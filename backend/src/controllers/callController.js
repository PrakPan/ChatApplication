// controllers/callController.js
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

const AWS = require('../config/awsConfig');
const kinesisVideo = new AWS.KinesisVideo();

// Helper: Create Kinesis Signaling Channel
async function createKinesisChannel(channelName) {
  const params = {
    ChannelName: channelName,
    ChannelType: 'SINGLE_MASTER',
    SingleMasterConfiguration: {
      MessageTtlSeconds: 60,
    },
  };

  return await kinesisVideo.createSignalingChannel(params).promise();
}

// Helper: Get Signaling Endpoints
async function getSignalingEndpoints(channelArn, role) {
  const params = {
    ChannelARN: channelArn,
    SingleMasterChannelEndpointConfiguration: {
      Protocols: ['WSS', 'HTTPS'],
      Role: role || 'MASTER',
    },
  };

  const response = await kinesisVideo.getSignalingChannelEndpoint(params).promise();
  return response.ResourceEndpointList;
}

// Helper: Get ICE Servers (STUN/TURN)
async function getIceServers(channelArn, endpoint) {
  const kinesisSignaling = new AWS.KinesisVideoSignalingChannels({
    endpoint,
    region: process.env.AWS_REGION || 'ap-south-1'
  });

  const response = await kinesisSignaling.getIceServerConfig({ 
    ChannelARN: channelArn 
  }).promise();

  return response.IceServerList;
}

// NEW: Get Kinesis Signaling Credentials
const getSignalingCredentials = asyncHandler(async (req, res) => {
  const { callId, role } = req.body; // role: 'MASTER' or 'VIEWER'
  
  const call = await Call.findById(callId);
  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Verify authorization
  const isUser = call.userId.toString() === req.user._id.toString();
  const host = await Host.findOne({ userId: req.user._id });
  const isHost = host && call.hostId.toString() === host._id.toString();

  if (!isUser && !isHost) {
    throw new ApiError(403, 'Not authorized');
  }

  try {
    // Create unique channel name for this call
    const channelName = `call-${callId}`;
    
    // Check if channel exists, create if not
    let channelArn;
    try {
      const describeResult = await kinesisVideo
        .describeSignalingChannel({ ChannelName: channelName })
        .promise();
      channelArn = describeResult.ChannelInfo.ChannelARN;
      logger.info(`Using existing Kinesis channel: ${channelArn}`);
    } catch (error) {
      if (error.code === 'ResourceNotFoundException') {
        // Create new channel
        const createResult = await createKinesisChannel(channelName);
        channelArn = createResult.ChannelARN;
        logger.info(`Created new Kinesis channel: ${channelArn}`);
      } else {
        throw error;
      }
    }

    // Get signaling endpoints
    const endpoints = await getSignalingEndpoints(channelArn, role);
    
    // Get ICE servers (STUN/TURN from AWS)
    const httpsEndpoint = endpoints.find(e => e.Protocol === 'HTTPS');
    const iceServers = await getIceServers(channelArn, httpsEndpoint.ResourceEndpoint);

    // Store channel info in call document
    call.kinesisChannelName = channelName;
    call.kinesisChannelArn = channelArn;
    await call.save();

    ApiResponse.success(res, 200, 'Signaling credentials retrieved', {
      channelName,
      channelArn,
      endpoints,
      iceServers,
      role
    });
  } catch (error) {
    logger.error('Error getting signaling credentials:', error);
    throw new ApiError(500, 'Failed to get signaling credentials');
  }
});

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
    status: 'initiated',
    lastBilledAt: new Date(),
    coinsDeductedSoFar: 0
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
    select: '_id userId ratePerMinute'
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

  // Only bill if at least 60 seconds have passed
  if (secondsSinceLastBill < 60) {
    return ApiResponse.success(res, 200, 'Not time to bill yet', { 
      shouldContinue: true,
      secondsUntilNextBill: 60 - secondsSinceLastBill
    });
  }

  const minutesToBill = Math.floor(secondsSinceLastBill / 60);
  const coinsToBill = minutesToBill * ratePerMinute;

  // Check user balance
  const user = await User.findById(call.userId);
  if (user.coinBalance < coinsToBill) {
    logger.warn(`Insufficient balance during call ${callId}`);
    
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
    select: '_id userId ratePerMinute'
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

  // Get host's charm level
  const hostLevel = await Level.findOne({ userId: call.hostId.userId });
  const ratePerMinute = hostLevel ? hostLevel.getRatePerMinute() : call.hostId.ratePerMinute;

  // Calculate remaining coins
  const lastBilledAt = call.lastBilledAt || call.startTime;
  const secondsSinceLastBill = Math.floor((call.endTime - lastBilledAt) / 1000);
  const remainingMinutes = Math.ceil(secondsSinceLastBill / 60);
  const remainingCoins = remainingMinutes * ratePerMinute;

  const user = await User.findById(call.userId);
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
        description: `Final billing for ${remainingMinutes} minute(s)`
      });
    } else {
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
          description: `Final billing (partial)`
        });
      }
    }
  }

  await user.save();

  // Update call record
  call.duration = durationInSeconds;
  call.coinsSpent = finalCoinsDeducted;
  call.status = 'completed';
  await call.save();

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

  // Create credit transaction
  await Transaction.create({
    userId: hostDoc.userId,
    type: 'call_credit',
    amount: hostEarnings,
    coins: hostEarnings,
    status: 'completed',
    callId: call._id,
    description: `Earnings from ${durationInMinutes} minute call`
  });

  // Cleanup Kinesis channel (optional - or keep for logs)
  if (call.kinesisChannelArn) {
    try {
      // Optional: Delete channel to save costs
      // await kinesisVideo.deleteSignalingChannel({
      //   ChannelARN: call.kinesisChannelArn
      // }).promise();
      logger.info(`Call ended, Kinesis channel: ${call.kinesisChannelName}`);
    } catch (error) {
      logger.error('Error cleaning up Kinesis channel:', error);
    }
  }

  logger.info(`Call ended: ${callId}, Duration: ${durationInMinutes}min`);

  ApiResponse.success(res, 200, 'Call ended successfully', { 
    call,
    coinsSpent: finalCoinsDeducted,
    duration: durationInMinutes,
    newBalance: user.coinBalance,
    hostEarnings
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
        select: '-onlineTimeLogs -photos -bankDetails'
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

  // Verify authorization
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
  getCallDetails,
  getSignalingCredentials // NEW: Export this
};