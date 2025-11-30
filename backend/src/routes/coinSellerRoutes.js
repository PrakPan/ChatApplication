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
router.post('/assign', assignCoinSeller);
router.delete('/:userId',  removeCoinSeller);
router.post('/:coinSellerId/add-diamonds', addDiamondsToCoinSeller);
router.get('/all', getAllCoinSellers);

// Coin seller routes
router.post('/distribute', distributeDiamonds);
router.post('/withdraw', withdrawDiamonds);
router.get('/withdrawable', getWithdrawableTransactions);
router.get('/dashboard', getCoinSellerDashboard);
router.get('/history', getDistributionHistory);

module.exports = router;