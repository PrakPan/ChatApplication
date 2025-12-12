const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { verifyAccessToken } = require('../config/jwt');
const CoinSeller = require('../models/CoinSeller');

const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'Not authorized, no token provided');
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('-password -refreshToken');

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    req.user = user;

      if (user.isCoinSeller) {
        const coinSeller = await CoinSeller.findOne({ userId: user._id });
        if (coinSeller && coinSeller.isActive) {
          req.user.coinSellerId = coinSeller._id;
          req.user.coinSellerData = coinSeller;
        }
      }

      next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token');
    }
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token expired');
    }
    throw error;
  }
});

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `Role ${req.user.role} is not authorized to access this route`);
    }
    next();
  };
};

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'Not authorized to access this route');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      throw new ApiError(401, 'User not found');
    }

    next();
  } catch (error) {
    throw new ApiError(401, 'Not authorized to access this route');
  }
});

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }
    next();
  };
};


exports.isCoinSeller = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    if (!req.user.isCoinSeller) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Coin seller privileges required'
      });
    }

    const coinSeller = await CoinSeller.findOne({ userId: req.user._id });
    
    if (!coinSeller || !coinSeller.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Coin seller account is not active'
      });
    }

    req.user.coinSellerId = coinSeller._id;
    req.user.coinSellerData = coinSeller;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error checking coin seller status'
    });
  }
};





module.exports = { authenticate, authorize, protect, restrictTo };