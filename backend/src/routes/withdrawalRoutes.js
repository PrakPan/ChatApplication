// routes/withdrawalRoutes.js
const express = require('express');
const router = express.Router();
const {
  createWithdrawalRequest,
  getWithdrawalHistory,
  getWithdrawalStats,
  cancelWithdrawal
} = require('../controllers/withdrawalController');
const {
  addBankAccount,
  getBankAccounts,
  updateBankAccount,
  deleteBankAccount,
  setPrimaryBankAccount
} = require('../controllers/bankAccountController');
const { protect, authorize, authenticate } = require('../middleware/auth');

// Host Withdrawal Routes
router.post('/request', authenticate, createWithdrawalRequest);
router.get('/history', authenticate,getWithdrawalHistory);
router.get('/stats', authenticate, getWithdrawalStats);
router.post('/:withdrawalId/cancel', authenticate, cancelWithdrawal);

// Bank Account Routes
router.post('/bank-accounts', authenticate, addBankAccount);
router.get('/bank-accounts', authenticate, getBankAccounts);
router.put('/bank-accounts/:accountId', authenticate, updateBankAccount);
router.delete('/bank-accounts/:accountId',authenticate, deleteBankAccount);
router.patch('/bank-accounts/:accountId/primary', authenticate, setPrimaryBankAccount);

module.exports = router;





// In your main app.js, add:
// app.use('/api/v1/withdrawals', require('./routes/withdrawalRoutes'));