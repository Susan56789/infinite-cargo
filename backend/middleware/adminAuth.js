// middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');

/**
 * Admin Authentication Middleware
 * Validates JWT tokens for admin routes
 * Checks admin permissions and status
 */
const adminAuth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    let token = req.header('x-auth-token');

    // Check for Bearer token format first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Check if no token
    if (!token) {
      return res.status(401).json({ 
        status: 'error',
        message: 'No token, authorization denied' 
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET);

      // Check if token has admin payload
      if (!decoded.admin) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token format - admin token required'
        });
      }

      // Get admin from database to ensure they still exist and are active
      const admin = await Admin.findById(decoded.admin.id).select('-password');
      
      if (!admin) {
        return res.status(401).json({
          status: 'error',
          message: 'Admin not found - token invalid'
        });
      }

      if (!admin.isActive) {
        return res.status(403).json({
          status: 'error',
          message: 'Admin account is deactivated'
        });
      }

      // Add admin info to request object
      req.admin = {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions || {}
      };

      // Log admin action for audit trail (in production, use proper logging)
      if (process.env.NODE_ENV !== 'test') {
        console.log(`Admin action: ${admin.email} (${admin.role}) accessed ${req.method} ${req.originalUrl}`);
      }

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token expired - please log in again'
        });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token format'
        });
      }
      throw err;
    }

  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error in authentication'
    });
  }
};

/**
 * Role-based access control middleware
 * Use after adminAuth middleware
 * @param {string|Array} allowedRoles - Single role or array of roles
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Permission-based access control middleware
 * Use after adminAuth middleware
 * @param {string|Array} requiredPermissions - Single permission or array of permissions
 */
const requirePermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    const adminPermissions = req.admin.permissions || {};
    
    const hasPermission = permissions.some(permission => adminPermissions[permission] === true);
    
    if (!hasPermission) {
      return res.status(403).json({
        status: 'error',
        message: `Access denied. Required permission: ${permissions.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Super admin only middleware
 * Use after adminAuth middleware
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required'
    });
  }

  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. Super admin role required.'
    });
  }

  next();
};

/**
 * Rate limiting for admin actions
 * Prevents abuse of admin endpoints
 */
const adminRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each admin to 100 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many admin requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use admin ID if available, otherwise fall back to IP
    return req.admin?.id || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for super admins in development
    return process.env.NODE_ENV === 'development' && req.admin?.role === 'super_admin';
  }
});

/**
 * Audit logging middleware
 * Logs admin actions for compliance and security
 */
const auditLog = (action) => {
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to capture response
    res.json = function(data) {
      // Log the admin action
      const logData = {
        timestamp: new Date().toISOString(),
        admin: {
          id: req.admin?.id,
          email: req.admin?.email,
          role: req.admin?.role
        },
        action,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: data.status === 'success',
        ...(data.status === 'error' && { error: data.message })
      };

      // In production, you'd want to save this to a database or log service
      if (process.env.NODE_ENV !== 'test') {
        console.log('Admin Audit Log:', JSON.stringify(logData, null, 2));
      }

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  adminAuth,
  requireRole,
  requirePermission,
  requireSuperAdmin,
  adminRateLimit,
  auditLog
};