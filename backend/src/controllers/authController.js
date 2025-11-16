const User = require('../models/User');
const Host = require('../models/Host');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const logger = require('../utils/logger');

const register = asyncHandler(async (req, res) => {

  console.log('Received body:', req.body); // Add this line
  console.log('Name:', req.body.name, 'Type:', typeof req.body.name); // Add this
  console.log('Email:', req.body.email, 'Type:', typeof req.body.email); // Add this
  console.log('Phone:', req.body.phone, 'Type:', typeof req.body.phone); // Add this
  console.log('Password:', req.body.password ? 'EXISTS' : 'MISSING'); // Ad
  const { name, email, phone, password, role, bio, ratePerMinute, languages, interests } = req.body;

  if (!name?.trim() || !email?.trim() || !phone?.trim() || !password) {
    throw new ApiError(400, 'Please provide all required fields: name, email, phone, password');
  }

  // Password validation
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  // Check if user exists
  const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
  if (existingUser) {
    if (existingUser.email === email) {
      throw new ApiError(400, 'Email already registered');
    }
    throw new ApiError(400, 'Phone number already registered');
  }

  // Create user (password will be automatically hashed by User model pre-save hook)
  const user = await User.create({
    name,
    email,
    phone,
    password, 
    role: role || 'user'
  });
 
  let hostProfile = null;
  if (role === 'host') {
    hostProfile = await Host.create({
      userId: user._id,
      bio: bio || '',
      ratePerMinute: ratePerMinute || 50,
      languages: languages || [],
      interests: interests || [],
      status: 'pending'
    });
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  logger.info(`User registered: ${email} with userId: ${user.userId}`);

  ApiResponse.success(res, 201, `${role === 'host' ? 'Host' : 'User'} registered successfully`, {
    user: {
      ...user.toJSON(),
      userId: user.userId // Include the alphanumeric ID in response
    },
    hostProfile,
    token: accessToken,
    refreshToken
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body; // credential can be userId, email, or phone
  const credential = email;
  // Validate input
  if (!credential || !password) {
    throw new ApiError(400, 'Please provide login credentials and password');
  }

  // Find user by userId, email, or phone
  let user;
  
  // Check if it's an email
  if (credential.includes('@')) {
    user = await User.findOne({ email: credential.toLowerCase() }).select('+password +refreshToken');
  } 
  // Check if it's a phone number (10 digits)
  else if (/^[0-9]{10}$/.test(credential)) {
    user = await User.findOne({ phone: credential }).select('+password +refreshToken');
  } 
  // Otherwise, treat it as userId (6 alphanumeric characters)
  else {
    user = await User.findOne({ userId: credential.toUpperCase() }).select('+password +refreshToken');
  }
  
  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Check if account is active
  if (!user.isActive) {
    throw new ApiError(403, 'Account has been deactivated');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Update refresh token and last login
  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save();

  // Get host profile if exists
  let hostProfile = null;
  if (user.role === 'host') {
    hostProfile = await Host.findOne({ userId: user._id });
  }

  logger.info(`User logged in: ${user.email} (userId: ${user.userId})`);

  ApiResponse.success(res, 200, 'Login successful', {
    user: {
      ...user.toJSON(),
      userId: user.userId
    },
    hostProfile,
    token: accessToken,
    refreshToken
  });
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ApiError(400, 'Refresh token is required');
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Account has been deactivated');
    }

    const accessToken = generateAccessToken(user._id, user.role);

    ApiResponse.success(res, 200, 'Token refreshed successfully', {
      token: accessToken
    });
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
});

const logout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.refreshToken = null;
  await user.save();

  logger.info(`User logged out: ${user.email} (userId: ${user.userId})`);

  ApiResponse.success(res, 200, 'Logout successful');
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  let hostProfile = null;
  if (user.role === 'host') {
    hostProfile = await Host.findOne({ userId: user._id });
  }

  ApiResponse.success(res, 200, 'Profile retrieved successfully', {
    user: {
      ...user.toJSON(),
      userId: user.userId
    },
    hostProfile
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;

  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone) {
    // Check if phone is already taken
    const existingUser = await User.findOne({ phone, _id: { $ne: user._id } });
    if (existingUser) {
      throw new ApiError(400, 'Phone number already in use');
    }
    user.phone = phone;
  }
  if (avatar) user.avatar = avatar;

  await user.save();

  logger.info(`Profile updated: ${user.email} (userId: ${user.userId})`);

  ApiResponse.success(res, 200, 'Profile updated successfully', { 
    user: {
      ...user.toJSON(),
      userId: user.userId
    }
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Please provide current and new password');
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters');
  }

  const user = await User.findById(req.user._id).select('+password');

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  logger.info(`Password changed: ${user.email} (userId: ${user.userId})`);

  ApiResponse.success(res, 200, 'Password changed successfully');
});

// New endpoint to check if credential is available
const checkAvailability = asyncHandler(async (req, res) => {
  const { email, phone } = req.query;

  const query = {};
  if (email) query.email = email.toLowerCase();
  if (phone) query.phone = phone;

  const existingUser = await User.findOne(query);

  ApiResponse.success(res, 200, 'Availability checked', {
    available: !existingUser,
    field: email ? 'email' : 'phone'
  });
});

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  checkAvailability
};