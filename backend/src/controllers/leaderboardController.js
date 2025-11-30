const WeeklyLeaderboard = require('../models/WeeklyLeaderboard');
const Level = require('../models/Level');
const Host = require('../models/Host');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

// Get current week's leaderboard
const getWeeklyLeaderboard = asyncHandler(async (req, res) => {
  const { type = 'both' } = req.query;

  // Get current week boundaries
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const buildLeaderboard = async (userType) => {
    const leaderboard = await WeeklyLeaderboard.find({
      userType,
      weekStartDate: weekStart
    })
      .populate('userId', 'name email avatar')
      .sort({ totalCallDuration: -1 })
      .limit(50)
      .lean();

    // Get level information
    const userIds = leaderboard.map(l => l.userId?._id).filter(Boolean);
    const levels = await Level.find({ userId: { $in: userIds } });
    const levelMap = {};
    levels.forEach(l => {
      levelMap[l.userId.toString()] = {
        richLevel: l.richLevel,
        charmLevel: l.charmLevel
      };
    });

    // For hosts, get their host profile info
    let hostMap = {};
    if (userType === 'host') {
      const hosts = await Host.find({ userId: { $in: userIds } }).lean();
      hosts.forEach(h => {
        hostMap[h.userId.toString()] = {
          rating: h.rating,
          totalCalls: h.totalCalls
        };
      });
    }

    return leaderboard.map((entry, index) => {
      const userId = entry.userId?._id?.toString();
      const levelData = levelMap[userId] || { richLevel: 1, charmLevel: 1 };
      const hostData = hostMap[userId] || {};

      return {
        ...entry,
        rank: index + 1,
        richLevel: levelData.richLevel,
        charmLevel: userType === 'host' ? levelData.charmLevel : undefined,
        rating: hostData.rating,
        totalCallsOverall: hostData.totalCalls
      };
    });
  };

  const result = {};

  if (type === 'user' || type === 'both') {
    result.users = await buildLeaderboard('user');
  }

  if (type === 'host' || type === 'both') {
    result.hosts = await buildLeaderboard('host');
  }

  ApiResponse.success(res, 200, 'Weekly leaderboard retrieved', {
    weekStart,
    weekEnd,
    ...result
  });
});

// Get user's leaderboard position
const getMyLeaderboardPosition = asyncHandler(async (req, res) => {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // Determine user type
  const host = await Host.findOne({ userId: req.user._id });
  const userType = host ? 'host' : 'user';

  // Get user's entry
  const myEntry = await WeeklyLeaderboard.findOne({
    userId: req.user._id,
    userType,
    weekStartDate: weekStart
  }).lean();

  if (!myEntry) {
    return ApiResponse.success(res, 200, 'No leaderboard entry for this week', {
      rank: null,
      totalCallDuration: 0,
      totalCalls: 0
    });
  }

  // Calculate rank
  const rank = await WeeklyLeaderboard.countDocuments({
    userType,
    weekStartDate: weekStart,
    totalCallDuration: { $gt: myEntry.totalCallDuration }
  }) + 1;

  // Get level info
  const level = await Level.findOne({ userId: req.user._id });

  ApiResponse.success(res, 200, 'Your leaderboard position', {
    rank,
    totalCallDuration: myEntry.totalCallDuration,
    totalCalls: myEntry.totalCalls,
    richLevel: level?.richLevel || 1,
    charmLevel: userType === 'host' ? (level?.charmLevel || 1) : undefined
  });
});

// Get leaderboard history (previous weeks)
const getLeaderboardHistory = asyncHandler(async (req, res) => {
  const { type = 'user', weeksAgo = 1 } = req.query;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() - (7 * weeksAgo));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const leaderboard = await WeeklyLeaderboard.find({
    userType: type,
    weekStartDate: weekStart
  })
    .populate('userId', 'name email avatar')
    .sort({ totalCallDuration: -1 })
    .limit(50)
    .lean();

  const userIds = leaderboard.map(l => l.userId?._id).filter(Boolean);
  const levels = await Level.find({ userId: { $in: userIds } });
  const levelMap = {};
  levels.forEach(l => {
    levelMap[l.userId.toString()] = {
      richLevel: l.richLevel,
      charmLevel: l.charmLevel
    };
  });

  const leaderboardWithLevels = leaderboard.map((entry, index) => {
    const userId = entry.userId?._id?.toString();
    const levelData = levelMap[userId] || { richLevel: 1, charmLevel: 1 };

    return {
      ...entry,
      rank: index + 1,
      richLevel: levelData.richLevel,
      charmLevel: type === 'host' ? levelData.charmLevel : undefined
    };
  });

  ApiResponse.success(res, 200, 'Leaderboard history retrieved', {
    weekStart,
    weekEnd,
    leaderboard: leaderboardWithLevels
  });
});

module.exports = {
  getWeeklyLeaderboard,
  getMyLeaderboardPosition,
  getLeaderboardHistory
};