const express = require('express');
const router = express.Router();
const {
  getCoinPackages,
  getCoinBalance,
  createCoinOrder,
  verifyPaymentAndAddCoins,
  getTransactionHistory
} = require('../controllers/coinController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validation');
const validators = require('../utils/validators');
const { paymentLimiter } = require('../middleware/rateLimiter');

// Public routes
router.get('/packages', getCoinPackages);

// Protected routes
router.use(authenticate);

router.get('/balance', getCoinBalance);
router.post('/create-order', paymentLimiter, validate(validators.createCoinOrder), createCoinOrder);
router.post('/verify-payment', paymentLimiter, verifyPaymentAndAddCoins);
router.get('/transactions', getTransactionHistory);

module.exports = router;