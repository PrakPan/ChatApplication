// ============================================
// FIXED CONTROLLER with Correct Date Handling
// ============================================

const FreeTarget = require('../models/FreeTarget');
const Host = require('../models/Host');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// Helper: Get today's date in IST (India Standard Time)
const getTodayIST = () => {
  const now = new Date();
  // Convert to IST (UTC + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  istTime.setUTCHours(0, 0, 0, 0);
  return istTime;
};

// Helper: Check if two dates are the same day in IST
const isSameDayIST = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Convert both to IST
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist1 = new Date(d1.getTime() + istOffset);
  const ist2 = new Date(d2.getTime() + istOffset);
  
  return (
    ist1.getUTCFullYear() === ist2.getUTCFullYear() &&
    ist1.getUTCMonth() === ist2.getUTCMonth() &&
    ist1.getUTCDate() === ist2.getUTCDate()
  );
};

// Helper: Calculate host's actual online time for today (IST)
const calculateTodayOnlineTime = async (hostId) => {
  const host = await Host.findById(hostId).select('onlineTimeLogs');
  
  if (!host || !host.onlineTimeLogs || host.onlineTimeLogs.length === 0) {
    return 0;
  }

  // Get today's start and end in IST
  const todayIST = getTodayIST();
  const todayStart = new Date(todayIST);
  const todayEnd = new Date(todayIST);
  todayEnd.setUTCHours(23, 59, 59, 999);

  let totalOnlineTime = 0;

  for (const log of host.onlineTimeLogs) {
    if (!log.startTime) continue;

    const sessionStart = new Date(log.startTime);
    
    // Skip if session started before today (IST)
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

  // Cap at 8 hours (28800 seconds)
  return Math.min(totalOnlineTime, 28800);
};

// Helper: Auto-mark past days for new hosts
const autoMarkPastDays = async (freeTarget) => {
  const todayIST = getTodayIST();
  
  let hasChanges = false;

  if (freeTarget.currentWeek && freeTarget.currentWeek.days) {
    for (const day of freeTarget.currentWeek.days) {
      const dayDate = new Date(day.date);
      
      // If day is in the past (before today IST) and still pending
      if (dayDate < todayIST && day.status === 'pending') {
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

// Helper: Get current day target using IST
const getCurrentDayTargetIST = (freeTarget) => {
  if (!freeTarget?.currentWeek?.days) return null;
  
  const todayIST = getTodayIST();
  
  return freeTarget.currentWeek.days.find(day => {
    return isSameDayIST(day.date, todayIST);
  });
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

  // Get today's target using IST comparison
  const todayTarget = getCurrentDayTargetIST(freeTarget);
  
  // Only calculate time if day is pending
  let timeCompleted = 0;
  let timeRemaining = freeTarget.targetDurationPerDay;

  if (todayTarget && todayTarget.status === 'pending') {
    timeCompleted = await calculateTodayOnlineTime(hostId);
    timeRemaining = Math.max(0, freeTarget.targetDurationPerDay - timeCompleted);
    
    // Update today's target with real-time data (don't save yet)
    todayTarget.totalCallDuration = timeCompleted;
  } else if (todayTarget) {
    // Day is completed or failed, use stored time
    timeCompleted = todayTarget.totalCallDuration || 0;
    timeRemaining = Math.max(0, freeTarget.targetDurationPerDay - timeCompleted);
  }

  // Calculate days left in week
  const daysLeftInWeek = freeTarget.currentWeek
    ? freeTarget.currentWeek.days.filter(d => d.status === 'pending').length
    : 0;

  const host = await Host.findById(hostId).select('isOnline');
  const activateClock = host?.isOnline === true;

  ApiResponse.success(res, 200, 'Free target data retrieved', {
    freeTarget: {
      ...freeTarget.toObject(),
      todayTarget,
      timeRemaining,
      timeCompleted,
      targetDuration: freeTarget.targetDurationPerDay,
      targetDurationPerDay: freeTarget.targetDurationPerDay,
      daysLeftInWeek,
      activateClock
    }
  });
});

// Check and complete today's target (called periodically or manually)
exports.checkAndCompleteTodayTarget = asyncHandler(async (req, res) => {
  const hostId = req.user.hostProfile._id;
  
  const freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget || !freeTarget.isEnabled) {
    return ApiResponse.success(res, 200, 'Free target not enabled', {});
  }

  const todayTarget = getCurrentDayTargetIST(freeTarget);
  
  if (!todayTarget || todayTarget.status !== 'pending') {
    return ApiResponse.success(res, 200, 'No active target for today', { todayTarget });
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

  const timeRemaining = Math.max(0, freeTarget.targetDurationPerDay - timeCompleted);

  return ApiResponse.success(res, 200, 'Target progress updated', {
    todayTarget,
    timeCompleted,
    timeRemaining
  });
});

// Start daily timer (legacy - now auto-starts)
exports.startDailyTimer = asyncHandler(async (req, res) => {
  const hostId = req.user.hostProfile._id;
  
  const freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget || !freeTarget.isEnabled) {
    throw new ApiError(400, 'Free target not enabled');
  }

  const todayTarget = getCurrentDayTargetIST(freeTarget);
  
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

  const todayTarget = getCurrentDayTargetIST(freeTarget);
  
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

  const todayTarget = getCurrentDayTargetIST(freeTarget);
  
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
    todayTarget: getCurrentDayTargetIST(freeTarget),
    timeCompleted,
    timeRemaining: Math.max(0, freeTarget.targetDurationPerDay - timeCompleted)
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
  
  let dayTarget = freeTarget.currentWeek?.days.find(d => {
    return isSameDayIST(d.date, targetDate);
  });
  
  if (!dayTarget) {
    for (const week of freeTarget.weekHistory) {
      dayTarget = week.days.find(d => {
        return isSameDayIST(d.date, targetDate);
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