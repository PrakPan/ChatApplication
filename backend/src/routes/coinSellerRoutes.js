const express = require('express');
const router = express.Router();
const { authenticate, authorize, isCoinSeller } = require('../middleware/auth');
const coinSellerController = require('../controllers/coinSellerController');

router.post('/assign', coinSellerController.assignCoinSeller);
router.delete('/:userId', coinSellerController.removeCoinSeller);
router.post('/:coinSellerId/add-diamonds', coinSellerController.addDiamondsToCoinSeller);
router.get('/all', coinSellerController.getAllCoinSellers);

router.post('/distribute', coinSellerController.distributeDiamonds);
router.post('/withdraw', coinSellerController.withdrawDiamonds);
router.get('/withdrawable', coinSellerController.getWithdrawableTransactions);
router.get('/dashboard', coinSellerController.getCoinSellerDashboard);
router.get('/history', coinSellerController.getDistributionHistory);

module.exports = router;