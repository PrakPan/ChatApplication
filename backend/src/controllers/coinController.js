const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { createOrder, verifyPayment } = require('../services/paymentService');
const { COIN_PACKAGES } = require('../utils/constants');
const logger = require('../utils/logger');

const getCoinPackages = asyncHandler(async (req, res) => {
  ApiResponse.success(res, 200, 'Coin packages retrieved', COIN_PACKAGES);
});

const getCoinBalance = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  ApiResponse.success(res, 200, 'Balance retrieved', { 
    balance: user.coinBalance 
  });
});

const createCoinOrder = asyncHandler(async (req, res) => {
  const { packageId } = req.body;

  const pkg = COIN_PACKAGES.find(p => p.id === packageId);
  if (!pkg) {
    throw new ApiError(400, 'Invalid package');
  }

  const order = await createOrder({
    amount: pkg.price,
    currency: pkg.currency,
    receipt: `order_${Date.now()}`,
    notes: {
      userId: req.user._id.toString(),
      coins: pkg.coins,
      packageId: pkg.id
    }
  });

  // Create pending transaction
  await Transaction.create({
    userId: req.user._id,
    type: 'purchase',
    amount: pkg.price,
    coins: pkg.coins,
    status: 'pending',
    orderId: order.id,
    metadata: { packageId: pkg.id }
  });

  logger.info(`Coin order created: User ${req.user.email}, Package ${packageId}`);

  ApiResponse.success(res, 200, 'Order created successfully', { order, package: pkg });
});

const verifyPaymentAndAddCoins = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Verify payment signature
  const isValid = verifyPayment({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature
  });

  if (!isValid) {
    throw new ApiError(400, 'Payment verification failed');
  }

  // Find transaction
  const transaction = await Transaction.findOne({ 
    orderId: razorpay_order_id,
    userId: req.user._id
  });

  if (!transaction) {
    throw new ApiError(404, 'Transaction not found');
  }

  if (transaction.status === 'completed') {
    throw new ApiError(400, 'Transaction already completed');
  }

  // Update transaction
  transaction.status = 'completed';
  transaction.paymentId = razorpay_payment_id;
  transaction.paymentMethod = 'razorpay';
  await transaction.save();

  // Add coins to user balance
  const user = await User.findById(req.user._id);
  user.coinBalance += transaction.coins;
  await user.save();

  logger.info(`Payment verified: User ${user.email}, Coins added: ${transaction.coins}`);

  ApiResponse.success(res, 200, 'Payment verified and coins added', {
    balance: user.coinBalance,
    coinsAdded: transaction.coins
  });
});

const getTransactionHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;

  const query = { userId: req.user._id };
  if (type) query.type = type;

  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Transaction.countDocuments(query);

  ApiResponse.success(res, 200, 'Transaction history retrieved', {
    transactions,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

module.exports = {
  getCoinPackages,
  getCoinBalance,
  createCoinOrder,
  verifyPaymentAndAddCoins,
  getTransactionHistory
};