// utils/emailService.js
const nodemailer = require('nodemailer');

// Email templates
const templates = {
  passwordResetOTP: (data) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-box { background: white; border: 2px dashed #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
        .otp { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
        .warning { color: #ef4444; font-size: 14px; margin-top: 20px; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <p>We received a request to reset your password. Use the OTP below to proceed:</p>
          
          <div class="otp-box">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Your OTP Code</p>
            <div class="otp">${data.otp}</div>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">Valid for ${data.validityMinutes} minutes</p>
          </div>
          
          <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
          
          <div class="warning">
            ⚠️ Never share this OTP with anyone. Our team will never ask for it.
          </div>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply.</p>
          <p>&copy; ${new Date().getFullYear()} Your App Name. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  passwordChanged: (data) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .success-icon { font-size: 48px; }
        .info-box { background: white; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">✅</div>
          <h1>Password Changed Successfully</h1>
        </div>
        <div class="content">
          <p>Hi ${data.name},</p>
          <p>Your password has been successfully changed.</p>
          
          <div class="info-box">
            <strong>Changed on:</strong> ${data.date}
          </div>
          
          <div class="warning">
            <strong>⚠️ Didn't make this change?</strong><br>
            If you didn't change your password, please contact our support team immediately.
          </div>
          
          <p>You can now use your new password to log in to your account.</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply.</p>
          <p>&copy; ${new Date().getFullYear()} Your App Name. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
};

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
};

// Send email function
exports.sendEmail = async ({ to, subject, template, data }) => {
  try {
    const transporter = createTransporter();
    
    const htmlContent = templates[template] ? templates[template](data) : data.html;
    
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Video Call App'}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlContent
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
};