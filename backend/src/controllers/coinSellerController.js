const User = require('../models/User');
const CoinSeller = require('../models/CoinSeller');
const DiamondTransaction = require('../models/DiamondTransaction');
const Level = require('../models/Level');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// ============= Admin: Manage Coin Sellers =============

const assignCoinSeller = asyncHandler(async (req, res) => {
  const { userId, initialDiamonds = 0, notes } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Check if already a coin seller
  const existing = await CoinSeller.findOne({ userId });
  if (existing) {
    throw new ApiError(400, 'User is already a coin seller');
  }

  // Update user role
  user.isCoinSeller = true;
  await user.save();

  // Create coin seller profile
  const coinSeller = await CoinSeller.create({
    userId,
    diamondBalance: initialDiamonds,
    totalDiamondsAllocated: initialDiamonds,
    assignedBy: req.user._id,
    notes
  });

  // Create allocation transaction if diamonds provided
  if (initialDiamonds > 0) {
    await DiamondTransaction.create({
      coinSellerId: coinSeller._id,
      recipientId: userId,
      amount: initialDiamonds,
      type: 'allocation',
      status: 'completed',
      canWithdraw: false,
      withdrawalDeadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      notes: `Initial allocation by admin`
    });
  }

  logger.info(`Coin seller assigned: ${userId} by admin ${req.user.email}`);

  ApiResponse.success(res, 201, 'Coin seller assigned successfully', { coinSeller });
});

const removeCoinSeller = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const coinSeller = await CoinSeller.findOne({ userId });
  if (!coinSeller) {
    throw new ApiError(404, 'Coin seller not found');
  }

  coinSeller.isActive = false;
  await coinSeller.save();

  const user = await User.findById(userId);
  if (user) {
    user.isCoinSeller = false;
    await user.save();
  }

  logger.info(`Coin seller removed: ${userId}`);

  ApiResponse.success(res, 200, 'Coin seller removed successfully');
});

const addDiamondsToCoinSeller = asyncHandler(async (req, res) => {
  const { coinSellerId } = req.params;
  const { amount, notes } = req.body;

  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Invalid amount');
  }

  const coinSeller = await CoinSeller.findById(coinSellerId);
  if (!coinSeller) {
    throw new ApiError(404, 'Coin seller not found');
  }

  await coinSeller.addDiamonds(amount);

  // Create allocation transaction
  await DiamondTransaction.create({
    coinSellerId: coinSeller._id,
    recipientId: coinSeller.userId,
    amount,
    type: 'allocation',
    status: 'completed',
    canWithdraw: false,
    withdrawalDeadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    notes: notes || `Diamonds allocated by admin`
  });

  logger.info(`Diamonds added to coin seller ${coinSellerId}: ${amount}`);

  ApiResponse.success(res, 200, 'Diamonds added successfully', {
    newBalance: coinSeller.diamondBalance,
    diamondsAdded: amount
  });
});

const getAllCoinSellers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isActive } = req.query;

  const query = {};
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const coinSellers = await CoinSeller.find(query)
    .populate('userId', 'name email phone')
    .populate('assignedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await CoinSeller.countDocuments(query);

  ApiResponse.success(res, 200, 'Coin sellers retrieved', {
    coinSellers,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// ============= Coin Seller: Distribute Diamonds =============

const distributeDiamonds = asyncHandler(async (req, res) => {
  const { recipientId, amount, notes } = req.body;

  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Invalid amount');
  }

  // Get coin seller profile
  const coinSeller = await CoinSeller.findOne({ userId: req.user._id, isActive: true });
  if (!coinSeller) {
    throw new ApiError(403, 'You are not an active coin seller');
  }

  // Check balance
  if (!coinSeller.hasEnoughDiamonds(amount)) {
    throw new ApiError(400, 'Insufficient diamond balance');
  }

  // Get recipient
  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new ApiError(404, 'Recipient not found');
  }

  // Deduct from seller
  await coinSeller.deductDiamonds(amount);

  // Add to recipient coin balance
  recipient.coinBalance += amount;
  await recipient.save();

  // Update recipient's rich level
  let level = await Level.findOne({ userId: recipientId });
  if (!level) {
    level = await Level.create({ userId: recipientId });
  }
  level.totalDiamondsRecharged += amount;
  await level.save();

  // Create distribution transaction (withdrawable for 24 hours)
  const transaction = await DiamondTransaction.create({
    coinSellerId: coinSeller._id,
    recipientId,
    amount,
    type: 'distribution',
    status: 'completed',
    canWithdraw: true,
    notes: notes || `Diamonds distributed by coin seller`
  });

  logger.info(`Diamonds distributed: ${amount} from seller ${req.user.email} to user ${recipient.email}`);

  ApiResponse.success(res, 200, 'Diamonds distributed successfully', {
    transaction,
    newBalance: coinSeller.diamondBalance,
    recipient: {
      name: recipient.name,
      newCoinBalance: recipient.coinBalance
    }
  });
});

const withdrawDiamonds = asyncHandler(async (req, res) => {
  const { transactionId } = req.body;

  // Get coin seller profile
  const coinSeller = await CoinSeller.findOne({ userId: req.user._id, isActive: true });
  if (!coinSeller) {
    throw new ApiError(403, 'You are not an active coin seller');
  }

  // Get transaction
  const transaction = await DiamondTransaction.findById(transactionId)
    .populate('recipientId', 'name email coinBalance');

  if (!transaction) {
    throw new ApiError(404, 'Transaction not found');
  }

  // Verify ownership
  if (transaction.coinSellerId.toString() !== coinSeller._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  // Check if withdrawal is allowed
  if (!transaction.isWithdrawalAllowed()) {
    throw new ApiError(400, 'Withdrawal period expired or transaction not eligible');
  }

  const recipient = transaction.recipientId;

  // Check if recipient has enough coins
  if (recipient.coinBalance < transaction.amount) {
    throw new ApiError(400, 'Recipient has insufficient balance for withdrawal');
  }

  // Deduct from recipient
  recipient.coinBalance -= transaction.amount;
  await recipient.save();

  // Add back to seller
  coinSeller.diamondBalance += transaction.amount;
  await coinSeller.save();

  // Update recipient's rich level (decrease)
  const level = await Level.findOne({ userId: recipient._id });
  if (level) {
    level.totalDiamondsRecharged = Math.max(0, level.totalDiamondsRecharged - transaction.amount);
    await level.save();
  }

  // Update transaction
  transaction.status = 'withdrawn';
  transaction.canWithdraw = false;
  transaction.withdrawnAt = new Date();
  await transaction.save();

  logger.info(`Diamonds withdrawn: ${transaction.amount} from user ${recipient.email} by seller ${req.user.email}`);

  ApiResponse.success(res, 200, 'Diamonds withdrawn successfully', {
    amount: transaction.amount,
    newBalance: coinSeller.diamondBalance,
    recipient: {
      name: recipient.name,
      newCoinBalance: recipient.coinBalance
    }
  });
});

const getWithdrawableTransactions = asyncHandler(async (req, res) => {
  const coinSeller = await CoinSeller.findOne({ userId: req.user._id });
  if (!coinSeller) {
    throw new ApiError(404, 'Coin seller profile not found');
  }

  const transactions = await DiamondTransaction.getWithdrawableTransactions(coinSeller._id);

  ApiResponse.success(res, 200, 'Withdrawable transactions retrieved', { transactions });
});

const getCoinSellerDashboard = asyncHandler(async (req, res) => {
  const coinSeller = await CoinSeller.findOne({ userId: req.user._id })
    .populate('userId', 'name email');

  if (!coinSeller) {
    throw new ApiError(404, 'Coin seller profile not found');
  }

  // Get transaction stats
  const [distributionCount, withdrawalCount, withdrawableTransactions] = await Promise.all([
    DiamondTransaction.countDocuments({ 
      coinSellerId: coinSeller._id, 
      type: 'distribution' 
    }),
    DiamondTransaction.countDocuments({ 
      coinSellerId: coinSeller._id, 
      status: 'withdrawn' 
    }),
    DiamondTransaction.getWithdrawableTransactions(coinSeller._id)
  ]);

  const stats = {
    diamondBalance: coinSeller.diamondBalance,
    totalAllocated: coinSeller.totalDiamondsAllocated,
    totalDistributed: coinSeller.totalDiamondsDistributed,
    totalWithdrawn: coinSeller.totalDiamondsWithdrawn,
    distributionCount,
    withdrawalCount,
    withdrawableAmount: withdrawableTransactions.reduce((sum, t) => sum + t.amount, 0),
    withdrawableCount: withdrawableTransactions.length
  };

  ApiResponse.success(res, 200, 'Dashboard data retrieved', stats);
});

const getDistributionHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;

  const coinSeller = await CoinSeller.findOne({ userId: req.user._id });
  if (!coinSeller) {
    throw new ApiError(404, 'Coin seller profile not found');
  }

  const query = { 
    coinSellerId: coinSeller._id,
    type: { $in: ['distribution', 'withdrawal'] }
  };
  if (status) query.status = status;

  const transactions = await DiamondTransaction.find(query)
    .populate('recipientId', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await DiamondTransaction.countDocuments(query);

  ApiResponse.success(res, 200, 'Distribution history retrieved', {
    transactions,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

module.exports = {
  // Admin endpoints
  assignCoinSeller,
  removeCoinSeller,
  addDiamondsToCoinSeller,
  getAllCoinSellers,
  
  // Coin seller endpoints
  distributeDiamonds,
  withdrawDiamonds,
  getWithdrawableTransactions,
  getCoinSellerDashboard,
  getDistributionHistory
};