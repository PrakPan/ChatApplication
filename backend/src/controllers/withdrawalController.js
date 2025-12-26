const Host = require('../models/Host');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// Create withdrawal request
const createWithdrawalRequest = asyncHandler(async (req, res) => {
  const { amount, bankAccountId } = req.body;
  const userId = req.user._id;

  // Validate amount
  if (!amount || amount < 1000) {
    throw new ApiError(400, 'Minimum withdrawal amount is 1000 diamonds');
  }

  // Get host profile
  const host = await Host.findOne({ userId }).populate('userId');
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  // Check if host has sufficient diamonds (using totalEarnings as diamond balance)
  if (host.totalEarnings < amount) {
    throw new ApiError(400, `Insufficient balance. You have ${host.totalEarnings} diamonds`);
  }

  // Get bank details
  let bankDetails = null;
  if (bankAccountId) {
    const account = host.bankDetails.find(acc => acc._id.toString() === bankAccountId);
    if (!account) {
      throw new ApiError(404, 'Bank account not found');
    }
    bankDetails = {
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      ifscCode: account.ifscCode,
      bankName: account.bankName,
      upiId: account.upiId
    };
  } else if (host.bankDetails && host.bankDetails.length > 0) {
    // Use first account if no specific account selected
    const account = host.bankDetails[0];
    bankDetails = {
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      ifscCode: account.ifscCode,
      bankName: account.bankName,
      upiId: account.upiId
    };
  } else {
    throw new ApiError(400, 'Please add bank details before requesting withdrawal');
  }

  // Deduct diamonds immediately
  host.totalEarnings -= amount;
  await host.save();

  // Create withdrawal request
  const withdrawal = await Withdrawal.create({
    hostId: host._id,
    amount,
    coins: amount, // Using coins field to store diamonds
    status: 'pending',
    bankDetails
  });

  logger.info(`Withdrawal request created: ${withdrawal._id} for host ${host._id}`);

  ApiResponse.success(res, 201, 'Withdrawal request submitted successfully', {
    withdrawal,
    remainingBalance: host.totalEarnings
  });
});

// Get host's withdrawal history
const getWithdrawalHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const userId = req.user._id;

  const host = await Host.findOne({ userId });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  const withdrawals = await Withdrawal.find({ hostId: host._id })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Withdrawal.countDocuments({ hostId: host._id });

  ApiResponse.success(res, 200, 'Withdrawal history retrieved', {
    withdrawals,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Get withdrawal statistics
const getWithdrawalStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const host = await Host.findOne({ userId });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  const [stats] = await Withdrawal.aggregate([
    { $match: { hostId: host._id } },
    {
      $group: {
        _id: null,
        totalRequested: { $sum: '$amount' },
        totalCompleted: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0]
          }
        },
        totalPending: {
          $sum: {
            $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
          }
        },
        totalRejected: {
          $sum: {
            $cond: [{ $eq: ['$status', 'rejected'] }, '$amount', 0]
          }
        }
      }
    }
  ]);

  ApiResponse.success(res, 200, 'Withdrawal stats retrieved', {
    currentBalance: host.totalEarnings,
    stats: stats || {
      totalRequested: 0,
      totalCompleted: 0,
      totalPending: 0,
      totalRejected: 0
    },
    rate: 100000,
  });
});

// Cancel pending withdrawal (only if still pending)
const cancelWithdrawal = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;
  const userId = req.user._id;

  const host = await Host.findOne({ userId });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  const withdrawal = await Withdrawal.findOne({
    _id: withdrawalId,
    hostId: host._id
  });

  if (!withdrawal) {
    throw new ApiError(404, 'Withdrawal request not found');
  }

  if (withdrawal.status !== 'pending') {
    throw new ApiError(400, 'Can only cancel pending withdrawals');
  }

  // Refund diamonds
  host.totalEarnings += withdrawal.amount;
  await host.save();

  // Update withdrawal status
  withdrawal.status = 'cancelled';
  await withdrawal.save();

  logger.info(`Withdrawal cancelled: ${withdrawalId}`);

  ApiResponse.success(res, 200, 'Withdrawal cancelled and diamonds refunded', {
    withdrawal,
    newBalance: host.totalEarnings
  });
});

// Admin: Get all withdrawals with filters
const getPendingWithdrawals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const query = {};
  if (status) query.status = status;

  const withdrawals = await Withdrawal.find(query)
    .populate({
      path: 'hostId',
      populate: {
        path: 'userId',
        select: 'name email phone avatar'
      }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Withdrawal.countDocuments(query);

  ApiResponse.success(res, 200, 'Withdrawals retrieved', {
    withdrawals,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Admin: Process withdrawal (approve)
const processWithdrawal = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;
  const { transactionId, notes } = req.body;

  const withdrawal = await Withdrawal.findById(withdrawalId).populate({
    path: 'hostId',
    populate: { path: 'userId' }
  });

  if (!withdrawal) {
    throw new ApiError(404, 'Withdrawal not found');
  }

  if (withdrawal.status !== 'pending') {
    throw new ApiError(400, 'Withdrawal already processed');
  }

  withdrawal.status = 'completed';
  withdrawal.transactionId = transactionId;
  withdrawal.notes = notes;
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  logger.info(`Withdrawal processed: ${withdrawalId}`);

  ApiResponse.success(res, 200, 'Withdrawal processed successfully', { withdrawal });
});

// Admin: Reject withdrawal (refund diamonds)
const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { withdrawalId } = req.params;
  const { reason } = req.body;

  const withdrawal = await Withdrawal.findById(withdrawalId).populate('hostId');
  if (!withdrawal) {
    throw new ApiError(404, 'Withdrawal not found');
  }

  if (withdrawal.status !== 'pending') {
    throw new ApiError(400, 'Withdrawal already processed');
  }

  // Refund diamonds to host
  const host = await Host.findById(withdrawal.hostId);
  host.totalEarnings += withdrawal.amount;
  await host.save();

  withdrawal.status = 'rejected';
  withdrawal.rejectionReason = reason;
  await withdrawal.save();

  logger.info(`Withdrawal rejected: ${withdrawalId}, Reason: ${reason}`);

  ApiResponse.success(res, 200, 'Withdrawal rejected and diamonds refunded', { withdrawal });
});

module.exports = {
  createWithdrawalRequest,
  getWithdrawalHistory,
  getWithdrawalStats,
  cancelWithdrawal,
  processWithdrawal,
  rejectWithdrawal,
  getPendingWithdrawals
};