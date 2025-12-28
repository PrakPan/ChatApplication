const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['purchase', 'call_debit', 'call_credit', 'withdrawal', 'refund','gift_debit','gift_credit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  coins: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: {
    type: String
  },
  orderId: {
    type: String
  },
  paymentMethod: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  callId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Call'
  },
  description: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
// transactionSchema.index({ userId: 1, createdAt: -1 });
// transactionSchema.index({ type: 1, status: 1 });
// transactionSchema.index({ paymentId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);