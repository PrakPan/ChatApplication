// routes/freeTargetRoutes.js
const express = require('express');
const router = express.Router();
const {
 
} = require('../controllers/freeTargetController');
const { authenticate, authorize } = require('../middleware/auth');
const { getFreeTarget } = require('../controllers/freeTargetController');
const { startDailyTimer } = require('../controllers/freeTargetController');
const { stopDailyTimer } = require('../controllers/freeTargetController');
const { recordCallForTarget } = require('../controllers/freeTargetController');
const { getWeeklyStats } = require('../controllers/freeTargetController');
const { getAllFreeTargets } = require('../controllers/freeTargetController');
const { toggleFreeTarget } = require('../controllers/freeTargetController');
const { overrideDayStatus } = require('../controllers/freeTargetController');

// Host routes
router.get('/my-target', authenticate, authorize('host'), getFreeTarget);
router.post('/start-timer', authenticate, authorize('host'), startDailyTimer);
router.post('/stop-timer', authenticate, authorize('host'), stopDailyTimer);
router.post('/record-call', authenticate, authorize('host'), recordCallForTarget);
router.get('/weekly-stats', authenticate, authorize('host'), getWeeklyStats);

// Admin routes
router.get('/admin/all', getAllFreeTargets);
router.get('/admin/:hostId', getFreeTarget);
router.patch('/admin/:hostId/toggle', toggleFreeTarget);
router.patch('/admin/:hostId/override-day', overrideDayStatus);
router.get('/admin/:hostId/stats', getWeeklyStats);

module.exports = router;


