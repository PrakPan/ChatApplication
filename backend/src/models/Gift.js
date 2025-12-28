const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema({
  callId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Call',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Host',
    required: true
  },
  giftType: {
    type: String,
    required: true,
    enum: ['teddy', 'balloons', 'race', 'cake', 'bouquet', 'kiss', 'sensual', 'dhanteras']
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  coinsSpent: {
    type: Number,
    required: true,
    min: 0
  },
  diamondsEarned: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
giftSchema.index({ callId: 1, createdAt: -1 });
giftSchema.index({ senderId: 1, createdAt: -1 });
giftSchema.index({ recipientId: 1, createdAt: -1 });
giftSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Gift', giftSchema);