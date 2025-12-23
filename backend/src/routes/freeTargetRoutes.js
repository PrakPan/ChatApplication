// routes/freeTargetRoutes.js
const express = require('express');
const router = express.Router();
const {
  getFreeTarget,
  startDailyTimer,
  stopDailyTimer,
  recordCallForTarget,
  getWeeklyStats,
  getAllFreeTargets,
  toggleFreeTarget,
  overrideDayStatus,
  checkAndCompleteTodayTarget
} = require('../controllers/freeTargetController');
const { authenticate, authorize } = require('../middleware/auth');

// Host routes
router.get('/my-target', authenticate, authorize('host'), getFreeTarget);
router.post('/start-timer', authenticate, authorize('host'), startDailyTimer);
router.post('/stop-timer', authenticate, authorize('host'), stopDailyTimer);
router.post('/record-call', authenticate, authorize('host'), recordCallForTarget);
router.post('/check-completion', authenticate, authorize('host'), checkAndCompleteTodayTarget);
router.get('/weekly-stats', authenticate, authorize('host'), getWeeklyStats);

// Admin routes
router.get('/admin/all'  , getAllFreeTargets);
router.get('/admin/:hostId', getFreeTarget);
router.patch('/admin/:hostId/toggle', toggleFreeTarget);
router.patch('/admin/:hostId/override-day', authenticate, authorize('admin'), overrideDayStatus);
router.get('/admin/:hostId/stats', authenticate, authorize('admin'), getWeeklyStats);

module.exports = router;