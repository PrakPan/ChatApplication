const mongoose = require('mongoose');

const coinSellerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  diamondBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalDiamondsAllocated: {
    type: Number,
    default: 0
  },
  totalDiamondsDistributed: {
    type: Number,
    default: 0
  },
  totalDiamondsWithdrawn: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
coinSellerSchema.index({ userId: 1 });
coinSellerSchema.index({ isActive: 1 });

// Method to check if seller has enough diamonds
coinSellerSchema.methods.hasEnoughDiamonds = function(amount) {
  return this.diamondBalance >= amount;
};

// Method to deduct diamonds
coinSellerSchema.methods.deductDiamonds = async function(amount) {
  if (!this.hasEnoughDiamonds(amount)) {
    throw new Error('Insufficient diamond balance');
  }
  this.diamondBalance -= amount;
  this.totalDiamondsDistributed += amount;
  await this.save();
};

// Method to add diamonds
coinSellerSchema.methods.addDiamonds = async function(amount) {
  this.diamondBalance += amount;
  this.totalDiamondsAllocated += amount;
  await this.save();
};

// Method to withdraw diamonds
coinSellerSchema.methods.withdrawDiamonds = async function(amount) {
  if (!this.hasEnoughDiamonds(amount)) {
    throw new Error('Insufficient diamond balance for withdrawal');
  }
  this.diamondBalance -= amount;
  this.totalDiamondsWithdrawn += amount;
  await this.save();
};

module.exports = mongoose.model('CoinSeller', coinSellerSchema);