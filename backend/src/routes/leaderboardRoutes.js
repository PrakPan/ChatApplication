const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');


const {
  getWeeklyLeaderboard,
  getMyLeaderboardPosition,
  getLeaderboardHistory
} = require('../controllers/leaderboardController');

// Public/authenticated routes
router.get('/weekly', getWeeklyLeaderboard);
router.get('/my-position', getMyLeaderboardPosition);
router.get('/history', getLeaderboardHistory);

module.exports = router;