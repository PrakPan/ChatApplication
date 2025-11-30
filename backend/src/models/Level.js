const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Rich Level (based on coins purchased/recharged)
  richLevel: {
    type: Number,
    default: 1,
    min: 1
  },
  totalDiamondsRecharged: {
    type: Number,
    default: 0
  },
  // Charm Level (only for hosts - based on beans earned)
  charmLevel: {
    type: Number,
    default: 1,
    min: 1
  },
  totalBeansEarned: {
    type: Number,
    default: 0
  },
  // Legacy fields for backward compatibility
  currentLevel: {
    type: Number,
    default: 1,
    min: 1
  },
  totalCallDuration: {
    type: Number,
    default: 0
  },
  experiencePoints: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
levelSchema.index({ userId: 1 });
levelSchema.index({ richLevel: -1 });
levelSchema.index({ charmLevel: -1 });
levelSchema.index({ totalDiamondsRecharged: -1 });
levelSchema.index({ totalBeansEarned: -1 });

// Rich Level Thresholds (Diamonds Recharged)
const RICH_LEVEL_THRESHOLDS = [
  { level: 1, diamonds: 0 },
  { level: 2, diamonds: 1000 },
  { level: 3, diamonds: 6000 },
  { level: 4, diamonds: 125000 },
  { level: 5, diamonds: 250000 },
  { level: 6, diamonds: 500000 },
  { level: 7, diamonds: 1000000 },
  { level: 8, diamonds: 2000000 },
  { level: 9, diamonds: 3125000 }
];

// Charm Level Thresholds (Beans Earned)
const CHARM_LEVEL_THRESHOLDS = [
  { level: 1, beans: 0 },
  { level: 2, beans: 1 },
  { level: 3, beans: 10 },
  { level: 4, beans: 1000000 },
  { level: 5, beans: 2000000 },
  { level: 6, beans: 2500000 },
  { level: 7, beans: 3000000 }
];

// Rate Per Minute based on Charm Level (in beans)
const RATE_BY_CHARM_LEVEL = {
  1: 50,
  2: 100,
  3: 150,
  4: 200,
  5: 250,
  6: 300,
  7: 350
};

// Method to calculate rich level based on diamonds recharged
levelSchema.methods.calculateRichLevel = function() {
  let newLevel = 1;
  for (let i = RICH_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (this.totalDiamondsRecharged >= RICH_LEVEL_THRESHOLDS[i].diamonds) {
      newLevel = RICH_LEVEL_THRESHOLDS[i].level;
      break;
    }
  }
  return newLevel;
};

// Method to calculate charm level based on beans earned
levelSchema.methods.calculateCharmLevel = function() {
  let newLevel = 1;
  for (let i = CHARM_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (this.totalBeansEarned >= CHARM_LEVEL_THRESHOLDS[i].beans) {
      newLevel = CHARM_LEVEL_THRESHOLDS[i].level;
      break;
    }
  }
  return newLevel;
};

// Method to get rate per minute based on charm level
levelSchema.methods.getRatePerMinute = function() {
  return RATE_BY_CHARM_LEVEL[this.charmLevel] || 50;
};

// Static method to get diamonds needed for next rich level
levelSchema.statics.getDiamondsForNextRichLevel = function(currentDiamonds) {
  for (let threshold of RICH_LEVEL_THRESHOLDS) {
    if (currentDiamonds < threshold.diamonds) {
      return {
        nextLevel: threshold.level,
        diamondsNeeded: threshold.diamonds - currentDiamonds,
        totalRequired: threshold.diamonds
      };
    }
  }
  return null; // Max level reached
};

// Static method to get beans needed for next charm level
levelSchema.statics.getBeansForNextCharmLevel = function(currentBeans) {
  for (let threshold of CHARM_LEVEL_THRESHOLDS) {
    if (currentBeans < threshold.beans) {
      return {
        nextLevel: threshold.level,
        beansNeeded: threshold.beans - currentBeans,
        totalRequired: threshold.beans
      };
    }
  }
  return null; // Max level reached
};

// Pre-save hook to auto-update levels
levelSchema.pre('save', function(next) {
  if (this.isModified('totalDiamondsRecharged')) {
    this.richLevel = this.calculateRichLevel();
  }
  if (this.isModified('totalBeansEarned')) {
    this.charmLevel = this.calculateCharmLevel();
  }
  next();
});

// Export constants for use in other files
levelSchema.statics.RICH_LEVEL_THRESHOLDS = RICH_LEVEL_THRESHOLDS;
levelSchema.statics.CHARM_LEVEL_THRESHOLDS = CHARM_LEVEL_THRESHOLDS;
levelSchema.statics.RATE_BY_CHARM_LEVEL = RATE_BY_CHARM_LEVEL;

module.exports = mongoose.model('Level', levelSchema);