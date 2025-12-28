const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { MailtrapTransport } = require("mailtrap");
require('dotenv').config();


if (!process.env.TOKEN) {
  throw new Error('MAILTRAP TOKEN is not defined in environment variables');
}


// const transporter = nodemailer.createTransport(
//   MailtrapTransport({
//     token: process.env.TOKEN,
//   })
// );

var transporter = nodemailer.createTransport({
  host: "live.smtp.mailtrap.io",
  port: 587,
  auth: {
    user: "smtp@mailtrap.io",
    pass: "bf80da639e54d1d8ec451b41bed76a11"
  }
});

transporter.verify((error, success) => {
  if (error) {
    logger.error('Mailtrap connection failed:', error);
  } else {
    logger.info('Mailtrap is ready to send emails');
  }
});


const sendEmail = async ({ to, subject, html, text }) => {

  console.log("Email Mail Options",to,subject);
  try {
    const mailOptions = {
      from: {
        name: "VideoCall Platform",
        // address: "catliveofficial@gmail.com" 
        address: "no-reply@catlive.in"
      },
      to : [to],
      subject,
      html,
      text: text || subject
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email send failed to ${to}:`, {
      error: error.message,
      code: error.code,
      response: error.response
    });
    throw new Error(`Failed to send email: ${error.message}`);
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