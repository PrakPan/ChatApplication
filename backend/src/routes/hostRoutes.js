const express = require('express');
const router = express.Router();
const {
  createHostProfile,
  updateHostProfile,
  uploadHostPhotos,
  updateOnlineStatus,
  getOnlineHosts,
  getHostDetails,
  getHostEarnings,
  getHostCallHistory
} = require('../controllers/hostController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');
const validators = require('../utils/validators');
const upload = require('../middleware/upload');

// Public routes
router.get('/online', getOnlineHosts);
router.get('/:hostId', getHostDetails);

// Protected routes (authenticated users)
router.use(authenticate);

// Host-specific routes
router.post('/profile', validate(validators.createHostProfile), createHostProfile);
router.put('/profile', authorize('host', 'admin'), validate(validators.createHostProfile), updateHostProfile);
router.post('/photos', authorize('host', 'admin'), upload.array('photos', 5), uploadHostPhotos);
router.put('/status', authorize('host', 'admin'), updateOnlineStatus);
router.get('/me/earnings', authorize('host', 'admin'), getHostEarnings);
router.get('/me/calls', authorize('host', 'admin'), getHostCallHistory);

module.exports = router;