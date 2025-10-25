const Host = require('../models/Host');
const User = require('../models/User');
const Call = require('../models/Call');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { uploadToCloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');

const createHostProfile = asyncHandler(async (req, res) => {
  const { bio, ratePerMinute, languages, interests, bankDetails } = req.body;

  // Check if host profile already exists
  const existingHost = await Host.findOne({ userId: req.user._id });
  if (existingHost) {
    throw new ApiError(400, 'Host profile already exists');
  }

  // Update user role to host
  await User.findByIdAndUpdate(req.user._id, { role: 'host' });

  // Create host profile
  const host = await Host.create({
    userId: req.user._id,
    bio,
    ratePerMinute,
    languages,
    interests,
    bankDetails,
    status: 'pending'
  });

  logger.info(`Host profile created: ${req.user.email}`);

  ApiResponse.success(res, 201, 'Host profile created successfully', { host });
});

const updateHostProfile = asyncHandler(async (req, res) => {
  const { bio, ratePerMinute, languages, interests, bankDetails } = req.body;

  const host = await Host.findOne({ userId: req.user._id });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  if (bio !== undefined) host.bio = bio;
  if (ratePerMinute !== undefined) host.ratePerMinute = ratePerMinute;
  if (languages !== undefined) host.languages = languages;
  if (interests !== undefined) host.interests = interests;
  if (bankDetails !== undefined) host.bankDetails = { ...host.bankDetails, ...bankDetails };

  await host.save();

  logger.info(`Host profile updated: ${req.user.email}`);

  ApiResponse.success(res, 200, 'Host profile updated successfully', { host });
});

const uploadHostPhotos = asyncHandler(async (req, res) => {
  const host = await Host.findOne({ userId: req.user._id });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'No files uploaded');
  }

  const uploadPromises = req.files.map(file => 
    uploadToCloudinary(file.path, 'host-photos')
  );

  const photoUrls = await Promise.all(uploadPromises);
  host.photos = [...host.photos, ...photoUrls];
  await host.save();

  logger.info(`Host photos uploaded: ${req.user.email}`);

  ApiResponse.success(res, 200, 'Photos uploaded successfully', { photos: host.photos });
});

const updateOnlineStatus = asyncHandler(async (req, res) => {
  const { isOnline } = req.body;

  const host = await Host.findOne({ userId: req.user._id });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  if (host.status !== 'approved') {
    throw new ApiError(403, 'Host profile must be approved to go online');
  }

  host.isOnline = isOnline;
  await host.save();

  logger.info(`Host online status updated: ${req.user.email} - ${isOnline}`);

  ApiResponse.success(res, 200, 'Online status updated', { isOnline: host.isOnline });
});

const getOnlineHosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', minRate, maxRate, languages } = req.query;

  const query = {
    isOnline: true,
    status: 'approved'
  };

  if (minRate || maxRate) {
    query.ratePerMinute = {};
    if (minRate) query.ratePerMinute.$gte = Number(minRate);
    if (maxRate) query.ratePerMinute.$lte = Number(maxRate);
  }

  if (languages) {
    query.languages = { $in: languages.split(',') };
  }

  const hosts = await Host.find(query)
    .populate('userId', 'name avatar')
    .sort({ rating: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    hosts = hosts.filter(host => 
      host.userId.name.match(searchRegex) || 
      host.bio?.match(searchRegex)
    );
  }

  const total = await Host.countDocuments(query);

  ApiResponse.success(res, 200, 'Hosts retrieved successfully', {
    hosts,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      limit: Number(limit)
    }
  });
});

const getHostDetails = asyncHandler(async (req, res) => {
  const { hostId } = req.params;

  const host = await Host.findById(hostId).populate('userId', 'name avatar email');
  
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  // Get host statistics
  const totalCalls = await Call.countDocuments({ 
    hostId: host._id, 
    status: 'completed' 
  });

  const avgRating = await Call.aggregate([
    { $match: { hostId: host._id, rating: { $exists: true } } },
    { $group: { _id: null, avgRating: { $avg: '$rating' } } }
  ]);

  const stats = {
    totalCalls,
    avgRating: avgRating[0]?.avgRating || 0
  };

  ApiResponse.success(res, 200, 'Host details retrieved', { host, stats });
});

const getHostEarnings = asyncHandler(async (req, res) => {
  const host = await Host.findOne({ userId: req.user._id });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  const earnings = {
    total: host.totalEarnings,
    thisMonth: 0,
    lastMonth: 0,
    pending: 0
  };

  // Calculate monthly earnings
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonthCalls = await Call.find({
    hostId: host._id,
    status: 'completed',
    createdAt: { $gte: startOfMonth }
  });

  const lastMonthCalls = await Call.find({
    hostId: host._id,
    status: 'completed',
    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
  });

  earnings.thisMonth = thisMonthCalls.reduce((sum, call) => 
    sum + (call.coinsSpent * 0.7), 0
  );

  earnings.lastMonth = lastMonthCalls.reduce((sum, call) => 
    sum + (call.coinsSpent * 0.7), 0
  );

  ApiResponse.success(res, 200, 'Earnings retrieved successfully', earnings);
});

const getHostCallHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const host = await Host.findOne({ userId: req.user._id });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  const query = { hostId: host._id };
  if (status) query.status = status;

  const calls = await Call.find(query)
    .populate('userId', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Call.countDocuments(query);

  ApiResponse.success(res, 200, 'Call history retrieved', {
    calls,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

module.exports = {
  createHostProfile,
  updateHostProfile,
  uploadHostPhotos,
  updateOnlineStatus,
  getOnlineHosts,
  getHostDetails,
  getHostEarnings,
  getHostCallHistory
};