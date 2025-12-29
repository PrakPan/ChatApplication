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

  if (languages) {
    query.languages = { $in: languages.split(',') };
  }

  let hosts = await Host.find(query)
    .populate('userId', 'name avatar')
    .sort({ rating: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Get levels and apply dynamic rates
  const hostUserIds = hosts.map(h => h.userId._id);
  const levels = await Level.find({ userId: { $in: hostUserIds } });
  const levelMap = {};
  levels.forEach(l => {
    levelMap[l.userId.toString()] = {
      charmLevel: l.charmLevel,
      richLevel: l.richLevel,
      ratePerMinute: l.getRatePerMinute()
    };
  });

  // Apply dynamic rates and filter by rate if specified
  hosts = hosts.map(host => {
    const levelData = levelMap[host.userId._id.toString()];
    const dynamicRate = levelData?.ratePerMinute || host.ratePerMinute;
    
    return {
      ...host,
      ratePerMinute: dynamicRate, // Override with dynamic rate
      charmLevel: levelData?.charmLevel || 1,
      richLevel: levelData?.richLevel || 1
    };
  });

  // Filter by rate range if specified
  if (minRate || maxRate) {
    hosts = hosts.filter(host => {
      const rate = host.ratePerMinute;
      if (minRate && rate < Number(minRate)) return false;
      if (maxRate && rate > Number(maxRate)) return false;
      return true;
    });
  }

  // Filter by search if specified
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

// REPLACE getHostDetails function
const getHostDetails = asyncHandler(async (req, res) => {
  const { hostId } = req.params;

  const host = await Host.findById(hostId)
    .populate('userId', 'name avatar email role country dob')
    .lean();
  
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  // Calculate age from dob
  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  // Get host statistics
  const totalCalls = await Call.countDocuments({ 
    hostId: host._id, 
    status: 'completed' 
  });

  const avgRating = await Call.aggregate([
    { $match: { hostId: host._id, rating: { $exists: true } } },
    { $group: { _id: null, avgRating: { $avg: '$rating' } } }
  ]);

  // Get level info and dynamic rate
  const level = await Level.findOne({ userId: host.userId._id });
  const dynamicRate = level ? level.getRatePerMinute() : host.ratePerMinute;

  // Frame URLs for charm levels
  const charmLevels = [
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946168/host-photos/Level_C1_te3wbx.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946168/host-photos/Level_C2_mwkvs1.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946168/host-photos/Level_C3_nsjdio.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946168/host-photos/Level_C4_x7pmj9.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946169/host-photos/Level_C5_bhuerp.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946169/host-photos/Level_C6_jmcyaf.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946169/host-photos/Level_C7_s1oxmf.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946169/host-photos/Level_C8_saltqc.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946170/host-photos/Level_C9_x2fmat.png"
  ];

  // Determine frameUrl based on charm level
  const currentCharmLevel = level?.charmLevel || 1;
  const frameIndex = currentCharmLevel - 1;
  const frameUrl = charmLevels[frameIndex] || charmLevels[0];

  // Calculate age
  const age = calculateAge(host.userId.dob);
  const country = host.userId.country || null;

  const stats = {
    totalCalls,
    avgRating: avgRating[0]?.avgRating || 0,
    charmLevel: currentCharmLevel,
    richLevel: level?.richLevel || 1,
    totalBeansEarned: level?.totalBeansEarned || 0,
    currentRate: dynamicRate
  };

  ApiResponse.success(res, 200, 'Host details retrieved', { 
    host: {
      ...host,
      ratePerMinute: dynamicRate,
      frameUrl,
      age,
      country,
      userId: {
        ...host.userId,
        frameUrl
      }
    }, 
    stats 
  });
});

const getHostLevelInfo = asyncHandler(async (req, res) => {
  const host = await Host.findOne({ userId: req.user._id });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  const level = await Level.findOne({ userId: req.user._id });
  if (!level) {
    throw new ApiError(404, 'Level data not found');
  }

  const currentRate = level.getRatePerMinute();
  const nextCharmLevel = Level.getBeansForNextCharmLevel(level.totalBeansEarned);
  const nextRichLevel = Level.getDiamondsForNextRichLevel(level.totalDiamondsRecharged);

  ApiResponse.success(res, 200, 'Host level info retrieved', {
    charmLevel: level.charmLevel,
    richLevel: level.richLevel,
    totalBeansEarned: level.totalBeansEarned,
    totalDiamondsRecharged: level.totalDiamondsRecharged,
    currentRatePerMinute: currentRate,
    nextCharmLevel,
    nextRichLevel,
    rateThresholds: Level.RATE_BY_CHARM_LEVEL
  });
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

const toggleHostOnlineStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { forceOffline } = req.body;
  
  const user = await User.findById(userId);

  // Find host profile
  const host = await Host.findOne({ userId });
  
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  // ============ NEW: Handle forceOffline (tab close/logout) ============
  if (forceOffline === true) {
    if (host.isOnline) {
      // End the current online session
      const sessionDuration = await endHostOnlineSession(host);
      
      host.isOnline = false;
      host.lastSeen = new Date();
      await host.save();
      
    
  if (req.io) {
    io.emit("host:status-changed", {
      hostId: host._id,
      userId: host.userId,
      isOnline: host.isOnline,
      timestamp: new Date()
    });
  }
      
      logger.info(`Host force offline: ${req.user.email} - Session duration: ${sessionDuration}s`);
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

  // ============ NEW: Start/End online session ============
  if (host.isOnline) {
    // Going offline
    const sessionDuration = await endHostOnlineSession(host);
    
    host.isOnline = false;
    host.lastSeen = new Date();
    await host.save();

    // Emit socket event
    if (req.io) {
      req.io.emit('host:offline', { 
        hostId: host._id,
        userId: host.userId 
      });
    }

    logger.info(`Host went offline: ${req.user.email} - Session: ${sessionDuration}s`);

    return ApiResponse.success(res, 200, 'Host is now offline', {
      isOnline: false,
      sessionDuration,
      host: {
        ...host.toObject(),
        userId: host.userId
      }
    });
  } else {
    // Going online
    await startHostOnlineSession(host);
    
    host.isOnline = true;
    await host.save();

    // Emit socket event
    if (req.io) {
      req.io.emit('host:online', { 
        hostId: host._id,
        userId: host.userId 
      });
    }

    logger.info(`Host went online: ${req.user.email}`);

    return ApiResponse.success(res, 200, 'Host is now online', {
      isOnline: true,
      host: {
        ...host.toObject(),
        userId: host.userId
      }
    });
  }
});

// ============================================
// ADD these helper functions to hostController.js
// ============================================

/**
 * Start online session for host
 */
const startHostOnlineSession = async (host) => {
  if (!host.onlineTimeLogs) {
    host.onlineTimeLogs = [];
  }
  
  host.onlineTimeLogs.push({
    startTime: new Date(),
    endTime: null,
    duration: 0
  });
  
  await host.save();
  
  logger.info(`Online session started for host ${host._id}`);
  return true;
};

/**
 * End online session for host and return duration
 */
const endHostOnlineSession = async (host) => {
  if (!host.onlineTimeLogs || host.onlineTimeLogs.length === 0) {
    return 0;
  }
  
  // Find the last active session (without endTime)
  const activeSession = host.onlineTimeLogs[host.onlineTimeLogs.length - 1];
  
  if (activeSession && !activeSession.endTime) {
    activeSession.endTime = new Date();
    activeSession.duration = Math.floor((activeSession.endTime - activeSession.startTime) / 1000);
    
    await host.save();
    
    logger.info(`Online session ended for host ${host._id}. Duration: ${activeSession.duration}s`);
    
    return activeSession.duration;
  }
  
  return 0;
};

/**
 * Calculate total online time for today
 */
const calculateTodayOnlineTime = async (hostId) => {
  const host = await Host.findById(hostId).select('onlineTimeLogs');
  
  if (!host || !host.onlineTimeLogs || host.onlineTimeLogs.length === 0) {
    return 0;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  let totalOnlineTime = 0;

  for (const log of host.onlineTimeLogs) {
    if (!log.startTime) continue;

    const sessionStart = new Date(log.startTime);
    
    // Skip sessions that started before today
    if (sessionStart < todayStart) continue;
    
    // If session is still active (no end time)
    if (!log.endTime) {
      const now = new Date();
      if (now > todayStart) {
        totalOnlineTime += Math.floor((now - sessionStart) / 1000);
      }
    } else {
      // Completed session
      const sessionEnd = new Date(log.endTime);
      if (sessionEnd >= todayStart && sessionStart <= todayEnd) {
        const start = sessionStart > todayStart ? sessionStart : todayStart;
        const end = sessionEnd < todayEnd ? sessionEnd : todayEnd;
        totalOnlineTime += Math.floor((end - start) / 1000);
      }
    }
  }

  return totalOnlineTime;
};


const getTodayOnlineTime = asyncHandler(async (req, res) => {
  const host = await Host.findOne({ userId: req.user._id });
  
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  const todayOnlineTime = await calculateTodayOnlineTime(host._id);
  
  // Format time for display
  const hours = Math.floor(todayOnlineTime / 3600);
  const minutes = Math.floor((todayOnlineTime % 3600) / 60);
  const seconds = todayOnlineTime % 60;
  
  ApiResponse.success(res, 200, 'Today online time retrieved', {
    todayOnlineTime,
    isOnline: host.isOnline,
    formattedTime: `${hours}h ${minutes}m ${seconds}s`
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
  saveHostPhotos,
  getHostLevelInfo,
  getTodayOnlineTime, // NEW
  calculateTodayOnlineTime //
};