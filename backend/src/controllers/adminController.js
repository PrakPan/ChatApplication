const User = require('../models/User');
const Host = require('../models/Host');
const Call = require('../models/Call');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

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
    .skip((page - 1) * limit);

  const total = await User.countDocuments(query);

  ApiResponse.success(res, 200, 'Users retrieved', {
    users,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

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

const approveHost = asyncHandler(async (req, res) => {
  const { hostId } = req.params;

  const host = await Host.findById(hostId);
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  host.status = 'approved';
  await host.save();

  logger.info(`Host approved: ${hostId}`);

  ApiResponse.success(res, 200, 'Host approved successfully', { host });
});

const rejectHost = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { reason } = req.body;

  const host = await Host.findById(hostId);
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  host.status = 'rejected';
  await host.save();

  // TODO: Send rejection email with reason

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

module.exports = {
  getDashboardStats,
  getAllUsers,
  getPendingHosts,
  approveHost,
  rejectHost,
  suspendHost,
  toggleUserStatus,
  getPendingWithdrawals,
  processWithdrawal,
  rejectWithdrawal,
  getRevenueStats
};