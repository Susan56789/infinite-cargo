const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const Admin = require('../models/admin');
const Load = require('../models/load');
const { adminAuth } = require('../middleware/adminAuth');
const { Subscription } = require('../models/subscription');
const corsHandler = require('../middleware/corsHandler');

// Apply CORS middleware
router.use(corsHandler);



// @route   POST /api/admin/login
// @desc    Admin login
// @access  Public
router.post('/login', [
  body('email')
  .trim()
  .normalizeEmail({ gmail_remove_dots: false })
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    console.log('Admin login request received:', { 
      email: req.body.email,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Validation failed',
        errors: errors.array().map(error => ({
          field: error.path || error.param,
          message: error.msg
        }))
      });
    }

    const { email, password } = req.body;

    // Check if admin exists
    const admin = await Admin.findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true 
    }).select('+password');

    console.log("ADMIN = ", admin);
    
    if (!admin) {
      console.log('Admin login failed: Admin not found or inactive for email:', email);
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid credentials or account is disabled' 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      console.log('Admin login failed: Invalid password for admin:', email);
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid credentials' 
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    console.log('Admin login successful:', { id: admin._id, email: admin.email, role: admin.role });
    try {
      const db = mongoose.connection.db;
      const auditLogsCollection = db.collection('audit_logs');

      await auditLogsCollection.insertOne({
        action: 'admin_login',   
        entityType: 'admin',         
        entityId: new mongoose.Types.ObjectId(admin._id),
        adminId: new mongoose.Types.ObjectId(admin._id),
        adminName: admin.name,
        adminEmail: admin.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        createdAt: new Date()
      });
    } catch (auditError) {
      console.warn('Audit log failed:', auditError);
      // Don't fail login if audit log fails
    }

    // Create JWT payload
    const payload = {
      admin: {
        id: admin._id,
        role: admin.role,
        permissions: admin.permissions
      }
    };

    // Sign JWT with admin secret (use different secret for admin)
    const token = jwt.sign(
      payload, 
      process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET, 
      { expiresIn: '8h' } // Shorter expiry for admin sessions
    );

    res.json({
      status: 'success',
      message: 'Admin login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        permissions: admin.permissions,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during admin login',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// @route   GET /api/admin/audit-logs
// @desc    Fetch audit logs
router.get('/audit-logs', adminAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const auditLogsCollection = db.collection('audit_logs');

    const { limit = 10 } = req.query;
    const logs = await auditLogsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.json({
      status: 'success',
      data: logs
    });
  } catch (error) {
    console.error('Audit logs fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch audit logs'
    });
  }
});


// @route   POST /api/admin/users/:id/verify
// @desc    Verify a cargo owner or driver
// POST /api/admin/users/:id/verify
router.post('/users/:id/verify', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { verified = true } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid user ID'
    });
  }

  if (!req.admin.permissions?.manageUsers) {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied'
    });
  }

  try {
    const db = mongoose.connection.db;
    const collections = ['drivers', 'cargo-owners'];
    let updated = null;
    let userType = null;

    for (const col of collections) {
      const result = await db.collection(col).findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id) },
        {
          $set: {
            isVerified: verified,
            updatedAt: new Date(),
            ...(col === 'drivers'
              ? { 'driverProfile.verified': verified }
              : { 'cargoOwnerProfile.verified': verified })
          }
        },
        { returnDocument: 'after' }
      );
      if (result.value) {
        updated = result.value;
        userType = col === 'drivers' ? 'driver' : 'cargo_owner';
        break;
      }
    }

    if (!updated) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    //  Correct audit log
    try {
      const auditLogsCollection = db.collection('audit_logs');
      await auditLogsCollection.insertOne({
        action: 'user_verify',   
        entityType: 'user',         
        entityId: new mongoose.Types.ObjectId(id),
        adminId: new mongoose.Types.ObjectId(req.admin.id),
        adminName: req.admin.name,
        userId: id,    
        userType: userType,
        verified: verified,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        createdAt: new Date()
      });
    } catch (auditError) {
      console.warn('Audit log failed:', auditError);
    }

    return res.json({
      status: 'success',
      message: verified ? 'User verified' : 'User unverified',
      data: updated
    });
  } catch (err) {
    console.error('Verify toggle error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});




// @route   POST /api/admin/users/:id/status
// @desc    Update user status (active/suspended)
router.post('/users/:id/status', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body;

  try {
    const db = mongoose.connection.db;
    const collections = ['drivers', 'cargo-owners'];
    let updated = null;
    let userType = null;

    for (const collectionName of collections) {
      const result = await db.collection(collectionName).findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { accountStatus: newStatus, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (result.value) {
        updated = result;
        userType = collectionName === 'drivers' ? 'driver' : 'cargo_owner';
        break;
      }
    }

    if (!updated.value) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    //  Correct audit log
    try {
      const auditLogsCollection = db.collection('audit_logs');
      await auditLogsCollection.insertOne({
        action: 'user_status_update',   
        entityType: 'user',         
        entityId: new mongoose.Types.ObjectId(id),
        adminId: new mongoose.Types.ObjectId(req.admin.id),
        adminName: req.admin.name,
        userId: id,    
        userType: userType,
        newStatus: newStatus,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        createdAt: new Date()
      });
    } catch (auditError) {
      console.warn('Audit log failed:', auditError);
    }

    res.json({
      status: 'success',
      message: 'Status updated',
      data: { user: updated.value }
    });

  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ status: 'error', message: 'Server error updating status' });
  }
});


// @route   POST /api/admin/register
// @desc    Create new admin (only super_admin can create)
// @access  Private
router.post('/register', 
  adminAuth,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('email')
      .trim()
      .normalizeEmail()
      .isEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^(\+254|0)[0-9]{9}$/)
      .withMessage('Please provide a valid Kenyan phone number'),
    body('role')
      .isIn(['super_admin', 'admin', 'moderator'])
      .withMessage('Role must be super_admin, admin, or moderator')
  ], 
  async (req, res) => {
    try {
      if (req.admin.role !== 'super_admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Only super admins can create new admins.'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error',
          message: 'Validation failed',
          errors: errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg
          }))
        });
      }

      const { name, email, password, phone, role, permissions } = req.body;

      const existingAdmin = await Admin.findOne({ 
        $or: [
          { email: email.toLowerCase() },
          { phone: phone.trim() }
        ]
      });

      if (existingAdmin) {
        const field = existingAdmin.email === email.toLowerCase() ? 'email' : 'phone';
        return res.status(400).json({ 
          status: 'error',
          message: `Admin with this ${field} already exists`,
          field
        });
      }

      let adminPermissions = {
        manageUsers: true,
        manageCargo: true,
        manageDrivers: true,
        managePayments: false,
        viewAnalytics: true,
        systemSettings: false
      };

      if (role === 'super_admin') {
        adminPermissions = {
          manageUsers: true,
          manageCargo: true,
          manageDrivers: true,
          managePayments: true,
          viewAnalytics: true,
          systemSettings: true
        };
      } else if (role === 'moderator') {
        adminPermissions = {
          manageUsers: false,
          manageCargo: true,
          manageDrivers: true,
          managePayments: false,
          viewAnalytics: true,
          systemSettings: false
        };
      }

      if (permissions) {
        adminPermissions = { ...adminPermissions, ...permissions };
      }

      const adminData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        phone: phone.trim(),
        role,
        permissions: adminPermissions,
        createdBy: req.admin.id
      };

      const admin = new Admin(adminData);

      const salt = await bcrypt.genSalt(12);
      admin.password = await bcrypt.hash(password, salt);

      await admin.save();
      console.log('Admin created successfully:', { id: admin._id, email: admin.email, role: admin.role });
try {
  const db = mongoose.connection.db;
  const auditLogsCollection = db.collection('audit_logs');
  await auditLogsCollection.insertOne({
    action: 'admin_create',   
    entityType: 'admin',         
    entityId: new mongoose.Types.ObjectId(admin._id),
    adminId: new mongoose.Types.ObjectId(req.admin.id),
    adminName: req.admin.name,
    newAdminEmail: admin.email,
    newAdminRole: admin.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    createdAt: new Date()
  });
} catch (auditError) {
  console.warn('Audit log failed:', auditError);
}
      res.status(201).json({
        status: 'success',
        message: 'Admin created successfully',
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
          permissions: admin.permissions,
          isActive: admin.isActive,
          createdAt: admin.createdAt
        }
      });

    } catch (error) {
      console.error('Admin registration error:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          status: 'error',
          message: `Admin with this ${field} already exists`,
          field
        });
      }

      res.status(500).json({
        status: 'error',
        message: 'Internal server error during admin registration',
        ...(process.env.NODE_ENV === 'development' && { error: error.message })
      });
    }
  }
);

// @route   GET /api/admin/cargo-owners
// @desc    List cargo owners with pagination and search

router.get('/cargo-owners', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const db = mongoose.connection.db;
    const cargoOwnersCollection = db.collection('cargo-owners');

    const total = await cargoOwnersCollection.countDocuments({});
    const owners = await cargoOwnersCollection
      .find({})
      .skip(skip)
      .limit(limit)
      .project({ password: 0 }) // hide password
      .toArray();

    res.json({
      status: 'success',
      data: {
        cargoOwners: owners,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCargoOwners: total,
        },
      },
    });
  } catch (err) {
    console.error('Error listing cargo owners', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   GET /api/admin/me
// @desc    Get current admin
// @access  Private
router.get('/me', adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    if (!admin) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }
    
    res.json({
      status: 'success',
      admin
    });
  } catch (error) {
    console.error('Get current admin error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/dashboard-stats
// @desc    Get dashboard statistics with revenue
// @access  Private
router.get('/dashboard-stats', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    const db = mongoose.connection.db;

    // Counts
    const [
      totalDrivers,
      totalCargoOwners,
      totalAdmins,
      activeDrivers,
      activeCargoOwners
    ] = await Promise.all([
      db.collection('drivers').countDocuments(),
      db.collection('cargo-owners').countDocuments(),
      Admin.countDocuments({ isActive: true }),
      db.collection('drivers').countDocuments({ isActive: true }),
      db.collection('cargo-owners').countDocuments({ isActive: true })
    ]);

    // New this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [newDriversThisMonth, newCargoOwnersThisMonth] = await Promise.all([
      db.collection('drivers').countDocuments({ createdAt: { $gte: thisMonth } }),
      db.collection('cargo-owners').countDocuments({ createdAt: { $gte: thisMonth } })
    ]);

    // Subscription stats
    const [
      totalSubscriptions,
      activeSubscriptions,
      pendingSubscriptions,
      expiredSubscriptions,
      newSubscriptionsThisMonth
    ] = await Promise.all([
      Subscription.countDocuments(),
      Subscription.countDocuments({ status: 'active', $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }] }),
      Subscription.countDocuments({ status: 'pending' }),
      Subscription.countDocuments({ status: 'active', expiresAt: { $lte: new Date() } }),
      Subscription.countDocuments({ createdAt: { $gte: thisMonth } })
    ]);

    // Revenue Logic
    let monthlyRevenue = 0;
    let totalRevenue = 0;

    try {
      const thisMonthSubs = await Subscription.find({
        createdAt: { $gte: thisMonth },
        paymentStatus: { $in: ['completed', 'paid', 'success'] }
      }).select('price amount');

      monthlyRevenue = thisMonthSubs.reduce((sum, sub) => {
        const val = sub.price || sub.amount || 0;
        return sum + val;
      }, 0);

      const allSubs = await Subscription.find({
        paymentStatus: { $in: ['completed', 'paid', 'success'] }
      }).select('price amount');

      totalRevenue = allSubs.reduce((sum, s) => {
        const v = s.price || s.amount || 0;
        return sum + v;
      }, 0);
    } catch (revError) {
      console.warn('Revenue calc error', revError);
    }

    // Loads
    const [totalLoads, activeLoads, completedLoads, newLoadsThisMonth] = await Promise.all([
      db.collection('loads').countDocuments(),
      db.collection('loads').countDocuments({ status: 'active' }),
      db.collection('loads').countDocuments({ status: 'completed' }),
      db.collection('loads').countDocuments({ createdAt: { $gte: thisMonth } })
    ]);

    const stats = {
      totalDrivers,
      totalCargoOwners,
      totalUsers: totalDrivers + totalCargoOwners,
      activeDrivers,
      activeCargoOwners,
      activeUsers: activeDrivers + activeCargoOwners,
      newUsersThisMonth: newDriversThisMonth + newCargoOwnersThisMonth,
      totalAdmins,

      totalSubscriptions,
      activeSubscriptions,
      pendingSubscriptions,
      expiredSubscriptions,
      newSubscriptionsThisMonth,

      monthlyRevenue,
      totalRevenue,

      totalLoads,
      activeLoads,
      completedLoads,
      newLoadsThisMonth,

      lastUpdated: new Date()
    };

    return res.json({ status: 'success', stats });

  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ status: 'error', message: 'Server error fetching dashboard statistics' });
  }
});


// @route   GET /api/admin/users
// @desc    Get users with pagination and search
// @access  Private
router.get('/users', 
  adminAuth, 
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isLength({ max: 100 }).withMessage('Search term too long'),
    query('userType').optional().isIn(['driver', 'cargo_owner']).withMessage('Invalid user type')
  ], 
  async (req, res) => {
    try {
      if (!req.admin.permissions.manageUsers) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You do not have permission to manage users.'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const userType = req.query.userType;
      const skip = (page - 1) * limit;

      const db = mongoose.connection.db;

      // Build search query
      let searchQuery = {};
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        searchQuery = {
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { phone: searchRegex }
          ]
        };
      }

      // Get users from collections based on userType filter
      let allUsers = [];
      
      if (!userType || userType === 'driver') {
        const drivers = await db.collection('drivers').find(searchQuery)
          .project({ password: 0, loginHistory: 0, registrationIp: 0 })
          .toArray();
        allUsers.push(...drivers.map(user => ({ ...user, userType: 'driver' })));
      }
      
      if (!userType || userType === 'cargo_owner') {
        const cargoOwners = await db.collection('cargo-owners').find(searchQuery)
          .project({ password: 0, loginHistory: 0, registrationIp: 0 })
          .toArray();
        allUsers.push(...cargoOwners.map(user => ({ ...user, userType: 'cargo_owner' })));
      }

      // Get subscription info for each user
      const userIds = allUsers.map(user => user._id);
      const subscriptions = await Subscription.find({
        userId: { $in: userIds },
        status: 'active'
      }).select('userId planName status expiresAt');

      // Create subscription map
      const subscriptionMap = {};
      subscriptions.forEach(sub => {
        subscriptionMap[sub.userId.toString()] = {
          planName: sub.planName,
          status: sub.status,
          expiresAt: sub.expiresAt,
          isExpired: sub.expiresAt && new Date() > sub.expiresAt
        };
      });

      // Add subscription info to users
      allUsers = allUsers.map(user => ({
        ...user,
        subscription: subscriptionMap[user._id.toString()] || null
      }));

      // Sort by creation date (newest first)
      allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      const total = allUsers.length;
      const users = allUsers.slice(skip, skip + limit);
      const totalPages = Math.ceil(total / limit);

      res.json({
        status: 'success',
        data: {
          users,
          total,
          totalPages,
          currentPage: page,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Server error fetching users'
      });
    }
  }
);


// @route   POST /api/admin/users/:id/suspend
// @desc    Suspend a user
// @access  Private
router.post('/users/:id/suspend', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage users.'
      });
    }

    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    const db = mongoose.connection.db;
    const objectId = new mongoose.Types.ObjectId(userId);

    // Try to find and update in both collections
    const [driverResult, cargoOwnerResult] = await Promise.all([
      db.collection('drivers').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isActive: false,
            accountStatus: 'suspended',
            suspendedAt: new Date(),
            suspendedBy: req.admin.id,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      ),
      db.collection('cargo-owners').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isActive: false,
            accountStatus: 'suspended',
            suspendedAt: new Date(),
            suspendedBy: req.admin.id,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      )
    ]);

    const updatedUser = driverResult.value || cargoOwnerResult.value;
    const userType = driverResult.value ? 'driver' : 'cargo_owner';

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
try {
  const auditLogsCollection = db.collection('audit_logs');
  await auditLogsCollection.insertOne({
    action: 'user_suspend',   
    entityType: 'user',         
    entityId: new mongoose.Types.ObjectId(userId),
    adminId: new mongoose.Types.ObjectId(req.admin.id),
    adminName: req.admin.name,
    userId: userId,    
    userType: userType,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    createdAt: new Date()
  });
} catch (auditError) {
  console.warn('Audit log failed:', auditError);
}
  console.log('User suspended:', { id: userId, email: updatedUser.email, userType, admin: req.admin.id });

    res.json({
      status: 'success',
      message: 'User suspended successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        userType,
        isActive: updatedUser.isActive,
        accountStatus: updatedUser.accountStatus
      }
    });

  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error suspending user'
    });
  }
});

// @route   POST /api/admin/users/:id/activate
// @desc    Activate a user
// @access  Private
router.post('/users/:id/activate', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage users.'
      });
    }

    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    const db = mongoose.connection.db;
    const objectId = new mongoose.Types.ObjectId(userId);

    // Try to find and update in both collections
    const [driverResult, cargoOwnerResult] = await Promise.all([
      db.collection('drivers').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isActive: true,
            accountStatus: 'active',
            reactivatedAt: new Date(),
            reactivatedBy: req.admin.id,
            updatedAt: new Date()
          },
          $unset: {
            suspendedAt: 1,
            suspendedBy: 1
          }
        },
        { returnDocument: 'after' }
      ),
      db.collection('cargo-owners').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isActive: true,
            accountStatus: 'active',
            reactivatedAt: new Date(),
            reactivatedBy: req.admin.id,
            updatedAt: new Date()
          },
          $unset: {
            suspendedAt: 1,
            suspendedBy: 1
          }
        },
        { returnDocument: 'after' }
      )
    ]);

    const updatedUser = driverResult.value || cargoOwnerResult.value;
    const userType = driverResult.value ? 'driver' : 'cargo_owner';

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    try {
  const auditLogsCollection = db.collection('audit_logs');
  await auditLogsCollection.insertOne({
    action: 'user_activate',   
    entityType: 'user',         
    entityId: new mongoose.Types.ObjectId(userId),
    adminId: new mongoose.Types.ObjectId(req.admin.id),
    adminName: req.admin.name,
    userId: userId,    
    userType: userType,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    createdAt: new Date()
  });
} catch (auditError) {
  console.warn('Audit log failed:', auditError);
}
console.log('User activated:', { id: userId, email: updatedUser.email, userType, admin: req.admin.id });

    res.json({
      status: 'success',
      message: 'User activated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        userType,
        isActive: updatedUser.isActive,
        accountStatus: updatedUser.accountStatus
      }
    });

  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error activating user'
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user
// @access  Private
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.manageUsers || req.admin.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Only super admins can delete users.'
      });
    }

    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    const db = mongoose.connection.db;
    const objectId = new mongoose.Types.ObjectId(userId);

    // Try to delete from both collections
    const [driverResult, cargoOwnerResult] = await Promise.all([
      db.collection('drivers').findOneAndDelete({ _id: objectId }),
      db.collection('cargo-owners').findOneAndDelete({ _id: objectId })
    ]);

    const deletedUser = driverResult.value || cargoOwnerResult.value;
    const userType = driverResult.value ? 'driver' : 'cargo_owner';

    if (!deletedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    console.log('User deleted:', { id: userId, email: deletedUser.email, userType, admin: req.admin.id });

    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting user'
    });
  }
});

// @route   POST /api/admin/users/:id/verify
// @desc    Verify a user
// @access  Private
router.post('/users/:id/verify', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage users.'
      });
    }

    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    const db = mongoose.connection.db;
    const objectId = new mongoose.Types.ObjectId(userId);

    // Try to find and update in both collections
    const [driverResult, cargoOwnerResult] = await Promise.all([
      db.collection('drivers').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isVerified: true,
            verifiedAt: new Date(),
            verifiedBy: req.admin.id,
            updatedAt: new Date(),
            'driverProfile.verified': true,
            'driverProfile.verificationStatus': 'verified'
          }
        },
        { returnDocument: 'after' }
      ),
      db.collection('cargo-owners').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isVerified: true,
            verifiedAt: new Date(),
            verifiedBy: req.admin.id,
            updatedAt: new Date(),
            'cargoOwnerProfile.verified': true,
            'cargoOwnerProfile.verificationStatus': 'verified'
          }
        },
        { returnDocument: 'after' }
      )
    ]);

    const updatedUser = driverResult.value || cargoOwnerResult.value;
    const userType = driverResult.value ? 'driver' : 'cargo_owner';

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
try {
  const auditLogsCollection = db.collection('audit_logs');
  await auditLogsCollection.insertOne({
    action: 'user_verify',   
    entityType: 'user',         
    entityId: new mongoose.Types.ObjectId(userId),
    adminId: new mongoose.Types.ObjectId(req.admin.id),
    adminName: req.admin.name,
    userId: userId,    
    userType: userType,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    createdAt: new Date()
  });
} catch (auditError) {
  console.warn('Audit log failed:', auditError);
}
    console.log('User verified:', { id: userId, email: updatedUser.email, userType, admin: req.admin.id });

    res.json({
      status: 'success',
      message: 'User verified successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        userType,
        isVerified: updatedUser.isVerified
      }
    });

  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error verifying user'
    });
  }
});

// @route   GET /api/admin/subscriptions
// @desc    Get subscriptions with optional status filter
// @access  Private
router.get('/subscriptions', 
  adminAuth, 
  [
    query('status').optional().isIn(['pending', 'active', 'expired', 'cancelled', 'rejected']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ], 
  async (req, res) => {
    try {
      if (!req.admin.permissions.managePayments) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You do not have permission to manage subscriptions.'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const status = req.query.status;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      // Build query
      let query = {};
      if (status === 'expired') {
        query = {
          status: 'active',
          expiresAt: { $lte: new Date() }
        };
      } else if (status) {
        query.status = status;
      }

      // Get subscriptions with user data
      const subscriptions = await Subscription.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'drivers',
            localField: 'userId',
            foreignField: '_id',
            as: 'driverUser'
          }
        },
        {
          $lookup: {
            from: 'cargo-owners',
            localField: 'userId',
            foreignField: '_id',
            as: 'cargoUser'
          }
        },
        {
          $addFields: {
            user: {
              $cond: {
                if: { $gt: [{ $size: '$driverUser' }, 0] },
                then: { $arrayElemAt: ['$driverUser', 0] },
                else: { $arrayElemAt: ['$cargoUser', 0] }
              }
            },
            userType: {
              $cond: {
                if: { $gt: [{ $size: '$driverUser' }, 0] },
                then: 'driver',
                else: 'cargo_owner'
              }
            }
          }
        },
        {
          $project: {
            driverUser: 0,
            cargoUser: 0,
            'user.password': 0,
            'user.loginHistory': 0
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]);

      const total = await Subscription.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      res.json({
        status: 'success',
        data: {
          subscriptions,
          total,
          totalPages,
          currentPage: page,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error('Get subscriptions error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Server error fetching subscriptions'
      });
    }
  }
);

// @route   POST /api/admin/subscriptions/:id/approve
// @desc    Approve a subscription
// @access  Private
router.post('/subscriptions/:id/approve', adminAuth, [
  body('paymentVerified').optional().isBoolean(),
  body('notes').optional().isLength({ max: 500 }),
  body('verificationDetails').optional().isObject()
], async (req, res) => {
  try {
    if (!req.admin.permissions.managePayments) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage subscriptions.'
      });
    }

    const subscriptionId = req.params.id;
    const { 
      paymentVerified = true, 
      notes = '', 
      verificationDetails = {} 
    } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subscription ID'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');
    const usersCollection = db.collection('cargo-owners');
    const notificationsCollection = db.collection('notifications');
    const auditLogsCollection = db.collection('audit_logs');

    //Find subscription by ID
    const subscription = await subscriptionsCollection.findOne({
      _id: new mongoose.Types.ObjectId(subscriptionId)
    });

    if (!subscription) {
      return res.status(404).json({
        status: 'error',
        message: 'Subscription not found'
      });
    }

    if (subscription.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: 'Only pending subscriptions can be approved'
      });
    }

    // Calculate expiry from approval time, not original request time
    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + subscription.duration * 24 * 60 * 60 * 1000);

    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';
    const adminEmail = req.admin.email || '';

    // Use transaction to ensure data consistency
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Update the subscription to active
        await subscriptionsCollection.updateOne(
          { _id: new mongoose.Types.ObjectId(subscriptionId) },
          {
            $set: {
              status: 'active',
              paymentStatus: 'completed',
              paymentVerified,
              activatedAt,
              expiresAt,
              approvedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
              approvedAt: new Date(),
              adminNotes: notes || '',
              verificationDetails: {
                ...verificationDetails,
                approvedByName: adminName,
                approvedByEmail: adminEmail,
                verificationTimestamp: new Date()
              },
              updatedAt: new Date()
            }
          },
          { session }
        );

        // Deactivate any other active premium subscriptions (keep basic as fallback)
        await subscriptionsCollection.updateMany(
          {
            userId: subscription.userId,
            _id: { $ne: new mongoose.Types.ObjectId(subscriptionId) },
            status: 'active',
            planId: { $ne: 'basic' } // Don't deactivate basic plan
          },
          {
            $set: {
              status: 'replaced',
              deactivatedAt: new Date(),
              replacedBy: new mongoose.Types.ObjectId(subscriptionId),
              updatedAt: new Date()
            }
          },
          { session }
        );

        // Update user's subscription record
        await usersCollection.updateOne(
          { _id: subscription.userId },
          {
            $set: {
              currentSubscription: new mongoose.Types.ObjectId(subscriptionId),
              subscriptionPlan: subscription.planId,
              subscriptionStatus: 'active',
              subscriptionExpiresAt: expiresAt,
              updatedAt: new Date()
            },
            $unset: { pendingSubscription: '' }
          },
          { session }
        );

        // Create user notification
        await notificationsCollection.insertOne({
          userId: subscription.userId,
          userType: 'cargo_owner',
          type: 'subscription_approved',
          title: 'Subscription Approved',
          message: `Your ${subscription.planName} subscription is now active until ${expiresAt.toLocaleDateString()}.`,
          data: {
            subscriptionId,
            planId: subscription.planId,
            planName: subscription.planName,
            activatedAt,
            expiresAt
          },
          isRead: false,
          priority: 'high',
          createdAt: new Date()
        }, { session });

        // Create audit log
        await auditLogsCollection.insertOne({
          action: 'subscription_approved',
          entityType: 'subscription',
          entityId: new mongoose.Types.ObjectId(subscriptionId),
          adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null,
          adminName,
          userId: subscription.userId,
          details: {
            planId: subscription.planId,
            planName: subscription.planName,
            amount: subscription.price,
            paymentMethod: subscription.paymentMethod,
            paymentVerified,
            notes,
            activatedAt,
            expiresAt,
            verificationDetails
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          createdAt: new Date()
        }, { session });
      });

      console.log('Subscription approved successfully:', { 
        subscriptionId, 
        userId: subscription.userId,
        planId: subscription.planId,
        adminId,
        activatedAt,
        expiresAt
      });

      res.json({
        status: 'success',
        message: 'Subscription approved successfully',
        data: {
          subscriptionId,
          approvedAt: activatedAt,
          expiresAt,
          approvedBy: adminName,
          planName: subscription.planName
        }
      });

    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error('Approve subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error approving subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// @route   POST /api/admin/subscriptions/:id/reject
// @desc    Reject a subscription
// @access  Private
router.post('/subscriptions/:id/reject', adminAuth, [
  body('reason').notEmpty().withMessage('Rejection reason is required'),
  body('reasonCategory').optional().isIn([
    'payment_failed', 'invalid_details', 'fraud_suspected', 'other'
  ]).withMessage('Valid reason category is required'),
  body('notes').optional().isLength({ max: 500 }),
  body('refundRequired').optional().isBoolean()
], async (req, res) => {
  try {
    if (!req.admin.permissions.managePayments) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage subscriptions.'
      });
    }

    const subscriptionId = req.params.id;
    const {
      reason,
      reasonCategory = 'other',
      notes = '',
      refundRequired = false
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subscription ID'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');
    const usersCollection = db.collection('cargo-owners');
    const notificationsCollection = db.collection('notifications');
    const auditLogsCollection = db.collection('audit_logs');

    const subscription = await subscriptionsCollection.findOne({
      _id: new mongoose.Types.ObjectId(subscriptionId)
    });

    if (!subscription) {
      return res.status(404).json({
        status: 'error',
        message: 'Subscription not found'
      });
    }

    if (subscription.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: 'Only pending subscriptions can be rejected'
      });
    }

    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';
    const adminEmail = req.admin.email || '';

    // Update subscription to rejected
    await subscriptionsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(subscriptionId) },
      {
        $set: {
          status: 'rejected',
          paymentStatus: 'failed',
          rejectedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
          rejectedAt: new Date(),
          rejectionReason: reason,
          rejectionCategory: reasonCategory,
          adminNotes: notes,
          refundRequired,
          rejectionDetails: {
            rejectedByName: adminName,
            rejectedByEmail: adminEmail,
            rejectionTimestamp: new Date()
          },
          updatedAt: new Date()
        }
      }
    );

    // Remove pendingSubscription from user
    await usersCollection.updateOne(
      { _id: subscription.userId },
      { $unset: { pendingSubscription: '' }, $set: { updatedAt: new Date() } }
    );

    // Send notification to user
    const reasonMessages = {
      payment_failed: 'Payment could not be verified',
      invalid_details: 'Payment details were invalid',
      fraud_suspected: 'Suspicious activity detected',
      other: reason
    };

    await notificationsCollection.insertOne({
      userId: subscription.userId,
      userType: 'cargo_owner',
      type: 'subscription_rejected',
      title: 'Subscription Request Rejected',
      message: `Your ${subscription.planName} request was declined. Reason: ${reasonMessages[reasonCategory]}. You remain on the Basic plan.`,
      data: {
        subscriptionId,
        planName: subscription.planName,
        reason,
        reasonCategory,
        refundRequired,
        rejectedAt: new Date()
      },
      isRead: false,
      priority: 'high',
      createdAt: new Date()
    });

    // Create audit log
    await auditLogsCollection.insertOne({
      action: 'subscription_rejected',
      entityType: 'subscription',
      entityId: new mongoose.Types.ObjectId(subscriptionId),
      adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      adminName,
      userId: subscription.userId,
      details: {
        planId: subscription.planId,
        planName: subscription.planName,
        amount: subscription.price,
        paymentMethod: subscription.paymentMethod,
        reason,
        reasonCategory,
        refundRequired,
        notes
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    console.log('Subscription rejected successfully:', { 
      subscriptionId, 
      userId: subscription.userId,
      reason,
      adminId 
    });

    res.json({
      status: 'success',
      message: 'Subscription rejected successfully',
      data: {
        subscriptionId,
        rejectedAt: new Date(),
        reason,
        reasonCategory
      }
    });

  } catch (error) {
    console.error('Reject subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error rejecting subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/loads
// @desc    Get loads with pagination (Admin only)
// @access  Private
router.get('/loads', adminAuth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isString(),
  query('search').optional().trim().isLength({ max: 100 })
], async (req, res) => {
  try {
    // Check admin permissions
    if (!req.admin.permissions?.manageCargo) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage cargo.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { page = 1, limit = 20, status, search } = req.query;

    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        status: 'error',
        message: 'Database not connected'
      });
    }

    // Build query
    const queryFilter = {};

    // Admin should see *all* statuses unless filtered
    if (status && status !== 'all') {
      queryFilter.status = status;
    }

    // Apply text search
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      queryFilter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { pickupLocation: searchRegex },
        { deliveryLocation: searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch data
    const loads = await Load.find(queryFilter)
      .populate('createdBy', 'name email phone location isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalLoads = await Load.countDocuments(queryFilter);
    const totalPages = Math.ceil(totalLoads / parseInt(limit));

    // Transform result to admin-friendly JSON
    const transformedLoads = loads.map(load => ({
      _id: load._id,
      title: load.title || 'Untitled Load',
      description: load.description || '',
      pickupLocation: load.pickupLocation || '',
      deliveryLocation: load.deliveryLocation || '',
      origin: load.pickupLocation || '',
      destination: load.deliveryLocation || '',
      weight: load.weight || 0,
      cargoType: load.cargoType || 'other',
      vehicleType: load.vehicleType || '',
      budget: load.budget || 0,
      pickupDate: load.pickupDate,
      deliveryDate: load.deliveryDate,
      status: load.status,
      isActive: load.isActive,
      isUrgent: load.isUrgent || false,
      createdAt: load.createdAt,
      updatedAt: load.updatedAt,
      daysSincePosted: Math.floor((Date.now() - new Date(load.createdAt)) / (1000 * 60 * 60 * 24)),
      cargoOwnerName: load.contactPerson.name,
      cargoOwnerEmail: load.contactPerson.email,
      cargoOwnerPhone: load.contactPerson.phone,
      canEdit: true,
      canDelete: !['in_transit', 'delivered'].includes(load.status)
    }));

    // Return response
    res.status(200).json({
      status: 'success',
      data: {
        loads: transformedLoads,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLoads,
          limit: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      },
      filters: {
        status: status || 'all',
        search: search || ''
      }
    });
  } catch (err) {
    console.error('Admin loads fetch error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching loads',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});



// @route   PUT /api/admin/dashboard-stats
// @desc    Force refresh dashboard statistics
// @access  Private
router.get('/dashboard-stats', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    const db = mongoose.connection.db;

    // Define time periods
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      // 1. TOTAL LOADS
      let totalLoads = 0;
      let activeLoads = 0;
      let newLoadsThisMonth = 0;

      try {
        [totalLoads, activeLoads, newLoadsThisMonth] = await Promise.all([
          Load.countDocuments().catch(() => 0),
          Load.countDocuments({ status: { $in: ['posted', 'receiving_bids', 'driver_assigned', 'in_transit'] } }).catch(() => 0),
          Load.countDocuments({ createdAt: { $gte: startOfMonth } }).catch(() => 0)
        ]);
      } catch (loadError) {
        console.log('Loads collection not available, using default values');
        try {
          totalLoads = await db.collection('loads').countDocuments();
          activeLoads = await db.collection('loads').countDocuments({ 
            status: { $in: ['posted', 'receiving_bids', 'driver_assigned', 'in_transit'] } 
          });
          newLoadsThisMonth = await db.collection('loads').countDocuments({
            createdAt: { $gte: startOfMonth }
          });
        } catch (dbError) {
          console.warn('Failed to get load stats:', dbError);
          totalLoads = activeLoads = newLoadsThisMonth = 0;
        }
      }

      // 2. NEW USERS TODAY
      const [newDriversToday, newCargoOwnersToday] = await Promise.all([
        db.collection('drivers').countDocuments({
          createdAt: { $gte: startOfToday }
        }).catch(() => 0),
        db.collection('cargo-owners').countDocuments({
          createdAt: { $gte: startOfToday }
        }).catch(() => 0)
      ]);

      const newUsersToday = newDriversToday + newCargoOwnersToday;

      // Get new users this week for additional context
      const [newDriversThisWeek, newCargoOwnersThisWeek] = await Promise.all([
        db.collection('drivers').countDocuments({
          createdAt: { $gte: startOfWeek }
        }).catch(() => 0),
        db.collection('cargo-owners').countDocuments({
          createdAt: { $gte: startOfWeek }
        }).catch(() => 0)
      ]);

      const newUsersThisWeek = newDriversThisWeek + newCargoOwnersThisWeek;

      // 3. TOTAL DRIVERS
      const [totalDrivers, activeDrivers] = await Promise.all([
        db.collection('drivers').countDocuments().catch(() => 0),
        db.collection('drivers').countDocuments({ 
          $or: [
            { isActive: true },
            { accountStatus: 'active' }
          ]
        }).catch(() => 0)
      ]);

      // 4. TOTAL CARGO OWNERS
      const [totalCargoOwners, activeCargoOwners] = await Promise.all([
        db.collection('cargo-owners').countDocuments().catch(() => 0),
        db.collection('cargo-owners').countDocuments({ 
          $or: [
            { isActive: true },
            { accountStatus: 'active' }
          ]
        }).catch(() => 0)
      ]);

      // 5. PENDING SUBSCRIPTIONS
      let pendingSubscriptions = 0;
      try {
        pendingSubscriptions = await Subscription.countDocuments({ 
          status: 'pending' 
        });
      } catch (subError) {
        console.warn('Failed to get pending subscriptions:', subError);
        try {
          pendingSubscriptions = await db.collection('subscriptions').countDocuments({ 
            status: 'pending' 
          });
        } catch (dbError) {
          console.warn('Direct DB subscription query failed:', dbError);
          pendingSubscriptions = 0;
        }
      }

      // 6. SUBSCRIPTIONS THIS MONTH -  REVENUE CALCULATION
      let newSubscriptionsThisMonth = 0;
      let monthlyRevenue = 0;
      let totalRevenue = 0; // All-time revenue
      
      try {
        // Get this month's subscriptions
        const thisMonthSubs = await Subscription.find({
          createdAt: { $gte: startOfMonth }
        }).select('price amount planName status paymentStatus');

        newSubscriptionsThisMonth = thisMonthSubs.length;
        
        // Calculate monthly revenue from paid subscriptions
        monthlyRevenue = thisMonthSubs
          .filter(sub => {
            // Include active subscriptions or those with completed payment
            return (sub.status === 'active' && sub.paymentStatus === 'completed') ||
                   (sub.paymentStatus === 'completed');
          })
          .reduce((total, sub) => {
            // Use 'price' field first, fallback to 'amount'
            const subAmount = sub.price || sub.amount || 0;
            return total + subAmount;
          }, 0);

        // Get all-time revenue
        const allSubscriptions = await Subscription.find({
          $and: [
            {
              $or: [
                { status: 'active', paymentStatus: 'completed' },
                { paymentStatus: 'completed' }
              ]
            },
            {
              $or: [
                { price: { $gt: 0 } },
                { amount: { $gt: 0 } }
              ]
            }
          ]
        }).select('price amount');

        totalRevenue = allSubscriptions.reduce((total, sub) => {
          const subAmount = sub.price || sub.amount || 0;
          return total + subAmount;
        }, 0);

      } catch (subError) {
        console.warn('Failed to get monthly subscription stats:', subError);
        try {
          // Direct DB access with corrected field names
          const thisMonthSubs = await db.collection('subscriptions')
            .find({ 
              createdAt: { $gte: startOfMonth }
            })
            .toArray();

          newSubscriptionsThisMonth = thisMonthSubs.length;
          
          monthlyRevenue = thisMonthSubs
            .filter(sub => {
              return (sub.status === 'active' && sub.paymentStatus === 'completed') ||
                     (sub.paymentStatus === 'completed');
            })
            .reduce((total, sub) => {
              const subAmount = sub.price || sub.amount || 0;
              return total + subAmount;
            }, 0);

          // Get all-time revenue from DB
          const allPaidSubs = await db.collection('subscriptions')
            .find({
              $and: [
                {
                  $or: [
                    { status: 'active', paymentStatus: 'completed' },
                    { paymentStatus: 'completed' }
                  ]
                },
                {
                  $or: [
                    { price: { $gt: 0 } },
                    { amount: { $gt: 0 } }
                  ]
                }
              ]
            })
            .toArray();

          totalRevenue = allPaidSubs.reduce((total, sub) => {
            const subAmount = sub.price || sub.amount || 0;
            return total + subAmount;
          }, 0);

        } catch (dbError) {
          console.warn('Direct DB subscription query failed:', dbError);
          newSubscriptionsThisMonth = monthlyRevenue = totalRevenue = 0;
        }
      }

      // Get new users this month for growth calculation
      const [newDriversThisMonth, newCargoOwnersThisMonth] = await Promise.all([
        db.collection('drivers').countDocuments({
          createdAt: { $gte: startOfMonth }
        }).catch(() => 0),
        db.collection('cargo-owners').countDocuments({
          createdAt: { $gte: startOfMonth }
        }).catch(() => 0)
      ]);

      const newUsersThisMonth = newDriversThisMonth + newCargoOwnersThisMonth;

      // Additional stats for context
      let totalActiveSubscriptions = 0;
      try {
        totalActiveSubscriptions = await Subscription.countDocuments({ 
          status: 'active',
          $or: [
            { expiresAt: { $gt: now } },
            { expiresAt: null }
          ]
        });
      } catch (error) {
        try {
          totalActiveSubscriptions = await db.collection('subscriptions').countDocuments({ 
            status: 'active'
          });
        } catch (dbError) {
          totalActiveSubscriptions = 0;
        }
      }

      // Compile final stats object
      const stats = {
        // Primary requested metrics
        totalLoads,
        newUsersToday,
        totalDrivers,
        totalCargoOwners,
        pendingSubscriptions,
        newSubscriptionsThisMonth,

        // Supporting data
        activeLoads,
        newLoadsThisMonth,
        newUsersThisWeek,
        activeDrivers,
        activeCargoOwners,
        monthlyRevenue,
        totalRevenue, // Add all-time revenue
        
        // Calculated totals
        totalUsers: totalDrivers + totalCargoOwners,
        activeUsers: activeDrivers + activeCargoOwners,
        newUsersThisMonth,

        // Additional context
        totalActiveSubscriptions,
        
        // System health indicators
        userGrowthRate: totalDrivers + totalCargoOwners > 0 ? 
          (newUsersThisMonth / (totalDrivers + totalCargoOwners) * 100).to(2) : '0.00',
        subscriptionRate: totalDrivers + totalCargoOwners > 0 ? 
          (totalActiveSubscriptions / (totalDrivers + totalCargoOwners) * 100).to(2) : '0.00',
        loadCompletionRate: totalLoads > 0 ? 
          ((totalLoads - activeLoads) / totalLoads * 100).to(2) : '0.00',

        // Metadata
        lastUpdated: new Date(),
        generatedAt: new Date().toISOString()
      };

      console.log('Dashboard stats generated successfully:', {
        totalLoads: stats.totalLoads,
        newUsersToday: stats.newUsersToday,
        totalDrivers: stats.totalDrivers,
        totalCargoOwners: stats.totalCargoOwners,
        pendingSubscriptions: stats.pendingSubscriptions,
        newSubscriptionsThisMonth: stats.newSubscriptionsThisMonth,
        monthlyRevenue: stats.monthlyRevenue,
        totalRevenue: stats.totalRevenue
      });

      res.json({
        status: 'success',
        stats,
        message: 'Dashboard statistics retrieved successfully'
      });

    } catch (error) {
      console.error('Error generating dashboard stats:', error);
      
      // Return partial stats or defaults on error
      const fallbackStats = {
        totalLoads: 0,
        newUsersToday: 0,
        totalDrivers: 0,
        totalCargoOwners: 0,
        pendingSubscriptions: 0,
        newSubscriptionsThisMonth: 0,
        
        activeLoads: 0,
        newLoadsThisMonth: 0,
        newUsersThisWeek: 0,
        activeDrivers: 0,
        activeCargoOwners: 0,
        monthlyRevenue: 0,
        totalRevenue: 0,
        
        totalUsers: 0,
        activeUsers: 0,
        newUsersThisMonth: 0,
        totalActiveSubscriptions: 0,
        
        userGrowthRate: '0.00',
        subscriptionRate: '0.00',
        loadCompletionRate: '0.00',
        
        lastUpdated: new Date(),
        error: 'Partial data due to system error'
      };

      res.json({
        status: 'success',
        stats: fallbackStats,
        message: 'Dashboard statistics retrieved with fallback data',
        warning: 'Some statistics may not be accurate due to system constraints'
      });
    }

  } catch (error) {
    console.error('Dashboard stats endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Optional: Add a stats refresh endpoint
router.post('/dashboard-stats/refresh', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied.'
      });
    }

    // Force refresh by making the same call as GET
    // This could be used to clear any caching if implemented later
    
    res.json({
      status: 'success',
      message: 'Dashboard statistics refresh initiated',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Dashboard stats refresh error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error refreshing dashboard statistics'
    });
  }
});

// @route   PUT /api/admin/:id/toggle-status
// @desc    Toggle admin active status
// @access  Private (super_admin only)
router.put('/:id/toggle-status', adminAuth, async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Only super admins can toggle admin status.'
      });
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }

    // Prevent super_admin from deactivating themselves
    if (admin._id.toString() === req.admin.id && req.admin.role === 'super_admin') {
      return res.status(400).json({
        status: 'error',
        message: 'Super admins cannot deactivate themselves'
      });
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    res.json({
      status: 'success',
      message: `Admin ${admin.isActive ? 'activated' : 'deactivated'} successfully`,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive
      }
    });

  } catch (error) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error toggling admin status'
    });
  }
});

module.exports = router;