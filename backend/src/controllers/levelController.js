const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getRichLevels = asyncHandler(async (req, res) => {
  const richLevels = [
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

  ApiResponse.success(res, 200, 'Rich levels retrieved successfully', {
    levels: richLevels
  });
});

/**
 * Get Charm Level Configuration
 * @route GET /api/v1/levels/charm
 * @access Public
 */
const getCharmLevels = asyncHandler(async (req, res) => {
  const charmLevels = [
    { level: 1, beans: 0, rate: 50 },
    { level: 2, beans: 1, rate: 100 },
    { level: 3, beans: 10, rate: 150 },
    { level: 4, beans: 1000000, rate: 200 },
    { level: 5, beans: 2000000, rate: 250 },
    { level: 6, beans: 2500000, rate: 300 },
    { level: 7, beans: 3000000, rate: 350 }
  ];

  ApiResponse.success(res, 200, 'Charm levels retrieved successfully', {
    levels: charmLevels
  });
});

/**
 * Get All Level Configurations
 * @route GET /api/v1/levels/all
 * @access Public
 */
const getAllLevels = asyncHandler(async (req, res) => {
  const richLevels = [
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

  const charmLevels = [
    { level: 1, beans: 0, rate: 50 },
    { level: 2, beans: 1, rate: 100 },
    { level: 3, beans: 10, rate: 150 },
    { level: 4, beans: 1000000, rate: 200 },
    { level: 5, beans: 2000000, rate: 250 },
    { level: 6, beans: 2500000, rate: 300 },
    { level: 7, beans: 3000000, rate: 350 }
  ];

  ApiResponse.success(res, 200, 'All levels retrieved successfully', {
    richLevels,
    charmLevels
  });
});

/**
 * Get User's Current Level Progress
 * @route GET /api/v1/levels/progress
 * @access Private
 */
const getUserLevelProgress = asyncHandler(async (req, res) => {
  const Level = require('../models/Level');
  const User = require('../models/User');
  const Host = require('../models/Host');

  const userId = req.user._id;

  // Get user's level data
  let level = await Level.findOne({ userId });
  
  if (!level) {
    // Create default level if not exists
    level = await Level.create({
      userId,
      richLevel: 1,
      charmLevel: 1,
      totalDiamondsRecharged: 0,
      totalBeansEarned: 0
    });
  }

  const user = await User.findById(userId);
  const host = await Host.findOne({ userId });

  // Rich level calculations
  const richLevels = [
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

  const nextRichLevelData = richLevels.find(l => l.level === level.richLevel + 1);
  const nextRichLevel = nextRichLevelData ? {
    nextLevel: nextRichLevelData.level,
    total: nextRichLevelData.diamonds,
    needed: nextRichLevelData.diamonds - level.totalDiamondsRecharged
  } : null;

  // Charm level calculations
  const charmLevels = [
    { level: 1, beans: 0, rate: 50 },
    { level: 2, beans: 1, rate: 100 },
    { level: 3, beans: 10, rate: 150 },
    { level: 4, beans: 1000000, rate: 200 },
    { level: 5, beans: 2000000, rate: 250 },
    { level: 6, beans: 2500000, rate: 300 },
    { level: 7, beans: 3000000, rate: 350 }
  ];

  const nextCharmLevelData = charmLevels.find(l => l.level === level.charmLevel + 1);
  const nextCharmLevel = nextCharmLevelData ? {
    nextLevel: nextCharmLevelData.level,
    total: nextCharmLevelData.beans,
    needed: nextCharmLevelData.beans - level.totalBeansEarned
  } : null;

  ApiResponse.success(res, 200, 'User level progress retrieved', {
    userId: user._id,
    name: user.name,
    richLevel: {
      current: level.richLevel,
      totalDiamondsRecharged: level.totalDiamondsRecharged,
      next: nextRichLevel
    },
    charmLevel: {
      current: level.charmLevel,
      totalBeansEarned: level.totalBeansEarned,
      currentRate: host?.ratePerMinute || 50,
      next: nextCharmLevel
    }
  });
});

module.exports = {
  getRichLevels,
  getCharmLevels,
  getAllLevels,
  getUserLevelProgress
};