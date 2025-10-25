class ApiResponse {
  constructor(statusCode, message, data = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    if (data) this.data = data;
  }

  static success(res, statusCode = 200, message = 'Success', data = null) {
    return res.status(statusCode).json(new ApiResponse(statusCode, message, data));
  }

  static error(res, statusCode = 500, message = 'Internal Server Error', errors = null) {
    const response = new ApiResponse(statusCode, message);
    if (errors) response.errors = errors;
    return res.status(statusCode).json(response);
  }
}

class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { ApiResponse, ApiError };