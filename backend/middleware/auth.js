// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user'); 

module.exports = async (req, res, next) => {
  try {
    // Extract token from headers
    const authHeader = req.header('Authorization');
    let token = req.header('x-auth-token');

    // Check Bearer token format first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // No token provided
    if (!token) {
      console.log('Auth middleware - No token provided');
      return res.status(401).json({
        status: 'error',
        message: 'Access denied. No token provided.'
      });
    }

    console.log('Auth middleware - Token received:', token.substring(0, 20) + '...');

    // Check JWT secret configuration
    if (!process.env.JWT_SECRET) {
      console.error('Auth middleware - JWT_SECRET not configured');
      return res.status(500).json({
        status: 'error',
        message: 'Server configuration error'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      // Try verification with issuer/audience first
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, {
          issuer: 'infinite-cargo',
          audience: 'infinite-cargo-users'
        });
        console.log('Auth middleware - Token verified with issuer/audience');
      } catch (strictError) {
        // Fallback to basic verification
        console.log('Auth middleware - Trying basic token verification');
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Auth middleware - Token verified without issuer/audience');
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

      return res.status(401).json({
        status: 'error',
        message: 'Token verification failed'
      });
    }

    console.log('Auth middleware - Decoded token:', { 
      id: decoded._id || decoded.id, 
      userType: decoded.userType,
      email: decoded.user?.email || decoded.email 
    });

    // Handle different token structures
    let userEmail;
    let userId = decoded._id || decoded.id || decoded.user?.id;
    
    if (decoded.user && decoded.user.email) {
      // Token structure: { user: { email: "..." }, ... }
      userEmail = decoded.user.email;
      userId = decoded.user.id || decoded.user._id || userId;
    } else if (decoded.email) {
      // Token structure: { email: "...", ... }
      userEmail = decoded.email;
    } else {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token structure - no email found'
      });
    }

    // FIXED: Use unified User model instead of separate collections
    let user;
    try {
      if (userId) {
        // First try to find by ID if available
        user = await User.findById(userId);
      }
      
      if (!user && userEmail) {
        // Fallback to email lookup
        user = await User.findOne({ email: userEmail });
      }
    } catch (dbError) {
      console.error('Auth middleware - Database error:', dbError.message);
      return res.status(500).json({
        status: 'error',
        message: 'Database error during authentication'
      });
    }

    if (!user) {
      console.log('Auth middleware - User not found for email:', userEmail);
      return res.status(401).json({
        status: 'error',
        message: 'Token is not valid - user not found'
      });
    }

    // Check account status
    if (user.accountLocked) {
      return res.status(423).json({
        status: 'error',
        message: 'Account is locked'
      });
    }

    if (user.accountStatus && user.accountStatus !== 'active') {
      return res.status(423).json({
        status: 'error',
        message: `Account is ${user.accountStatus}`
      });
    }

    // FIXED: Ensure userType is properly set
    let userType = user.userType || decoded.userType;
    
    // Fallback userType detection if not explicitly set
    if (!userType) {
      if (user.driverProfile || user.vehicleType) {
        userType = 'driver';
      } else if (user.cargoOwnerProfile || user.companyName) {
        userType = 'cargo_owner';
      } else {
        // Default based on which profile fields are present
        userType = 'cargo_owner'; // Default assumption
      }
    }

    // Normalize userType variations
    if (['cargoOwner', 'cargo-owner', 'cargo_owner'].includes(userType)) {
      userType = 'cargo_owner';
    }

    // Set user information in request object
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name || user.fullName || '',
      phone: user.phone || '',
      userType: userType,
      isVerified: user.isVerified || false,
      location: user.location || null,
      role: user.role || 'user',
      profileCompleted: user.profileCompleted || false,
      driverProfile: user.driverProfile || null,
      cargoOwnerProfile: user.cargoOwnerProfile || null,
      companyName: user.companyName || user.cargoOwnerProfile?.companyName || '',
      accountStatus: user.accountStatus || 'active'
    };

    console.log('Auth middleware - Authentication successful for:', user.email, 'Type:', userType, 'ID:', user._id);
    next();

  } catch (error) {
    console.error('Auth middleware - Unexpected error:', error.message);
    console.error('Auth middleware - Error stack:', error.stack);
    return res.status(500).json({
      status: 'error',
      message: 'Server error during authentication'
    });
  }
};