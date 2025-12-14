const express = require('express');
const router = express.Router();
const { authenticate, authorize, isCoinSeller } = require('../middleware/auth');
const coinSellerController = require('../controllers/coinSellerController');

// Admin routes - require authentication and admin authorization
router.post('/assign', coinSellerController.assignCoinSeller);
router.delete('/:userId', coinSellerController.removeCoinSeller);
router.post('/:coinSellerId/add-diamonds', coinSellerController.addDiamondsToCoinSeller);
router.get('/all', coinSellerController.getAllCoinSellers);

// Coin seller routes - require authentication FIRST, then isCoinSeller check
router.post('/distribute', authenticate, isCoinSeller, coinSellerController.distributeDiamonds);
router.post('/withdraw', authenticate, isCoinSeller, coinSellerController.withdrawDiamonds);
router.get('/withdrawable', authenticate, isCoinSeller, coinSellerController.getWithdrawableTransactions);
router.get('/dashboard', authenticate, isCoinSeller, coinSellerController.getCoinSellerDashboard);
router.get('/history', authenticate, isCoinSeller, coinSellerController.getDistributionHistory);

module.exports = router;