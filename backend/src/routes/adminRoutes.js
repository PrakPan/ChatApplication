// const express = require('express');
// const router = express.Router();
// const {
//   getDashboardStats,
//   getAllUsers,
//   getPendingHosts,
//   approveHost,
//   rejectHost,
//   suspendHost,
//   toggleUserStatus,
//   getPendingWithdrawals,
//   processWithdrawal,
//   rejectWithdrawal,
//   getRevenueStats
// } = require('../controllers/adminController');
// const { authenticate, authorize } = require('../middleware/auth');

// router.use(authenticate);
// router.use(authorize('admin'));

// router.get('/dashboard', getDashboardStats);
// router.get('/users', getAllUsers);
// router.get('/hosts/pending', getPendingHosts);
// router.put('/hosts/:hostId/approve', approveHost);
// router.put('/hosts/:hostId/reject', rejectHost);
// router.put('/hosts/:hostId/suspend', suspendHost);
// router.put('/users/:userId/toggle-status', toggleUserStatus);
// router.get('/withdrawals/pending', getPendingWithdrawals);
// router.put('/withdrawals/:withdrawalId/process', processWithdrawal);
// router.put('/withdrawals/:withdrawalId/reject', rejectWithdrawal);
// router.get('/revenue', getRevenueStats);

// module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  createUser,
  addCoinsToUser,
  deleteUser,
  getAllHosts,
  createHost,
  approveHost,
  rejectHost,
  suspendHost,
  addCoinsToHost,
  deleteHost,
  getCallHistory,
  getUserCallHistory,
  getHostCallHistory,
  getWeeklyLeaderboard,
  updateUserLevel,
  getPendingHosts,
  getPendingWithdrawals,
  processWithdrawal,
  rejectWithdrawal,
  getRevenueStats
} = require('../controllers/adminController');

// Middleware to check if user is admin
const { protect, restrictTo } = require('../middleware/auth');

// Apply authentication and admin role check to all routes
// router.use(protect);
// router.use(restrictTo('admin'));

// ============= Dashboard =============
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/revenue', getRevenueStats);

// ============= User Management =============
router.route('/users')
  .get(getAllUsers)
  .post(createUser);

router.route('/users/:userId')
  .delete(deleteUser);

router.post('/users/:userId/add-coins', addCoinsToUser);
router.patch('/users/:userId/level', updateUserLevel);

// ============= Host Management =============
router.route('/hosts')
  .get(getAllHosts)
  .post(createHost);

router.get('/hosts/pending', getPendingHosts);

router.route('/hosts/:hostId')
  .delete(deleteHost);

router.post('/hosts/:hostId/approve', approveHost);
router.post('/hosts/:hostId/reject', rejectHost);
router.post('/hosts/:hostId/suspend', suspendHost);
router.post('/hosts/:hostId/add-coins', addCoinsToHost);
router.patch('/hosts/:hostId/level', updateUserLevel);

// ============= Call History =============
router.get('/calls', getCallHistory);
router.get('/calls/user/:userId', getUserCallHistory);
router.get('/calls/host/:hostId', getHostCallHistory);

// ============= Leaderboard =============
router.get('/leaderboard', getWeeklyLeaderboard);

// ============= Withdrawals =============
router.get('/withdrawals/pending', getPendingWithdrawals);
router.post('/withdrawals/:withdrawalId/process', processWithdrawal);
router.post('/withdrawals/:withdrawalId/reject', rejectWithdrawal);

module.exports = router;