const mongoose = require('mongoose');

const weeklyLeaderboardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userType: {
    type: String,
    enum: ['user', 'host'],
    required: true
  },
  weekStartDate: {
    type: Date,
    required: true
  },
  weekEndDate: {
    type: Date,
    required: true
  },
  totalCallDuration: {
    type: Number,
    default: 0
  },
  totalCalls: {
    type: Number,
    default: 0
  },
  rank: {
    type: Number
  },
  // Reward tracking fields
  rewardDistributed: {
    type: Boolean,
    default: false
  },
  coinsAwarded: {
    type: Number,
    default: 0
  },
  diamondsAwarded: {
    type: Number,
    default: 0
  },
  rewardDistributedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for performance
weeklyLeaderboardSchema.index({ userType: 1, weekStartDate: 1, totalCallDuration: -1 });
weeklyLeaderboardSchema.index({ userId: 1, weekStartDate: 1 });
weeklyLeaderboardSchema.index({ weekStartDate: 1, rewardDistributed: 1 });
weeklyLeaderboardSchema.index({ weekStartDate: 1 }); // For cleanup queries

module.exports = mongoose.model('WeeklyLeaderboard', weeklyLeaderboardSchema);