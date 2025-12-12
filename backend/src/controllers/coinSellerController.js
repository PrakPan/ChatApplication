const User = require('../models/User');
const CoinSeller = require('../models/CoinSeller');
const DiamondTransaction = require('../models/DiamondTransaction');
const mongoose = require('mongoose');

const assignCoinSeller = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, initialDiamonds, notes } = req.body;

    if (!userId) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const existingCoinSeller = await CoinSeller.findOne({ userId }).session(session);
    if (existingCoinSeller) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'User is already a coin seller' });
    }

    user.isCoinSeller = true;
    user.role = 'coinSeller';
    await user.save({ session });

    const coinSeller = new CoinSeller({
      userId,
      diamondBalance: initialDiamonds || 0,
      totalDiamondsAllocated: initialDiamonds || 0,
      assignedBy: req.user?._id,
      notes
    });

    await coinSeller.save({ session });

    if (initialDiamonds && initialDiamonds > 0) {
      const transaction = new DiamondTransaction({
        coinSellerId: coinSeller._id,
        recipientId: userId,
        amount: initialDiamonds,
        type: 'allocation',
        status: 'completed',
        canWithdraw: false,
        withdrawalDeadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        notes: 'Initial allocation'
      });
      await transaction.save({ session });
    }

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Coin seller assigned successfully',
      data: coinSeller
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

const removeCoinSeller = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId } = req.params;

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const coinSeller = await CoinSeller.findOne({ userId }).session(session);
    if (!coinSeller) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Coin seller not found' });
    }

    coinSeller.isActive = false;
    await coinSeller.save({ session });

    user.isCoinSeller = false;
    if (user.role === 'coinSeller') {
      user.role = 'user';
    }
    await user.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Coin seller removed successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

const addDiamondsToCoinSeller = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { coinSellerId } = req.params;
    const { amount, notes } = req.body;

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const coinSeller = await CoinSeller.findById(coinSellerId).session(session);
    if (!coinSeller) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Coin seller not found' });
    }

    coinSeller.diamondBalance += amount;
    coinSeller.totalDiamondsAllocated += amount;
    await coinSeller.save({ session });

    const transaction = new DiamondTransaction({
      coinSellerId: coinSeller._id,
      recipientId: coinSeller.userId,
      amount,
      type: 'allocation',
      status: 'completed',
      canWithdraw: false,
      withdrawalDeadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      notes: notes || 'Diamond allocation by admin'
    });
    await transaction.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Diamonds added successfully',
      data: {
        newBalance: coinSeller.diamondBalance,
        amountAdded: amount
      }
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

const getAllCoinSellers = async (req, res) => {

  console.log("Inside All")
  try {
    const { isActive } = req.query;
    const filter = {};
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const coinSellers = await CoinSeller.find(filter)
      .populate('userId', 'name email phone userId avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: coinSellers.length,
      data: coinSellers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const distributeDiamonds = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { recipientUserId, amount, sellingPrice, notes } = req.body;
    const coinSellerId = req.user.coinSellerId;

    if (!recipientUserId || !amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    const coinSeller = await CoinSeller.findById(coinSellerId).session(session);
    if (!coinSeller) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Coin seller not found' });
    }

    if (coinSeller.diamondBalance < amount) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Insufficient diamond balance' });
    }

    const recipient = await User.findOne({ userId: recipientUserId }).session(session);
    if (!recipient) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    recipient.coinBalance += amount;
    await recipient.save({ session });

    coinSeller.diamondBalance -= amount;
    coinSeller.totalDiamondsDistributed += amount;
    await coinSeller.save({ session });

    const transaction = new DiamondTransaction({
      coinSellerId: coinSeller._id,
      recipientId: recipient._id,
      amount,
      type: 'distribution',
      status: 'completed',
      canWithdraw: true,
      notes,
      metadata: { sellingPrice }
    });
    await transaction.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Diamonds distributed successfully',
      data: {
        transaction,
        remainingBalance: coinSeller.diamondBalance
      }
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

const withdrawDiamonds = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { transactionId } = req.body;
    const coinSellerId = req.user.coinSellerId;

    const transaction = await DiamondTransaction.findById(transactionId).session(session);
    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.coinSellerId.toString() !== coinSellerId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!transaction.isWithdrawalAllowed()) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Withdrawal not allowed or expired' });
    }

    const recipient = await User.findById(transaction.recipientId).session(session);
    if (!recipient) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    if (recipient.coinBalance < transaction.amount) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Recipient has insufficient balance' });
    }

    recipient.coinBalance -= transaction.amount;
    await recipient.save({ session });

    const coinSeller = await CoinSeller.findById(coinSellerId).session(session);
    coinSeller.diamondBalance += transaction.amount;
    coinSeller.totalDiamondsWithdrawn += transaction.amount;
    await coinSeller.save({ session });

    transaction.status = 'withdrawn';
    transaction.canWithdraw = false;
    transaction.withdrawnAt = new Date();
    await transaction.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Diamonds withdrawn successfully',
      data: {
        amount: transaction.amount,
        newBalance: coinSeller.diamondBalance
      }
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

const getWithdrawableTransactions = async (req, res) => {
  try {
    const coinSellerId = req.user.coinSellerId;

    const now = new Date();
    const transactions = await DiamondTransaction.find({
      coinSellerId,
      status: 'completed',
      canWithdraw: true,
      withdrawalDeadline: { $gte: now }
    }).populate('recipientId', 'name email coinBalance');

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCoinSellerDashboard = async (req, res) => {
  try {
    const coinSellerId = req.user.coinSellerId;

    const coinSeller = await CoinSeller.findById(coinSellerId).populate('userId', 'name email userId');

    if (!coinSeller) {
      return res.status(404).json({ success: false, message: 'Coin seller not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = await DiamondTransaction.find({
      coinSellerId,
      type: 'distribution',
      createdAt: { $gte: today }
    });

    const todayStats = {
      totalTransactions: todayTransactions.length,
      totalDiamondsDistributed: todayTransactions.reduce((sum, t) => sum + t.amount, 0),
      totalRevenue: todayTransactions.reduce((sum, t) => sum + (t.metadata?.sellingPrice || 0), 0)
    };

    res.json({
      success: true,
      data: {
        coinSeller,
        todayStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDistributionHistory = async (req, res) => {
  try {
    const coinSellerId = req.user.coinSellerId;
    const { page = 1, limit = 20, type } = req.query;

    const filter = { coinSellerId };
    if (type) {
      filter.type = type;
    }

    const transactions = await DiamondTransaction.find(filter)
      .populate('recipientId', 'name email userId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await DiamondTransaction.countDocuments(filter);

    res.json({
      success: true,
      data: transactions,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  assignCoinSeller,
  removeCoinSeller,
  addDiamondsToCoinSeller,
  getAllCoinSellers,
  distributeDiamonds,
  withdrawDiamonds,
  getWithdrawableTransactions,
  getCoinSellerDashboard,
  getDistributionHistory
};