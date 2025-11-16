const Joi = require('joi');

const validators = {
  register: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('user', 'host').default('user'),
    // Host-specific optional fields
    bio: Joi.string().max(500).optional(),
    ratePerMinute: Joi.number().min(10).optional(),
    languages: Joi.array().items(Joi.string()).optional(),
    interests: Joi.array().items(Joi.string()).optional()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(50),
    phone: Joi.string().pattern(/^[0-9]{10}$/),
    avatar: Joi.string().uri()
  }),

  createHostProfile: Joi.object({
    bio: Joi.string().max(500),
    ratePerMinute: Joi.number().min(10).required(),
    languages: Joi.array().items(Joi.string()),
    interests: Joi.array().items(Joi.string()),
    bankDetails: Joi.object({
      accountName: Joi.string().required(),
      accountNumber: Joi.string().required(),
      ifscCode: Joi.string().required(),
      bankName: Joi.string().required(),
      upiId: Joi.string()
    })
  }),

  initiateCall: Joi.object({
    hostId: Joi.string().required()
  }),

  endCall: Joi.object({
    callId: Joi.string().required()
  }),

  rateCall: Joi.object({
    callId: Joi.string().required(),
    rating: Joi.number().min(1).max(5).required(),
    feedback: Joi.string().max(500)
  }),

  createCoinOrder: Joi.object({
    packageId: Joi.string().required()
  }),

  requestWithdrawal: Joi.object({
    amount: Joi.number().min(100).required(),
    bankDetails: Joi.object({
      accountName: Joi.string().required(),
      accountNumber: Joi.string().required(),
      ifscCode: Joi.string().required(),
      bankName: Joi.string().required(),
      upiId: Joi.string()
    })
  })
};

module.exports = validators;