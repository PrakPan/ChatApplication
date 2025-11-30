const Follow = require('../models/Follow');
const User = require('../models/User');
const Host = require('../models/Host');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// Follow a host
const followHost = asyncHandler(async (req, res) => {
  const { hostId } = req.body;

  // Check if trying to follow self
  if (hostId === req.user._id.toString()) {
    throw new ApiError(400, 'Cannot follow yourself');
  }

  // Check if host exists
  const host = await Host.findOne({ userId: hostId });
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  // Check if already following
  const existingFollow = await Follow.findOne({
    followerId: req.user._id,
    followingId: hostId
  });

  if (existingFollow) {
    throw new ApiError(400, 'Already following this host');
  }

  // Create follow
  await Follow.create({
    followerId: req.user._id,
    followingId: hostId,
    followingType: 'host'
  });

  logger.info(`User ${req.user.email} followed host ${hostId}`);

  ApiResponse.success(res, 200, 'Host followed successfully');
});

// Unfollow a host
const unfollowHost = asyncHandler(async (req, res) => {
  const { hostId } = req.params;

  const follow = await Follow.findOneAndDelete({
    followerId: req.user._id,
    followingId: hostId
  });

  if (!follow) {
    throw new ApiError(404, 'Follow relationship not found');
  }

  logger.info(`User ${req.user.email} unfollowed host ${hostId}`);

  ApiResponse.success(res, 200, 'Host unfollowed successfully');
});

// Get followers list
const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const targetUserId = userId || req.user._id;

  const followers = await Follow.find({ followingId: targetUserId })
    .populate('followerId', 'name avatar email')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  const total = await Follow.countDocuments({ followingId: targetUserId });

  const followersList = followers.map(f => f.followerId);

  ApiResponse.success(res, 200, 'Followers retrieved', {
    followers: followersList,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get following list
const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const targetUserId = userId || req.user._id;

  const following = await Follow.find({ followerId: targetUserId })
    .populate({
      path: 'followingId',
      select: 'name avatar email role'
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  const total = await Follow.countDocuments({ followerId: targetUserId });

  // Get host details if following a host
  const followingList = await Promise.all(
    following.map(async (f) => {
      const user = f.followingId;
      if (f.followingType === 'host') {
        const host = await Host.findOne({ userId: user._id })
          .select('ratePerMinute rating totalCalls')
          .lean();
        return {
          ...user,
          hostDetails: host
        };
      }
      return user;
    })
  );

  ApiResponse.success(res, 200, 'Following retrieved', {
    following: followingList,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Check if following a host
const checkFollowing = asyncHandler(async (req, res) => {
  const { hostId } = req.params;

  const isFollowing = await Follow.isFollowing(req.user._id, hostId);

  ApiResponse.success(res, 200, 'Follow status retrieved', { isFollowing });
});

// Get follow stats
const getFollowStats = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const targetUserId = userId || req.user._id;

  const [followersCount, followingCount] = await Promise.all([
    Follow.getFollowerCount(targetUserId),
    Follow.getFollowingCount(targetUserId)
  ]);

  ApiResponse.success(res, 200, 'Follow stats retrieved', {
    followersCount,
    followingCount
  });
});

module.exports = {
  followHost,
  unfollowHost,
  getFollowers,
  getFollowing,
  checkFollowing,
  getFollowStats
};