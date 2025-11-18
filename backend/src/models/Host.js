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
  }]
}, {
  timestamps: true
});

// Virtual to get approved photos count
hostSchema.virtual('approvedPhotosCount').get(function() {
  return this.photos.filter(photo => photo.approvalStatus === 'approved').length;
});

// Method to check if host can go online
hostSchema.methods.canGoOnline = function() {
  return this.status === 'approved' && this.approvedPhotosCount >= 3;
};

// Pre-save hook to auto-approve host if they have 3+ approved photos
hostSchema.pre('save', function(next) {
  if (this.isModified('photos')) {
    const approvedCount = this.photos.filter(photo => photo.approvalStatus === 'approved').length;
    if (approvedCount >= 3 && this.status === 'pending') {
      this.status = 'approved';
    }
  }
  next();
});

module.exports = mongoose.model('Host', hostSchema);