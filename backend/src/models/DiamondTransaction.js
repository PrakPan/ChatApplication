const mongoose = require('mongoose');

const diamondTransactionSchema = new mongoose.Schema({
  coinSellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CoinSeller',
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  type: {
    type: String,
    enum: ['allocation', 'distribution', 'withdrawal'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'withdrawn', 'expired'],
    default: 'completed'
  },
  canWithdraw: {
    type: Boolean,
    default: true
  },
  withdrawalDeadline: {
    type: Date,
    required: true
  },
  withdrawnAt: {
    type: Date
  },
  notes: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
diamondTransactionSchema.index({ coinSellerId: 1, createdAt: -1 });
diamondTransactionSchema.index({ recipientId: 1, createdAt: -1 });
diamondTransactionSchema.index({ status: 1, withdrawalDeadline: 1 });
diamondTransactionSchema.index({ canWithdraw: 1, withdrawalDeadline: 1 });

// Method to check if withdrawal is still allowed
diamondTransactionSchema.methods.isWithdrawalAllowed = function() {
  return this.canWithdraw && 
         this.status === 'completed' && 
         new Date() <= this.withdrawalDeadline;
};

// Static method to get withdrawable transactions for a coin seller
diamondTransactionSchema.statics.getWithdrawableTransactions = async function(coinSellerId) {
  const now = new Date();
  return await this.find({
    coinSellerId,
    status: 'completed',
    canWithdraw: true,
    withdrawalDeadline: { $gte: now }
  }).populate('recipientId', 'name email coinBalance');
};

// Static method to mark expired transactions
diamondTransactionSchema.statics.markExpiredTransactions = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      status: 'completed',
      canWithdraw: true,
      withdrawalDeadline: { $lt: now }
    },
    {
      $set: { 
        status: 'expired',
        canWithdraw: false 
      }
    }
  );
  return result;
};

// Pre-save hook to set withdrawal deadline (24 hours from creation)
diamondTransactionSchema.pre('save', function(next) {
  if (this.isNew && this.type === 'distribution') {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 24);
    this.withdrawalDeadline = deadline;
  }
  next();
});

module.exports = mongoose.model('DiamondTransaction', diamondTransactionSchema);