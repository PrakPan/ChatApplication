const Host = require('../models/Host');
const User = require('../models/User');
const Call = require('../models/Call');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { uploadToCloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');
const Level = require('../models/Level');

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
    // isOnline: true,
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

const getAllHosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', status, isOnline } = req.query;

  const query = {};
  if (status) query.status = status;
  // if (isOnline !== undefined) query.isOnline = isOnline === 'true';

  if (req.user?.role === "host") {
    query.userId = { $ne: req.user._id };
  }

  const sortOrder = { isOnline: -1, createdAt: -1 };


  const hosts = await Host.find(query)
    .populate('userId', 'name email phone avatar userId')
    .sort(sortOrder)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Filter by search if provided
  let filteredHosts = hosts;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredHosts = hosts.filter(h => 
      h.userId?.name?.toLowerCase().includes(searchLower) ||
      h.userId?.email?.toLowerCase().includes(searchLower) ||
      h._id.toString().includes(search)
    );
  }

  // Populate with level information
  const userIds = filteredHosts.map(h => h.userId?._id).filter(Boolean);
  const levels = await Level.find({ userId: { $in: userIds } });
  const levelMap = {};
  levels.forEach(l => {
    levelMap[l.userId.toString()] = l.currentLevel;
  });

  const hostsWithLevel = filteredHosts.map(h => ({
    ...h,
    level: levelMap[h.userId?._id?.toString()] || 1
  }));

  const total = await Host.countDocuments(query);

  ApiResponse.success(res, 200, 'Hosts retrieved', {
    hosts: hostsWithLevel,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Toggle host online/offline status
const toggleHostOnlineStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { forceOffline } = req.body;
  
  const user = await User.findById(userId);

  // Check if user is a host
  if (user.role !== 'host') {
    throw new ApiError(403, 'Only hosts can toggle online status');
  }

  // Find host profile
  const host = await Host.findOne({ userId });
  
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  // If forceOffline is true, set to offline regardless of current state
  if (forceOffline === true) {
    if (host.isOnline) {
      host.isOnline = false;
      host.lastSeen = new Date();
      await host.save();
      
      // Emit socket event if socket.io is available
      if (req.io) {
        req.io.emit('host:offline', { 
          hostId: host._id,
          userId: host.userId 
        });
      }
      
      logger.info(`Host force offline: ${req.user.email}`);
    }
    
    return ApiResponse.success(res, 200, 'Host is now offline', {
      isOnline: false,
      host: {
        ...host.toObject(),
        userId: host.userId
      }
    });
  }

  // Check if host is approved (only when trying to go online)
  if (!host.isOnline && host.status !== 'approved') {
    throw new ApiError(403, 'Host profile must be approved to go online');
  }

  // Check if host has uploaded at least one photo
  if (!host.isOnline && (!host.photos || host.photos.length === 0)) {
    throw new ApiError(403, 'Please upload at least one photo before going online');
  }

  // Toggle the online status normally
  host.isOnline = !host.isOnline;
  
  // Update lastSeen when going offline
  if (!host.isOnline) {
    host.lastSeen = new Date();
  }
  
  await host.save();

  // Emit socket event
  if (req.io) {
    if (host.isOnline) {
      req.io.emit('host:online', { 
        hostId: host._id,
        userId: host.userId 
      });
    } else {
      req.io.emit('host:offline', { 
        hostId: host._id,
        userId: host.userId 
      });
    }
  }

  logger.info(`Host online status updated: ${req.user.email} - ${host.isOnline ? 'online' : 'offline'}`);

  ApiResponse.success(res, 200, `Host is now ${host.isOnline ? 'online' : 'offline'}`, {
    isOnline: host.isOnline,
    host: {
      ...host.toObject(),
      userId: host.userId
    }
  });
});

// Get specific host by ID
const getHostById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const host = await Host.findById(id).populate('userId', 'name email phone avatar');
  
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  // Get level information
  const level = await Level.findOne({ userId: host.userId._id });

  ApiResponse.success(res, 200, 'Host retrieved', {
    host: {
      ...host.toObject(),
      level: level?.currentLevel || 1
    }
  });
});


const saveHostPhotos = asyncHandler(async (req, res) => {
  console.log('Request body:', req.body);
  
  let { photos } = req.body;

  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    throw new ApiError(400, 'No photo URLs provided');
  }

  // Validate that all items are strings (URLs)
  const allStrings = photos.every(photo => typeof photo === 'string');
  if (!allStrings) {
    throw new ApiError(400, 'All photos must be URL strings');
  }

  const host = await Host.findOne({ userId: req.user._id });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  // Push each URL as a subdocument with approval status
  photos.forEach(url => {
    host.photos.push({
      url: url.trim(),
      approvalStatus: 'pending',
      uploadedAt: new Date()
    });
  });

  // Save the document
  await host.save();

  logger.info(`Host photos saved: ${req.user.email} - ${photos.length} photos`);

  ApiResponse.success(res, 200, 'Photos saved successfully', { photos: host.photos });
});

module.exports = {
  createHostProfile,
  updateHostProfile,
  uploadHostPhotos,
  updateOnlineStatus,
  getOnlineHosts,
  getHostDetails,
  getHostEarnings,
  getHostCallHistory,
  toggleHostOnlineStatus,
  getHostById,
  getAllHosts,
  saveHostPhotos
};