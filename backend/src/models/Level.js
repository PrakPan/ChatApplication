const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  currentLevel: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  totalCallDuration: {
    type: Number,
    default: 0
  },
  experiencePoints: {
    type: Number,
    default: 0
  },
  nextLevelXP: {
    type: Number,
    default: 1000
  }
}, {
  timestamps: true
});

levelSchema.index({ userId: 1 });
levelSchema.index({ currentLevel: -1 });

module.exports = mongoose.model('Level', levelSchema);