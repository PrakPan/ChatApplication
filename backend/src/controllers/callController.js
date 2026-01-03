const Call = require('../models/Call');
const Host = require('../models/Host');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { REVENUE_SPLIT } = require('../utils/constants');
const logger = require('../utils/logger');
const Level = require('../models/Level');
const WeeklyLeaderboard = require('../models/WeeklyLeaderboard');

const initiateCall = asyncHandler(async (req, res) => {
  const { hostId } = req.body;
  console.log("HHH", hostId);

  // Get host details
  const host = await Host.findById(hostId);

  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  if (host.status !== 'approved') {
    throw new ApiError(400, 'Host is not approved');
  }

  if (!host.isOnline) {
    throw new ApiError(400, 'Host is currently offline');
  }

  // Check user balance
  const user = await User.findById(req.user._id);
  if (user.coinBalance < host.ratePerMinute) {
    throw new ApiError(400, 'Insufficient coin balance');
  }

  // Create call record
  const call = await Call.create({
    userId: req.user._id,
    hostId: host._id,
    startTime: new Date(),
    status: 'initiated',
    lastBilledAt: new Date(), // Track when we last deducted coins
    coinsDeductedSoFar: 0 // Track total coins deducted during call
  });

  logger.info(`Call initiated: User ${user.email} to Host ${host._id}`);

  ApiResponse.success(res, 200, 'Call initiated successfully', { call });
});

const acceptCall = asyncHandler(async (req, res) => {
  const { callId } = req.body;

  const call = await Call.findById(callId);
  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  
  const host = await Host.findOne({ userId: req.user._id });
  if (!host || call.hostId.toString() !== host._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  if (call.status !== 'initiated') {
    throw new ApiError(400, 'Call cannot be accepted');
  }

  call.status = 'ongoing';
  call.startTime = new Date();
  call.lastBilledAt = new Date(); 
  await call.save();

  logger.info(`Call accepted: ${callId}`);

  ApiResponse.success(res, 200, 'Call accepted', { call });
});


const checkCallBalance = asyncHandler(async (req, res) => {
  const { callId } = req.body;

  const call = await Call.findById(callId).populate({
  path: 'hostId',
  select: '-onlineTimeLogs -photos -bankDetails'
});
  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  if (call.status !== 'ongoing') {
    return ApiResponse.success(res, 200, 'Call not ongoing', { 
      shouldContinue: false 
    });
  }

  // Verify user is part of this call
  const isUser = call.userId.toString() === req.user._id.toString();
  if (!isUser && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }

  // Get host's charm level to determine rate
  const hostLevel = await Level.findOne({ userId: call.hostId.userId });
  const ratePerMinute = hostLevel ? hostLevel.getRatePerMinute() : call.hostId.ratePerMinute;

  // Calculate time since last billing
  const now = new Date();
  const lastBilledAt = call.lastBilledAt || call.startTime;
  const secondsSinceLastBill = Math.floor((now - lastBilledAt) / 1000);

  // Only bill if at least 60 seconds have passed (1 minute)
  if (secondsSinceLastBill < 60) {
    return ApiResponse.success(res, 200, 'Not time to bill yet', { 
      shouldContinue: true,
      secondsUntilNextBill: 60 - secondsSinceLastBill
    });
  }

  // Calculate minutes to bill (round down to complete minutes)
  const minutesToBill = Math.floor(secondsSinceLastBill / 60);
  const coinsToBill = minutesToBill * ratePerMinute;

  // Check user balance
  const user = await User.findById(call.userId);
  if (user.coinBalance < coinsToBill) {
    // Insufficient balance - end call
    logger.warn(`Insufficient balance during call ${callId}. Ending call.`);
    
    return ApiResponse.success(res, 200, 'Insufficient balance', { 
      shouldContinue: false,
      insufficientBalance: true,
      currentBalance: user.coinBalance,
      requiredAmount: coinsToBill
    });
  }

  // Deduct coins
  user.coinBalance -= coinsToBill;
  await user.save();

  // Update call record
  call.coinsDeductedSoFar = (call.coinsDeductedSoFar || 0) + coinsToBill;
  call.lastBilledAt = now;
  await call.save();

  // Create transaction record
  await Transaction.create({
    userId: call.userId,
    type: 'call_debit_partial',
    amount: coinsToBill,
    coins: coinsToBill,
    status: 'completed',
    callId: call._id,
    description: `Ongoing call billing: ${minutesToBill} minute(s) @ ${ratePerMinute} beans/min`
  });

  logger.info(`Billed ${coinsToBill} beans for ${minutesToBill} minutes on call ${callId}`);

  ApiResponse.success(res, 200, 'Balance checked and billed', { 
    shouldContinue: true,
    coinsBilled: coinsToBill,
    minutesBilled: minutesToBill,
    newBalance: user.coinBalance,
    totalDeductedSoFar: call.coinsDeductedSoFar
  });
});

const endCall = asyncHandler(async (req, res) => {
  const { callId, wasDisconnected, hostManuallyDisconnected } = req.body;

  const call = await Call.findById(callId).populate({
  path: 'hostId',
  select: '-onlineTimeLogs -photos -bankDetails'
});
  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Verify user is part of this call
  const isUser = call.userId.toString() === req.user._id.toString();
  const host = await Host.findOne({ userId: req.user._id });
  const isHost = host && call.hostId._id.toString() === host._id.toString();

  if (!isUser && !isHost) {
    throw new ApiError(403, 'Not authorized');
  }

  if (call.status === 'completed') {
    throw new ApiError(400, 'Call already ended');
  }

  // Calculate final duration
  call.endTime = new Date();
  const durationInSeconds = Math.floor((call.endTime - call.startTime) / 1000);
  const durationInMinutes = Math.ceil(durationInSeconds / 60);

  // Get host's charm level to determine rate
  const hostLevel = await Level.findOne({ userId: call.hostId.userId });
  const ratePerMinute = hostLevel ? hostLevel.getRatePerMinute() : call.hostId.ratePerMinute;

  // Calculate remaining coins to deduct (if any)
  const lastBilledAt = call.lastBilledAt || call.startTime;
  const secondsSinceLastBill = Math.floor((call.endTime - lastBilledAt) / 1000);
  const remainingMinutes = Math.ceil(secondsSinceLastBill / 60);
  const remainingCoins = remainingMinutes * ratePerMinute;

  const user = await User.findById(call.userId);

  // Deduct remaining coins if any
  let finalCoinsDeducted = call.coinsDeductedSoFar || 0;
  
  if (remainingCoins > 0) {
    if (user.coinBalance >= remainingCoins) {
      user.coinBalance -= remainingCoins;
      finalCoinsDeducted += remainingCoins;
      
      await Transaction.create({
        userId: call.userId,
        type: 'call_debit',
        amount: remainingCoins,
        coins: remainingCoins,
        status: 'completed',
        callId: call._id,
        description: `Final billing for ${remainingMinutes} minute(s) @ ${ratePerMinute} beans/min`
      });
    } else {
      // User ran out of balance - deduct what they have
      const coinsAvailable = user.coinBalance;
      if (coinsAvailable > 0) {
        finalCoinsDeducted += coinsAvailable;
        user.coinBalance = 0;
        
        await Transaction.create({
          userId: call.userId,
          type: 'call_debit',
          amount: coinsAvailable,
          coins: coinsAvailable,
          status: 'completed',
          callId: call._id,
          description: `Final billing (partial - insufficient balance)`
        });
      }
      
      logger.warn(`User ${call.userId} ended call with insufficient balance`);
    }
  }

  await user.save();

  // Update call record with final details
  call.duration = durationInSeconds;
  call.coinsSpent = finalCoinsDeducted;
  call.status = 'completed';
  await call.save();

  // Handle Free Target tracking
  const FreeTarget = require('../models/FreeTarget');
  const freeTarget = await FreeTarget.findOne({ 
    hostId: call.hostId._id,
    isEnabled: true 
  });

  if (freeTarget) {
    const todayTarget = freeTarget.getCurrentDayTarget();
    
    if (todayTarget && todayTarget.status === 'pending') {
      if (wasDisconnected) {
        const dayFailed = freeTarget.recordDisconnect(callId);
        if (dayFailed) {
          logger.warn(`Free target day failed due to disconnects for host ${call.hostId._id}`);
        }
      }

      if (durationInSeconds > 0) {
        freeTarget.addCallDuration(durationInSeconds);
        freeTarget.stats.totalCallsCompleted += 1;
        freeTarget.stats.totalCallDuration += durationInSeconds;
      }

      await freeTarget.save();
    }
  }

  // Calculate host earnings (70%)
  const hostEarnings = Math.floor(finalCoinsDeducted * (REVENUE_SPLIT.HOST_PERCENTAGE / 100));

  // Update host earnings
  const hostDoc = await Host.findById(call.hostId._id);
  hostDoc.totalEarnings += hostEarnings;
  hostDoc.totalCalls += 1;
  
  await hostDoc.save();

  // Update host's charm level
  if (!hostLevel) {
    await Level.create({ 
      userId: call.hostId.userId,
      totalBeansEarned: hostEarnings 
    });
  } else {
    hostLevel.totalBeansEarned += hostEarnings;
    await hostLevel.save();
  }

  // Create credit transaction for host
  await Transaction.create({
    userId: hostDoc.userId,
    type: 'call_credit',
    amount: hostEarnings,
    coins: hostEarnings,
    status: 'completed',
    callId: call._id,
    description: `Earnings from ${durationInMinutes} minute call (${hostEarnings} beans earned)`
  });

  // Update Weekly Leaderboard
  await updateWeeklyLeaderboard(call.userId, 'user', durationInSeconds);
  await updateWeeklyLeaderboard(hostDoc.userId, 'host', durationInSeconds);

  logger.info(`Call ended: ${callId}, Duration: ${durationInMinutes}min, Total Beans: ${finalCoinsDeducted}, Host Earnings: ${hostEarnings}`);

  ApiResponse.success(res, 200, 'Call ended successfully', { 
    call,
    coinsSpent: finalCoinsDeducted,
    duration: durationInMinutes,
    newBalance: user.coinBalance,
    hostEarnings,
    rateUsed: ratePerMinute,
    hostStillOnline: hostDoc.isOnline
  });
});

async function updateWeeklyLeaderboard(userId, userType, durationInSeconds) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  let leaderboardEntry = await WeeklyLeaderboard.findOne({
    userId,
    userType,
    weekStartDate: weekStart
  });

  if (!leaderboardEntry) {
    leaderboardEntry = await WeeklyLeaderboard.create({
      userId,
      userType,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      totalCallDuration: durationInSeconds,
      totalCalls: 1
    });
  } else {
    leaderboardEntry.totalCallDuration += durationInSeconds;
    leaderboardEntry.totalCalls += 1;
    await leaderboardEntry.save();
  }
}

const rateCall = asyncHandler(async (req, res) => {
  const { callId, rating, feedback } = req.body;

  const call = await Call.findById(callId);
  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  if (call.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  if (call.status !== 'completed') {
    throw new ApiError(400, 'Can only rate completed calls');
  }

  if (call.rating) {
    throw new ApiError(400, 'Call already rated');
  }

  call.rating = rating;
  call.feedback = feedback;
  await call.save();

  // Update host rating
  const host = await Host.findById(call.hostId);
  const newTotalRatings = host.totalRatings + 1;
  const newRating = ((host.rating * host.totalRatings) + rating) / newTotalRatings;
  
  host.rating = Math.round(newRating * 10) / 10;
  host.totalRatings = newTotalRatings;
  await host.save();

  logger.info(`Call rated: ${callId}, Rating: ${rating}`);

  ApiResponse.success(res, 200, 'Call rated successfully', { call });
});

const getCallHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const query = { userId: req.user._id };
  if (status) query.status = status;

  const calls = await Call.find(query)
    .populate('hostId', 'userId bio ratePerMinute')
    .populate({
      path: 'hostId',
      populate: {
        path: 'userId',
        select: 'name avatar -onlineTimeLogs -photos -bankDetails'
      }
    })
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

const getCallDetails = asyncHandler(async (req, res) => {
  const { callId } = req.params;

  const call = await Call.findById(callId)
    .populate('userId', 'name avatar email')
    .populate({
      path: 'hostId',
      populate: {
        path: 'userId',
        select: 'name avatar'
      }
    });

  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Verify user is part of this call
  const isUser = call.userId._id.toString() === req.user._id.toString();
  const host = await Host.findOne({ userId: req.user._id });
  const isHost = host && call.hostId._id.toString() === host._id.toString();

  if (!isUser && !isHost && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized');
  }

  ApiResponse.success(res, 200, 'Call details retrieved', { call });
});

module.exports = {
  initiateCall,
  acceptCall,
  endCall,
  checkCallBalance, 
  rateCall,
  getCallHistory,
  getCallDetails
};