const express = require('express');
const router = express.Router();
const {  authorize } = require('../middleware/auth');

// Import controller functions
const coinSellerController = require('../controllers/coinSellerController');

// Verify all functions exist before using them
const {
  assignCoinSeller,
  removeCoinSeller,
  addDiamondsToCoinSeller,
  getAllCoinSellers,
  distributeDiamonds,
  withdrawDiamonds,
  getWithdrawableTransactions,
  getCoinSellerDashboard,
  getDistributionHistory
} = coinSellerController;

// Admin routes
router.post('/assign', authorize('admin'), assignCoinSeller);
router.delete('/:userId', authorize('admin'), removeCoinSeller);
router.post('/:coinSellerId/add-diamonds', authorize('admin'), addDiamondsToCoinSeller);
router.get('/all', authorize('admin'), getAllCoinSellers);

// Coin seller routes
router.post('/distribute', distributeDiamonds);
router.post('/withdraw', withdrawDiamonds);
router.get('/withdrawable', getWithdrawableTransactions);
router.get('/dashboard', getCoinSellerDashboard);
router.get('/history', getDistributionHistory);

module.exports = router;