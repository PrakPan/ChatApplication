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
const { protect, authorize } = require('../middleware/auth');

// Host Withdrawal Routes
router.post('/request',  createWithdrawalRequest);
router.get('/history', getWithdrawalHistory);
router.get('/stats', getWithdrawalStats);
router.post('/:withdrawalId/cancel', cancelWithdrawal);

// Bank Account Routes
router.post('/bank-accounts', addBankAccount);
router.get('/bank-accounts', getBankAccounts);
router.put('/bank-accounts/:accountId', updateBankAccount);
router.delete('/bank-accounts/:accountId',deleteBankAccount);
router.patch('/bank-accounts/:accountId/primary', setPrimaryBankAccount);

module.exports = router;





// In your main app.js, add:
// app.use('/api/v1/withdrawals', require('./routes/withdrawalRoutes'));