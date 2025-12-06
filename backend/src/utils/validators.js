const Joi = require('joi');

const validators = {
  register: Joi.object({
    name: Joi.string().min(2).max(50).required()
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 50 characters'
      }),
    
    email: Joi.string().email().required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Please provide a valid email address'
      }),
    
    phone: Joi.string().pattern(/^[0-9]{10}$/).required()
      .messages({
        'string.empty': 'Phone number is required',
        'string.pattern.base': 'Phone number must be exactly 10 digits'
      }),
    
    password: Joi.string().min(8).required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 8 characters'
      }),
    
    role: Joi.string().valid('user', 'host').default('user')
      .messages({
        'any.only': 'Role must be either user or host'
      }),
    
    country: Joi.string().min(2).max(100).required()
      .messages({
        'string.empty': 'Country is required',
        'string.min': 'Country must be at least 2 characters',
        'string.max': 'Country cannot exceed 100 characters'
      }),
    
    dob: Joi.date().max('now').required()
      .messages({
        'date.base': 'Invalid date of birth',
        'date.max': 'Date of birth cannot be in the future',
        'any.required': 'Date of birth is required'
      }),
    
    gender: Joi.string().valid('male', 'female', 'other').lowercase().required()
      .messages({
        'string.empty': 'Gender is required',
        'any.only': 'Gender must be male, female, or other'
      }),
    
    // Host-specific optional fields
    bio: Joi.string().max(500).min(0).optional().allow('')
      .messages({
        'string.max': 'Bio cannot exceed 500 characters'
      }),
    
    languages: Joi.array().items(Joi.string()).optional()
      .messages({
        'array.base': 'Languages must be an array of strings'
      }),
    
    interests: Joi.array().items(Joi.string()).optional()
      .messages({
        'array.base': 'Interests must be an array of strings'
      })
  }).custom((value, helpers) => {
    // Custom validation for hosts
    if (value.role === 'host') {
      // Age validation
      const birthDate = new Date(value.dob);
      const today = new Date();
      
      // Check if date is valid
      if (isNaN(birthDate.getTime())) {
        return helpers.error('any.invalid', { message: 'Invalid date of birth' });
      }
      
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();
      
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

      if (actualAge < 18) {
        return helpers.error('any.invalid', { message: 'Hosts must be at least 18 years old' });
      }
      if (value.gender !== 'female') {
        return helpers.error('any.invalid', { message: 'Only females can register as hosts' });
      }
    }

    return value;
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