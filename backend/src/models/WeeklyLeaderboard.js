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
  }
}, {
  timestamps: true
});

weeklyLeaderboardSchema.index({ userType: 1, weekStartDate: 1, totalCallDuration: -1 });
weeklyLeaderboardSchema.index({ userId: 1, weekStartDate: 1 });

module.exports = mongoose.model('WeeklyLeaderboard', weeklyLeaderboardSchema);