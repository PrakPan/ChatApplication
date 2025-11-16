const User = require('../models/User');
const Host = require('../models/Host');
const Call = require('../models/Call');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const Level = require('../models/Level');



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
  const { page = 1, limit = 20 } = req.query;

  const withdrawals = await Withdrawal.find({ status: 'pending' })
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

  const total = await Withdrawal.countDocuments({ status: 'pending' });

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
    filteredHosts = hosts.filter(h => 
      h.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
      h.userId?.email?.toLowerCase().includes(search.toLowerCase()) ||
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

  const buildLeaderboard = async (userType) => {
    const leaderboard = await WeeklyLeaderboard.find({
      userType,
      weekStartDate: weekStart
    })
      .populate('userId', 'name email')
      .sort({ totalCallDuration: -1 })
      .limit(50)
      .lean();

    // Populate with level information
    const userIds = leaderboard.map(l => l.userId._id);
    const levels = await Level.find({ userId: { $in: userIds } });
    const levelMap = {};
    levels.forEach(l => {
      levelMap[l.userId.toString()] = l.currentLevel;
    });

    return leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      level: levelMap[entry.userId._id.toString()] || 1
    }));
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
  // ADD THESE MISSING FUNCTIONS:
  getPendingHosts,
  getPendingWithdrawals,
  processWithdrawal,
  rejectWithdrawal,
  getRevenueStats,
  toggleUserStatus  // if you have this route
};