const User = require('../models/User');
const Host = require('../models/Host');
const Call = require('../models/Call');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const Level = require('../models/Level');
const WeeklyLeaderboard = require('../models/WeeklyLeaderboard');



const getPendingHosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const hosts = await Host.find({ status: 'pending' })
    .populate('userId', 'name email phone avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Host.countDocuments({ status: 'pending' });

  ApiResponse.success(res, 200, 'Pending hosts retrieved', {
    hosts,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});



const toggleUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.isActive = !user.isActive;
  await user.save();

  logger.info(`User status toggled: ${userId}, Active: ${user.isActive}`);

  ApiResponse.success(res, 200, 'User status updated', { 
    isActive: user.isActive 
  });
});

const getPendingWithdrawals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20,status } = req.query;

  const withdrawals = await Withdrawal.find({ status: status || 'pending' })
    .populate({
      path: 'hostId',
      populate: {
        path: 'userId',
        select: 'name email phone'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Withdrawal.countDocuments({ status: status || 'pending' });

  ApiResponse.success(res, 200, 'Pending withdrawals retrieved', {
    withdrawals,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

const processWithdrawal = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;
  const { transactionId, notes } = req.body;

  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (!withdrawal) {
    throw new ApiError(404, 'Withdrawal not found');
  }

  withdrawal.status = 'completed';
  withdrawal.transactionId = transactionId;
  withdrawal.notes = notes;
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  logger.info(`Withdrawal processed: ${withdrawalId}`);

  ApiResponse.success(res, 200, 'Withdrawal processed', { withdrawal });
});

const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;
  const { reason } = req.body;

  const withdrawal = await Withdrawal.findById(withdrawalId).populate('hostId');
  if (!withdrawal) {
    throw new ApiError(404, 'Withdrawal not found');
  }

  withdrawal.status = 'rejected';
  withdrawal.rejectionReason = reason;
  await withdrawal.save();

  // Refund coins to host
  const host = await Host.findById(withdrawal.hostId);
  host.totalEarnings += withdrawal.coins;
  await host.save();

  logger.info(`Withdrawal rejected: ${withdrawalId}, Reason: ${reason}`);

  ApiResponse.success(res, 200, 'Withdrawal rejected', { withdrawal });
});

const updateWithdrawalStatus = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;
  const { status, transactionId, notes, rejectionReason } = req.body;
  
  if (!['processing', 'completed', 'failed', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }
  
  const withdrawal = await Withdrawal.findById(withdrawalId).populate('hostId');
  
  if (!withdrawal) {
    throw new ApiError(404, 'Withdrawal not found');
  }
  
  if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
    throw new ApiError(400, 'Cannot update withdrawal in current status');
  }
  
  const previousStatus = withdrawal.status;
  withdrawal.status = status;
  withdrawal.processedBy = req.user?._id || 'Admin';
  withdrawal.processedAt = new Date();
  
  if (transactionId) {
    withdrawal.transactionId = transactionId;
  }
  
  if (notes) {
    withdrawal.adminNotes = notes;
  }
  
  // Handle status changes
  if (status === 'rejected' || status === 'failed') {
    if (!rejectionReason && status === 'rejected') {
      throw new ApiError(400, 'Rejection reason is required');
    }
    
    withdrawal.rejectionReason = rejectionReason || 'Processing failed';
    
    // REFUND DIAMONDS
    const host = await Host.findById(withdrawal.hostId._id);
    host.totalEarnings += withdrawal.amount;
    await host.save();
    
    // Create refund transaction
    await Transaction.create({
      userId: withdrawal.hostId.userId,
      type: 'withdrawal_refund',
      amount: withdrawal.amount,
      status: 'completed',
      description: `Withdrawal ${status} - Refund of ${withdrawal.amount} diamonds`,
      metadata: {
        withdrawalId: withdrawal._id,
        reason: withdrawal.rejectionReason
      }
    });
    
    logger.info(`Withdrawal ${withdrawalId} ${status}. Refunded ${withdrawal.amount} diamonds to host ${host._id}`);
  }
  
  if (status === 'completed') {
    if (!transactionId) {
      throw new ApiError(400, 'Transaction ID is required for completed withdrawals');
    }
    
    // Update transaction
    await Transaction.findOneAndUpdate(
      { 'metadata.withdrawalId': withdrawal._id },
      { 
        status: 'completed',
        description: `Withdrawal completed - ${withdrawal.amount} diamonds (TXN: ${transactionId})`
      }
    );
    
    logger.info(`Withdrawal ${withdrawalId} completed. Transaction ID: ${transactionId}`);
  }
  
  await withdrawal.save();
  
  ApiResponse.success(res, 200, `Withdrawal status updated to ${status}`, {
    withdrawal
  });
});



const getRevenueStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const matchStage = {
    type: 'purchase',
    status: 'completed'
  };

  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const revenue = await Transaction.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } }
  ]);

  ApiResponse.success(res, 200, 'Revenue stats retrieved', revenue);
});


const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalHosts,
    totalCalls,
    totalRevenue,
    pendingWithdrawals,
    pendingHosts
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Host.countDocuments({ status: 'approved' }),
    Call.countDocuments({ status: 'completed' }),
    Transaction.aggregate([
      { $match: { type: 'purchase', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Withdrawal.countDocuments({ status: 'pending' }),
    Host.countDocuments({ status: 'pending' })
  ]);

  const stats = {
    totalUsers,
    totalHosts,
    totalCalls,
    totalRevenue: totalRevenue[0]?.total || 0,
    pendingWithdrawals,
    pendingHosts
  };

  ApiResponse.success(res, 200, 'Dashboard stats retrieved', stats);
});

// ============= User Management =============
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', role } = req.query;

  const query = {};
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') }
    ];
  }

  const users = await User.find(query)
    .select('-password -refreshToken')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Populate with level information
  const userIds = users.map(u => u._id);
  const levels = await Level.find({ userId: { $in: userIds } });
  const levelMap = {};
  levels.forEach(l => {
    levelMap[l.userId.toString()] = l.currentLevel;
  });

  const usersWithLevel = users.map(u => ({
    ...u,
    level: levelMap[u._id.toString()] || 1
  }));

  const total = await User.countDocuments(query);

  ApiResponse.success(res, 200, 'Users retrieved', {
    users: usersWithLevel,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role = 'user', level = 1 } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
  if (existingUser) {
    throw new ApiError(400, 'User with this email or phone already exists');
  }

  const user = await User.create({
    name,
    email,
    phone,
    password,
    role,
    isActive: true,
    isVerified: true
  });

  // Create level entry
  await Level.create({
    userId: user._id,
    currentLevel: level
  });

  logger.info(`User created by admin: ${user._id}`);

  ApiResponse.success(res, 201, 'User created successfully', { 
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      level
    }
  });
});

const addCoinsToUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { amount, reason } = req.body;

  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Invalid amount');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.coinBalance += amount;
  await user.save();

  // Create transaction record
  await Transaction.create({
    userId: user._id,
    type: 'purchase',
    amount: 0,
    coins: amount,
    status: 'completed',
    description: reason || 'Coins added by admin',
    metadata: { addedBy: 'admin', reason }
  });

  logger.info(`Coins added to user ${userId}: ${amount}, Reason: ${reason}`);

  ApiResponse.success(res, 200, 'Coins added successfully', {
    userId: user._id,
    newBalance: user.coinBalance,
    coinsAdded: amount
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Delete related data
  await Promise.all([
    Level.deleteOne({ userId }),
    WeeklyLeaderboard.deleteMany({ userId }),
    Call.deleteMany({ userId })
  ]);

  await User.findByIdAndDelete(userId);

  logger.info(`User deleted by admin: ${userId}`);

  ApiResponse.success(res, 200, 'User deleted successfully');
});

// ============= Host Management =============
const getAllHosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', status } = req.query;

  const query = {};
  if (status) query.status = status;

  const hosts = await Host.find(query)
    .populate('userId', 'name email phone avatar')
    .sort({ createdAt: -1 })
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

  /**
   * -----------------------------
   * LEVELS
   * -----------------------------
   */
  const userIds = filteredHosts
    .map(h => h.userId?._id)
    .filter(Boolean);

  const levels = await Level.find({ userId: { $in: userIds } }).lean();
  const levelMap = {};
  levels.forEach(l => {
    levelMap[l.userId.toString()] = l.currentLevel;
  });

  /**
   * -----------------------------
   * FREE TARGETS
   * -----------------------------
   */
  const FreeTarget = require('../models/FreeTarget');

  const hostIds = filteredHosts.map(h => h._id);
  const freeTargets = await FreeTarget.find({
    hostId: { $in: hostIds }
  }).lean();

  const freeTargetMap = {};
  freeTargets.forEach(ft => {
    freeTargetMap[ft.hostId.toString()] = ft.isEnabled;
  });

  /**
   * -----------------------------
   * FINAL RESPONSE MAPPING
   * -----------------------------
   */
  const hostsWithExtras = filteredHosts.map(h => ({
    ...h,
    level: levelMap[h.userId?._id?.toString()] || 1,
    freeTargetEnabled: freeTargetMap[h._id.toString()] || false
  }));

  const total = await Host.countDocuments(query);

  ApiResponse.success(res, 200, 'Hosts retrieved', {
    hosts: hostsWithExtras,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});


const createHost = asyncHandler(async (req, res) => {
  const { 
    name, email, phone, password, 
    ratePerMinute = 50, bio, level = 1 
  } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
  if (existingUser) {
    throw new ApiError(400, 'User with this email or phone already exists');
  }

  // Create user account
  const user = await User.create({
    name,
    email,
    phone,
    password,
    role: 'host',
    isActive: true,
    isVerified: true
  });

  // Create host profile
  const host = await Host.create({
    userId: user._id,
    bio,
    ratePerMinute,
    status: 'approved',
    isKycVerified: true
  });

  // Create level entry
  await Level.create({
    userId: user._id,
    currentLevel: level
  });

  logger.info(`Host created by admin: ${host._id}`);

  ApiResponse.success(res, 201, 'Host created successfully', {
    host: {
      _id: host._id,
      userId: user._id,
      name: user.name,
      email: user.email,
      ratePerMinute,
      level
    }
  });
});

const approveHost = asyncHandler(async (req, res) => {
  const { hostId } = req.params;

  const host = await Host.findById(hostId).populate('userId');
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  host.status = 'approved';
  await host.save();

  // Send approval email
  try {
    await sendHostApprovalEmail(host.userId, host);
  } catch (error) {
    logger.error(`Failed to send approval email: ${error.message}`);
  }

  logger.info(`Host approved: ${hostId}`);

  ApiResponse.success(res, 200, 'Host approved successfully', { host });
});

const rejectHost = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { reason } = req.body;

  const host = await Host.findById(hostId).populate('userId');
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  host.status = 'rejected';
  await host.save();

  // Send rejection email
  try {
    await sendHostRejectionEmail(host.userId, reason);
  } catch (error) {
    logger.error(`Failed to send rejection email: ${error.message}`);
  }

  logger.info(`Host rejected: ${hostId}, Reason: ${reason}`);

  ApiResponse.success(res, 200, 'Host rejected', { host });
});

const suspendHost = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { reason } = req.body;

  const host = await Host.findById(hostId);
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  host.status = 'suspended';
  host.isOnline = false;
  await host.save();

  logger.info(`Host suspended: ${hostId}, Reason: ${reason}`);

  ApiResponse.success(res, 200, 'Host suspended', { host });
});

const addCoinsToHost = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { amount, reason } = req.body;

  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Invalid amount');
  }

  const host = await Host.findById(hostId).populate('userId');
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  host.totalEarnings += amount;
  await host.save();

  // Also update user's coin balance
  const user = await User.findById(host.userId._id);
  user.coinBalance += amount;
  await user.save();

  logger.info(`Coins added to host ${hostId}: ${amount}, Reason: ${reason}`);

  ApiResponse.success(res, 200, 'Coins added successfully', {
    hostId: host._id,
    newEarnings: host.totalEarnings,
    coinsAdded: amount
  });
});

const deleteHost = asyncHandler(async (req, res) => {
  const { hostId } = req.params;

  const host = await Host.findById(hostId);
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  const userId = host.userId;

  // Delete related data
  await Promise.all([
    Host.findByIdAndDelete(hostId),
    Level.deleteOne({ userId }),
    WeeklyLeaderboard.deleteMany({ userId }),
    Call.deleteMany({ hostId })
  ]);

  logger.info(`Host deleted by admin: ${hostId}`);

  ApiResponse.success(res, 200, 'Host deleted successfully');
});

const updateHostGrade = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { grade } = req.body;
  
  if (!['D', 'C', 'B', 'A'].includes(grade)) {
    throw new ApiError(400, 'Invalid grade. Must be D, C, B, or A');
  }
  
  const host = await Host.findById(hostId);
  
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }
  
  const oldGrade = host.grade;
  const oldRate = host.ratePerMinute;
  
  host.grade = grade;
  // Rate will be auto-updated by pre-save hook
  await host.save();
  
  logger.info(`Host ${hostId} grade updated from ${oldGrade} to ${grade}. Rate: ${oldRate} -> ${host.ratePerMinute}`);
  
  ApiResponse.success(res, 200, 'Host grade updated successfully', {
    host,
    oldGrade,
    newGrade: grade,
    oldRate,
    newRate: host.ratePerMinute
  });
});

// ============= Call History =============
const getCallHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, userId, hostId, status, search } = req.query;

  const query = {};
  if (userId) query.userId = userId;
  if (hostId) query.hostId = hostId;
  if (status) query.status = status;

  const calls = await Call.find(query)
    .populate('userId', 'name email phone')
    .populate({
      path: 'hostId',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Filter by search if provided
  let filteredCalls = calls;
  if (search) {
    filteredCalls = calls.filter(c => 
      c._id.toString().includes(search) ||
      c.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.hostId?.userId?.name?.toLowerCase().includes(search.toLowerCase())
    );
  }

  const total = await Call.countDocuments(query);

  ApiResponse.success(res, 200, 'Call history retrieved', {
    calls: filteredCalls,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

const getUserCallHistory = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const calls = await Call.find({ userId })
    .populate({
      path: 'hostId',
      populate: {
        path: 'userId',
        select: 'name email'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Call.countDocuments({ userId });

  ApiResponse.success(res, 200, 'User call history retrieved', {
    calls,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

const getHostCallHistory = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const calls = await Call.find({ hostId })
    .populate('userId', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Call.countDocuments({ hostId });

  ApiResponse.success(res, 200, 'Host call history retrieved', {
    calls,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// ============= Weekly Leaderboard =============
const getWeeklyLeaderboard = asyncHandler(async (req, res) => {
  const { type = 'both' } = req.query;

  // Get current week start and end dates
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // Frame URLs
  const richLevels = [
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945737/host-photos/Level_1_zsfafn.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945737/host-photos/Level_2_wys7gf.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945738/host-photos/Level_3_ahksl6.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945738/host-photos/Level_4_w4blac.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945738/host-photos/Level_5_qjzrgy.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_6_wiqtui.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945738/host-photos/Level_7_mezsy6.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_8_ho0mkc.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_9_lmpfgi.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_10_j7km2v.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945740/host-photos/Level_11_aduvse.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_12_ytcxam.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_13_hefdjb.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945740/host-photos/Level_14_iutvsp.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945738/host-photos/Level_15_u3zmdb.png"
  ];

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

  const buildLeaderboard = async (userType) => {
    const leaderboard = await WeeklyLeaderboard.find({
      userType,
      weekStartDate: weekStart
    })
      .populate('userId', 'name email avatar role')
      .sort({ totalCallDuration: -1 })
      .limit(50)
      .lean();

    // Populate with level information
    const userIds = leaderboard.map(l => l.userId._id);
    const levels = await Level.find({ userId: { $in: userIds } });
    const levelMap = {};
    levels.forEach(l => {
      levelMap[l.userId.toString()] = {
        richLevel: l.richLevel || 1,
        charmLevel: l.charmLevel || 1
      };
    });

    return leaderboard.map((entry, index) => {
      const userId = entry.userId._id.toString();
      const levelData = levelMap[userId] || { richLevel: 1, charmLevel: 1 };
      const userRole = entry.userId.role;

      // Determine frameUrl based on role
      let frameUrl = null;
      if (userRole === 'user') {
        const frameIndex = levelData.richLevel - 1;
        frameUrl = richLevels[frameIndex] || richLevels[0];
      } else if (userRole === 'host') {
        const frameIndex = levelData.charmLevel - 1;
        frameUrl = charmLevels[frameIndex] || charmLevels[0];
      }

      return {
        ...entry,
        rank: index + 1,
        richLevel: levelData.richLevel,
        charmLevel: levelData.charmLevel,
        frameUrl,
        userId: {
          ...entry.userId,
          frameUrl
        }
      };
    });
  };

  const result = {};

  if (type === 'user' || type === 'both') {
    result.users = await buildLeaderboard('user');
  }

  if (type === 'host' || type === 'both') {
    result.hosts = await buildLeaderboard('host');
  }

  ApiResponse.success(res, 200, 'Weekly leaderboard retrieved', {
    weekStart,
    weekEnd,
    ...result
  });
});

// ============= Level Management =============
const updateUserLevel = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { level } = req.body;

  if (!level || level < 1 || level > 100) {
    throw new ApiError(400, 'Level must be between 1 and 100');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  let levelDoc = await Level.findOne({ userId });
  
  if (!levelDoc) {
    levelDoc = await Level.create({
      userId,
      currentLevel: level
    });
  } else {
    levelDoc.currentLevel = level;
    await levelDoc.save();
  }

  logger.info(`User level updated: ${userId}, New Level: ${level}`);

  ApiResponse.success(res, 200, 'Level updated successfully', {
    userId,
    level: levelDoc.currentLevel
  });
});

const updateHostStatus = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { status, reason } = req.body;

  const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
  
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  const host = await Host.findById(hostId).populate('userId', 'name email');
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  // Store the previous status for logging
  const previousStatus = host.status;
  
  host.status = status;
  
  // Add reason if provided (especially for rejections/suspensions)
  if (reason) {
    host.rejectionReason = reason;
  }

  await host.save();

  logger.info(`Host status updated: ${hostId} from ${previousStatus} to ${status} by admin`);

  // Send email notifications for status changes
  try {
    if (status === 'approved' && previousStatus !== 'approved') {
      // await sendHostApprovalEmail(host.userId, host);
    } else if (status === 'rejected') {
      // await sendHostRejectionEmail(host.userId, reason || 'No reason provided');
    } else if (status === 'suspended') {
      // await sendHostSuspensionEmail(host.userId, reason || 'Account suspended by admin');
    }
  } catch (error) {
    logger.error(`Failed to send status email: ${error.message}`);
  }

  ApiResponse.success(res, 200, `Host status updated to ${status}`, { host });
});

module.exports = {
  getDashboardStats,
  getAllUsers,
  createUser,
  addCoinsToUser,
  deleteUser,
  getAllHosts,
  createHost,
  approveHost,
  rejectHost,
  suspendHost,
  addCoinsToHost,
  deleteHost,
  getCallHistory,
  getUserCallHistory,
  getHostCallHistory,
  getWeeklyLeaderboard,
  updateUserLevel,
  updateHostGrade,
  // ADD THESE MISSING FUNCTIONS:
  getPendingHosts,
  getPendingWithdrawals,
  processWithdrawal,
  rejectWithdrawal,
  getRevenueStats,
  updateHostStatus,
  toggleUserStatus, // if you have this route
  updateWithdrawalStatus
};