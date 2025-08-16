// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user'); 

module.exports = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.header('x-auth-token');

    if (!token) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Access denied. No token provided.' 
      });
    }

    console.log('Auth middleware - Token received:', token.substring(0, 20) + '...');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'infinite-cargo',
      audience: 'infinite-cargo-users'
    });

    console.log('Auth middleware - Token decoded:', {
      userId: decoded.user.id,
      userType: decoded.user.userType,
      email: decoded.user.email,
      exp: new Date(decoded.exp * 1000),
      iat: new Date(decoded.iat * 1000)
    });

    // Check if token is expired (additional check)
    const currentTime = Date.now() / 1000;
    if (decoded.exp <= currentTime) {
      console.log('Auth middleware - Token expired:', {
        exp: new Date(decoded.exp * 1000),
        now: new Date()
      });
      return res.status(401).json({ 
        status: 'error', 
        message: 'Token expired',
        expired: true 
      });
    }

    // Use the User model's static method to find user by email
    const user = await User.findUserByEmail(decoded.user.email);

    if (!user) {
      console.log('Auth middleware - User not found:', decoded.user.email);
      return res.status(401).json({ 
        status: 'error', 
        message: 'Token is not valid - user not found' 
      });
    }

    console.log('Auth middleware - User found:', {
      userId: user._id,
      email: user.email,
      userType: user.userType,
      isVerified: user.isVerified
    });

    // Check if account is locked or inactive (if you have these fields)
    if (user.accountLocked) {
      console.log('Auth middleware - Account locked:', user.email);
      return res.status(423).json({
        status: 'error',
        message: 'Account is locked'
      });
    }

    if (user.accountStatus && user.accountStatus !== 'active') {
      console.log('Auth middleware - Account inactive:', user.email);
      return res.status(423).json({
        status: 'error',
        message: 'Account is inactive'
      });
    }

    // Attach user info to request (without sensitive data)
    req.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      userType: user.userType,
      isVerified: user.isVerified,
      location: user.location,
      role: user.role,
      profileCompleted: user.profileCompleted,
      driverProfile: user.driverProfile,
      cargoOwnerProfile: user.cargoOwnerProfile
    };

    console.log('Auth middleware - Authentication successful for:', user.email);
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    
    if (err.name === 'JsonWebTokenError') {
      console.log('Auth middleware - Invalid token format');
      return res.status(401).json({ 
        status: 'error', 
        message: 'Invalid token' 
      });
    }
    
    if (err.name === 'TokenExpiredError') {
      console.log('Auth middleware - Token expired error');
      return res.status(401).json({ 
        status: 'error', 
        message: 'Token expired',
        expired: true 
      });
    }

    if (err.name === 'NotBeforeError') {
      console.log('Auth middleware - Token not active yet');
      return res.status(401).json({ 
        status: 'error', 
        message: 'Token not active' 
      });
    }

    return res.status(500).json({ 
      status: 'error', 
      message: 'Server error during authentication' 
    });
  }
};