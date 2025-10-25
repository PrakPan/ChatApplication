const rateLimit = require('express-rate-limit');
const { ApiResponse } = require('../utils/apiResponse');

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    handler: (req, res) => {
      ApiResponse.error(res, 429, message || 'Too many requests, please try again later');
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts, please try again after 15 minutes'
);

const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'Too many requests from this IP'
);

const callLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10, // 10 calls
  'Too many call requests, please slow down'
);

const paymentLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  20, // 20 transactions
  'Too many payment requests'
);

module.exports = {
  authLimiter,
  apiLimiter,
  callLimiter,
  paymentLimiter
};