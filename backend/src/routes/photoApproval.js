const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getPendingPhotoApprovals,
  approveHostPhoto,
  rejectHostPhoto,
  deleteHostPhoto,
  approveHostProfile,
  rejectHostProfile,
  getHostPhotosForReview
} = require('../controllers/photoApprovalController');

// All routes require admin authentication
// router.use(authenticate);

// Photo approval routes
router.get('/photos/pending', getPendingPhotoApprovals);
router.get('/photos/:hostId', getHostPhotosForReview);
router.delete('/photos/:hostId/:photoIndex', deleteHostPhoto);

// Change from photoId to photoIndex in routes
router.patch('/photos/:hostId/:photoIndex/approve', approveHostPhoto);
router.patch('/photos/:hostId/:photoIndex/reject', rejectHostPhoto);

module.exports = router;