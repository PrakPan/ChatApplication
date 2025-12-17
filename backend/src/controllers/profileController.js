const User = require('../models/User');
const Host = require('../models/Host');
const Level = require('../models/Level');
const Follow = require('../models/Follow');
const Agent = require('../models/Agent');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { uploadToCloudinary, uploadBufferToCloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');

// Get user profile with all details
const getProfile = asyncHandler(async (req, res) => {
  console.log("Here");

  const user = await User.findById(req.user._id)
    .select('-password -refreshToken')
    .lean();
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Get level info
  const level = await Level.findOne({ userId: user._id });

  // Get follow stats
  const [followersCount, followingCount] = await Promise.all([
    Follow.getFollowerCount(user._id),
    Follow.getFollowingCount(user._id)
  ]);

  // Get host info if user is a host
  let hostInfo = null;
  if (user.role === 'host') {
    hostInfo = await Host.findOne({ userId: user._id }).lean();

    if (hostInfo) {
      const FreeTarget = require('../models/FreeTarget');
      const freeTarget = await FreeTarget.findOne({ hostId: hostInfo._id }).lean();

      hostInfo.freeTargetEnabled = freeTarget?.isEnabled || false;
    }
  }

  // Get agent info if user is an agent
  let agentInfo = null;
  if (user.isAgent) {
    const agent = await Agent.findOne({ userId: user._id }).lean();
    if (agent) {
      const stats = await Agent.findById(agent._id)
        .then(a => a.calculateTotalEarnings());

      agentInfo = { ...agent, ...stats };
    }
  }

  ApiResponse.success(res, 200, 'Profile retrieved', {
    user,
    level: {
      richLevel: level?.richLevel || 1,
      charmLevel: level?.charmLevel || 1,
      totalDiamondsRecharged: level?.totalDiamondsRecharged || 0,
      totalBeansEarned: level?.totalBeansEarned || 0
    },
    followStats: {
      followersCount,
      followingCount
    },
    hostInfo,
    agentInfo
  });
});


// Update avatar
const updateAvatar = asyncHandler(async (req, res) => {
  const { avatar } = req.body;

  if (!avatar) {
    throw new ApiError(400, 'Avatar URL is required');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar },
    { new: true }
  ).select('-password -refreshToken');

  logger.info(`Avatar updated: ${req.user.email}`);

  ApiResponse.success(res, 200, 'Avatar updated successfully', {
    avatar: user.avatar
  });
});


// Update phone
const updatePhone = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone || !/^[0-9]{10}$/.test(phone)) {
    throw new ApiError(400, 'Invalid phone number');
  }

  // Check if phone already exists
  const existingUser = await User.findOne({ 
    phone, 
    _id: { $ne: req.user._id } 
  });

  if (existingUser) {
    throw new ApiError(400, 'Phone number already in use');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { phone },
    { new: true }
  ).select('-password -refreshToken');

  logger.info(`Phone updated: ${req.user.email}`);

  ApiResponse.success(res, 200, 'Phone updated successfully', { phone: user.phone });
});

// Update email
const updateEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError(400, 'Invalid email address');
  }

  // Check if email already exists
  const existingUser = await User.findOne({ 
    email: email.toLowerCase(), 
    _id: { $ne: req.user._id } 
  });

  if (existingUser) {
    throw new ApiError(400, 'Email already in use');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { email: email.toLowerCase() },
    { new: true }
  ).select('-password -refreshToken');

  logger.info(`Email updated: ${email}`);

  ApiResponse.success(res, 200, 'Email updated successfully', { email: user.email });
});

// Update bio (for both user and host)
const updateBio = asyncHandler(async (req, res) => {
  const { bio } = req.body;

  if (!bio || bio.trim().length === 0) {
    throw new ApiError(400, 'Bio cannot be empty');
  }

  if (bio.length > 500) {
    throw new ApiError(400, 'Bio cannot exceed 500 characters');
  }

  // Update user bio
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { bio: bio.trim() },
    { new: true }
  ).select('-password -refreshToken');

  // If host, also update host bio
  if (user.role === 'host') {
    await Host.findOneAndUpdate(
      { userId: req.user._id },
      { bio: bio.trim() }
    );
  }

  logger.info(`Bio updated: ${req.user.email}`);

  ApiResponse.success(res, 200, 'Bio updated successfully', { bio: user.bio });
});

// Update name
const updateName = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim().length < 2) {
    throw new ApiError(400, 'Name must be at least 2 characters');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name: name.trim() },
    { new: true }
  ).select('-password -refreshToken');

  logger.info(`Name updated: ${req.user.email}`);

  ApiResponse.success(res, 200, 'Name updated successfully', { name: user.name });
});



// ADD this function to profileController.js

const updateDob = asyncHandler(async (req, res) => {
  const { dob } = req.body;

  if (!dob) {
    throw new ApiError(400, 'Date of birth is required');
  }

  const dobDate = new Date(dob);
  if (isNaN(dobDate.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }

  // Check if user is at least 18 years old
  const age = new Date().getFullYear() - dobDate.getFullYear();
  if (age < 18) {
    throw new ApiError(400, 'You must be at least 18 years old');
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { dob: dobDate },
    { new: true }
  ).select('-password -refreshToken');

  logger.info(`DOB updated: ${req.user.email}`);

  ApiResponse.success(res, 200, 'Date of birth updated successfully', { dob: user.dob });
});

// UPDATE exports to include updateDob
module.exports = {
  getProfile,
  updateAvatar,
  updatePhone,
  updateEmail,
  updateBio,
  updateName,
  updateDob // ADD THIS
};