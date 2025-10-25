const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Host',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [100, 'Minimum withdrawal amount is 100']
  },
  coins: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'rejected'],
    default: 'pending'
  },
  bankDetails: {
    accountName: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    upiId: String
  },
  transactionId: {
    type: String
  },
  processedAt: {
    type: Date
  },
  notes: {
    type: String
  },
  rejectionReason: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
// withdrawalSchema.index({ hostId: 1, createdAt: -1 });
// withdrawalSchema.index({ status: 1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);