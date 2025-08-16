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
      console.log('Admin auth - No token provided');
      return res.status(401).json({ 
        status: 'error',
        message: 'No token, authorization denied' 
      });
    }

    console.log('Admin auth - Token received:', token.substring(0, 20) + '...');

    try {
      // Check if JWT secrets exist
      const jwtSecret = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('Admin auth - No JWT secret configured');
        return res.status(500).json({
          status: 'error',
          message: 'Server configuration error'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, jwtSecret);

      console.log('Admin auth - Token decoded:', {
        hasAdmin: !!decoded.admin,
        adminId: decoded.admin?.id,
        adminEmail: decoded.admin?.email,
        exp: decoded.exp ? new Date(decoded.exp * 1000) : 'No expiry'
      });

      // Check if token has admin payload
      if (!decoded.admin) {
        console.log('Admin auth - Invalid token structure, missing admin payload');
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token format - admin token required'
        });
      }

      // Check if admin ID exists in token
      if (!decoded.admin.id) {
        console.log('Admin auth - Missing admin ID in token');
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token structure - missing admin ID'
        });
      }

      // Get admin from database with enhanced error handling
      let admin;
      try {
        admin = await Admin.findById(decoded.admin.id).select('-password');
      } catch (dbError) {
        console.error('Admin auth - Database error finding admin:', dbError);
        return res.status(500).json({
          status: 'error',
          message: 'Database error during authentication'
        });
      }
      
      if (!admin) {
        console.log('Admin auth - Admin not found:', decoded.admin.id);
        return res.status(401).json({
          status: 'error',
          message: 'Admin not found - token invalid'
        });
      }

      console.log('Admin auth - Admin found:', {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        isLocked: admin.isLocked
      });

      // Check if admin account is active
      if (!admin.isActive) {
        console.log('Admin auth - Admin account deactivated:', admin.email);
        return res.status(403).json({
          status: 'error',
          message: 'Admin account is deactivated'
        });
      }

      // Check if account is locked
      if (admin.isLocked) {
        console.log('Admin auth - Admin account locked:', admin.email);
        return res.status(423).json({
          status: 'error',
          message: 'Admin account is locked due to failed login attempts'
        });
      }

      // Add admin info to request object
      req.admin = {
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions || {},
        isActive: admin.isActive,
        lastLogin: admin.lastLogin
      };

      // Log admin action for audit trail (in production, use proper logging)
      if (process.env.NODE_ENV !== 'test') {
        console.log(`Admin action: ${admin.email} (${admin.role}) accessed ${req.method} ${req.originalUrl}`);
      }

      // Update last login time (optional - only do this for certain routes to avoid too many DB writes)
      if (req.originalUrl.includes('/dashboard') && (!admin.lastLogin || Date.now() - admin.lastLogin > 60000)) {
        try {
          admin.lastLogin = new Date();
          await admin.save();
        } catch (updateError) {
          // Don't fail auth if we can't update last login
          console.warn('Admin auth - Failed to update last login:', updateError);
        }
      }

      next();

    } catch (jwtError) {
      console.error('Admin auth - JWT error:', jwtError);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token expired - please log in again',
          expired: true
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token format'
        });
      } else if (jwtError.name === 'NotBeforeError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token not active yet'
        });
      }
      
      // Re-throw unexpected JWT errors
      throw jwtError;
    }

  } catch (error) {
    console.error('Admin auth middleware error:', {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : 'Stack trace hidden in production'
    });

    // Handle specific error types
    if (error.message && error.message.includes('Database error')) {
      return res.status(500).json({
        status: 'error',
        message: 'Database connection error'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error in authentication',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message })
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
      console.log('RequireRole - No admin in request');
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(req.admin.role)) {
      console.log(`RequireRole - Access denied. Admin role: ${req.admin.role}, Required: ${roles.join(' or ')}`);
      return res.status(403).json({
        status: 'error',
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    console.log(`RequireRole - Access granted. Admin role: ${req.admin.role}`);
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
      console.log('RequirePermission - No admin in request');
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    const adminPermissions = req.admin.permissions || {};
    
    const hasPermission = permissions.some(permission => adminPermissions[permission] === true);
    
    if (!hasPermission) {
      console.log(`RequirePermission - Access denied. Admin permissions:`, adminPermissions, `Required:`, permissions);
      return res.status(403).json({
        status: 'error',
        message: `Access denied. Required permission: ${permissions.join(' or ')}`
      });
    }

    console.log(`RequirePermission - Access granted for permissions:`, permissions);
    next();
  };
};

/**
 * Super admin only middleware
 * Use after adminAuth middleware
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin) {
    console.log('RequireSuperAdmin - No admin in request');
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required'
    });
  }

  if (req.admin.role !== 'super_admin') {
    console.log(`RequireSuperAdmin - Access denied. Admin role: ${req.admin.role}`);
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. Super admin role required.'
    });
  }

  console.log('RequireSuperAdmin - Super admin access granted');
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
  },
  handler: (req, res) => {
    console.log(`Admin rate limit exceeded for ${req.admin?.email || req.ip}`);
    res.status(429).json({
      status: 'error',
      message: 'Too many admin requests, please try again later.',
      retryAfter: '15 minutes'
    });
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
      try {
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

        // Optionally save to admin's audit log in database
        if (req.admin?.id && data.status === 'success') {
          // Don't await this to avoid slowing down response
          const Admin = require('../models/admin');
          Admin.findById(req.admin.id)
            .then(admin => {
              if (admin) {
                return admin.addAuditLog(action, null, { url: req.originalUrl, method: req.method }, req);
              }
            })
            .catch(err => console.warn('Failed to save audit log to database:', err));
        }
      } catch (logError) {
        console.warn('Audit logging failed:', logError);
      }

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Middleware to check if admin exists and create default super admin if none exist
 * Use this only on admin login routes
 */
const ensureSuperAdminExists = async (req, res, next) => {
  try {
    const adminCount = await Admin.countDocuments();
    
    if (adminCount === 0) {
      console.log('No admins found, creating default super admin...');
      
      // Create default super admin (you should change these credentials)
      const defaultSuperAdmin = await Admin.createSuperAdmin({
        name: 'Super Administrator',
        email: 'admin@infinitecargo.com',
        password: 'SuperAdmin123!', // Change this immediately after first login
        phone: '+254700000000'
      });
      
      console.log('Default super admin created:', defaultSuperAdmin.email);
    }
    
    next();
  } catch (error) {
    console.error('Error in ensureSuperAdminExists:', error);
    // Don't fail the request, just log the error
    next();
  }
};

module.exports = {
  adminAuth,
  requireRole,
  requirePermission,
  requireSuperAdmin,
  adminRateLimit,
  auditLog,
  ensureSuperAdminExists
};