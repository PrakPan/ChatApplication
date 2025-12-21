const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { MailtrapTransport } = require("mailtrap");
require('dotenv').config();


const transporter = nodemailer.createTransport(
  MailtrapTransport({
    token: process.env.TOKEN,
  })
);



const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const mailOptions = {
      from: `"VideoCall Platform" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email send failed: ${error.message}`);
    throw new Error('Failed to send email');
  }
};

const sendWelcomeEmail = async (user) => {
  const html = `
    Welcome to VideoCall Platform!
    Hi ${user.name},
    Thank you for registering with us.
    Start connecting with amazing hosts today!
  `;

  await sendEmail({
    
    to: user.email,
    subject: 'Welcome to VideoCall Platform',
    html,
    text: `Welcome ${user.name}!`
  });
};

const sendHostApprovalEmail = async (user, host) => {
  const html = `
    Host Application Approved!
    Hi ${user.name},
    Congratulations! Your host application has been approved.
    You can now go online and start taking calls.
  `;

  await sendEmail({
    to: user.email,
    subject: 'Host Application Approved',
    html,
    text: `Your host application has been approved!`
  });
};

const sendHostRejectionEmail = async (user, reason) => {
  const html = `
    Host Application Update
    Hi ${user.name},
    Unfortunately, your host application was not approved.
    Reason: ${reason}
    Please contact support for more information.
  `;

  await sendEmail({
    to: user.email,
    subject: 'Host Application Update',
    html,
    text: `Your host application was not approved`
  });
};

const sendWithdrawalCompletedEmail = async (user, withdrawal) => {
  const html = `
    Withdrawal Completed
    Hi ${user.name},
    Your withdrawal request of ₹${withdrawal.amount} has been processed.
    Transaction ID: ${withdrawal.transactionId}
  `;

  await sendEmail({
    to: user.email,
    subject: 'Withdrawal Completed',
    html,
    text: `Your withdrawal has been completed`
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendHostApprovalEmail,
  sendHostRejectionEmail,
  sendWithdrawalCompletedEmail
};