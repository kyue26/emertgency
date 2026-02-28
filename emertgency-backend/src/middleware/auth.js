import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Authentication middleware
export const authenticate = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request
    req.user = {
      professionalId: decoded.professionalId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Invalid token',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Token expired',
      });
    }
    next(error);
  }
};

// Authorization middleware for specific roles
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'User not authenticated',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Authorization Error',
        message: 'You do not have permission to access this resource',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
    }

    next();
  };
};
