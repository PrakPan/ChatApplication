const express = require('express');
const router = express.Router();

const {
  sendGift,
  getGiftHistory,
  getGiftStats,
  getCallGifts,
  allGifts
} = require('../controllers/giftController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Send a gift
router.post('/send', sendGift);

router.get('/gifts', allGifts);

// Get gift history
router.get('/history', getGiftHistory);

// Get gift statistics (for hosts)
router.get('/stats', getGiftStats);

// Get gifts for a specific call
router.get('/call/:callId', getCallGifts);

module.exports = router;