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


// @route   GET /api/admin/dashboard-stats
// @desc    Get dashboard statistics with revenue
// @access  Private
router.get('/dashboard-stats', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions?.viewAnalytics) {
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
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Parallel execution of all statistics queries
    const [
      // Load statistics
      loadStats,
      // User statistics  
      userStats,
      // Subscription statistics
      subscriptionStats,
      // Revenue statistics
      revenueStats,
      // Growth statistics
      growthStats
    ] = await Promise.allSettled([
      // Load Statistics
      Promise.all([
        Load.countDocuments().catch(() => 0),
        Load.countDocuments({ 
          status: { $in: ['posted', 'available', 'receiving_bids', 'assigned', 'in_transit'] } 
        }).catch(() => 0),
        Load.countDocuments({ createdAt: { $gte: startOfMonth } }).catch(() => 0),
        Load.countDocuments({ createdAt: { $gte: startOfWeek } }).catch(() => 0),
        Load.countDocuments({ createdAt: { $gte: startOfToday } }).catch(() => 0),
        Load.countDocuments({ status: 'delivered' }).catch(() => 0),
        Load.countDocuments({ status: 'cancelled' }).catch(() => 0),
        Load.countDocuments({ isUrgent: true, isActive: true }).catch(() => 0)
      ]),

      // User Statistics
      Promise.all([
        db.collection('drivers').countDocuments(),
        db.collection('cargo-owners').countDocuments(),
        db.collection('drivers').countDocuments({ 
          $and: [
            { $or: [{ isActive: true }, { accountStatus: 'active' }] },
            { $or: [{ isActive: { $ne: false } }, { accountStatus: { $ne: 'suspended' } }] }
          ]
        }),
        db.collection('cargo-owners').countDocuments({ 
          $and: [
            { $or: [{ isActive: true }, { accountStatus: 'active' }] },
            { $or: [{ isActive: { $ne: false } }, { accountStatus: { $ne: 'suspended' } }] }
          ]
        }),
        db.collection('drivers').countDocuments({ createdAt: { $gte: startOfMonth } }),
        db.collection('cargo-owners').countDocuments({ createdAt: { $gte: startOfMonth } }),
        db.collection('drivers').countDocuments({ createdAt: { $gte: startOfWeek } }),
        db.collection('cargo-owners').countDocuments({ createdAt: { $gte: startOfWeek } }),
        db.collection('drivers').countDocuments({ createdAt: { $gte: startOfToday } }),
        db.collection('cargo-owners').countDocuments({ createdAt: { $gte: startOfToday } }),
        db.collection('drivers').countDocuments({ isVerified: true }),
        db.collection('cargo-owners').countDocuments({ isVerified: true })
      ]),

      // Subscription Statistics
      Promise.all([
        Subscription.countDocuments().catch(() => 0),
        Subscription.countDocuments({ 
          status: 'active',
          $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }]
        }).catch(() => 0),
        Subscription.countDocuments({ status: 'pending' }).catch(() => 0),
        Subscription.countDocuments({ 
          status: 'active', 
          expiresAt: { $lte: now } 
        }).catch(() => 0),
        Subscription.countDocuments({ createdAt: { $gte: startOfMonth } }).catch(() => 0),
        Subscription.countDocuments({ status: 'rejected' }).catch(() => 0)
      ]),

      // Revenue Statistics
      Promise.all([
        Subscription.aggregate([
          {
            $match: {
              status: 'active',
              paymentStatus: 'completed',
              createdAt: { $gte: startOfMonth }
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: { $ifNull: ['$price', '$amount'] } },
              count: { $sum: 1 }
            }
          }
        ]).catch(() => []),
        
        Subscription.aggregate([
          {
            $match: {
              status: 'active',
              paymentStatus: 'completed'
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: { $ifNull: ['$price', '$amount'] } },
              count: { $sum: 1 }
            }
          }
        ]).catch(() => []),

        // Revenue by plan
        Subscription.aggregate([
          {
            $match: {
              status: 'active',
              paymentStatus: 'completed'
            }
          },
          {
            $group: {
              _id: '$planId',
              revenue: { $sum: { $ifNull: ['$price', '$amount'] } },
              count: { $sum: 1 }
            }
          }
        ]).catch(() => [])
      ]),

      // Growth Statistics (comparing this month vs last month)
      Promise.all([
        db.collection('drivers').countDocuments({ 
          createdAt: { 
            $gte: startOfLastMonth, 
            $lt: startOfMonth 
          } 
        }),
        db.collection('cargo-owners').countDocuments({ 
          createdAt: { 
            $gte: startOfLastMonth, 
            $lt: startOfMonth 
          } 
        }),
        Load.countDocuments({ 
          createdAt: { 
            $gte: startOfLastMonth, 
            $lt: startOfMonth 
          } 
        }).catch(() => 0),
        Subscription.countDocuments({ 
          createdAt: { 
            $gte: startOfLastMonth, 
            $lt: startOfMonth 
          } 
        }).catch(() => 0)
      ])
    ]);

    // Process results with error handling
    const [
      totalLoads, activeLoads, newLoadsThisMonth, newLoadsThisWeek, 
      newLoadsToday, completedLoads, cancelledLoads, urgentLoads
    ] = loadStats.status === 'fulfilled' ? loadStats.value : Array(8).fill(0);

    const [
      totalDrivers, totalCargoOwners, activeDrivers, activeCargoOwners,
      newDriversThisMonth, newCargoOwnersThisMonth, newDriversThisWeek, 
      newCargoOwnersThisWeek, newDriversToday, newCargoOwnersToday,
      verifiedDrivers, verifiedCargoOwners
    ] = userStats.status === 'fulfilled' ? userStats.value : Array(12).fill(0);

    const [
      totalSubscriptions, activeSubscriptions, pendingSubscriptions,
      expiredSubscriptions, newSubscriptionsThisMonth, rejectedSubscriptions
    ] = subscriptionStats.status === 'fulfilled' ? subscriptionStats.value : Array(6).fill(0);

    const [monthlyRevenueData, totalRevenueData, revenueByPlan] = 
      revenueStats.status === 'fulfilled' ? revenueStats.value : [[], [], []];

    const [
      driversLastMonth, cargoOwnersLastMonth, loadsLastMonth, subscriptionsLastMonth
    ] = growthStats.status === 'fulfilled' ? growthStats.value : Array(4).fill(0);

    // Calculate derived metrics
    const totalUsers = totalDrivers + totalCargoOwners;
    const activeUsers = activeDrivers + activeCargoOwners;
    const newUsersToday = newDriversToday + newCargoOwnersToday;
    const newUsersThisWeek = newDriversThisWeek + newCargoOwnersThisWeek;
    const newUsersThisMonth = newDriversThisMonth + newCargoOwnersThisMonth;
    const usersLastMonth = driversLastMonth + cargoOwnersLastMonth;

    const monthlyRevenue = monthlyRevenueData[0]?.totalRevenue || 0;
    const totalRevenue = totalRevenueData[0]?.totalRevenue || 0;

    // Calculate growth rates
    const userGrowthRate = usersLastMonth > 0 ? 
      parseFloat(((newUsersThisMonth - usersLastMonth) / usersLastMonth * 100).toFixed(2)) : 
      (newUsersThisMonth > 0 ? 100 : 0);

    const loadGrowthRate = loadsLastMonth > 0 ? 
      parseFloat(((newLoadsThisMonth - loadsLastMonth) / loadsLastMonth * 100).toFixed(2)) : 
      (newLoadsThisMonth > 0 ? 100 : 0);

    const subscriptionGrowthRate = subscriptionsLastMonth > 0 ? 
      parseFloat(((newSubscriptionsThisMonth - subscriptionsLastMonth) / subscriptionsLastMonth * 100).toFixed(2)) : 
      (newSubscriptionsThisMonth > 0 ? 100 : 0);

    // Calculate rates and percentages
    const subscriptionRate = totalUsers > 0 ? 
      parseFloat((activeSubscriptions / totalUsers * 100).toFixed(2)) : 0;
    
    const loadCompletionRate = totalLoads > 0 ? 
      parseFloat((completedLoads / totalLoads * 100).toFixed(2)) : 0;

    const loadCancellationRate = totalLoads > 0 ? 
      parseFloat((cancelledLoads / totalLoads * 100).toFixed(2)) : 0;

    const driverVerificationRate = totalDrivers > 0 ? 
      parseFloat((verifiedDrivers / totalDrivers * 100).toFixed(2)) : 0;

    const cargoOwnerVerificationRate = totalCargoOwners > 0 ? 
      parseFloat((verifiedCargoOwners / totalCargoOwners * 100).toFixed(2)) : 0;

    const averageRevenuePerSubscription = activeSubscriptions > 0 ? 
      parseFloat((totalRevenue / activeSubscriptions).toFixed(2)) : 0;

    // Build comprehensive stats object
    const stats = {
      // Load metrics
      loads: {
        total: totalLoads,
        active: activeLoads,
        newToday: newLoadsToday,
        newThisWeek: newLoadsThisWeek,
        newThisMonth: newLoadsThisMonth,
        completed: completedLoads,
        cancelled: cancelledLoads,
        urgent: urgentLoads,
        completionRate: loadCompletionRate,
        cancellationRate: loadCancellationRate,
        growthRate: loadGrowthRate
      },

      // User metrics
      users: {
        total: totalUsers,
        active: activeUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
        growthRate: userGrowthRate,
        drivers: {
          total: totalDrivers,
          active: activeDrivers,
          newToday: newDriversToday,
          newThisWeek: newDriversThisWeek,
          newThisMonth: newDriversThisMonth,
          verified: verifiedDrivers,
          verificationRate: driverVerificationRate
        },
        cargoOwners: {
          total: totalCargoOwners,
          active: activeCargoOwners,
          newToday: newCargoOwnersToday,
          newThisWeek: newCargoOwnersThisWeek,
          newThisMonth: newCargoOwnersThisMonth,
          verified: verifiedCargoOwners,
          verificationRate: cargoOwnerVerificationRate
        }
      },

      // Subscription metrics
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        pending: pendingSubscriptions,
        expired: expiredSubscriptions,
        rejected: rejectedSubscriptions,
        newThisMonth: newSubscriptionsThisMonth,
        rate: subscriptionRate,
        growthRate: subscriptionGrowthRate,
        byPlan: revenueByPlan.reduce((acc, plan) => {
          acc[plan._id] = {
            count: plan.count,
            revenue: plan.revenue
          };
          return acc;
        }, {})
      },

      // Revenue metrics
      revenue: {
        monthly: monthlyRevenue,
        total: totalRevenue,
        averagePerSubscription: averageRevenuePerSubscription,
        byPlan: revenueByPlan
      },

      // Performance indicators
      kpis: {
        userGrowthRate,
        loadGrowthRate,
        subscriptionGrowthRate,
        subscriptionRate,
        loadCompletionRate,
        loadCancellationRate,
        driverVerificationRate,
        cargoOwnerVerificationRate,
        averageLoadsPerUser: totalUsers > 0 ? parseFloat((totalLoads / totalUsers).toFixed(2)) : 0,
        dailyActiveUsers: activeUsers,
        monthlyActiveRevenue: monthlyRevenue
      },

      // System metadata
      metadata: {
        lastUpdated: new Date(),
        generatedBy: req.admin.name || 'System',
        dataSource: 'mongodb',
        queryExecutionTime: Date.now() - (req.startTime || Date.now())
      }
    };

    res.json({
      status: 'success',
      data: stats,
      message: 'Dashboard statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    // Return fallback stats structure
    const fallbackStats = {
      loads: { total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0, completed: 0, cancelled: 0, urgent: 0, completionRate: 0, cancellationRate: 0, growthRate: 0 },
      users: { 
        total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0, growthRate: 0,
        drivers: { total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0, verified: 0, verificationRate: 0 },
        cargoOwners: { total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0, verified: 0, verificationRate: 0 }
      },
      subscriptions: { total: 0, active: 0, pending: 0, expired: 0, rejected: 0, newThisMonth: 0, rate: 0, growthRate: 0, byPlan: {} },
      revenue: { monthly: 0, total: 0, averagePerSubscription: 0, byPlan: [] },
      kpis: { userGrowthRate: 0, loadGrowthRate: 0, subscriptionGrowthRate: 0, subscriptionRate: 0, loadCompletionRate: 0, loadCancellationRate: 0, driverVerificationRate: 0, cargoOwnerVerificationRate: 0, averageLoadsPerUser: 0, dailyActiveUsers: 0, monthlyActiveRevenue: 0 },
      metadata: { lastUpdated: new Date(), error: true, errorMessage: 'Error fetching statistics' }
    };

    res.status(500).json({
      status: 'error',
      message: 'Error fetching dashboard statistics',
      data: fallbackStats,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/dashboard-stats/refresh
// @desc    Force refresh dashboard statistics
// @access  Private
router.post('/dashboard-stats/refresh', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    // Mark start time for performance tracking
    req.startTime = Date.now();

    // Clear any cached stats if you implement caching later
    // await clearDashboardStatsCache();

    // Call the same logic as the GET endpoint by forwarding the request
    const originalMethod = req.method;
    req.method = 'GET';
    
    // Re-run the dashboard stats logic
    return router.handle(req, res);

  } catch (error) {
    console.error('Dashboard stats refresh error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error refreshing dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/analytics/detailed
// @desc    Get detailed analytics with historical data
// @access  Private
router.get('/analytics/detailed', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions?.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    const { 
      timeframe = '30d',
      groupBy = 'day',
      includeGeography = 'false',
      includeUserBehavior = 'false'
    } = req.query;

    // Calculate date ranges
    let startDate, endDate = new Date();
    const days = parseInt(timeframe.replace('d', '')) || 30;
    startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const db = mongoose.connection.db;

    // Build aggregation pipeline for time grouping
    let dateGrouping = {};
    switch (groupBy) {
      case 'hour':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        break;
      case 'day':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'week':
        dateGrouping = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      case 'month':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default:
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const analyticsQueries = [];

    // User registration trends
    analyticsQueries.push(
      db.collection('drivers').aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: dateGrouping,
            drivers: { $sum: 1 },
            verifiedDrivers: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ]).toArray().catch(() => [])
    );

    analyticsQueries.push(
      db.collection('cargo-owners').aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: dateGrouping,
            cargoOwners: { $sum: 1 },
            verifiedCargoOwners: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ]).toArray().catch(() => [])
    );

    // Load posting trends
    analyticsQueries.push(
      Load.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: dateGrouping,
            totalLoads: { $sum: 1 },
            urgentLoads: { $sum: { $cond: [{ $eq: ['$isUrgent', true] }, 1, 0] } },
            averageBudget: { $avg: '$budget' },
            totalBudget: { $sum: '$budget' },
            completedLoads: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ]).catch(() => [])
    );

    // Subscription trends
    analyticsQueries.push(
      Subscription.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: dateGrouping,
            totalSubscriptions: { $sum: 1 },
            approvedSubscriptions: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            revenue: { $sum: { $ifNull: ['$price', '$amount'] } },
            basicPlan: { $sum: { $cond: [{ $eq: ['$planId', 'basic'] }, 1, 0] } },
            proPlan: { $sum: { $cond: [{ $eq: ['$planId', 'pro'] }, 1, 0] } },
            businessPlan: { $sum: { $cond: [{ $eq: ['$planId', 'business'] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ]).catch(() => [])
    );

    // Geographic analysis (if requested)
    if (includeGeography === 'true') {
      analyticsQueries.push(
        db.collection('drivers').aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$location',
              driverCount: { $sum: 1 },
              activeDrivers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
              verifiedDrivers: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } }
            }
          },
          { $sort: { driverCount: -1 } },
          { $limit: 20 }
        ]).toArray().catch(() => [])
      );

      analyticsQueries.push(
        db.collection('cargo-owners').aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$location',
              cargoOwnerCount: { $sum: 1 },
              activeCargoOwners: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
              verifiedCargoOwners: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } }
            }
          },
          { $sort: { cargoOwnerCount: -1 } },
          { $limit: 20 }
        ]).toArray().catch(() => [])
      );

      analyticsQueries.push(
        Load.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$pickupLocation',
              loadCount: { $sum: 1 },
              totalBudget: { $sum: '$budget' },
              averageBudget: { $avg: '$budget' },
              completedLoads: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
            }
          },
          { $sort: { loadCount: -1 } },
          { $limit: 20 }
        ]).catch(() => [])
      );
    }

    // User behavior analysis (if requested)
    if (includeUserBehavior === 'true') {
      analyticsQueries.push(
        Load.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$cargoType',
              count: { $sum: 1 },
              totalBudget: { $sum: '$budget' },
              averageBudget: { $avg: '$budget' },
              averageWeight: { $avg: '$weight' }
            }
          },
          { $sort: { count: -1 } }
        ]).catch(() => [])
      );

      analyticsQueries.push(
        Load.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$vehicleType',
              count: { $sum: 1 },
              totalBudget: { $sum: '$budget' },
              averageBudget: { $avg: '$budget' }
            }
          },
          { $sort: { count: -1 } }
        ]).catch(() => [])
      );
    }

    // Execute all queries
    const results = await Promise.allSettled(analyticsQueries);

    // Process results
    const [
      driverTrends,
      cargoOwnerTrends,
      loadTrends,
      subscriptionTrends,
      ...additionalResults
    ] = results.map(result => result.status === 'fulfilled' ? result.value : []);

    let geographicData = {};
    let behaviorData = {};

    if (includeGeography === 'true') {
      const [driversByLocation, cargoOwnersByLocation, loadsByLocation] = additionalResults.slice(0, 3);
      geographicData = {
        driversByLocation,
        cargoOwnersByLocation,
        loadsByLocation
      };
    }

    if (includeUserBehavior === 'true') {
      const startIndex = includeGeography === 'true' ? 3 : 0;
      const [cargoTypeAnalysis, vehicleTypeAnalysis] = additionalResults.slice(startIndex, startIndex + 2);
      behaviorData = {
        cargoTypeAnalysis,
        vehicleTypeAnalysis
      };
    }

    const analytics = {
      timeframe,
      groupBy,
      period: {
        start: startDate,
        end: endDate,
        days: days
      },
      trends: {
        userRegistrations: {
          drivers: driverTrends,
          cargoOwners: cargoOwnerTrends
        },
        loads: loadTrends,
        subscriptions: subscriptionTrends
      },
      geography: geographicData,
      behavior: behaviorData,
      summary: {
        totalDataPoints: driverTrends.length + cargoOwnerTrends.length + loadTrends.length + subscriptionTrends.length,
        queryExecutionTime: Date.now() - (req.startTime || Date.now()),
        generatedAt: new Date()
      }
    };

    res.json({
      status: 'success',
      data: analytics,
      message: 'Detailed analytics retrieved successfully'
    });

  } catch (error) {
    console.error('Detailed analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching detailed analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// @route   GET /api/admin/analytics/summary
// @desc    Get quick summary stats for dashboard cards
// @access  Private
router.get('/analytics/summary', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions?.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const db = mongoose.connection.db;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Quick essential stats only
    const [
      userCounts,
      loadCounts, 
      subscriptionCounts,
      revenueData
    ] = await Promise.allSettled([
      // User counts
      Promise.all([
        db.collection('drivers').countDocuments(),
        db.collection('cargo-owners').countDocuments(),
        db.collection('drivers').countDocuments({ createdAt: { $gte: startOfToday } }),
        db.collection('cargo-owners').countDocuments({ createdAt: { $gte: startOfToday } }),
        db.collection('drivers').countDocuments({ createdAt: { $gte: startOfWeek } }),
        db.collection('cargo-owners').countDocuments({ createdAt: { $gte: startOfWeek } })
      ]),
      
      // Load counts
      Promise.all([
        Load.countDocuments().catch(() => 0),
        Load.countDocuments({ 
          status: { $in: ['posted', 'available', 'receiving_bids', 'assigned', 'in_transit'] } 
        }).catch(() => 0),
        Load.countDocuments({ createdAt: { $gte: startOfToday } }).catch(() => 0)
      ]),
      
      // Subscription counts
      Promise.all([
        Subscription.countDocuments().catch(() => 0),
        Subscription.countDocuments({ status: 'pending' }).catch(() => 0),
        Subscription.countDocuments({ 
          status: 'active',
          $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }]
        }).catch(() => 0)
      ]),
      
      // Revenue
      Subscription.aggregate([
        {
          $match: {
            status: 'active',
            paymentStatus: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$price', '$amount'] } },
            count: { $sum: 1 }
          }
        }
      ]).catch(() => [])
    ]);

    // Process results
    const [drivers, cargoOwners, newDriversToday, newCargoOwnersToday, newDriversWeek, newCargoOwnersWeek] = 
      userCounts.status === 'fulfilled' ? userCounts.value : [0, 0, 0, 0, 0, 0];

    const [totalLoads, activeLoads, newLoadsToday] = 
      loadCounts.status === 'fulfilled' ? loadCounts.value : [0, 0, 0];

    const [totalSubscriptions, pendingSubscriptions, activeSubscriptions] = 
      subscriptionCounts.status === 'fulfilled' ? subscriptionCounts.value : [0, 0, 0];

    const revenue = revenueData.status === 'fulfilled' ? 
      (revenueData.value[0]?.totalRevenue || 0) : 0;

    const summary = {
      users: {
        total: drivers + cargoOwners,
        newToday: newDriversToday + newCargoOwnersToday,
        newThisWeek: newDriversWeek + newCargoOwnersWeek,
        breakdown: {
          drivers,
          cargoOwners
        }
      },
      loads: {
        total: totalLoads,
        active: activeLoads,
        newToday: newLoadsToday
      },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        pending: pendingSubscriptions
      },
      revenue: {
        total: revenue
      },
      lastUpdated: new Date()
    };

    res.json({
      status: 'success',
      data: summary
    });

  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching analytics summary'
    });
  }
});

// @route   GET /api/admin/analytics/performance
// @desc    Get performance metrics and KPIs
// @access  Private
router.get('/analytics/performance', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions?.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    const { period = '30d' } = req.query;
    const days = parseInt(period.replace('d', '')) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    // Parallel execution of performance queries
    const [
      loadPerformance,
      userEngagement,
      revenueMetrics,
      systemHealth
    ] = await Promise.allSettled([
      // Load performance metrics
      Promise.all([
        Load.countDocuments({ 
          createdAt: { $gte: startDate },
          status: 'delivered' 
        }).catch(() => 0),
        Load.countDocuments({ 
          createdAt: { $gte: startDate } 
        }).catch(() => 0),
        Load.aggregate([
          {
            $match: { 
              createdAt: { $gte: startDate },
              status: 'delivered',
              deliveredAt: { $exists: true }
            }
          },
          {
            $project: {
              deliveryTime: {
                $divide: [
                  { $subtract: ['$deliveredAt', '$createdAt'] },
                  1000 * 60 * 60 * 24 // Convert to days
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              avgDeliveryTime: { $avg: '$deliveryTime' },
              minDeliveryTime: { $min: '$deliveryTime' },
              maxDeliveryTime: { $max: '$deliveryTime' }
            }
          }
        ]).catch(() => [])
      ]),

      // User engagement metrics
      Promise.all([
        mongoose.connection.db.collection('drivers').countDocuments({
          createdAt: { $gte: startDate },
          isActive: true
        }),
        mongoose.connection.db.collection('cargo-owners').countDocuments({
          createdAt: { $gte: startDate },
          isActive: true
        }),
        mongoose.connection.db.collection('drivers').countDocuments({
          createdAt: { $gte: startDate },
          isVerified: true
        }),
        mongoose.connection.db.collection('cargo-owners').countDocuments({
          createdAt: { $gte: startDate },
          isVerified: true
        })
      ]),

      // Revenue performance
      Subscription.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: 'active',
            paymentStatus: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$price', '$amount'] } },
            avgRevenue: { $avg: { $ifNull: ['$price', '$amount'] } },
            count: { $sum: 1 }
          }
        }
      ]).catch(() => []),

      // System health indicators
      Promise.all([
        Load.countDocuments({ 
          createdAt: { $gte: startDate },
          status: 'cancelled' 
        }).catch(() => 0),
        Subscription.countDocuments({ 
          createdAt: { $gte: startDate },
          status: 'rejected' 
        }).catch(() => 0),
        mongoose.connection.db.collection('drivers').countDocuments({
          createdAt: { $gte: startDate },
          accountStatus: 'suspended'
        }),
        mongoose.connection.db.collection('cargo-owners').countDocuments({
          createdAt: { $gte: startDate },
          accountStatus: 'suspended'
        })
      ])
    ]);

    // Process results
    const [completedLoads, totalLoads, deliveryTimeData] = 
      loadPerformance.status === 'fulfilled' ? loadPerformance.value : [0, 0, []];

    const [activeDrivers, activeCargoOwners, verifiedDrivers, verifiedCargoOwners] = 
      userEngagement.status === 'fulfilled' ? userEngagement.value : [0, 0, 0, 0];

    const revenueData = revenueMetrics.status === 'fulfilled' ? 
      (revenueMetrics.value[0] || { totalRevenue: 0, avgRevenue: 0, count: 0 }) : 
      { totalRevenue: 0, avgRevenue: 0, count: 0 };

    const [cancelledLoads, rejectedSubscriptions, suspendedDrivers, suspendedCargoOwners] = 
      systemHealth.status === 'fulfilled' ? systemHealth.value : [0, 0, 0, 0];

    const avgDeliveryTime = deliveryTimeData.length > 0 ? 
      deliveryTimeData[0].avgDeliveryTime : null;

    // Calculate KPIs
    const completionRate = totalLoads > 0 ? (completedLoads / totalLoads * 100) : 0;
    const cancellationRate = totalLoads > 0 ? (cancelledLoads / totalLoads * 100) : 0;
    const userActivationRate = (activeDrivers + activeCargoOwners) > 0 ? 
      ((verifiedDrivers + verifiedCargoOwners) / (activeDrivers + activeCargoOwners) * 100) : 0;
    const revenuePerUser = (activeDrivers + activeCargoOwners) > 0 ? 
      (revenueData.totalRevenue / (activeDrivers + activeCargoOwners)) : 0;

    const performance = {
      period: {
        days,
        start: startDate,
        end: endDate
      },
      kpis: {
        loadCompletionRate: parseFloat(completionRate.toFixed(2)),
        loadCancellationRate: parseFloat(cancellationRate.toFixed(2)),
        userActivationRate: parseFloat(userActivationRate.toFixed(2)),
        averageDeliveryTime: avgDeliveryTime ? parseFloat(avgDeliveryTime.toFixed(2)) : null,
        revenuePerUser: parseFloat(revenuePerUser.toFixed(2)),
        subscriptionConversionRate: (activeDrivers + activeCargoOwners) > 0 ? 
          parseFloat((revenueData.count / (activeDrivers + activeCargoOwners) * 100).toFixed(2)) : 0
      },
      metrics: {
        loads: {
          total: totalLoads,
          completed: completedLoads,
          cancelled: cancelledLoads,
          completionRate: parseFloat(completionRate.toFixed(2)),
          cancellationRate: parseFloat(cancellationRate.toFixed(2)),
          avgDeliveryDays: avgDeliveryTime ? parseFloat(avgDeliveryTime.toFixed(2)) : null
        },
        users: {
          activeDrivers,
          activeCargoOwners,
          verifiedDrivers,
          verifiedCargoOwners,
          suspendedDrivers,
          suspendedCargoOwners,
          totalActive: activeDrivers + activeCargoOwners,
          verificationRate: (activeDrivers + activeCargoOwners) > 0 ? 
            parseFloat(((verifiedDrivers + verifiedCargoOwners) / (activeDrivers + activeCargoOwners) * 100).toFixed(2)) : 0
        },
        revenue: {
          total: revenueData.totalRevenue,
          average: parseFloat((revenueData.avgRevenue || 0).toFixed(2)),
          subscriptions: revenueData.count,
          revenuePerUser: parseFloat(revenuePerUser.toFixed(2))
        },
        system: {
          rejectedSubscriptions,
          suspendedUsers: suspendedDrivers + suspendedCargoOwners,
          healthScore: parseFloat((100 - cancellationRate - (rejectedSubscriptions / Math.max(revenueData.count, 1) * 100)).toFixed(2))
        }
      },
      generatedAt: new Date()
    };

    res.json({
      status: 'success',
      data: performance,
      message: 'Performance metrics retrieved successfully'
    });

  } catch (error) {
    console.error('Performance analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching performance metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/analytics/export
// @desc    Export analytics data in various formats
// @access  Private
router.get('/analytics/export', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions?.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to export analytics.'
      });
    }

    const { 
      format = 'json',
      type = 'summary',
      period = '30d',
      include = 'all'
    } = req.query;

    const days = parseInt(period.replace('d', '')) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    let exportData = {};

    // Get data based on type
    switch (type) {
      case 'users':
        const userExportData = await Promise.allSettled([
          mongoose.connection.db.collection('drivers').find({
            createdAt: { $gte: startDate }
          }).project({
            _id: 1, name: 1, email: 1, location: 1, isVerified: 1, 
            isActive: 1, createdAt: 1
          }).toArray(),
          mongoose.connection.db.collection('cargo-owners').find({
            createdAt: { $gte: startDate }
          }).project({
            _id: 1, name: 1, email: 1, location: 1, isVerified: 1, 
            isActive: 1, createdAt: 1
          }).toArray()
        ]);
        
        exportData = {
          drivers: userExportData[0].status === 'fulfilled' ? userExportData[0].value : [],
          cargoOwners: userExportData[1].status === 'fulfilled' ? userExportData[1].value : []
        };
        break;

      case 'loads':
        exportData.loads = await Load.find({
          createdAt: { $gte: startDate }
        }).select({
          title: 1, pickupLocation: 1, deliveryLocation: 1, weight: 1, 
          budget: 1, status: 1, isUrgent: 1, createdAt: 1, deliveredAt: 1
        }).lean().catch(() => []);
        break;

      case 'subscriptions':
        exportData.subscriptions = await Subscription.find({
          createdAt: { $gte: startDate }
        }).select({
          userId: 1, planId: 1, planName: 1, price: 1, status: 1, 
          paymentStatus: 1, createdAt: 1, activatedAt: 1, expiresAt: 1
        }).lean().catch(() => []);
        break;

      default: // summary
        const summaryData = await Promise.allSettled([
          mongoose.connection.db.collection('drivers').countDocuments({
            createdAt: { $gte: startDate }
          }),
          mongoose.connection.db.collection('cargo-owners').countDocuments({
            createdAt: { $gte: startDate }
          }),
          Load.countDocuments({ createdAt: { $gte: startDate } }).catch(() => 0),
          Subscription.countDocuments({ createdAt: { $gte: startDate } }).catch(() => 0)
        ]);

        exportData = {
          summary: {
            period: { start: startDate, end: endDate, days },
            drivers: summaryData[0].status === 'fulfilled' ? summaryData[0].value : 0,
            cargoOwners: summaryData[1].status === 'fulfilled' ? summaryData[1].value : 0,
            loads: summaryData[2].status === 'fulfilled' ? summaryData[2].value : 0,
            subscriptions: summaryData[3].status === 'fulfilled' ? summaryData[3].value : 0
          },
          exportedAt: new Date(),
          exportedBy: req.admin.name || 'Admin'
        };
    }

    // Handle different export formats
    switch (format.toLowerCase()) {
      case 'csv':
        // For CSV, we'll need to flatten the data structure
        let csvContent = '';
        if (type === 'users') {
          csvContent = 'Type,ID,Name,Email,Location,Verified,Active,Created\n';
          exportData.drivers?.forEach(driver => {
            csvContent += `Driver,${driver._id},${driver.name},${driver.email},${driver.location},${driver.isVerified},${driver.isActive},${driver.createdAt}\n`;
          });
          exportData.cargoOwners?.forEach(owner => {
            csvContent += `CargoOwner,${owner._id},${owner.name},${owner.email},${owner.location},${owner.isVerified},${owner.isActive},${owner.createdAt}\n`;
          });
        }
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-${type}-${period}.csv`);
        return res.send(csvContent);

      case 'xlsx':
        // For production, you'd want to use a library like xlsx or exceljs
        return res.status(501).json({
          status: 'error',
          message: 'XLSX export not implemented. Please use JSON or CSV format.'
        });

      default: // json
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-${type}-${period}.json`);
        return res.json({
          status: 'success',
          data: exportData,
          metadata: {
            exportType: type,
            format: format,
            period: period,
            exportedAt: new Date(),
            exportedBy: req.admin.name || 'Admin'
          }
        });
    }

  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error exporting analytics data',
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