// middleware/auth.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    let token = req.header('x-auth-token');

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

    if (!process.env.JWT_SECRET) {
      console.error('Auth middleware - JWT_SECRET not configured');
      return res.status(500).json({
        status: 'error',
        message: 'Server configuration error'
      });
    }

    let decoded;
    try {
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, {
          issuer: 'infinite-cargo',
          audience: 'infinite-cargo-users'
        });
      } catch (jwtError) {
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

      return res.status(401).json({
        status: 'error',
        message: 'Token verification failed'
      });
    }

    if (!decoded.user || !decoded.user.email) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token structure'
      });
    }

    // Lookup in driver and cargo owner collections
    const db = mongoose.connection.db;

    const [driverUser, cargoOwnerUser] = await Promise.all([
      db.collection('drivers').findOne({ email: decoded.user.email }),
      db.collection('cargo-owners').findOne({ email: decoded.user.email })
    ]);

    const user = driverUser || cargoOwnerUser;
    const userType = driverUser ? 'driver' : cargoOwnerUser ? 'cargo_owner' : null;

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Token is not valid - user not found'
      });
    }

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

    req.user = {
      id: user._id,
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

    console.log('Auth middleware - Authentication successful for:', user.email);
    next();
  } catch (error) {
    console.error('Auth middleware - Unexpected error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error during authentication'
    });
  }
};
