const express = require('express');
const router = express.Router();
const {
  getRichLevels,
  getCharmLevels,
  getAllLevels,
  getUserLevelProgress
} = require('../controllers/levelController');
const { authorize } = require('../middleware/auth');

// Public routes - Level configurations
router.get('/rich', getRichLevels);
router.get('/charm', getCharmLevels);
router.get('/all', getAllLevels);

// Protected route - User's current progress
router.get('/progress', authorize, getUserLevelProgress);

module.exports = router;