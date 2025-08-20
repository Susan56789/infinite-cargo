// routes/adminNotifications.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query, param } = require('express-validator');
const { adminAuth } = require('../middleware/adminAuth');
const corsHandler = require('../middleware/corsHandler');
// If you need to verify roles against DB later:
// const Admin = require('../models/admin');

router.use(corsHandler);

// ---------- helpers ----------
const asObjectId = (val) => {
  if (!val || !mongoose.Types.ObjectId.isValid(String(val))) return null;
  return new mongoose.Types.ObjectId(String(val));
};

const getAuthAdmin = (req) => {
  // supports either req.user or req.admin
  const user = req.admin || req.user || {};
  const id = user.id || user._id;
  const role = user.role; // 'super_admin' | 'admin' | 'moderator'
  return { id: asObjectId(id), role };
};

const requireAdminRole = (role, allowed = ['admin', 'super_admin', 'moderator']) =>
  !!role && allowed.includes(role);

// Build the base visibility filter for admin notifications
const buildVisibilityFilter = (adminId) => ({
  $or: [
    { adminId: adminId },           // notifications for this admin
    { adminId: { $exists: false }}, // global without adminId
    { isGlobal: true }              // explicitly global
  ]
});

const getCollection = (name) => {
  if (!mongoose.connection || !mongoose.connection.db) {
    throw new Error('Database connection not available');
  }
  return mongoose.connection.db.collection(name);
};

// ---------- Admin notification helper ----------
const createAdminNotification = async (notificationData) => {
  try {
    const notificationsCollection = getCollection('admin_notifications');

    const notification = {
      ...notificationData,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Normalize optional adminId
    if (notification.adminId && !asObjectId(notification.adminId)) {
      throw new Error('Invalid adminId for admin notification');
    }
    if (notification.adminId) {
      notification.adminId = asObjectId(notification.adminId);
    }

    const result = await notificationsCollection.insertOne(notification);
    return result.insertedId;
  } catch (error) {
    console.error('Error creating admin notification:', error);
    return null;
  }
};

// @route   GET /api/admin/notifications
// @desc    Get admin notifications (with pagination, unread & search filters)
// @access  Private (Admin only)
router.get(
  '/',
  adminAuth,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('unread').optional().isBoolean().withMessage('Unread must be boolean'),
    query('search').optional().isString().withMessage('Search must be a string')
  ],
  async (req, res) => {
    try {
      const { id: adminId, role } = getAuthAdmin(req);
      if (!adminId || !requireAdminRole(role)) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Admin privileges required.'
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

      // normalize query params
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const unreadParam = req.query.unread;
      const search = (req.query.search || '').trim();

      const notificationsCollection = getCollection('admin_notifications');

      // Base visibility
      const baseOr = buildVisibilityFilter(adminId).$or;
      const andParts = [{ $or: baseOr }];

      // Unread filter (compose instead of overwrite)
      if (typeof unreadParam !== 'undefined') {
        const unreadBool = (String(unreadParam).toLowerCase() === 'true');
        andParts.push({ isRead: unreadBool ? false : true });
      }

      // Search filter (compose instead of overwrite)
      if (search) {
        andParts.push({
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { message: { $regex: search, $options: 'i' } }
          ]
        });
      }

      const matchQuery = andParts.length > 1 ? { $and: andParts } : { $or: baseOr };

      // totals & pagination
      const totalNotifications = await notificationsCollection.countDocuments(matchQuery);
      const skip = (page - 1) * limit;
      const totalPages = Math.max(1, Math.ceil(totalNotifications / limit));

      const notifications = await notificationsCollection
        .find(matchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const unreadCount = await notificationsCollection.countDocuments({
        $and: [{ $or: baseOr }, { isRead: false }]
      });

      const formatted = notifications.map((n) => ({
        _id: n._id,
        type: n.type || 'system',
        title: n.title,
        message: n.message,
        priority: n.priority || 'medium',
        icon: n.icon || 'bell',
        isRead: !!n.isRead,
        createdAt: n.createdAt,
        readAt: n.readAt || null,
        actionUrl: n.actionUrl || null,
        data: n.data || {},
        expiresAt: n.expiresAt || null,
        isGlobal: !!n.isGlobal
      }));

      return res.json({
        status: 'success',
        data: {
          notifications: formatted,
          pagination: {
            currentPage: page,
            totalPages,
            totalNotifications,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            limit
          },
          summary: {
            total: totalNotifications,
            unread: unreadCount,
            read: totalNotifications - unreadCount
          }
        }
      });
    } catch (error) {
      console.error('Get admin notifications error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error fetching notifications',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/admin/notifications/summary
// @desc    Get admin notification summary
// @access  Private (Admin only)
router.get('/summary', adminAuth, async (req, res) => {
  try {
    const { id: adminId, role } = getAuthAdmin(req);
    if (!adminId || !requireAdminRole(role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }

    const notificationsCollection = getCollection('admin_notifications');

    const matchQuery = buildVisibilityFilter(adminId);

    const summaryAgg = await notificationsCollection.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
          highPriority: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
          mediumPriority: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
          lowPriority: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } }
        }
      }
    ]).toArray();

    const typeBreakdown = await notificationsCollection.aggregate([
      { $match: { ...matchQuery, isRead: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    const recentNotifications = await notificationsCollection
      .find(matchQuery)
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const summary = summaryAgg[0] || {
      total: 0,
      unread: 0,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0
    };

    return res.json({
      status: 'success',
      data: {
        summary,
        typeBreakdown: typeBreakdown.reduce((acc, item) => {
          acc[item._id || 'unknown'] = item.count;
          return acc;
        }, {}),
        recentNotifications: recentNotifications.map((n) => ({
          _id: n._id,
          type: n.type || 'system',
          title: n.title,
          message: n.message,
          priority: n.priority || 'medium',
          isRead: !!n.isRead,
          createdAt: n.createdAt,
          timestamp: n.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Get admin notification summary error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching notification summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/admin/notifications/:id/read
// @desc    Mark admin notification as read
// @access  Private (Admin only)
router.put('/:id/read',
  adminAuth,
  [param('id').isMongoId().withMessage('Invalid notification ID')],
  async (req, res) => {
    try {
      const { id: adminId, role } = getAuthAdmin(req);
      if (!adminId || !requireAdminRole(role)) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Admin privileges required.'
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

      const notifId = asObjectId(req.params.id);
      const notificationsCollection = getCollection('admin_notifications');

      const result = await notificationsCollection.updateOne(
        {
          _id: notifId,
          ...buildVisibilityFilter(adminId)
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
            updatedAt: new Date(),
            readBy: adminId
          }
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Notification not found or access denied'
        });
      }

      if (result.modifiedCount === 0) {
        return res.json({
          status: 'success',
          message: 'Notification was already marked as read',
          data: { notificationId: notifId, isRead: true, alreadyRead: true }
        });
      }

      return res.json({
        status: 'success',
        message: 'Notification marked as read',
        data: { notificationId: notifId, isRead: true, readAt: new Date() }
      });
    } catch (error) {
      console.error('Mark admin notification read error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error marking notification as read',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   PUT /api/admin/notifications/read-all
// @desc    Mark all admin notifications as read
// @access  Private (Admin only)
router.put('/read-all', adminAuth, async (req, res) => {
  try {
    const { id: adminId, role } = getAuthAdmin(req);
    if (!adminId || !requireAdminRole(role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }

    const notificationsCollection = getCollection('admin_notifications');
    const result = await notificationsCollection.updateMany(
      { ...buildVisibilityFilter(adminId), isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date(),
          readBy: adminId
        }
      }
    );

    return res.json({
      status: 'success',
      message: `${result.modifiedCount} notifications marked as read`,
      data: { updatedCount: result.modifiedCount, readAt: new Date() }
    });
  } catch (error) {
    console.error('Mark all admin notifications read error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error marking all notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/admin/notifications/:id
// @desc    Delete an admin notification
// @access  Private (Admin only)
router.delete('/:id',
  adminAuth,
  [param('id').isMongoId().withMessage('Invalid notification ID')],
  async (req, res) => {
    try {
      const { id: adminId, role } = getAuthAdmin(req);
      if (!adminId || !requireAdminRole(role)) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Admin privileges required.'
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

      const notifId = asObjectId(req.params.id);
      const notificationsCollection = getCollection('admin_notifications');

      const result = await notificationsCollection.deleteOne({
        _id: notifId,
        ...buildVisibilityFilter(adminId)
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Notification not found or access denied'
        });
      }

      return res.json({
        status: 'success',
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Delete admin notification error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error deleting notification',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   POST /api/admin/notifications/broadcast
// @desc    Send broadcast notification to users (admin only)
// @access  Private (Admin only)
router.post(
  '/broadcast',
  adminAuth,
  [
    body('userType').optional().isIn(['driver', 'cargo_owner', 'all']).withMessage('Invalid user type'),
    body('userIds').optional().isArray().withMessage('User IDs must be an array'),
    body('type').notEmpty().withMessage('Notification type is required'),
    body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required and cannot exceed 200 characters'),
    body('message').notEmpty().isLength({ max: 1000 }).withMessage('Message is required and cannot exceed 1000 characters'),
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high')
  ],
  async (req, res) => {
    try {
      const { id: adminId, role } = getAuthAdmin(req);
      if (!adminId || !requireAdminRole(role, ['admin', 'super_admin'])) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Admin privileges required.'
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

      const {
        userType,
        userIds,
        type,
        title,
        message,
        priority = 'medium',
        data = {},
        icon,
        actionUrl,
        expiresAt
      } = req.body;

      const db = mongoose.connection.db;

      let targetUsers = [];
      if (Array.isArray(userIds) && userIds.length > 0) {
        targetUsers = userIds
          .map(asObjectId)
          .filter(Boolean)
          .map((oid) => ({ userId: oid, userType: userType || 'driver' }));
      } else if (userType && userType !== 'all') {
        const collectionName = userType === 'driver' ? 'drivers' : 'cargo-owners';
        const users = await db.collection(collectionName).find({}, { projection: { _id: 1 } }).toArray();
        targetUsers = users.map((u) => ({ userId: u._id, userType }));
      } else {
        const drivers = await db.collection('drivers').find({}, { projection: { _id: 1 } }).toArray();
        const cargoOwners = await db.collection('cargo-owners').find({}, { projection: { _id: 1 } }).toArray();
        targetUsers = [
          ...drivers.map((u) => ({ userId: u._id, userType: 'driver' })),
          ...cargoOwners.map((u) => ({ userId: u._id, userType: 'cargo_owner' }))
        ];
      }

      const notificationsCollection = db.collection('notifications');
      const notifications = targetUsers.map((u) => ({
        userId: u.userId,
        userType: u.userType,
        type,
        title,
        message,
        priority,
        data,
        icon: icon || 'bell',
        actionUrl: actionUrl || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        sentBy: adminId,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const result = await notificationsCollection.insertMany(notifications);

      // Track via admin notification
      await createAdminNotification({
        adminId,
        type: 'broadcast_sent',
        title: 'Broadcast Notification Sent',
        message: `Successfully sent "${title}" to ${result.insertedCount} users`,
        priority: 'low',
        data: {
          originalTitle: title,
          targetCount: result.insertedCount,
          targetUserType: userType || 'mixed'
        }
      });

      return res.status(201).json({
        status: 'success',
        message: `Notification sent to ${result.insertedCount} users`,
        data: {
          sentCount: result.insertedCount,
          targetUserType: userType || 'mixed'
        }
      });
    } catch (error) {
      console.error('Broadcast notification error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error broadcasting notification',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   POST /api/admin/notifications/system
// @desc    Create system notification for admins
// @access  Private (Super Admin only)
router.post(
  '/system',
  adminAuth,
  [
    body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required and cannot exceed 200 characters'),
    body('message').notEmpty().isLength({ max: 1000 }).withMessage('Message is required and cannot exceed 1000 characters'),
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
    body('isGlobal').optional().isBoolean().withMessage('isGlobal must be boolean')
  ],
  async (req, res) => {
    try {
      const { id: adminId, role } = getAuthAdmin(req);
      if (!adminId || role !== 'super_admin') {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Super admin privileges required.'
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

      const {
        title,
        message,
        priority = 'medium',
        isGlobal = true,
        type = 'system_announcement',
        data = {},
        icon,
        actionUrl,
        expiresAt
      } = req.body;

      const notificationId = await createAdminNotification({
        adminId: isGlobal ? null : adminId,
        isGlobal,
        type,
        title,
        message,
        priority,
        data,
        icon: icon || 'bell',
        actionUrl: actionUrl || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: adminId
      });

      if (!notificationId) {
        return res.status(500).json({
          status: 'error',
          message: 'Failed to create system notification'
        });
      }

      return res.status(201).json({
        status: 'success',
        message: 'System notification created successfully',
        data: { notificationId }
      });
    } catch (error) {
      console.error('Create system notification error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Server error creating system notification',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ---------- utility exports ----------
const adminNotificationUtils = {
  createAdminNotification,

  notifyNewUserRegistration: async (userData) => {
    return await createAdminNotification({
      isGlobal: true,
      type: 'new_user_registration',
      title: 'New User Registered',
      message: `${userData.name} (${userData.userType}) has registered on the platform`,
      priority: 'low',
      data: {
        userId: userData._id,
        userType: userData.userType,
        email: userData.email
      },
      actionUrl: `/admin/${userData.userType}s`
    });
  },

  notifySubscriptionRequest: async (subscriptionData) => {
    return await createAdminNotification({
      isGlobal: true,
      type: 'subscription_request',
      title: 'New Subscription Request',
      message: `${subscriptionData.userName} has requested ${subscriptionData.planName} subscription`,
      priority: 'medium',
      data: {
        subscriptionId: subscriptionData._id,
        userId: subscriptionData.userId,
        planName: subscriptionData.planName,
        amount: subscriptionData.amount
      },
      actionUrl: '/admin/subscriptions'
    });
  },

  notifySystemAlert: async (alertData) => {
    return await createAdminNotification({
      isGlobal: true,
      type: 'system_alert',
      title: alertData.title || 'System Alert',
      message: alertData.message,
      priority: 'high',
      data: alertData.data || {},
      icon: 'alert-triangle'
    });
  }
};

module.exports = router;
module.exports.adminNotificationUtils = adminNotificationUtils;
