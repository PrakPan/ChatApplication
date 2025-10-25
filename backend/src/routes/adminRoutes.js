const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  getPendingHosts,
  approveHost,
  rejectHost,
  suspendHost,
  toggleUserStatus,
  getPendingWithdrawals,
  processWithdrawal,
  rejectWithdrawal,
  getRevenueStats
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('admin'));

router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/hosts/pending', getPendingHosts);
router.put('/hosts/:hostId/approve', approveHost);
router.put('/hosts/:hostId/reject', rejectHost);
router.put('/hosts/:hostId/suspend', suspendHost);
router.put('/users/:userId/toggle-status', toggleUserStatus);
router.get('/withdrawals/pending', getPendingWithdrawals);
router.put('/withdrawals/:withdrawalId/process', processWithdrawal);
router.put('/withdrawals/:withdrawalId/reject', rejectWithdrawal);
router.get('/revenue', getRevenueStats);

module.exports = router;