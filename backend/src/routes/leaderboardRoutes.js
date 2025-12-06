const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');


const {
  getWeeklyLeaderboard,
  getMyLeaderboardPosition,
  getLeaderboardHistory,
  getAllLeaderboardPoints
} = require('../controllers/leaderboardController');

// Public/authenticated routes
router.get('/weekly', getWeeklyLeaderboard);
router.get('/my-position', getMyLeaderboardPosition);
router.get('/history', getLeaderboardHistory);
router.get('/leaderboard-points',getAllLeaderboardPoints);

module.exports = router;