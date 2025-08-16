// routes/notifications.js - Notification Management Routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');

const corsHandler = require('../middleware/corsHandler');

// Notification helper functions
const createNotification = async (notificationData) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const notification = {
      ...notificationData,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await notificationsCollection.insertOne(notification);
    return result.insertedId;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

const getNotificationTemplate = (type, data) => {
  const templates = {
    'new_bid': {
      title: 'New Bid Received',
      message: `${data.driverName} has placed a bid of ${data.bidAmount} on your load "${data.loadTitle}"`,
      icon: 'users',
      priority: 'medium'
    },
    'bid_accepted': {
      title: 'Bid Accepted',
      message: `Your bid of ${data.bidAmount} has been accepted for load "${data.loadTitle}"`,
      icon: 'check-circle',
      priority: 'high'
    },
    'bid_rejected': {
      title: 'Bid Rejected',
      message: `Your bid for load "${data.loadTitle}" has been rejected. ${data.reason || ''}`,
      icon: 'x-circle',
      priority: 'medium'
    },
    'load_assigned': {
      title: 'Driver Assigned',
      message: `Driver ${data.driverName} has been assigned to your load "${data.loadTitle}"`,
      icon: 'truck',
      priority: 'high'
    },
    'trip_started': {
      title: 'Trip Started',
      message: `${data.driverName} has started the trip for load "${data.loadTitle}"`,
      icon: 'play-circle',
      priority: 'high'
    },
    'delivery_completed': {
      title: 'Delivery Completed',
      message: `Your load "${data.loadTitle}" has been successfully delivered`,
      icon: 'check-circle',
      priority: 'high'
    },
    'load_cancelled': {
      title: 'Load Cancelled',
      message: `Load "${data.loadTitle}" has been cancelled. ${data.reason || ''}`,
      icon: 'x-circle',
      priority: 'medium'
    },
    'payment_required': {
      title: 'Payment Required',
      message: `Payment is required for completed load "${data.loadTitle}"`,
      icon: 'credit-card',
      priority: 'high'
    },
    'rating_request': {
      title: 'Rate Your Experience',
      message: `Please rate your experience with ${data.partnerName} for load "${data.loadTitle}"`,
      icon: 'star',
      priority: 'low'
    },
    'profile_update': {
      title: 'Profile Updated',
      message: 'Your profile has been successfully updated',
      icon: 'user',
      priority: 'low'
    },
    'verification_approved': {
      title: 'Verification Approved',
      message: 'Your account has been verified and approved',
      icon: 'shield-check',
      priority: 'high'
    },
    'verification_rejected': {
      title: 'Verification Rejected',
      message: `Your account verification was rejected. ${data.reason || 'Please contact support.'}`,
      icon: 'shield-x',
      priority: 'high'
    },
    'system_maintenance': {
      title: 'System Maintenance',
      message: `System maintenance scheduled for ${data.date}. ${data.details || ''}`,
      icon: 'settings',
      priority: 'medium'
    },
    'security_alert': {
      title: 'Security Alert',
      message: data.message || 'Unusual activity detected on your account',
      icon: 'alert-triangle',
      priority: 'high'
    }
  };

  const template = templates[type];
  if (!template) {
    return {
      title: 'Notification',
      message: data.message || 'You have a new notification',
      icon: 'bell',
      priority: 'medium'
    };
  }

  return template;
};

// @route   GET /api/notifications
// @desc    Get notifications for current user
// @access  Private
// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
router.get('/', corsHandler, auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('unread').optional().isBoolean().withMessage('Unread must be boolean')
], async (req, res) => {
  try {
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
      unread
    } = req.query;

    // Mock notifications for now (replace with real database queries later)
    const mockNotifications = [
      {
        _id: '1',
        type: 'bid_received',
        title: 'New Bid Received',
        message: 'You received a new bid on your load "Furniture Transport"',
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        relatedLoad: '507f1f77bcf86cd799439011',
        actionUrl: '/loads/507f1f77bcf86cd799439011'
      },
      {
        _id: '2', 
        type: 'load_assigned',
        title: 'Load Assigned',
        message: 'Your load "Electronics Delivery" has been assigned to a driver',
        isRead: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        relatedLoad: '507f1f77bcf86cd799439012',
        actionUrl: '/loads/507f1f77bcf86cd799439012'
      },
      {
        _id: '3',
        type: 'load_delivered',
        title: 'Load Delivered',
        message: 'Your load "Construction Materials" has been successfully delivered',
        isRead: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        relatedLoad: '507f1f77bcf86cd799439013',
        actionUrl: '/loads/507f1f77bcf86cd799439013'
      },
      {
        _id: '4',
        type: 'subscription_reminder',
        title: 'Subscription Reminder',
        message: 'Your Pro plan will renew in 3 days',
        isRead: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
        actionUrl: '/dashboard/subscription'
      }
    ];

    // Filter by unread status if specified
    let filteredNotifications = mockNotifications;
    if (unread !== undefined) {
      filteredNotifications = mockNotifications.filter(notif => 
        unread === 'true' ? !notif.isRead : notif.isRead
      );
    }

    // Apply pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedNotifications = filteredNotifications.slice(skip, skip + parseInt(limit));

    const totalNotifications = filteredNotifications.length;
    const totalPages = Math.ceil(totalNotifications / parseInt(limit));
    const unreadCount = mockNotifications.filter(n => !n.isRead).length;

    res.json({
      status: 'success',
      data: {
        notifications: paginatedNotifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalNotifications,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        summary: {
          total: mockNotifications.length,
          unread: unreadCount,
          read: mockNotifications.length - unreadCount
        }
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', corsHandler, auth, async (req, res) => {
  try {
    // For now, just return success
    // When you implement real notifications, update the notification in database
    res.json({
      status: 'success',
      message: 'Notification marked as read',
      data: {
        notificationId: req.params.id,
        isRead: true,
        readAt: new Date()
      }
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', corsHandler, auth, async (req, res) => {
  try {
    // For now, just return success
    // When you implement real notifications, update all user notifications in database
    res.json({
      status: 'success',
      message: 'All notifications marked as read',
      data: {
        updatedCount: 4, // Mock count
        readAt: new Date()
      }
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking all notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/notifications/mark-all-read
// @desc    Mark all notifications as read
// @access  Private
router.put('/mark-all-read', corsHandler, auth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const result = await notificationsCollection.updateMany(
      { 
        userId: new mongoose.Types.ObjectId(req.user.id),
        isRead: false
      },
      { 
        $set: { 
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    res.json({
      status: 'success',
      message: `${result.modifiedCount} notifications marked as read`
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', corsHandler, auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification ID'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const result = await notificationsCollection.deleteOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(req.user.id)
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
    console.error('Delete notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/notifications/send
// @desc    Send notification to user (admin only)
// @access  Private (Admin only)
router.post('/send', corsHandler, auth, [
  body('userId').notEmpty().isMongoId().withMessage('Valid user ID is required'),
  body('userType').isIn(['driver', 'cargo_owner', 'admin']).withMessage('Valid user type is required'),
  body('type').notEmpty().withMessage('Notification type is required'),
  body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required and cannot exceed 200 characters'),
  body('message').notEmpty().isLength({ max: 1000 }).withMessage('Message is required and cannot exceed 1000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('data').optional().isObject().withMessage('Data must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
      });
    }

    const {
      userId,
      userType,
      type,
      title,
      message,
      priority = 'medium',
      data = {},
      icon,
      actionUrl,
      expiresAt
    } = req.body;

    const notificationId = await createNotification({
      userId: new mongoose.Types.ObjectId(userId),
      userType,
      type,
      title,
      message,
      priority,
      data,
      icon: icon || 'bell',
      actionUrl,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      sentBy: new mongoose.Types.ObjectId(req.user.id)
    });

    if (!notificationId) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to send notification'
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Notification sent successfully',
      data: {
        notificationId
      }
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error sending notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/notifications/broadcast
// @desc    Send notification to multiple users (admin only)
// @access  Private (Admin only)
router.post('/broadcast', corsHandler, auth, [
  body('userType').optional().isIn(['driver', 'cargo_owner', 'all']).withMessage('Invalid user type'),
  body('userIds').optional().isArray().withMessage('User IDs must be an array'),
  body('type').notEmpty().withMessage('Notification type is required'),
  body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required and cannot exceed 200 characters'),
  body('message').notEmpty().isLength({ max: 1000 }).withMessage('Message is required and cannot exceed 1000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Admin privileges required.'
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
        userType: userType || 'driver' // Default to driver if not specified
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

    // Create notifications for all target users
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

// @route   GET /api/notifications/summary
// @desc    Get notification summary for current user
// @access  Private
router.get('/summary', corsHandler, auth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Get notification summary using aggregation
    const summary = await notificationsCollection.aggregate([
      {
        $match: {
          userId: userId,
          userType: req.user.userType
        }
      },
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
      {
        $match: {
          userId: userId,
          userType: req.user.userType,
          isRead: false
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();

    // Get recent notifications
    const recentNotifications = await notificationsCollection.find({
      userId: userId,
      userType: req.user.userType
    })
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
        recentNotifications
      }
    });

  } catch (error) {
    console.error('Get notification summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching notification summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Utility functions to be used by other routes
const notificationUtils = {
  createNotification,
  getNotificationTemplate,
  
  // Send notification for new bid
  sendNewBidNotification: async (loadOwnerId, bidData, loadData) => {
    const template = getNotificationTemplate('new_bid', {
      driverName: bidData.driverName,
      bidAmount: bidData.bidAmount,
      loadTitle: loadData.title
    });

    return await createNotification({
      userId: loadOwnerId,
      userType: 'cargo_owner',
      type: 'new_bid',
      title: template.title,
      message: template.message,
      priority: template.priority,
      icon: template.icon,
      data: {
        bidId: bidData.bidId,
        loadId: loadData.loadId,
        driverId: bidData.driverId
      },
      actionUrl: `/loads/${loadData.loadId}/bids`
    });
  },

  // Send notification for bid acceptance
  sendBidAcceptedNotification: async (driverId, bidData, loadData) => {
    const template = getNotificationTemplate('bid_accepted', {
      bidAmount: bidData.bidAmount,
      loadTitle: loadData.title
    });

    return await createNotification({
      userId: driverId,
      userType: 'driver',
      type: 'bid_accepted',
      title: template.title,
      message: template.message,
      priority: template.priority,
      icon: template.icon,
      data: {
        bidId: bidData.bidId,
        loadId: loadData.loadId
      },
      actionUrl: `/driver/trips/${loadData.loadId}`
    });
  },

  // Send notification for trip start
  sendTripStartedNotification: async (cargoOwnerId, driverName, loadData) => {
    const template = getNotificationTemplate('trip_started', {
      driverName,
      loadTitle: loadData.title
    });

    return await createNotification({
      userId: cargoOwnerId,
      userType: 'cargo_owner',
      type: 'trip_started',
      title: template.title,
      message: template.message,
      priority: template.priority,
      icon: template.icon,
      data: {
        loadId: loadData.loadId,
        driverId: loadData.driverId
      },
      actionUrl: `/loads/${loadData.loadId}/tracking`
    });
  }
};

module.exports = router;
module.exports.notificationUtils = notificationUtils;