const Host = require('../models/Host');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// Constants
const DIAMOND_TO_INR_RATE = 0.01; // 100,000 diamonds = 1000 INR, so 1 diamond = 0.01 INR
const MIN_WITHDRAWAL_DIAMONDS = 1000;

// Create withdrawal request
const createWithdrawalRequest = asyncHandler(async (req, res) => {
  const { amount, bankAccountId } = req.body;
  const userId = req.user._id;

  // Validate amount
  if (!amount || amount < MIN_WITHDRAWAL_DIAMONDS) {
    throw new ApiError(400, `Minimum withdrawal amount is ${MIN_WITHDRAWAL_DIAMONDS} diamonds`);
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

  // Calculate INR amount
  const inrAmount = Math.round(amount * DIAMOND_TO_INR_RATE);

  // Deduct diamonds immediately
  host.totalEarnings -= amount;
  await host.save();

  // Create withdrawal request
  const withdrawal = await Withdrawal.create({
    hostId: host._id,
    amount,
    coins: amount, // Using coins field to store diamonds
    inrAmount, // Add INR amount
    status: 'pending',
    bankDetails
  });

  logger.info(`Withdrawal request created: ${withdrawal._id} for host ${host._id}`);

  ApiResponse.success(res, 201, 'Withdrawal request submitted successfully', {
    withdrawal,
    remainingBalance: host.totalEarnings,
    conversion: {
      rate: DIAMOND_TO_INR_RATE,
      inrAmount,
      diamonds: amount
    }
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

  // Calculate total INRs for the returned withdrawals
  const withdrawalsWithInr = withdrawals.map(withdrawal => ({
    ...withdrawal.toObject(),
    inrAmount: withdrawal.amount * DIAMOND_TO_INR_RATE
  }));

  const total = await Withdrawal.countDocuments({ hostId: host._id });

  ApiResponse.success(res, 200, 'Withdrawal history retrieved', {
    withdrawals: withdrawalsWithInr,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    },
    conversionRate: DIAMOND_TO_INR_RATE
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
        totalDiamondsRequested: { $sum: '$amount' },
        totalDiamondsCompleted: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0]
          }
        },
        totalDiamondsPending: {
          $sum: {
            $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
          }
        },
        totalDiamondsRejected: {
          $sum: {
            $cond: [{ $eq: ['$status', 'rejected'] }, '$amount', 0]
          }
        }
      }
    }
  ]);

  // Calculate INR amounts
  const totalInrRequested = (stats?.totalDiamondsRequested || 0) * DIAMOND_TO_INR_RATE;
  const totalInrCompleted = (stats?.totalDiamondsCompleted || 0) * DIAMOND_TO_INR_RATE;
  const totalInrPending = (stats?.totalDiamondsPending || 0) * DIAMOND_TO_INR_RATE;
  const totalInrRejected = (stats?.totalDiamondsRejected || 0) * DIAMOND_TO_INR_RATE;
  const currentBalanceInr = host.totalEarnings * DIAMOND_TO_INR_RATE;

  ApiResponse.success(res, 200, 'Withdrawal stats retrieved', {
    currentBalance: {
      diamonds: host.totalEarnings,
      inr: Math.round(currentBalanceInr)
    },
    stats: {
      diamonds: stats || {
        totalRequested: 0,
        totalCompleted: 0,
        totalPending: 0,
        totalRejected: 0
      },
      inr: {
        totalRequested: Math.round(totalInrRequested),
        totalCompleted: Math.round(totalInrCompleted),
        totalPending: Math.round(totalInrPending),
        totalRejected: Math.round(totalInrRejected)
      }
    },
    conversionRate: DIAMOND_TO_INR_RATE,
    conversionNote: '100,000 diamonds = 1,000 INR'
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

  // Calculate current balance in INR
  const currentBalanceInr = host.totalEarnings * DIAMOND_TO_INR_RATE;

  // Update withdrawal status
  withdrawal.status = 'cancelled';
  await withdrawal.save();

  logger.info(`Withdrawal cancelled: ${withdrawalId}`);

  ApiResponse.success(res, 200, 'Withdrawal cancelled and diamonds refunded', {
    withdrawal,
    newBalance: {
      diamonds: host.totalEarnings,
      inr: Math.round(currentBalanceInr)
    },
    refundedAmount: {
      diamonds: withdrawal.amount,
      inr: Math.round(withdrawal.amount * DIAMOND_TO_INR_RATE)
    }
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

  // Add INR amounts to withdrawals
  const withdrawalsWithInr = withdrawals.map(withdrawal => ({
    ...withdrawal.toObject(),
    inrAmount: Math.round(withdrawal.amount * DIAMOND_TO_INR_RATE)
  }));

  const total = await Withdrawal.countDocuments(query);

  ApiResponse.success(res, 200, 'Withdrawals retrieved', {
    withdrawals: withdrawalsWithInr,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    },
    conversionRate: DIAMOND_TO_INR_RATE
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

  // Calculate INR amount if not already stored
  const inrAmount = withdrawal.inrAmount || Math.round(withdrawal.amount * DIAMOND_TO_INR_RATE);

  withdrawal.status = 'completed';
  withdrawal.transactionId = transactionId;
  withdrawal.notes = notes;
  withdrawal.processedAt = new Date();
  withdrawal.inrAmount = inrAmount; // Ensure INR amount is stored
  await withdrawal.save();

  logger.info(`Withdrawal processed: ${withdrawalId}`);

  ApiResponse.success(res, 200, 'Withdrawal processed successfully', {
    withdrawal: {
      ...withdrawal.toObject(),
      inrAmount
    }
  });
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

  ApiResponse.success(res, 200, 'Withdrawal rejected and diamonds refunded', {
    withdrawal: {
      ...withdrawal.toObject(),
      inrAmount: Math.round(withdrawal.amount * DIAMOND_TO_INR_RATE)
    },
    refundedAmount: {
      diamonds: withdrawal.amount,
      inr: Math.round(withdrawal.amount * DIAMOND_TO_INR_RATE)
    }
  });
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