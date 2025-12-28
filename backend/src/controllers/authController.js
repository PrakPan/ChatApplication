const User = require('../models/User');
const Host = require('../models/Host');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const logger = require('../utils/logger');
const Level = require('../models/Level');

const register = asyncHandler(async (req, res) => {
  console.log('Received registration request:', req.body);
  
  const { name, email, phone, password, role, bio, languages, interests, country, dob, gender } = req.body;

  // Validate required fields
  if (!name || name.trim() === '') {
    throw new ApiError(400, 'Name is required');
  }
  if (!email || email.trim() === '') {
    throw new ApiError(400, 'Email is required');
  }
  if (!phone || phone.trim() === '') {
    throw new ApiError(400, 'Phone number is required');
  }
  if (!password || password.trim() === '') {
    throw new ApiError(400, 'Password is required');
  }
  if (!country || country.trim() === '') {
    throw new ApiError(400, 'Country is required');
  }
  if (!dob) {
    throw new ApiError(400, 'Date of birth is required');
  }
  if (!gender || gender.trim() === '') {
    throw new ApiError(400, 'Gender is required');
  }

  // Password validation
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  // Email format validation
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, 'Please provide a valid email address');
  }

  // Phone format validation (10 digits)
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone)) {
    throw new ApiError(400, 'Phone number must be exactly 10 digits');
  }

  // Gender validation
  if (!['male', 'female', 'other'].includes(gender.toLowerCase())) {
    throw new ApiError(400, 'Invalid gender value');
  }

  // Host-specific validations
  if (role === 'host') {
    // Age validation for hosts
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    
    const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

    if (actualAge < 18) {
      throw new ApiError(400, 'Hosts must be at least 18 years old');
    }

    // Gender validation for hosts
    if (gender.toLowerCase() !== 'female') {
      throw new ApiError(400, 'Only females can register as hosts');
    }
  }

  // Check if user exists
  const existingUser = await User.findOne({ 
    $or: [
      { email: email.toLowerCase().trim() }, 
      { phone: phone.trim() }
    ] 
  });
  
  if (existingUser) {
    if (existingUser.email === email.toLowerCase().trim()) {
      throw new ApiError(400, 'Email already registered');
    }
    throw new ApiError(400, 'Phone number already registered');
  }

  // Create user (password will be automatically hashed by User model pre-save hook)
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    password: password,
    role: role || 'user',
    country: country.trim(),
    dob: new Date(dob),
    gender: gender.toLowerCase()
  });
 
  let hostProfile = null;
  if (role === 'host') {
    hostProfile = await Host.create({
      userId: user._id,
      bio: bio || '',
      ratePerMinute: 50, // Default rate
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
      userId: user.userId
    },
    hostProfile,
    token: accessToken,
    refreshToken
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
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
  
  // Get level info
  const level = await Level.findOne({ userId: user._id });

  // Frame URLs
  const levels = [
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945737/host-photos/Level_1_zsfafn.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945737/host-photos/Level_2_wys7gf.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945738/host-photos/Level_3_ahksl6.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945738/host-photos/Level_4_w4blac.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945738/host-photos/Level_5_qjzrgy.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_6_wiqtui.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945738/host-photos/Level_7_mezsy6.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_8_ho0mkc.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_9_lmpfgi.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_10_j7km2v.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945740/host-photos/Level_11_aduvse.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_12_ytcxam.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945739/host-photos/Level_13_hefdjb.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945740/host-photos/Level_14_iutvsp.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766945738/host-photos/Level_15_u3zmdb.png"
  ];

  const charmlevels = [
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946168/host-photos/Level_C1_te3wbx.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946168/host-photos/Level_C2_mwkvs1.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946168/host-photos/Level_C3_nsjdio.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946168/host-photos/Level_C4_x7pmj9.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946169/host-photos/Level_C5_bhuerp.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946169/host-photos/Level_C6_jmcyaf.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946169/host-photos/Level_C7_s1oxmf.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946169/host-photos/Level_C8_saltqc.png",
    "https://res.cloudinary.com/dw3gi24uf/image/upload/v1766946170/host-photos/Level_C9_x2fmat.png"
  ];

  // Determine frame URL based on role and level
  let frameUrl = null;
  if (user.role === 'user') {
    const currentRichLevel = level?.richLevel || 1;
    const frameIndex = currentRichLevel - 1;
    frameUrl = levels[frameIndex] || levels[0];
  } else if (user.role === 'host') {
    const currentCharmLevel = level?.charmLevel || 1;
    const frameIndex = currentCharmLevel - 1;
    frameUrl = charmlevels[frameIndex] || charmlevels[0];
  }
  
  let hostProfile = null;
  let freeTargetEnabled = false;
  
  if (user.role === 'host') {
    hostProfile = await Host.findOne({ userId: user._id });
    
    const FreeTarget = require('../models/FreeTarget');
    const freeTarget = await FreeTarget.findOne({ hostId: hostProfile._id });

    console.log("Free Target", freeTarget);
    freeTargetEnabled = freeTarget?.isEnabled || false;
  }

  ApiResponse.success(res, 200, 'Profile retrieved successfully', {
    user: {
      ...user.toJSON(),
      userId: user.userId,
      frameUrl
    },
    hostProfile: hostProfile ? {
      ...hostProfile.toJSON(),
      freeTargetEnabled
    } : null
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