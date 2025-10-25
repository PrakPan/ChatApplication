const User = require('../models/User');
const Host = require('../models/Host');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const logger = require('../utils/logger');

const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
  if (existingUser) {
    if (existingUser.email === email) {
      throw new ApiError(400, 'Email already registered');
    }
    throw new ApiError(400, 'Phone number already registered');
  }

  // Create user
  const user = await User.create({
    name,
    email,
    phone,
    password,
    role
  });

  // Create host profile if role is host
  let hostProfile = null;
  if (role === 'host') {
    hostProfile = await Host.create({
      userId: user._id,
      status: 'pending'
    });
  }

  // Generate tokens
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  logger.info(`User registered: ${email}`);

  ApiResponse.success(res, 201, 'User registered successfully', {
    user: user.toJSON(),
    hostProfile,
    token: accessToken,
    refreshToken
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user with password
  const user = await User.findOne({ email }).select('+password');
  
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Check if account is active
  if (!user.isActive) {
    throw new ApiError(403, 'Account has been deactivated');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
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

  logger.info(`User logged in: ${email}`);

  ApiResponse.success(res, 200, 'Login successful', {
    user: user.toJSON(),
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

  logger.info(`User logged out: ${user.email}`);

  ApiResponse.success(res, 200, 'Logout successful');
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  let hostProfile = null;
  if (user.role === 'host') {
    hostProfile = await Host.findOne({ userId: user._id });
  }

  ApiResponse.success(res, 200, 'Profile retrieved successfully', {
    user,
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

  logger.info(`Profile updated: ${user.email}`);

  ApiResponse.success(res, 200, 'Profile updated successfully', { user });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  logger.info(`Password changed: ${user.email}`);

  ApiResponse.success(res, 200, 'Password changed successfully');
});

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  getProfile,
  updateProfile,
  changePassword
};