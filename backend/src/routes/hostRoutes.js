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
  getHostCallHistory,
  toggleHostOnlineStatus,
  getHostById,
  getAllHosts,
  saveHostPhotos,
  getHostLevelInfo
} = require('../controllers/hostController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');
const validators = require('../utils/validators');
const upload = require('../middleware/upload');

// Public routes
router.get('/online', getOnlineHosts);
router.get('/:hostId', getHostDetails);
router.get('/', authenticate, getAllHosts);
router.get('/:id', authenticate, getHostById);
// Protected routes (authenticated users)
router.use(authenticate);

// Host-specific routes
router.post('/profile', validate(validators.createHostProfile), createHostProfile);
router.put('/profile', authorize('host', 'admin','coinSeller'), validate(validators.createHostProfile), updateHostProfile);
router.post('/photos', authorize('host', 'admin','coinSeller'), upload.array('photos', 5), uploadHostPhotos);
router.put('/status', authorize('host', 'admin','coinSeller'), updateOnlineStatus);
router.get('/me/earnings', authorize('host', 'admin','coinSeller'), getHostEarnings);
router.get('/me/calls', authorize('host', 'admin','coinSeller'), getHostCallHistory);
router.put('/toggle-online', authorize('host', 'admin','coinSeller'), toggleHostOnlineStatus);

router.post('/photos/save', authorize('host', 'admin','coinSeller'), saveHostPhotos);
router.get('/level-info', authorize('host','coinSeller'), getHostLevelInfo);

module.exports = router;