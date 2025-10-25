const { ApiError } = require('../utils/apiResponse');

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      throw new ApiError(400, 'Validation failed', errors);
    }

    req.body = value;
    next();
  };
};

module.exports = validate;