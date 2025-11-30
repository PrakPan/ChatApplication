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
  ratePerMinute: {
    type: Number,
    required: [true, 'Rate per minute is required'],
    default: 50,
    min: [10, 'Rate must be at least 10 coins per minute']
  },
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
  bankDetails: {
    accountName: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String
  },
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

// Index for better query performance on online status and last seen
hostSchema.index({ isOnline: 1, lastSeen: -1 });
hostSchema.index({ userId: 1, isOnline: 1 });

// Virtual to get approved photos count
hostSchema.virtual('approvedPhotosCount').get(function() {
  return this.photos.filter(photo => photo.approvalStatus === 'approved').length;
});

// Method to check if host can go online
hostSchema.methods.canGoOnline = function() {
  return this.status === 'approved' && this.approvedPhotosCount >= 3;
};

// Pre-save hook to update lastSeen when going offline
hostSchema.pre('save', function(next) {
  // Auto-approve host if they have 3+ approved photos
  if (this.isModified('photos')) {
    const approvedCount = this.photos.filter(photo => photo.approvalStatus === 'approved').length;
    if (approvedCount >= 3 && this.status === 'pending') {
      this.status = 'approved';
    }
  }
  
  // Update lastSeen when going offline
  if (this.isModified('isOnline') && !this.isOnline) {
    this.lastSeen = new Date();
  }
  
  next();
});

module.exports = mongoose.model('Host', hostSchema);