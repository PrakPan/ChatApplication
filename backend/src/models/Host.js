const mongoose = require('mongoose');

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
  photos: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
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

// Index for faster queries
// hostSchema.index({ userId: 1 });
// hostSchema.index({ isOnline: 1, status: 1 });
// hostSchema.index({ rating: -1 });

module.exports = mongoose.model('Host', hostSchema);