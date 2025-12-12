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
    min: [1000, 'Minimum withdrawal amount is 1000 diamonds']
  },
  coins: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  bankDetails: {
    accountName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true
    },
    bankName: {
      type: String,
      required: true
    },
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

// Indexes for better query performance
withdrawalSchema.index({ hostId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ createdAt: -1 });

// Virtual to format amount
withdrawalSchema.virtual('formattedAmount').get(function() {
  return `₹${this.amount.toLocaleString('en-IN')}`;
});

// Method to check if withdrawal can be cancelled
withdrawalSchema.methods.canBeCancelled = function() {
  return this.status === 'pending';
};

// Static method to get pending withdrawals count
withdrawalSchema.statics.getPendingCount = async function() {
  return await this.countDocuments({ status: 'pending' });
};

module.exports = mongoose.model('Withdrawal', withdrawalSchema);