const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('../utils/logger');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '123',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '233'
});

const createOrder = async ({ amount, currency, receipt, notes }) => {
  try {
    const options = {
      amount: amount * 100, // Convert to paise
      currency: currency || 'INR',
      receipt,
      notes
    };

    const order = await razorpay.orders.create(options);
    logger.info(`Razorpay order created: ${order.id}`);
    return order;
  } catch (error) {
    logger.error(`Razorpay order creation failed: ${error.message}`);
    throw new Error('Failed to create payment order');
  }
};

const verifyPayment = ({ orderId, paymentId, signature }) => {
  try {
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    logger.error(`Payment verification failed: ${error.message}`);
    return false;
  }
};

const getPaymentDetails = async (paymentId) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    logger.error(`Failed to fetch payment: ${error.message}`);
    throw new Error('Failed to fetch payment details');
  }
};

const refundPayment = async (paymentId, amount) => {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount * 100 // Convert to paise
    });
    logger.info(`Refund processed: ${refund.id}`);
    return refund;
  } catch (error) {
    logger.error(`Refund failed: ${error.message}`);
    throw new Error('Failed to process refund');
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getPaymentDetails,
  refundPayment
};