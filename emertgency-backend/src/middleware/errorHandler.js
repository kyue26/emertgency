// Global error handler middleware
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error status and message
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // PostgreSQL specific error handling
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        return res.status(409).json({
          error: 'Conflict',
          message: 'A record with this information already exists',
          details: err.detail,
        });
      case '23503': // Foreign key violation
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Referenced record does not exist',
          details: err.detail,
        });
      case '23514': // Check constraint violation
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Data validation failed',
          details: err.detail,
        });
      case '23502': // Not null violation
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Required field is missing',
          details: err.detail,
        });
    }
  }

  // Validation errors (from Joi)
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: err.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      })),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Token expired',
    });
  }

  // Send error response
  res.status(status).json({
    error: err.name || 'Error',
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
