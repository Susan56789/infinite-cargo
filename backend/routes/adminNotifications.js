// routes/adminNotifications.js 
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const {adminAuth} = require('../middleware/adminAuth');

const corsHandler = require('../middleware/corsHandler');

router.use(corsHandler);

// Admin notification helper functions
const createAdminNotification = async (notificationData) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('admin_notifications');

    const notification = {
      ...notificationData,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await notificationsCollection.insertOne(notification);
    return result.insertedId;
  } catch (error) {
    console.error('Error creating admin notification:', error);
    return null;
  }
};

// @route   GET /api/admin/notifications
// @desc    Get admin notifications
// @access  Private (Admin only)
router.get('/', adminAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('unread').optional().isBoolean().withMessage('Unread must be boolean'),
  query('search').optional().isString().withMessage('Search must be a string')
], async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 'admin') {
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
      page = 1,
      limit = 20,
      unread,
      search
    } = req.query;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('admin_notifications');

    const adminId = new mongoose.Types.ObjectId(req.user.id);

    // Build query filter
    const matchQuery = {
      $or: [
        { adminId: adminId }, // Notifications specifically for this admin
        { adminId: { $exists: false } }, // Global admin notifications
        { isGlobal: true } // Explicitly global notifications
      ]
    };

    // Add unread filter if specified
    if (unread !== undefined) {
      matchQuery.isRead = unread === 'true' ? false : true;
    }

    // Add search filter if specified
    if (search) {
      matchQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const totalNotifications = await notificationsCollection.countDocuments(matchQuery);

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalPages = Math.ceil(totalNotifications / parseInt(limit));

    // Fetch notifications with pagination and sorting
    const notifications = await notificationsCollection
      .find(matchQuery)
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    // Get unread count
    const unreadCount = await notificationsCollection.countDocuments({
      ...matchQuery,
      isRead: false
    });

    // Format notifications for response
    const formattedNotifications = notifications.map(notif => ({
      _id: notif._id,
      type: notif.type || 'system',
      title: notif.title,
      message: notif.message,
      priority: notif.priority || 'medium',
      icon: notif.icon || 'bell',
      isRead: notif.isRead,
      createdAt: notif.createdAt,
      readAt: notif.readAt || null,
      actionUrl: notif.actionUrl || null,
      data: notif.data || {},
      expiresAt: notif.expiresAt || null,
      isGlobal: notif.isGlobal || false
    }));

    res.json({
      status: 'success',
      data: {
        notifications: formattedNotifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalNotifications,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
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
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/notifications/summary
// @desc    Get admin notification summary
// @access  Private (Admin only)
router.get('/summary', adminAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('admin_notifications');

    const adminId = new mongoose.Types.ObjectId(req.user.id);

    const matchQuery = {
      $or: [
        { adminId: adminId },
        { adminId: { $exists: false } },
        { isGlobal: true }
      ]
    };

    // Get notification summary using aggregation
    const summary = await notificationsCollection.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          highPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          },
          mediumPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] }
          },
          lowPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] }
          }
        }
      }
    ]).toArray();

    // Get type breakdown
    const typeBreakdown = await notificationsCollection.aggregate([
      { $match: { ...matchQuery, isRead: false } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    // Get recent notifications
    const recentNotifications = await notificationsCollection.find(matchQuery)
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const summaryData = summary[0] || {
      total: 0,
      unread: 0,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0
    };

    res.json({
      status: 'success',
      data: {
        summary: summaryData,
        typeBreakdown: typeBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentNotifications: recentNotifications.map(notif => ({
          _id: notif._id,
          type: notif.type || 'system',
          title: notif.title,
          message: notif.message,
          priority: notif.priority || 'medium',
          isRead: notif.isRead,
          createdAt: notif.createdAt,
          timestamp: notif.createdAt // For backward compatibility
        }))
      }
    });

  } catch (error) {
    console.error('Get admin notification summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching notification summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/admin/notifications/:id/read
// @desc    Mark admin notification as read
// @access  Private (Admin only)
router.put('/:id/read', adminAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { id } = req.params;

    // Validate notification ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification ID'
      });
    }

    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('admin_notifications');
    const adminId = new mongoose.Types.ObjectId(req.user.id);

    // Update the notification
    const result = await notificationsCollection.updateOne(
      { 
        _id: new mongoose.Types.ObjectId(id),
        $or: [
          { adminId: adminId },
          { adminId: { $exists: false } },
          { isGlobal: true }
        ]
      },
      { 
        $set: { 
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date(),
          readBy: adminId // Track who read it
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
        data: {
          notificationId: id,
          isRead: true,
          alreadyRead: true
        }
      });
    }

    res.json({
      status: 'success',
      message: 'Notification marked as read',
      data: {
        notificationId: id,
        isRead: true,
        readAt: new Date()
      }
    });

  } catch (error) {
    console.error('Mark admin notification read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/admin/notifications/read-all
// @desc    Mark all admin notifications as read
// @access  Private (Admin only)
router.put('/read-all', adminAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }

    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('admin_notifications');
    const adminId = new mongoose.Types.ObjectId(req.user.id);

    const result = await notificationsCollection.updateMany(
      { 
        $or: [
          { adminId: adminId },
          { adminId: { $exists: false } },
          { isGlobal: true }
        ],
        isRead: false
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

    res.json({
      status: 'success',
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        updatedCount: result.modifiedCount,
        readAt: new Date()
      }
    });

  } catch (error) {
    console.error('Mark all admin notifications read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking all notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/admin/notifications/:id
// @desc    Delete an admin notification
// @access  Private (Admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification ID'
      });
    }

    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('admin_notifications');
    const adminId = new mongoose.Types.ObjectId(req.user.id);

    const result = await notificationsCollection.deleteOne({
      _id: new mongoose.Types.ObjectId(id),
      $or: [
        { adminId: adminId },
        { adminId: { $exists: false } },
        { isGlobal: true }
      ]
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found or access denied'
      });
    }

    res.json({
      status: 'success',
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete admin notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/notifications/broadcast
// @desc    Send broadcast notification to users (admin only)
// @access  Private (Admin only)
router.post('/broadcast', adminAuth, [
  body('userType').optional().isIn(['driver', 'cargo_owner', 'all']).withMessage('Invalid user type'),
  body('userIds').optional().isArray().withMessage('User IDs must be an array'),
  body('type').notEmpty().withMessage('Notification type is required'),
  body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required and cannot exceed 200 characters'),
  body('message').notEmpty().isLength({ max: 1000 }).withMessage('Message is required and cannot exceed 1000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high')
], async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 'admin') {
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

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    let targetUsers = [];

    if (userIds && userIds.length > 0) {
      // Send to specific users
      targetUsers = userIds.map(id => ({
        userId: new mongoose.Types.ObjectId(id),
        userType: userType || 'driver'
      }));
    } else if (userType && userType !== 'all') {
      // Send to all users of specific type
      const collection = userType === 'driver' ? 'drivers' : 'cargo-owners';
      const users = await db.collection(collection).find({}, { projection: { _id: 1 } }).toArray();
      targetUsers = users.map(user => ({
        userId: user._id,
        userType
      }));
    } else {
      // Send to all users
      const drivers = await db.collection('drivers').find({}, { projection: { _id: 1 } }).toArray();
      const cargoOwners = await db.collection('cargo-owners').find({}, { projection: { _id: 1 } }).toArray();
      
      targetUsers = [
        ...drivers.map(user => ({ userId: user._id, userType: 'driver' })),
        ...cargoOwners.map(user => ({ userId: user._id, userType: 'cargo_owner' }))
      ];
    }

    // Create notifications for all target users (in regular notifications collection)
    const notificationsCollection = db.collection('notifications');
    const notifications = targetUsers.map(user => ({
      userId: user.userId,
      userType: user.userType,
      type,
      title,
      message,
      priority,
      data,
      icon: icon || 'bell',
      actionUrl,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      sentBy: new mongoose.Types.ObjectId(req.user.id),
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const result = await notificationsCollection.insertMany(notifications);

    // Also create an admin notification for tracking
    await createAdminNotification({
      adminId: new mongoose.Types.ObjectId(req.user.id),
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

    res.status(201).json({
      status: 'success',
      message: `Notification sent to ${result.insertedCount} users`,
      data: {
        sentCount: result.insertedCount,
        targetUserType: userType || 'mixed'
      }
    });

  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error broadcasting notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/notifications/system
// @desc    Create system notification for admins
// @access  Private (Super Admin only)
router.post('/system', adminAuth, [
  body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required and cannot exceed 200 characters'),
  body('message').notEmpty().isLength({ max: 1000 }).withMessage('Message is required and cannot exceed 1000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('isGlobal').optional().isBoolean().withMessage('isGlobal must be boolean')
], async (req, res) => {
  try {
    // Check if user is super admin
    if (req.user.userType !== 'admin' || req.user.role !== 'super_admin') {
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
      adminId: isGlobal ? null : new mongoose.Types.ObjectId(req.user.id),
      isGlobal,
      type,
      title,
      message,
      priority,
      data,
      icon: icon || 'bell',
      actionUrl,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: new mongoose.Types.ObjectId(req.user.id)
    });

    if (!notificationId) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create system notification'
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'System notification created successfully',
      data: {
        notificationId
      }
    });

  } catch (error) {
    console.error('Create system notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error creating system notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Utility functions for creating common admin notifications
const adminNotificationUtils = {
  createAdminNotification,
  
  // Create notification for new user registration
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

  // Create notification for subscription request
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

  // Create notification for system alerts
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