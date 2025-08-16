// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');

module.exports = async (req, res, next) => {
  try {
    // Get token from header with better error handling
    const authHeader = req.header('Authorization');
    let token = req.header('x-auth-token');

    // Check for Bearer token format first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      console.log('Auth middleware - No token provided');
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.'
      });
    }

    console.log('Auth middleware - Token received:', token.substring(0, 20) + '...');

    // Verify token with more robust error handling
    let decoded;
    try {
      // Check if JWT_SECRET exists
      if (!process.env.JWT_SECRET) {
        console.error('Auth middleware - JWT_SECRET not configured');
        return res.status(500).json({
          status: 'error',
          message: 'Server configuration error'
        });
      }

      // First try with issuer/audience if they're expected
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, {
          issuer: 'infinite-cargo',
          audience: 'infinite-cargo-users'
        });
      } catch (jwtError) {
        // If that fails, try without issuer/audience (fallback for older tokens)
        console.log('Auth middleware - Trying token verification without issuer/audience');
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      }
    } catch (jwtError) {
      console.error('Auth middleware - JWT verification failed:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token expired',
          expired: true
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token'
        });
      }
      
      if (jwtError.name === 'NotBeforeError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token not active'
        });
      }
      
      return res.status(401).json({
        status: 'error',
        message: 'Token verification failed'
      });
    }

    console.log('Auth middleware - Token decoded:', {
      userId: decoded.user?.id,
      userType: decoded.user?.userType,
      email: decoded.user?.email,
      exp: decoded.exp ? new Date(decoded.exp * 1000) : 'No expiry',
      iat: decoded.iat ? new Date(decoded.iat * 1000) : 'No issued time'
    });

    // Check if token structure is correct
    if (!decoded.user || !decoded.user.email) {
      console.log('Auth middleware - Invalid token structure:', {
        hasUser: !!decoded.user,
        hasEmail: !!decoded.user?.email,
        tokenStructure: Object.keys(decoded)
      });
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token structure'
      });
    }

    // Check if token is expired (additional check)
    if (decoded.exp) {
      const currentTime = Date.now() / 1000;
      if (decoded.exp <= currentTime) {
        console.log('Auth middleware - Token expired:', {
          exp: new Date(decoded.exp * 1000),
          now: new Date(),
          expired: decoded.exp <= currentTime
        });
        return res.status(401).json({
          status: 'error',
          message: 'Token expired',
          expired: true
        });
      }
    }

    // Find user with enhanced error handling
    let user;
    try {
      console.log('Auth middleware - Searching for user:', decoded.user.email);
      
      // Use the corrected findUserByEmail method
      user = await User.findUserByEmail(decoded.user.email);
      
      if (!user) {
        console.log('Auth middleware - User not found in database:', decoded.user.email);
        return res.status(401).json({
          status: 'error',
          message: 'Token is not valid - user not found'
        });
      }

      console.log('Auth middleware - User found:', {
        userId: user._id,
        email: user.email,
        userType: user.userType,
        isVerified: user.isVerified,
        accountStatus: user.accountStatus
      });

    } catch (dbError) {
      console.error('Auth middleware - Database error when finding user:', dbError);
      return res.status(500).json({
        status: 'error',
        message: 'Database error during authentication'
      });
    }

    // Check account status with safe property access
    if (user.accountLocked) {
      console.log('Auth middleware - Account locked:', user.email);
      return res.status(423).json({
        status: 'error',
        message: 'Account is locked'
      });
    }

    if (user.accountStatus && user.accountStatus !== 'active') {
      console.log('Auth middleware - Account inactive:', {
        email: user.email,
        status: user.accountStatus
      });
      return res.status(423).json({
        status: 'error',
        message: `Account is ${user.accountStatus}`
      });
    }

    // Attach user info to request with safe property access
    req.user = {
      id: user._id,
      email: user.email,
      name: user.name || '',
      phone: user.phone || '',
      userType: user.userType || 'user',
      isVerified: user.isVerified || false,
      location: user.location || null,
      role: user.role || 'user',
      profileCompleted: user.profileCompleted || false,
      driverProfile: user.driverProfile || null,
      cargoOwnerProfile: user.cargoOwnerProfile || null,
      accountStatus: user.accountStatus || 'active'
    };

    console.log('Auth middleware - Authentication successful for:', user.email);
    next();

  } catch (error) {
    console.error('Auth middleware - Unexpected error:', {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : 'Stack trace hidden in production'
    });

    // Handle specific error types
    if (error.message && error.message.includes('Database error')) {
      return res.status(500).json({
        status: 'error',
        message: 'Database connection error',
        ...(process.env.NODE_ENV === 'development' && { debug: error.message })
      });
    }

    if (error.message && error.message.includes('Database connection not available')) {
      return res.status(500).json({
        status: 'error',
        message: 'Database connection not available'
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Server error during authentication',
      ...(process.env.NODE_ENV === 'development' && { debug: error.message })
    });
  }
};