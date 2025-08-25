// middleware/auth.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

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

    // Handle different token structures and get user ID
    let userEmail;
    let userId = decoded._id || decoded.id;
    
    if (decoded.user && decoded.user.email) {
      // Token structure: { user: { email: "..." }, ... }
      userEmail = decoded.user.email;
      // Also check for user ID in nested structure
      userId = userId || decoded.user.id || decoded.user._id;
    } else if (decoded.email) {
      // Token structure: { email: "...", ... }
      userEmail = decoded.email;
    } else {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token structure - no email found'
      });
    }

    // Get database connection
    const db = mongoose.connection.db;
    if (!db) {
      console.error('Auth middleware - Database connection not available');
      return res.status(500).json({
        status: 'error',
        message: 'Database connection error'
      });
    }

    let user = null;
    let userType = null;

    // First try to find user by ID if we have it
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      console.log('Auth middleware - Looking up user by ID:', userId);
      
      const [driverUser, cargoOwnerUser] = await Promise.all([
        db.collection('drivers').findOne({ _id: new mongoose.Types.ObjectId(userId) }),
        db.collection('cargo-owners').findOne({ _id: new mongoose.Types.ObjectId(userId) })
      ]);

      user = driverUser || cargoOwnerUser;
      userType = driverUser ? 'driver' : cargoOwnerUser ? 'cargo_owner' : null;
      
      console.log('Auth middleware - User found by ID:', !!user, 'Type:', userType);
    }

    // Fallback to email lookup if user not found by ID
    if (!user && userEmail) {
      console.log('Auth middleware - Falling back to email lookup for:', userEmail);
      
      const [driverUser, cargoOwnerUser] = await Promise.all([
        db.collection('drivers').findOne({ email: userEmail }),
        db.collection('cargo-owners').findOne({ email: userEmail })
      ]);

      user = driverUser || cargoOwnerUser;
      userType = driverUser ? 'driver' : cargoOwnerUser ? 'cargo_owner' : null;
      
      // Update userId with the actual database ID if found by email
      if (user) {
        userId = user._id;
        console.log('Auth middleware - User found by email, updating userId to:', userId);
      }
    }

    if (!user) {
      console.log('Auth middleware - User not found for email:', userEmail, 'or ID:', userId);
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

    // Set user information in request object
    req.user = {
  id: user._id.toString(),     
  _id: user._id.toString(),    
  email: user.email,
  name: user.name || '',
  phone: user.phone || '',
  userType: userType,
  isVerified: user.isVerified || false,
  location: user.location || null,
  role: user.role || 'user',
  profileCompleted: user.profileCompleted || false,
  driverProfile: user.driverProfile || null,
  cargoOwnerProfile: user.cargoOwnerProfile || null,
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