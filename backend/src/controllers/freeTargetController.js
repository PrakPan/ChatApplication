// controllers/freeTargetController.js
const FreeTarget = require('../models/FreeTarget');
const Host = require('../models/Host');
const Call = require('../models/Call');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

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

  const freeTarget = await FreeTarget.findOne({ hostId });

  console.log("Free Target host", freeTarget, hostId);

  if (!freeTarget || !freeTarget.isEnabled) {
    throw new ApiError(404, 'Free target not enabled for this host');
  }

  // Week rollover logic (unchanged)
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

  const todayTarget = freeTarget.getCurrentDayTarget();
  const timeCompleted = todayTarget?.totalCallDuration || 0;
  const timeRemaining = Math.max(
    0,
    freeTarget.targetDurationPerDay - timeCompleted
  );

  ApiResponse.success(res, 200, 'Free target data retrieved', {
    freeTarget: {
      ...freeTarget.toObject(),
      todayTarget,
      timeRemaining,
      timeCompleted,
      targetDuration: freeTarget.targetDurationPerDay,
      daysLeftInWeek: freeTarget.currentWeek
        ? freeTarget.currentWeek.days.filter(d => d.status === 'pending').length
        : 0
    }
  });
});


// Start daily timer
exports.startDailyTimer = asyncHandler(async (req, res) => {
  const hostId = req.user.hostProfile._id;
  
  const freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget || !freeTarget.isEnabled) {
    throw new ApiError(400, 'Free target not enabled');
  }

  if (!freeTarget.canStartTimer()) {
    throw new ApiError(400, 'Cannot start timer. Either already active or day completed/failed');
  }

  const todayTarget = freeTarget.getCurrentDayTarget();
  todayTarget.isTimerActive = true;
  todayTarget.timerStartedAt = new Date();
  
  await freeTarget.save();

  logger.info(`Free target timer started for host ${hostId}`);

  ApiResponse.success(res, 200, 'Daily timer started', {
    todayTarget,
    targetDuration: freeTarget.targetDurationPerDay
  });
});

// Stop daily timer (manual or automatic)
exports.stopDailyTimer = asyncHandler(async (req, res) => {
  const hostId = req.user.hostProfile._id;
  
  const freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget) {
    throw new ApiError(404, 'Free target not found');
  }

  const todayTarget = freeTarget.getCurrentDayTarget();
  
  if (!todayTarget || !todayTarget.isTimerActive) {
    throw new ApiError(400, 'Timer is not active');
  }

  todayTarget.isTimerActive = false;
  
  // Check if target was met
  if (todayTarget.totalCallDuration >= freeTarget.targetDurationPerDay) {
    todayTarget.status = 'completed';
    todayTarget.completedAt = new Date();
    freeTarget.currentWeek.completedDays += 1;
  }
  
  await freeTarget.save();

  logger.info(`Free target timer stopped for host ${hostId}`);

  ApiResponse.success(res, 200, 'Daily timer stopped', { todayTarget });
});

// Record call completion for free target
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

  // Add call duration
  if (duration > 0) {
    freeTarget.addCallDuration(duration);
    freeTarget.stats.totalCallsCompleted += 1;
    freeTarget.stats.totalCallDuration += duration;
  }
  
  await freeTarget.save();

  ApiResponse.success(res, 200, 'Call recorded for free target', {
    todayTarget: freeTarget.getCurrentDayTarget(),
    timeRemaining: freeTarget.targetDurationPerDay - todayTarget.totalCallDuration
  });
});

// Admin: Enable/disable free target for host
exports.toggleFreeTarget = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { isEnabled } = req.body;
  
  let freeTarget = await FreeTarget.findOne({ hostId });
  
  if (!freeTarget) {
    // Create new free target
    const currentWeek = await FreeTarget.initializeWeek(hostId);
    
    freeTarget = await FreeTarget.create({
      hostId,
      isEnabled,
      currentWeek
    });
  } else {
    freeTarget.isEnabled = isEnabled;
    await freeTarget.save();
  }

//   logger.info(`Free target ${isEnabled ? 'enabled' : 'disabled'} for host ${hostId} by admin ${req.user._id}`);

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
  
  // Find the day in current week or history
  let dayTarget = freeTarget.currentWeek?.days.find(d => {
    const dayDate = new Date(d.date);
    dayDate.setHours(0, 0, 0, 0);
    return dayDate.getTime() === targetDate.getTime();
  });
  
  if (!dayTarget) {
    // Check history
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
  
  // Update completed days count if in current week
  if (freeTarget.currentWeek) {
    if (status === 'completed' && previousStatus !== 'completed') {
      freeTarget.currentWeek.completedDays += 1;
    } else if (status !== 'completed' && previousStatus === 'completed') {
      freeTarget.currentWeek.completedDays -= 1;
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
    .populate('hostId', 'userId isOnline')
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