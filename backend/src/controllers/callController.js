const Call = require('../models/Call');
const Host = require('../models/Host');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { REVENUE_SPLIT } = require('../utils/constants');
const logger = require('../utils/logger');

const initiateCall = asyncHandler(async (req, res) => {
  const { hostId } = req.body;

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
    status: 'initiated'
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

  // Verify host owns this call
  const host = await Host.findOne({ userId: req.user._id });
  if (!host || call.hostId.toString() !== host._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  if (call.status !== 'initiated') {
    throw new ApiError(400, 'Call cannot be accepted');
  }

  call.status = 'ongoing';
  call.startTime = new Date();
  await call.save();

  logger.info(`Call accepted: ${callId}`);

  ApiResponse.success(res, 200, 'Call accepted', { call });
});

const endCall = asyncHandler(async (req, res) => {
  const { callId } = req.body;

  const call = await Call.findById(callId).populate('hostId');
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

  // Calculate duration and coins
  call.endTime = new Date();
  const durationInSeconds = Math.floor((call.endTime - call.startTime) / 1000);
  const durationInMinutes = Math.ceil(durationInSeconds / 60);
  
  call.duration = durationInSeconds;
  call.coinsSpent = durationInMinutes * call.hostId.ratePerMinute;
  call.status = 'completed';
  await call.save();

  // Deduct coins from user
  const user = await User.findById(call.userId);
  if (user.coinBalance < call.coinsSpent) {
    call.status = 'failed';
    await call.save();
    throw new ApiError(400, 'Insufficient balance to complete call');
  }

  user.coinBalance -= call.coinsSpent;
  await user.save();

  // Create debit transaction
  await Transaction.create({
    userId: call.userId,
    type: 'call_debit',
    amount: call.coinsSpent,
    coins: call.coinsSpent,
    status: 'completed',
    callId: call._id,
    description: `Call with host for ${durationInMinutes} minutes`
  });

  // Calculate host earnings (70%)
  const hostEarnings = Math.floor(call.coinsSpent * (REVENUE_SPLIT.HOST_PERCENTAGE / 100));

  // Update host earnings
  const hostDoc = await Host.findById(call.hostId._id);
  hostDoc.totalEarnings += hostEarnings;
  hostDoc.totalCalls += 1;
  await hostDoc.save();

  // Create credit transaction for host
  await Transaction.create({
    userId: hostDoc.userId,
    type: 'call_credit',
    amount: hostEarnings,
    coins: hostEarnings,
    status: 'completed',
    callId: call._id,
    description: `Earnings from ${durationInMinutes} minute call`
  });

  logger.info(`Call ended: ${callId}, Duration: ${durationInMinutes}min, Coins: ${call.coinsSpent}`);

  ApiResponse.success(res, 200, 'Call ended successfully', { 
    call,
    coinsSpent: call.coinsSpent,
    duration: durationInMinutes,
    newBalance: user.coinBalance
  });
});

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
        select: 'name avatar'
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
  rateCall,
  getCallHistory,
  getCallDetails
};