// controllers/passwordResetController.js
const User = require("../models/User");
const { ApiResponse, ApiError } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const crypto = require("crypto");
const logger = require("../utils/logger");
const { sendEmail } = require("../services/emailService");

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();

function passwordResetOtpTemplate({ name, otp, validityMinutes }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset OTP</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .email-wrapper {
      width: 100%;
      padding: 40px 0;
    }
    .email-container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #ff5a7d, #ff8a00);
      color: #ffffff;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
    }
    .content {
      padding: 32px 28px;
      color: #333333;
      line-height: 1.6;
    }
    .content p {
      margin: 0 0 16px;
      font-size: 15px;
    }
    .otp-box {
      margin: 28px 0;
      text-align: center;
    }
    .otp {
      display: inline-block;
      font-size: 32px;
      letter-spacing: 6px;
      font-weight: 700;
      color: #ff5a7d;
      background: #fff0f4;
      padding: 14px 26px;
      border-radius: 10px;
      border: 1px dashed #ffb3c1;
    }
    .validity {
      margin-top: 10px;
      font-size: 13px;
      color: #777777;
    }
    .note {
      margin-top: 24px;
      font-size: 13px;
      color: #888888;
      background: #f9fafb;
      padding: 14px;
      border-radius: 8px;
    }
    .footer {
      padding: 18px;
      text-align: center;
      font-size: 12px;
      color: #999999;
      background: #fafafa;
    }
    .brand {
      font-weight: 600;
      color: #ff5a7d;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">

      <div class="header">
        <h1>Password Reset Request</h1>
      </div>

      <div class="content">
        <p>Hi <strong>${name}</strong>,</p>

        <p>
          We received a request to reset your password for your 
          <span class="brand">Catlive</span> account.
        </p>

        <p>Please use the OTP below to continue:</p>

        <div class="otp-box">
          <div class="otp">${otp}</div>
          <div class="validity">
            This OTP is valid for <strong>${validityMinutes} minutes</strong>.
          </div>
        </div>

        <div class="note">
          If you did not request this, please ignore this email.
          Your account is safe.
        </div>

        <p style="margin-top: 24px;">
          Thanks,<br/>
          <strong>Catlive Team</strong>
        </p>
      </div>

      <div class="footer">
        © ${new Date().getFullYear()} Catlive. All rights reserved.
      </div>

    </div>
  </div>
</body>
</html>
`;
}

// Generate 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Request password reset OTP
exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  console.log("User Email", user);
  if (!user) {
     throw new ApiError(500, "Failed to send OTP. Not a valid customer");
  }

  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; 

  // Store OTP
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt,
    attempts: 0,
    userId: user._id,
  });

  try {
    const html = passwordResetOtpTemplate({
      name: user.name,
      otp,
      validityMinutes: 10,
    });

    await sendEmail({
      to: email,
      subject: "Password Reset OTP",
      html,
      text: `Your Catlive OTP is ${otp}. Valid for 10 minutes.`,
    });

    logger.info(`Password reset OTP sent to ${email}`);
  } catch (error) {
    // Remove OTP from store if email fails
    otpStore.delete(email.toLowerCase());
    logger.error(`Failed to send OTP email to ${email}:`, error);
    throw new ApiError(500, "Failed to send OTP. Please try again.");
  }

  ApiResponse.success(
    res,
    200,
    "If an account exists, an OTP has been sent to your email"
  );
});

// Verify OTP
exports.verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }

  const otpData = otpStore.get(email.toLowerCase());

  if (!otpData) {
    throw new ApiError(
      400,
      "OTP expired or not found. Please request a new one."
    );
  }

  // Check expiry
  if (Date.now() > otpData.expiresAt) {
    otpStore.delete(email.toLowerCase());
    throw new ApiError(400, "OTP has expired. Please request a new one.");
  }

  // Check attempts
  if (otpData.attempts >= 3) {
    otpStore.delete(email.toLowerCase());
    throw new ApiError(
      400,
      "Too many failed attempts. Please request a new OTP."
    );
  }

  // Verify OTP
  if (otpData.otp !== otp) {
    otpData.attempts += 1;
    throw new ApiError(
      400,
      `Invalid OTP. ${3 - otpData.attempts} attempts remaining.`
    );
  }

  // OTP verified - generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes

  // Store reset token
  otpStore.set(`reset_${resetToken}`, {
    email: email.toLowerCase(),
    userId: otpData.userId,
    expiresAt: resetTokenExpiry,
  });

  // Clear OTP
  otpStore.delete(email.toLowerCase());

  logger.info(`OTP verified for ${email}`);

  ApiResponse.success(res, 200, "OTP verified successfully", {
    resetToken,
    expiresIn: 30 * 60, // seconds
  });
});

// Reset password with token
exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    throw new ApiError(400, "Reset token and new password are required");
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }

  const resetData = otpStore.get(`reset_${resetToken}`);

  if (!resetData) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  if (Date.now() > resetData.expiresAt) {
    otpStore.delete(`reset_${resetToken}`);
    throw new ApiError(
      400,
      "Reset token has expired. Please start the process again."
    );
  }

  // Update password
  const user = await User.findById(resetData.userId).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.password = newPassword;
  await user.save();

  // Clear reset token
  otpStore.delete(`reset_${resetToken}`);

  // Send confirmation email
  try {
    await sendEmail({
      to: user.email,
      subject: "Password Changed Successfully",
      template: "passwordChanged",
      data: {
        name: user.name,
        date: new Date().toLocaleString(),
      },
    });
  } catch (error) {
    logger.error(
      `Failed to send password change confirmation to ${user.email}:`,
      error
    );
  }

  logger.info(`Password reset successfully for user ${user.email}`);

  ApiResponse.success(
    res,
    200,
    "Password reset successfully. You can now login with your new password."
  );
});

// Resend OTP
exports.resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  // Check if there's an existing OTP request
  const existingOTP = otpStore.get(email.toLowerCase());

  if (existingOTP && Date.now() < existingOTP.expiresAt) {
    // Don't allow resend if OTP is still valid and was sent less than 1 minute ago
    const timeSinceLastSend =
      Date.now() - (existingOTP.expiresAt - 10 * 60 * 1000);
    if (timeSinceLastSend < 60000) {
      // 1 minute
      throw new ApiError(400, "Please wait before requesting another OTP");
    }
  }

  // CHECK IF USER EXISTS BEFORE RESENDING
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Return success message even if user doesn't exist
    return ApiResponse.success(
      res,
      200,
      "If an account exists, an OTP has been sent to your email"
    );
  }

  // Generate new OTP only if user exists
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  // Store OTP
  otpStore.set(email.toLowerCase(), {
    otp,
    expiresAt,
    attempts: 0,
    userId: user._id,
  });

  // Send email
  try {
    await sendEmail({
      to: email,
      subject: "Password Reset OTP (Resent)",
      template: "passwordResetOTP",
      data: {
        name: user.name,
        otp,
        validityMinutes: 10,
      },
    });

    logger.info(`Password reset OTP resent to ${email}`);
  } catch (error) {
    // Remove OTP from store if email fails
    otpStore.delete(email.toLowerCase());
    logger.error(`Failed to resend OTP email to ${email}:`, error);
    throw new ApiError(500, "Failed to send OTP. Please try again.");
  }

  ApiResponse.success(
    res,
    200,
    "If an account exists, an OTP has been sent to your email"
  );
});

// Cleanup expired OTPs
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (value.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
