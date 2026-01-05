const Gift = require('../models/Gift');
const Call = require('../models/Call');
const Host = require('../models/Host');
const User = require('../models/User');
const CoinSeller = require('../models/CoinSeller');
const Transaction = require('../models/Transaction');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// Gift configuration (same as frontend)
const GIFT_CONFIG = {
  teddy: { price: 300, diamonds: 210 },
  balloons: { price: 500, diamonds: 350 },
  race: { price: 700, diamonds: 490 },
  cake: { price: 1000, diamonds: 700 },
  bouquet: { price: 1000, diamonds: 700 },
  kiss: { price: 1500, diamonds: 1050 },
  sensual: { price: 2500, diamonds: 1750 },
  dhanteras: { price: 4000, diamonds: 2800 }
};

// Revenue split: 70% to host as diamonds, 30% platform fee
const DIAMOND_CONVERSION_RATE = 0.70;

/**
 * Send a gift during a video call
 * POST /api/gifts/send
 */
const sendGift = asyncHandler(async (req, res) => {
  const { callId, hostId, giftId, quantity = 1 } = req.body;

  // Validate input
  if (!callId || !hostId || !giftId) {
    throw new ApiError(400, 'Call ID, Host ID, and Gift ID are required');
  }

  if (!GIFT_CONFIG[giftId]) {
    throw new ApiError(400, 'Invalid gift ID');
  }

  if (quantity < 1 || quantity > 99) {
    throw new ApiError(400, 'Quantity must be between 1 and 99');
  }

  // Get gift details
  const giftConfig = GIFT_CONFIG[giftId];
  const totalCost = giftConfig.price * quantity;
  const totalDiamonds = giftConfig.diamonds * quantity;

  // Verify call exists and is ongoing
  const call = await Call.findById(callId);
  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // if (call.status !== 'ongoing') {
  //   throw new ApiError(400, 'Can only send gifts during ongoing calls');
  // }

  // Verify user is part of the call
  if (call.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not part of this call');
  }

  // Get user and check balance
  const user = await User.findById(req.user._id);
  if (user.coinBalance < totalCost) {
    throw new ApiError(400, 'Insufficient coin balance');
  }

  // Get host
  const host = await Host.findOne({ userId: hostId }).populate('userId');
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  // Verify host is part of the call
  if (call.hostId.toString() !== host._id.toString()) {
    throw new ApiError(403, 'Host is not part of this call');
  }

  // Deduct coins from user
  user.coinBalance -= totalCost;
  await user.save();

  // Add earnings directly to host
  host.totalEarnings = (host.totalEarnings || 0) + totalDiamonds;

  // Create gift transaction record
  const gift = await Gift.create({
    callId,
    senderId: user._id,
    recipientId: host.userId._id,
    hostId: host._id,
    giftType: giftId,
    quantity,
    coinsSpent: totalCost,
    diamondsEarned: totalDiamonds
  });

  // Create debit transaction for user
  await Transaction.create({
    userId: user._id,
    type: 'gift_debit',
    amount: totalCost,
    coins: totalCost,
    status: 'completed',
    callId: call._id,
    description: `Sent ${quantity}x ${giftId} gift`
  });

  // Create credit transaction for host
  await Transaction.create({
    userId: host.userId._id,
    type: 'gift_credit',
    amount: totalDiamonds,
    coins: totalDiamonds,
    status: 'completed',
    callId: call._id,
    description: `Received ${quantity}x ${giftId} gift (${totalDiamonds} diamonds)`
  });

  // Update host stats
  host.totalGiftsReceived = (host.totalGiftsReceived || 0) + quantity;
  await host.save();

  logger.info(`Gift sent: ${quantity}x ${giftId} from User ${user._id} to Host ${host._id} in Call ${callId}`);

  
// Get the socket.io instance and connectedUsers map from the app
const io = req.app.get('io');
const connectedUsers = req.app.get('connectedUsers');

if (io && connectedUsers) {
  const hostUserId = host.userId._id.toString();
  const senderUserId = user._id.toString();
  
  // Get socket IDs
  const hostSocketId = connectedUsers.get(hostUserId);
  const senderSocketId = connectedUsers.get(senderUserId);

  console.log('🎁 Sending gift notifications:');
  console.log('Host userId:', hostUserId, 'socketId:', hostSocketId);
  console.log('Sender userId:', senderUserId, 'socketId:', senderSocketId);

  // Emit to host
  if (hostSocketId) {
    io.to(hostSocketId).emit('gift:received', {
      giftId,
      quantity,
      senderName: user.name,
      senderAvatar: user.avatar,
      senderId: user._id,
      callId,
      totalDiamonds,
      giftType: giftId,
      timestamp: new Date()
    });
    logger.info(`Gift notification sent to host socket ${hostSocketId}`);
  }

  // Emit to sender for confirmation and animation
  if (senderSocketId) {
    io.to(senderSocketId).emit('gift:sent', {
      giftId,
      quantity,
      recipientName: host.userId.name,
      newBalance: user.coinBalance,
      timestamp: new Date()
    });
    logger.info(`Gift confirmation sent to sender socket ${senderSocketId}`);
  }
}

  ApiResponse.success(res, 200, 'Gift sent successfully', {
    gift: {
      _id: gift._id,
      giftType: gift.giftType,
      quantity: gift.quantity,
      coinsSpent: gift.coinsSpent,
      diamondsEarned: gift.diamondsEarned,
      createdAt: gift.createdAt
    },
    newBalance: user.coinBalance,
    diamondsEarned: totalDiamonds
  });
});

const allGifts = asyncHandler(async (req, res) => {
   const gifts = [
   { 
    id: 'teddy', 
    name: 'Teddy Love', 
    price: 300,
    icon: '🧸',
    lottie: 'https://res.cloudinary.com/dw3gi24uf/raw/upload/v1767633778/Mouth_bhhlub.json',
    sound: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
    gradient: 'from-pink-500 to-rose-500'
  },
  { 
    id: 'balloons', 
    name: 'Love Balloons', 
    price: 500,
    icon: '🎈',
    lottie: 'https://res.cloudinary.com/dw3gi24uf/raw/upload/v1767634139/Cat_feeling_love_emotionsexpression._Emojisticker_animation_ue4owe.json',
    sound: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
    gradient: 'from-purple-500 to-pink-500'
  },
  { 
    id: 'race', 
    name: 'Future Race', 
    price: 700,
    icon: '🏎️',
    lottie: 'https://res.cloudinary.com/dw3gi24uf/raw/upload/v1767633779/cars_q5q1hz.json',
    sound: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
    gradient: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'cake', 
    name: 'Birthday Cake', 
    price: 1000,
    icon: '🎂',
    lottie: 'https://res.cloudinary.com/dw3gi24uf/raw/upload/v1767633778/Ice_cream_lottie_animation_kxa0pn.json',
    sound: 'https://assets.mixkit.co/active_storage/sfx/2021/2021-preview.mp3',
    gradient: 'from-yellow-500 to-orange-500'
  },
  { 
    id: 'bouquet', 
    name: 'Red Bouquet', 
    price: 1000,
    icon: '💐',
    lottie: 'https://res.cloudinary.com/dw3gi24uf/raw/upload/v1767633779/Rose_ndeob0.json',
    sound: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    gradient: 'from-red-500 to-pink-500'
  },
  { 
    id: 'kiss', 
    name: 'Dream Kiss', 
    price: 1500,
    icon: '💋',
    lottie: 'https://res.cloudinary.com/dw3gi24uf/raw/upload/v1767633779/Love_and_Kiss_ocqhvu.json',
    sound: 'https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3',
    gradient: 'from-pink-500 to-purple-500'
  },
  { 
    id: 'sensual', 
    name: 'Sensual', 
    price: 2500,
    icon: '🌹',
    lottie: 'https://res.cloudinary.com/dw3gi24uf/raw/upload/v1767633778/Love_qqf7eo.json',
    sound: 'https://assets.mixkit.co/active_storage/sfx/2871/2871-preview.mp3',
    gradient: 'from-rose-500 to-red-600'
  },
  { 
    id: 'dhanteras', 
    name: 'Happy Dhanteras', 
    price: 4000,
    icon: '✨',
    lottie: 'https://res.cloudinary.com/dw3gi24uf/raw/upload/v1767634138/happy_lips_and_tongue_v2_txikuq.json',
    sound: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3',
    gradient: 'from-yellow-400 to-amber-600'
  },
]

  ApiResponse.success(res, 200, 'Gift retrieved', {
    gifts
  });
});


/**
 * Get gift history for a user
 * GET /api/gifts/history
 */
const getGiftHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type = 'all' } = req.query;

  let query = {};

  // Filter by type: sent, received, or all
  if (type === 'sent') {
    query.senderId = req.user._id;
  } else if (type === 'received') {
    const host = await Host.findOne({ userId: req.user._id });
    if (host) {
      query.recipientId = req.user._id;
    } else {
      return ApiResponse.success(res, 200, 'No gifts received', {
        gifts: [],
        pagination: { total: 0, page: 1, pages: 0 }
      });
    }
  } else {
    // All gifts (both sent and received)
    const host = await Host.findOne({ userId: req.user._id });
    query.$or = [
      { senderId: req.user._id },
      { recipientId: req.user._id }
    ];
  }

  const gifts = await Gift.find(query)
    .populate('senderId', 'name avatar')
    .populate('recipientId', 'name avatar')
    .populate('callId', 'startTime duration')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Gift.countDocuments(query);

  ApiResponse.success(res, 200, 'Gift history retrieved', {
    gifts,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

/**
 * Get gift statistics for host
 * GET /api/gifts/stats
 */
const getGiftStats = asyncHandler(async (req, res) => {
  const host = await Host.findOne({ userId: req.user._id });
  
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  const coinSeller = await CoinSeller.findOne({ userId: req.user._id });

  // Get gift breakdown
  const giftBreakdown = await Gift.aggregate([
    { 
      $match: { 
        recipientId: req.user._id 
      } 
    },
    {
      $group: {
        _id: '$giftType',
        count: { $sum: '$quantity' },
        totalDiamonds: { $sum: '$diamondsEarned' }
      }
    },
    {
      $sort: { totalDiamonds: -1 }
    }
  ]);

  // Get recent gifts
  const recentGifts = await Gift.find({ recipientId: req.user._id })
    .populate('senderId', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(10);

  // Get top gifters
  const topGifters = await Gift.aggregate([
    { 
      $match: { 
        recipientId: req.user._id 
      } 
    },
    {
      $group: {
        _id: '$senderId',
        totalGifts: { $sum: '$quantity' },
        totalDiamonds: { $sum: '$diamondsEarned' }
      }
    },
    {
      $sort: { totalDiamonds: -1 }
    },
    {
      $limit: 5
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $project: {
        _id: 1,
        totalGifts: 1,
        totalDiamonds: 1,
        'user.name': 1,
        'user.avatar': 1
      }
    }
  ]);

  ApiResponse.success(res, 200, 'Gift statistics retrieved', {
    totalGiftsReceived: host.totalGiftsReceived || 0,
    currentDiamondBalance: coinSeller?.diamondBalance || 0,
    totalDiamondsEarned: coinSeller?.totalDiamondsAllocated || 0,
    giftBreakdown,
    recentGifts,
    topGifters
  });
});

/**
 * Get call gifts (gifts sent during a specific call)
 * GET /api/gifts/call/:callId
 */
const getCallGifts = asyncHandler(async (req, res) => {
  const { callId } = req.params;

  const call = await Call.findById(callId);
  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Verify user is part of the call
  const isUser = call.userId.toString() === req.user._id.toString();
  const host = await Host.findOne({ userId: req.user._id });
  const isHost = host && call.hostId.toString() === host._id.toString();

  if (!isUser && !isHost && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to view this call\'s gifts');
  }

  const gifts = await Gift.find({ callId })
    .populate('senderId', 'name avatar')
    .sort({ createdAt: -1 });

  const totalGifts = gifts.reduce((sum, gift) => sum + gift.quantity, 0);
  const totalCoinsSpent = gifts.reduce((sum, gift) => sum + gift.coinsSpent, 0);
  const totalDiamondsEarned = gifts.reduce((sum, gift) => sum + gift.diamondsEarned, 0);

  ApiResponse.success(res, 200, 'Call gifts retrieved', {
    gifts,
    summary: {
      totalGifts,
      totalCoinsSpent,
      totalDiamondsEarned
    }
  });
});

module.exports = {
  sendGift,
  getGiftHistory,
  getGiftStats,
  getCallGifts,
  allGifts
};