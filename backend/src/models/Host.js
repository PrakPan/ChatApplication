const mongoose = require('mongoose');
const photoSchema = require('./photoSchema');

const hostSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  grade: {
    type: String,
    enum: ['D', 'C', 'B', 'A'],
    default: 'D'
  },
  ratePerMinute: {
    type: Number,
    required: [true, 'Rate per minute is required'],
    default: 800,
    min: [10, 'Rate must be at least 10 coins per minute']
  },
  callStatus: {
    type: String,
    enum: ['online', 'busy', 'offline'],
    default: 'offline'
  },
  currentCallId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Call',
    default: null
  },
  // ===============================================
  onlineTimeLogs: [{
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number, 
      default: 0
    }
  }],
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: null
  },
  isKycVerified: {
    type: Boolean,
    default: false
  },
  kycDocuments: {
    idType: String,
    idNumber: String,
    idFrontImage: String,
    idBackImage: String,
    selfieImage: String
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalCalls: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  photos: [photoSchema],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  rejectionReason: String,
  bankDetails: [{
    accountName: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String
  }],
  languages: [{
    type: String
  }],
  interests: [{
    type: String
  }],
  agentId: {
    type: String,
    uppercase: true,
    minlength: 5,
    maxlength: 5,
    default: null,
    index: true
  },
}, {
  timestamps: true
});

hostSchema.index({ agentId: 1 });
hostSchema.index({ isOnline: 1, lastSeen: -1 });
hostSchema.index({ userId: 1, isOnline: 1 });
hostSchema.index({ callStatus: 1 }); // NEW INDEX

hostSchema.methods.getRateByGrade = function() {
  const gradeRates = {
    'D': 800,
    'C': 900,
    'B': 1100,
    'A': 1200
  };
  return gradeRates[this.grade] || 800;
};

hostSchema.virtual('approvedPhotosCount').get(function() {
  return this.photos.filter(photo => photo.approvalStatus === 'approved').length;
});

// ============ NEW: Call Status Methods ============
hostSchema.methods.setCallBusy = async function(callId) {
  this.callStatus = 'busy';
  this.currentCallId = callId;
  await this.save();
  console.log(`Host ${this._id} is now busy on call ${callId}`);
};

hostSchema.methods.setCallAvailable = async function() {
  this.callStatus = this.isOnline ? 'available' : 'offline';
  this.currentCallId = null;
  await this.save();
  console.log(`Host ${this._id} is now ${this.callStatus}`);
};

hostSchema.methods.isAvailableForCall = function() {
  return this.isOnline && this.callStatus === 'available' && this.status === 'approved';
};
// ================================================

hostSchema.virtual('freeTargetEnabled').get(async function() {
  const FreeTarget = require('./FreeTarget');
  const freeTarget = await FreeTarget.findOne({ hostId: this._id });
  return freeTarget?.isEnabled || false;
});

hostSchema.methods.canGoOnline = function() {
  return this.status === 'approved' && this.approvedPhotosCount >= 3;
};

hostSchema.methods.startOnlineSession = async function() {
  if (this.isOnline) {
    return;
  }
  
  this.isOnline = true;
  this.callStatus = 'available'; // NEW: Set as available
  this.onlineTimeLogs.push({
    startTime: new Date(),
    endTime: null,
    duration: 0
  });
  
  await this.save();
  console.log(`Host ${this._id} went online at ${new Date()}`);
};

hostSchema.methods.endOnlineSession = async function() {
  if (!this.isOnline) {
    return;
  }
  
  this.isOnline = false;
  this.callStatus = 'offline'; // NEW: Set as offline
  this.currentCallId = null; // NEW: Clear call ID
  
  const activeSession = this.onlineTimeLogs[this.onlineTimeLogs.length - 1];
  
  if (activeSession && !activeSession.endTime) {
    activeSession.endTime = new Date();
    activeSession.duration = Math.floor((activeSession.endTime - activeSession.startTime) / 1000);
    
    await this.save();
    console.log(`Host ${this._id} went offline. Session duration: ${activeSession.duration}s`);
    
    return activeSession.duration;
  }
  
  await this.save();
};

hostSchema.methods.getTodayOnlineTime = function() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  
  let totalTime = 0;
  
  for (const log of this.onlineTimeLogs) {
    if (!log.startTime) continue;
    
    const sessionStart = new Date(log.startTime);
    
    if (sessionStart < todayStart) continue;
    
    if (!log.endTime) {
      const now = new Date();
      if (now > todayStart) {
        totalTime += Math.floor((now - sessionStart) / 1000);
      }
    } else {
      const sessionEnd = new Date(log.endTime);
      if (sessionEnd >= todayStart && sessionStart <= todayEnd) {
        const start = sessionStart > todayStart ? sessionStart : todayStart;
        const end = sessionEnd < todayEnd ? sessionEnd : todayEnd;
        totalTime += Math.floor((end - start) / 1000);
      }
    }
  }
  
  return totalTime;
};

// Host.js - Update pre-save hook
hostSchema.pre('save', function(next) {
  if (this.isModified('grade')) {
    this.ratePerMinute = this.getRateByGrade();
  }

  if (this.isModified('photos')) {
    const approvedCount = this.photos.filter(photo => photo.approvalStatus === 'approved').length;
    if (approvedCount >= 3 && this.status === 'pending') {
      this.status = 'approved';
    }
  }
  
  // Only update these when MANUALLY setting isOnline to false
  // Don't trigger on every save
  if (this.isModified('isOnline') && !this.isOnline) {
    // Only set offline status if not already set
    if (this.callStatus !== 'offline') {
      this.callStatus = 'offline';
      this.currentCallId = null;
    }
    // Only update lastSeen if not recently updated (within last minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    if (!this.lastSeen || this.lastSeen < oneMinuteAgo) {
      this.lastSeen = new Date();
    }
  }
  
  // Auto-update callStatus when going online
  if (this.isModified('isOnline') && this.isOnline) {
    if (this.callStatus === 'offline' || !this.callStatus) {
      this.callStatus = 'available';
    }
  }
  
  next();
});

module.exports = mongoose.model('Host', hostSchema);