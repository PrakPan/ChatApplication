const Host = require('../models/Host');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
// Get all pending photo approvals

const getPendingPhotoApprovals = asyncHandler(async (req, res) => {
  const hosts = await Host.find({
    'photos.approvalStatus': 'pending'
  }).populate('userId', 'name email avatar');

  const pendingApprovals = hosts.map(host => {
    const photos = host.photos || [];
    
    const pendingPhotos = photos
      .map((photo, index) => ({ photo, index }))
      .filter(({ photo }) => photo && photo.approvalStatus === 'pending');

    return {
      hostId: host._id.toString(),
      hostName: host.userId?.name || 'Unknown Host',
      hostEmail: host.userId?.email || 'Unknown Email',
      status: host.status || 'unknown',
      pendingPhotos: pendingPhotos.map(({ photo, index }) => ({
        photoIndex: index, // This is what the frontend will use
        url: photo.url || '',
        uploadedAt: photo.uploadedAt || new Date()
      }))
    };
  }).filter(host => host.pendingPhotos.length > 0);

  ApiResponse.success(res, 200, 'Pending photo approvals retrieved', {
    approvals: pendingApprovals,
    total: pendingApprovals.length
  });
});




// Approve a host photo - SIMPLE INDEX VERSION
const approveHostPhoto = asyncHandler(async (req, res) => {
  const { hostId, photoIndex } = req.params;

  console.log(`✅ APPROVING: Host ${hostId}, Photo Index ${photoIndex}`);

  const host = await Host.findById(hostId).populate('userId', 'name email');
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  const index = parseInt(photoIndex);
  if (isNaN(index)) {
    throw new ApiError(400, `Invalid photo index: ${photoIndex}`);
  }

  if (index < 0 || index >= host.photos.length) {
    throw new ApiError(404, `Photo index ${index} out of range. Host has ${host.photos.length} photos.`);
  }

  const photo = host.photos[index];
  if (!photo) {
    throw new ApiError(404, `Photo at index ${index} is null or undefined`);
  }


  if (photo.approvalStatus !== 'pending') {
    throw new ApiError(400, `Photo is already ${photo.approvalStatus}`);
  }

  // Update photo approval status
  photo.approvalStatus = 'approved';
  photo.approvedAt = new Date();
  photo.approvedBy = 'admin' || req.user._id;

  await host.save();
  const approvedPhotos = host.photos.filter(p => p.approvalStatus === 'approved');


  // Auto-approve host if they have 3+ approved photos and are pending
  let autoApproved = false;
  if (approvedPhotos.length >= 3 && host.status === 'pending') {
    host.status = 'approved';
    await host.save();
    autoApproved = true;
  }

  ApiResponse.success(res, 200, 'Photo approved successfully', {
    host: {
      _id: host._id,
      status: host.status,
      approvedPhotosCount: approvedPhotos.length
    },
    autoApproved,
    approvedPhotosCount: approvedPhotos.length
  });
});

// Reject a host photo - INDEX VERSION WITH AUTH FIX
const rejectHostPhoto = asyncHandler(async (req, res) => {
  const { hostId, photoIndex } = req.params;
  const { reason } = req.body;

  console.log(`❌ REJECTING: Host ${hostId}, Photo Index ${photoIndex}`);

 

  if (!reason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const host = await Host.findById(hostId).populate('userId', 'name email');
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  const index = parseInt(photoIndex);
  if (isNaN(index) || index < 0 || index >= host.photos.length) {
    throw new ApiError(404, `Invalid photo index: ${photoIndex}`);
  }

  const photo = host.photos[index];
  if (!photo) {
    throw new ApiError(404, `Photo at index ${index} not found`);
  }

  console.log(`📸 Found photo at index ${index}:`, {
    url: photo.url,
    currentStatus: photo.approvalStatus,
    actualPhotoId: photo._id?.toString()
  });

  if (photo.approvalStatus !== 'pending') {
    throw new ApiError(400, `Photo is already ${photo.approvalStatus}`);
  }

  // Update photo approval status
  photo.approvalStatus = 'rejected';
  photo.rejectionReason = reason;
  photo.rejectedAt = new Date();
  photo.rejectedBy = 'admin' ||  req.user._id; // This should now work with the auth check above

  await host.save();

  ApiResponse.success(res, 200, 'Photo rejected successfully', { 
    host: {
      _id: host._id,
      status: host.status
    }
  });
});
// Delete a host photo
const deleteHostPhoto = asyncHandler(async (req, res) => {
  const { hostId, photoIndex } = req.params;

  const host = await Host.findById(hostId);
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  const photoIdx = parseInt(photoIndex);
  if (photoIdx < 0 || photoIdx >= host.photos.length) {
    throw new ApiError(404, 'Photo not found');
  }

  // Remove photo from array
  host.photos.splice(photoIdx, 1);
  await host.save();

  logger.info(`Photo deleted: Host ${hostId}, Photo ${photoIndex}`);

  ApiResponse.success(res, 200, 'Photo deleted successfully', { 
    host,
    remainingPhotos: host.photos.length 
  });
});

// Approve host profile (overall)
const approveHostProfile = asyncHandler(async (req, res) => {
  const { hostId } = req.params;

  const host = await Host.findById(hostId).populate('userId', 'name email');
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  // Check if host has at least 3 approved photos
  const approvedPhotos = host.photos.filter(photo => 
    photo.approvalStatus === 'approved'
  );

  if (approvedPhotos.length < 3) {
    throw new ApiError(400, `Host must have at least 3 approved photos. Current: ${approvedPhotos.length}`);
  }

  host.status = 'approved';
  await host.save();

  logger.info(`Host profile approved: ${host.userId.email}`);

  ApiResponse.success(res, 200, 'Host profile approved successfully', { host });
});

// Reject host profile
const rejectHostProfile = asyncHandler(async (req, res) => {
  const { hostId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const host = await Host.findById(hostId).populate('userId', 'name email');
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  host.status = 'rejected';
  host.rejectionReason = reason;
  await host.save();

  logger.info(`Host profile rejected: ${host.userId.email}, Reason: ${reason}`);

  ApiResponse.success(res, 200, 'Host profile rejected successfully', { host });
});

// Get host photos for admin review
const getHostPhotosForReview = asyncHandler(async (req, res) => {
  const { hostId } = req.params;

  const host = await Host.findById(hostId).populate('userId', 'name email avatar');
  if (!host) {
    throw new ApiError(404, 'Host not found');
  }

  const photosWithStatus = host.photos.map((photo, index) => ({
    index,
    photoId: photo._id,
    url: photo.url,
    approvalStatus: photo.approvalStatus || 'pending',
    rejectionReason: photo.rejectionReason,
    uploadedAt: photo.uploadedAt,
    approvedAt: photo.approvedAt,
    rejectedAt: photo.rejectedAt,
    approvedBy: photo.approvedBy,
    rejectedBy: photo.rejectedBy
  }));

  ApiResponse.success(res, 200, 'Host photos retrieved', {
    host: {
      id: host._id,
      name: host.userId.name,
      email: host.userId.email,
      status: host.status,
      totalPhotos: host.photos.length,
      approvedPhotos: photosWithStatus.filter(p => p.approvalStatus === 'approved').length,
      pendingPhotos: photosWithStatus.filter(p => p.approvalStatus === 'pending').length,
      rejectedPhotos: photosWithStatus.filter(p => p.approvalStatus === 'rejected').length
    },
    photos: photosWithStatus
  });
});

module.exports = {
  getPendingPhotoApprovals,
  approveHostPhoto,
  rejectHostPhoto,
  deleteHostPhoto,
  approveHostProfile,
  rejectHostProfile,
  getHostPhotosForReview
};