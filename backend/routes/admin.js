const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { body, validationResult, query } = require('express-validator');
const Admin = require('../models/admin');
const Load = require('../models/load');
const { adminAuth } = require('../middleware/adminAuth');
const { Subscription } = require('../models/subscription');
const mongoose = require('mongoose');

// CORS configuration for credentials + allow any origin in development
const corsOptions = {
  origin: (origin, callback) => {
    callback(null, origin || true); // Reflects the requesting origin
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'x-auth-token',
    'Cache-Control',
    'Pragma'
  ],
  optionsSuccessStatus: 200,
  maxAge: 86400
};

router.use(cors(corsOptions));


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

    const auditLogsCollection = db.collection('audit_logs');

await auditLogsCollection.insertOne({
  action: 'admin_login',   
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
  const { verified = true } = req.body; // can be true or false

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
          },
          ...(verified ? {} : {
            // optional: unset verificationDate if unverifying
            $unset: { 
              'driverProfile.verificationDate': "",
              'cargoOwnerProfile.verificationDate': ""
            }
          })
        },
        { returnDocument: 'after' }
      );
      if (result.value) {
        updated = result.value;
        break;
      }
    }

    if (!updated) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

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
  const { newStatus } = req.body; // 'active' | 'on_hold' | 'suspended'

  try {
    const db = mongoose.connection.db;
    // Could be driver or cargo-owner
    const collections = ['drivers', 'cargo-owners'];

    let updated = null;
    for (const collectionName of collections) {
      updated = await db.collection(collectionName).findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { accountStatus: newStatus, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (updated.value) break;
    }
 const auditLogsCollection = db.collection('audit_logs');

await auditLogsCollection.insertOne({
  action: 'user_status_update',   
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

    if (!updated.value) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
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
 const auditLogsCollection = db.collection('audit_logs');

await auditLogsCollection.insertOne({
  action: 'admin_create',   
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
// @desc    Get dashboard statistics
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

    // Get basic counts from both collections
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

    // Get new registrations this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [newDriversThisMonth, newCargoOwnersThisMonth] = await Promise.all([
      db.collection('drivers').countDocuments({
        createdAt: { $gte: thisMonth }
      }),
      db.collection('cargo-owners').countDocuments({
        createdAt: { $gte: thisMonth }
      })
    ]);

    // Get subscription statistics
    const [
      totalSubscriptions,
      activeSubscriptions,
      pendingSubscriptions,
      expiredSubscriptions,
      newSubscriptionsThisMonth
    ] = await Promise.all([
      Subscription.countDocuments(),
      Subscription.countDocuments({ 
        status: 'active',
        $or: [
          { expiresAt: { $gt: new Date() } },
          { expiresAt: null }
        ]
      }),
      Subscription.countDocuments({ status: 'pending' }),
      Subscription.countDocuments({ 
        status: 'active',
        expiresAt: { $lte: new Date() }
      }),
      Subscription.countDocuments({
        createdAt: { $gte: thisMonth }
      })
    ]);

    // Get loads statistics (with fallback)
    let totalLoads = 0;
    let activeLoads = 0;
    let completedLoads = 0;
    let newLoadsThisMonth = 0;

    try {
      [totalLoads, activeLoads, completedLoads, newLoadsThisMonth] = await Promise.all([
        db.collection('loads').countDocuments(),
        db.collection('loads').countDocuments({ status: 'active' }),
        db.collection('loads').countDocuments({ status: 'completed' }),
        db.collection('loads').countDocuments({
          createdAt: { $gte: thisMonth }
        })
      ]);
    } catch (loadError) {
      console.log('Loads collection not available, using default values');
    }

    const stats = {
      // User statistics
      totalUsers: totalDrivers + totalCargoOwners,
      totalDrivers,
      totalCargoOwners,
      activeUsers: activeDrivers + activeCargoOwners,
      activeDrivers,
      activeCargoOwners,
      newUsersThisMonth: newDriversThisMonth + newCargoOwnersThisMonth,
      
      // Admin statistics
      totalAdmins,
      
      // Subscription statistics
      totalSubscriptions,
      activeSubscriptions,
      pendingSubscriptions,
      expiredSubscriptions,
      newSubscriptionsThisMonth,
      
      // Load statistics
      totalLoads,
      activeLoads,
      completedLoads,
      newLoadsThisMonth,
      
      // System health
      systemHealth: {
        usersGrowth: ((newDriversThisMonth + newCargoOwnersThisMonth) / Math.max(1, totalDrivers + totalCargoOwners)) * 100,
        subscriptionRate: (activeSubscriptions / Math.max(1, totalDrivers + totalCargoOwners)) * 100,
        loadCompletionRate: totalLoads > 0 ? (completedLoads / totalLoads) * 100 : 0
      },
      
      lastUpdated: new Date()
    };

    res.json({
      status: 'success',
      stats
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching dashboard statistics'
    });
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
router.post('/subscriptions/:id/approve', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.managePayments) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage subscriptions.'
      });
    }

    const subscriptionId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subscription ID'
      });
    }

    const subscription = await Subscription.findById(subscriptionId);
    
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

    // Update subscription
    subscription.status = 'active';
    subscription.paymentStatus = 'completed';
    subscription.approvedBy = req.admin.id;
    subscription.approvedAt = new Date();
    subscription.activatedAt = new Date();
    subscription.expiresAt = new Date(Date.now() + subscription.duration * 24 * 60 * 60 * 1000);

    await subscription.save();

    console.log('Subscription approved:', { 
      id: subscriptionId, 
      userId: subscription.userId,
      admin: req.admin.id 
    });

     const auditLogsCollection = db.collection('audit_logs');

await auditLogsCollection.insertOne({
  action: 'subscription_approve',   
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


    res.json({
      status: 'success',
      message: 'Subscription approved successfully',
      subscription: {
        id: subscription._id,
        status: subscription.status,
        activatedAt: subscription.activatedAt,
        expiresAt: subscription.expiresAt
      }
    });

  } catch (error) {
    console.error('Approve subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error approving subscription'
    });
  }
});

// @route   POST /api/admin/subscriptions/:id/reject
// @desc    Reject a subscription
// @access  Private
router.post('/subscriptions/:id/reject', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.managePayments) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage subscriptions.'
      });
    }

    const subscriptionId = req.params.id;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subscription ID'
      });
    }

    const subscription = await Subscription.findById(subscriptionId);
    
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

    // Update subscription
    subscription.status = 'rejected';
    subscription.paymentStatus = 'failed';
    subscription.rejectedBy = req.admin.id;
    subscription.rejectedAt = new Date();
    subscription.rejectionReason = reason || 'Administrative decision';

    await subscription.save();

     const auditLogsCollection = db.collection('audit_logs');

await auditLogsCollection.insertOne({
  action: 'subscription_reject',   
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

    console.log('Subscription rejected:', { 
      id: subscriptionId, 
      reason, 
      admin: req.admin.id 
    });

    res.json({
      status: 'success',
      message: 'Subscription rejected successfully'
    });

  } catch (error) {
    console.error('Reject subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error rejecting subscription'
    });
  }
});

// @route   GET /api/admin/loads
// @desc    Get loads with pagination
// @access  Private
router.get('/loads', 
  adminAuth, 
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['posted','receiving_bids','driver_assigned','in_transit','delivered','cancelled'])
  ],
  async (req, res) => {
    try {
      if (!req.admin.permissions.manageCargo) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You do not have permission to manage loads.'
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const status = req.query.status;
      const skip = (page - 1) * limit;

      const query = {};
      if (status) {
        query.status = status;
      }

      const [loads, total] = await Promise.all([
        Load.find(query)
          .populate('postedBy', 'name email phone')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Load.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      return res.json({
        status: 'success',
        data: {
          loads,
          total,
          totalPages,
          currentPage: page,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error('Load listing error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error fetching loads'
      });
    }
  }
);


// @route   PUT /api/admin/dashboard-stats
// @desc    Force refresh dashboard statistics
// @access  Private
router.put('/dashboard-stats', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    const db = mongoose.connection.db;

    // Get fresh counts from database
    const [
      totalDrivers,
      totalCargoOwners,
      totalAdmins,
      newDriversThisMonth,
      newCargoOwnersThisMonth,
      activeDrivers,
      activeCargoOwners
    ] = await Promise.all([
      db.collection('drivers').countDocuments(),
      db.collection('cargo-owners').countDocuments(),
      Admin.countDocuments({ isActive: true }),
      db.collection('drivers').countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      }),
      db.collection('cargo-owners').countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      }),
      db.collection('drivers').countDocuments({ isActive: true }),
      db.collection('cargo-owners').countDocuments({ isActive: true })
    ]);

    const stats = {
      totalUsers: totalDrivers + totalCargoOwners,
      totalDrivers,
      totalCargoOwners,
      totalAdmins,
      newUsersThisMonth: newDriversThisMonth + newCargoOwnersThisMonth,
      activeUsers: activeDrivers + activeCargoOwners,
      lastUpdated: new Date()
    };

    res.json({
      status: 'success',
      message: 'Dashboard statistics refreshed successfully',
      stats
    });

  } catch (error) {
    console.error('Refresh dashboard stats error:', error);
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