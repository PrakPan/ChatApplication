// controllers/passwordResetController.js
const User = require('../models/User');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { sendEmail } = require('../utils/emailService');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();

// Generate 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Request password reset OTP
exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Don't reveal if user exists or not (security best practice)
    return ApiResponse.success(res, 200, 'If an account exists, an OTP has been sent to your email');
  }

  // Generate OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store OTP
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt,
    attempts: 0,
    userId: user._id
  });

  // Send email
  try {
    await sendEmail({
      to: email,
      subject: 'Password Reset OTP',
      template: 'passwordResetOTP',
      data: {
        name: user.name,
        otp,
        validityMinutes: 10
      }
    });

    logger.info(`Password reset OTP sent to ${email}`);
  } catch (error) {
    logger.error(`Failed to send OTP email to ${email}:`, error);
    throw new ApiError(500, 'Failed to send OTP. Please try again.');
  }

  ApiResponse.success(res, 200, 'OTP sent to your email. Valid for 10 minutes.');
});

// Verify OTP
exports.verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(400, 'Email and OTP are required');
  }

  const otpData = otpStore.get(email.toLowerCase());

  if (!otpData) {
    throw new ApiError(400, 'OTP expired or not found. Please request a new one.');
  }

  // Check expiry
  if (Date.now() > otpData.expiresAt) {
    otpStore.delete(email.toLowerCase());
    throw new ApiError(400, 'OTP has expired. Please request a new one.');
  }

  // Check attempts
  if (otpData.attempts >= 3) {
    otpStore.delete(email.toLowerCase());
    throw new ApiError(400, 'Too many failed attempts. Please request a new OTP.');
  }

  // Verify OTP
  if (otpData.otp !== otp) {
    otpData.attempts += 1;
    throw new ApiError(400, `Invalid OTP. ${3 - otpData.attempts} attempts remaining.`);
  }

  // OTP verified - generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes

  // Store reset token
  otpStore.set(`reset_${resetToken}`, {
    email: email.toLowerCase(),
    userId: otpData.userId,
    expiresAt: resetTokenExpiry
  });

  // Clear OTP
  otpStore.delete(email.toLowerCase());

  logger.info(`OTP verified for ${email}`);

  ApiResponse.success(res, 200, 'OTP verified successfully', {
    resetToken,
    expiresIn: 30 * 60 // seconds
  });
});

// Reset password with token
exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    throw new ApiError(400, 'Reset token and new password are required');
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long');
  }

  const resetData = otpStore.get(`reset_${resetToken}`);

  if (!resetData) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  if (Date.now() > resetData.expiresAt) {
    otpStore.delete(`reset_${resetToken}`);
    throw new ApiError(400, 'Reset token has expired. Please start the process again.');
  }

  // Update password
  const user = await User.findById(resetData.userId).select('+password');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.password = newPassword;
  await user.save();

  // Clear reset token
  otpStore.delete(`reset_${resetToken}`);

  // Send confirmation email
  try {
    await sendEmail({
      to: user.email,
      subject: 'Password Changed Successfully',
      template: 'passwordChanged',
      data: {
        name: user.name,
        date: new Date().toLocaleString()
      }
    });
  } catch (error) {
    logger.error(`Failed to send password change confirmation to ${user.email}:`, error);
  }

  logger.info(`Password reset successfully for user ${user.email}`);

  ApiResponse.success(res, 200, 'Password reset successfully. You can now login with your new password.');
});

// Resend OTP
exports.resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  // Check if there's an existing OTP request
  const existingOTP = otpStore.get(email.toLowerCase());
  
  if (existingOTP && Date.now() < existingOTP.expiresAt) {
    // Don't allow resend if OTP is still valid and was sent less than 1 minute ago
    const timeSinceLastSend = Date.now() - (existingOTP.expiresAt - 10 * 60 * 1000);
    if (timeSinceLastSend < 60000) { // 1 minute
      throw new ApiError(400, 'Please wait before requesting another OTP');
    }
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return ApiResponse.success(res, 200, 'If an account exists, an OTP has been sent to your email');
  }

  // Generate new OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  // Store OTP
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt,
    attempts: 0,
    userId: user._id
  });

  // Send email
  try {
    await sendEmail({
      to: email,
      subject: 'Password Reset OTP (Resent)',
      template: 'passwordResetOTP',
      data: {
        name: user.name,
        otp,
        validityMinutes: 10
      }
    });

    logger.info(`Password reset OTP resent to ${email}`);
  } catch (error) {
    logger.error(`Failed to resend OTP email to ${email}:`, error);
    throw new ApiError(500, 'Failed to send OTP. Please try again.');
  }

  ApiResponse.success(res, 200, 'New OTP sent to your email.');
});

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (value.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000); 