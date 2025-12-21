// ============================================
// 1. UPDATED CONTROLLER (freeTargetController.js)
// ============================================

const FreeTarget = require('../models/FreeTarget');
const Host = require('../models/Host');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// Helper: Calculate host's actual online time for today
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

  // Calculate from completed sessions
  for (const log of host.onlineTimeLogs) {
    if (!log.startTime) continue;

    const sessionStart = new Date(log.startTime);
    
    // Skip if session started before today
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

// Helper: Auto-mark past days for new hosts
const autoMarkPastDays = async (freeTarget) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let hasChanges = false;

  if (freeTarget.currentWeek && freeTarget.currentWeek.days) {
    for (const day of freeTarget.currentWeek.days) {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      
      // If day is in the past and still pending
      if (dayDate < today && day.status === 'pending') {
        day.status = 'failed';
        day.adminNote = 'Auto-marked as host joined after this date';
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    await freeTarget.save();
  }

  return freeTarget;
};

// Get free target data for host
exports.getFreeTarget = asyncHandler(async (req, res) => {
  let hostId = req.params.hostId;

  // If hostId not explicitly passed, resolve from logged-in user
  if (!hostId) {
    const host = await Host.findOne({ userId: req.user._id }).select('_id');
    if (!host) {
      throw new ApiError(404, 'Host profile not found');
    }
    hostId = host._id;
  }

  let freeTarget = await FreeTarget.findOne({ hostId });

  if (!freeTarget || !freeTarget.isEnabled) {
    throw new ApiError(404, 'Free target not enabled for this host');
  }

  // Week rollover logic
  const now = new Date();
  if (freeTarget.currentWeek && now > freeTarget.currentWeek.endDate) {
    if (freeTarget.currentWeek.status === 'active') {
      freeTarget.currentWeek.status = 'failed';
    }

    freeTarget.weekHistory.push(freeTarget.currentWeek);

    if (freeTarget.currentWeek.status === 'completed') {
      freeTarget.totalWeeksCompleted += 1;
    } else {
      freeTarget.totalWeeksFailed += 1;
    }

    freeTarget.currentWeek = await FreeTarget.initializeWeek(hostId);
    await freeTarget.save();
  }

  // Auto-mark past days for new hosts
  freeTarget = await autoMarkPastDays(freeTarget);

  // Calculate real-time online duration from host logs
  const timeCompleted = await calculateTodayOnlineTime(hostId);
  const timeRemaining = Math.max(
    0,
    freeTarget.targetDurationPerDay - timeCompleted
  );

  const todayTarget = freeTarget.getCurrentDayTarget();
  
  // Update today's target with real-time data
  if (todayTarget) {
    todayTarget.totalCallDuration = timeCompleted;
  }

  // Calculate days left in week
  const daysLeftInWeek = freeTarget.currentWeek
    ? freeTarget.currentWeek.days.filter(d => d.status === 'pending').length
    : 0;

  ApiResponse.success(res, 200, 'Free target data retrieved', {
    freeTarget: {
      ...freeTarget.toObject(),
      todayTarget,
      timeRemaining,
      timeCompleted,
      targetDuration: freeTarget.targetDurationPerDay,
      daysLeftInWeek
    }
  });
});

// Check and complete today's target (called periodically or when host goes offline)
exports.checkAndCompleteTodayTarget = asyncHandler(async (req, res) => {
  const hostId = req.user.hostProfile._id;
  
  const freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget || !freeTarget.isEnabled) {
    return ApiResponse.success(res, 200, 'Free target not enabled', {});
  }

  const todayTarget = freeTarget.getCurrentDayTarget();
  
  if (!todayTarget || todayTarget.status !== 'pending') {
    return ApiResponse.success(res, 200, 'No active target for today', {});
  }

  // Calculate real online time
  const timeCompleted = await calculateTodayOnlineTime(hostId);
  todayTarget.totalCallDuration = timeCompleted;

  // Check if target is completed
  if (timeCompleted >= freeTarget.targetDurationPerDay) {
    todayTarget.status = 'completed';
    todayTarget.completedAt = new Date();
    freeTarget.currentWeek.completedDays += 1;

    // Award 1 lakh (100,000) diamonds
    const host = await Host.findById(hostId);
    if (host) {
      host.totalEarnings = (host.totalEarnings || 0) + 100000;
      await host.save();
      
      logger.info(`Awarded 100,000 diamonds to host ${hostId} for completing daily target`);
    }

    await freeTarget.save();

    return ApiResponse.success(res, 200, 'Daily target completed! Awarded 1 lakh diamonds', {
      todayTarget,
      diamondsAwarded: 100000,
      totalEarnings: host.totalEarnings
    });
  }

  await freeTarget.save();

  return ApiResponse.success(res, 200, 'Target progress updated', {
    todayTarget,
    timeRemaining: freeTarget.targetDurationPerDay - timeCompleted
  });
});

// Start daily timer (legacy - now auto-starts)
exports.startDailyTimer = asyncHandler(async (req, res) => {
  const hostId = req.user.hostProfile._id;
  
  const freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget || !freeTarget.isEnabled) {
    throw new ApiError(400, 'Free target not enabled');
  }

  const todayTarget = freeTarget.getCurrentDayTarget();
  
  if (!todayTarget) {
    throw new ApiError(400, 'No target found for today');
  }

  todayTarget.isTimerActive = true;
  todayTarget.timerStartedAt = new Date();
  
  await freeTarget.save();

  logger.info(`Free target timer started for host ${hostId}`);

  ApiResponse.success(res, 200, 'Daily timer started', {
    todayTarget,
    targetDuration: freeTarget.targetDurationPerDay
  });
});

// Stop daily timer
exports.stopDailyTimer = asyncHandler(async (req, res) => {
  const hostId = req.user.hostProfile._id;
  
  const freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget) {
    throw new ApiError(404, 'Free target not found');
  }

  const todayTarget = freeTarget.getCurrentDayTarget();
  
  if (!todayTarget) {
    throw new ApiError(400, 'No target found for today');
  }

  todayTarget.isTimerActive = false;
  
  // Calculate real online time
  const timeCompleted = await calculateTodayOnlineTime(hostId);
  todayTarget.totalCallDuration = timeCompleted;

  // Check if target was met
  if (timeCompleted >= freeTarget.targetDurationPerDay) {
    todayTarget.status = 'completed';
    todayTarget.completedAt = new Date();
    freeTarget.currentWeek.completedDays += 1;

    // Award 1 lakh diamonds
    const host = await Host.findById(hostId);
    if (host) {
      host.totalEarnings = (host.totalEarnings || 0) + 100000;
      await host.save();
      
      logger.info(`Awarded 100,000 diamonds to host ${hostId} for completing daily target`);
    }
  }
  
  await freeTarget.save();

  logger.info(`Free target timer stopped for host ${hostId}`);

  ApiResponse.success(res, 200, 'Daily timer stopped', { 
    todayTarget,
    diamondsAwarded: todayTarget.status === 'completed' ? 100000 : 0
  });
});

// Record call completion (legacy - now uses online time)
exports.recordCallForTarget = asyncHandler(async (req, res) => {
  const { callId, duration, wasDisconnected } = req.body;
  const hostId = req.user.hostProfile._id;
  
  const freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget || !freeTarget.isEnabled) {
    return ApiResponse.success(res, 200, 'Free target not enabled', {});
  }

  const todayTarget = freeTarget.getCurrentDayTarget();
  
  if (!todayTarget || todayTarget.status !== 'pending') {
    return ApiResponse.success(res, 200, 'Not in active target period', {});
  }

  // Handle disconnected call
  if (wasDisconnected) {
    const dayFailed = freeTarget.recordDisconnect(callId);
    
    if (dayFailed) {
      await freeTarget.save();
      logger.warn(`Free target day failed due to disconnects for host ${hostId}`);
      
      return ApiResponse.success(res, 200, 'Day marked as failed due to excessive disconnects', {
        dayFailed: true,
        todayTarget
      });
    }
  }

  // Update stats
  if (duration > 0) {
    freeTarget.stats.totalCallsCompleted += 1;
    freeTarget.stats.totalCallDuration += duration;
  }
  
  await freeTarget.save();

  // Get real-time online time
  const timeCompleted = await calculateTodayOnlineTime(hostId);

  ApiResponse.success(res, 200, 'Call recorded for free target', {
    todayTarget: freeTarget.getCurrentDayTarget(),
    timeCompleted,
    timeRemaining: freeTarget.targetDurationPerDay - timeCompleted
  });
});

// Admin: Enable/disable free target for host
exports.toggleFreeTarget = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { isEnabled } = req.body;
  
  let freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget) {
    const currentWeek = await FreeTarget.initializeWeek(hostId);
    
    freeTarget = await FreeTarget.create({
      hostId,
      isEnabled,
      currentWeek
    });

    // Auto-mark past days for new hosts
    await autoMarkPastDays(freeTarget);
  } else {
    freeTarget.isEnabled = isEnabled;
    await freeTarget.save();
  }

  logger.info(`Free target ${isEnabled ? 'enabled' : 'disabled'} for host ${hostId}`);

  ApiResponse.success(res, 200, `Free target ${isEnabled ? 'enabled' : 'disabled'}`, {
    freeTarget
  });
});

// Admin: Override day status
exports.overrideDayStatus = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { date, status, note } = req.body;
  
  if (!['completed', 'failed'].includes(status)) {
    throw new ApiError(400, 'Status must be completed or failed');
  }
  
  const freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget) {
    throw new ApiError(404, 'Free target not found');
  }

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  let dayTarget = freeTarget.currentWeek?.days.find(d => {
    const dayDate = new Date(d.date);
    dayDate.setHours(0, 0, 0, 0);
    return dayDate.getTime() === targetDate.getTime();
  });
  
  if (!dayTarget) {
    for (const week of freeTarget.weekHistory) {
      dayTarget = week.days.find(d => {
        const dayDate = new Date(d.date);
        dayDate.setHours(0, 0, 0, 0);
        return dayDate.getTime() === targetDate.getTime();
      });
      if (dayTarget) break;
    }
  }
  
  if (!dayTarget) {
    throw new ApiError(404, 'Day not found in free target records');
  }

  const previousStatus = dayTarget.status;
  dayTarget.status = status;
  dayTarget.adminOverride = true;
  dayTarget.adminNote = note || 'Admin override';
  dayTarget.overrideBy = req.user._id;
  
  // Update completed days count
  if (freeTarget.currentWeek) {
    if (status === 'completed' && previousStatus !== 'completed') {
      freeTarget.currentWeek.completedDays += 1;
    } else if (status !== 'completed' && previousStatus === 'completed') {
      freeTarget.currentWeek.completedDays -= 1;
    }
  }

  // Award/remove diamonds if needed
  if (status === 'completed' && previousStatus !== 'completed') {
    const host = await Host.findById(hostId);
    if (host) {
      host.totalEarnings = (host.totalEarnings || 0) + 100000;
      await host.save();
      logger.info(`Admin awarded 100,000 diamonds to host ${hostId} via override`);
    }
  }
  
  await freeTarget.save();

  logger.info(`Admin ${req.user._id} overrode day status for host ${hostId} on ${date} to ${status}`);

  ApiResponse.success(res, 200, 'Day status updated by admin', {
    dayTarget,
    freeTarget
  });
});

// Admin: Get all hosts with free target
exports.getAllFreeTargets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  
  const query = {};
  if (status) {
    query['currentWeek.status'] = status;
  }

  const freeTargets = await FreeTarget.find(query)
    .populate('hostId', 'userId isOnline totalEarnings')
    .populate('currentWeek.days.overrideBy', 'name email')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ 'currentWeek.startDate': -1 });

  const count = await FreeTarget.countDocuments(query);

  ApiResponse.success(res, 200, 'Free targets retrieved', {
    freeTargets,
    totalPages: Math.ceil(count / limit),
    currentPage: page,
    total: count
  });
});

// Get weekly stats
exports.getWeeklyStats = asyncHandler(async (req, res) => {
  const hostId = req.params.hostId || req.user.hostProfile?._id;
  
  const freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget) {
    throw new ApiError(404, 'Free target not found');
  }

  const weekStats = {
    currentWeek: freeTarget.currentWeek,
    totalWeeksCompleted: freeTarget.totalWeeksCompleted,
    totalWeeksFailed: freeTarget.totalWeeksFailed,
    recentHistory: freeTarget.weekHistory.slice(-4).reverse(),
    overallStats: freeTarget.stats
  };

  ApiResponse.success(res, 200, 'Weekly stats retrieved', weekStats);
});

module.exports = exports;