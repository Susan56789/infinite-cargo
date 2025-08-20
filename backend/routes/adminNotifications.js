// routes/adminNotifications.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const { adminAuth } = require('../middleware/adminAuth');
const corsHandler = require('../middleware/corsHandler');

router.use(corsHandler);

// ================================
// GET / → Fetch all notifications addressed to admin with pagination
// ================================
router.get('/', adminAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('unread').optional().isBoolean().withMessage('Unread must be boolean'),
  query('type').optional().isString().withMessage('Type must be a string')
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
      unread,
      type
    } = req.query;

    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    // Build query filter for admin notifications
    const matchQuery = {
      userType: 'admin'
    };

    // Add unread filter if specified
    if (unread !== undefined) {
      matchQuery.isRead = unread === 'true' ? false : true;
    }

    // Add type filter if specified
    if (type) {
      matchQuery.type = type;
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
      userType: 'admin',
      isRead: false
    });

    // Format notifications for response
    const formattedNotifications = notifications.map(notif => ({
      _id: notif._id,
      type: notif.type,
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
      // Include user info if it exists in the data
      userId: notif.userId || (notif.data && notif.data.userId) || null,
      userEmail: notif.data && notif.data.userEmail || null,
      userName: notif.data && notif.data.userName || null
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
      message: 'Server error fetching admin notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ================================
// GET /summary → Count + unread + type breakdown
// ================================
router.get('/summary', adminAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    // Get notification summary using aggregation
    const summary = await notificationsCollection.aggregate([
      {
        $match: {
          userType: 'admin'
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

    // Get type breakdown for unread notifications
    const typeBreakdown = await notificationsCollection.aggregate([
      {
        $match: {
          userType: 'admin',
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
      userType: 'admin'
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
        recentNotifications: recentNotifications.map(notif => ({
          _id: notif._id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          priority: notif.priority || 'medium',
          isRead: notif.isRead,
          createdAt: notif.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Get admin notification summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching admin notification summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ================================
// PUT /:id/read → Mark single notification as read
// ================================
router.put('/:id/read', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate notification ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification ID'
      });
    }

    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    // Update the notification
    const result = await notificationsCollection.updateOne(
      { 
        _id: new mongoose.Types.ObjectId(id),
        userType: 'admin'
      },
      { 
        $set: { 
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin notification not found'
      });
    }

    if (result.modifiedCount === 0) {
      // Notification was already read
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
      message: 'Admin notification marked as read',
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
      message: 'Server error marking admin notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ================================
// PUT /read-all → Mark all admin notifications as read
// ================================
router.put('/read-all', adminAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const result = await notificationsCollection.updateMany(
      { 
        userType: 'admin',
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
      message: `${result.modifiedCount} admin notifications marked as read`,
      data: {
        updatedCount: result.modifiedCount,
        readAt: new Date()
      }
    });

  } catch (error) {
    console.error('Mark all admin notifications read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking all admin notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ================================
// DELETE /:id → Delete single admin notification
// ================================
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification ID'
      });
    }

    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const result = await notificationsCollection.deleteOne({
      _id: new mongoose.Types.ObjectId(id),
      userType: 'admin'
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin notification not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Admin notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete admin notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting admin notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ================================
// DELETE /clear-all → Delete all admin notifications
// ================================
router.delete('/clear-all', adminAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const result = await notificationsCollection.deleteMany({
      userType: 'admin'
    });

    res.json({
      status: 'success',
      message: `${result.deletedCount} admin notifications deleted`,
      data: {
        deletedCount: result.deletedCount
      }
    });

  } catch (error) {
    console.error('Clear all admin notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error clearing admin notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ================================
// PUT /bulk-read → Mark multiple admin notifications as read
// ================================
router.put('/bulk-read', adminAuth, [
  body('notificationIds')
    .isArray({ min: 1 })
    .withMessage('Notification IDs array is required')
    .custom((ids) => {
      return ids.every(id => mongoose.Types.ObjectId.isValid(id));
    })
    .withMessage('All notification IDs must be valid')
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

    const { notificationIds } = req.body;
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const objectIds = notificationIds.map(id => new mongoose.Types.ObjectId(id));

    const result = await notificationsCollection.updateMany(
      { 
        _id: { $in: objectIds },
        userType: 'admin',
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
      message: `${result.modifiedCount} admin notifications marked as read`,
      data: {
        requestedCount: notificationIds.length,
        updatedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Bulk read admin notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking admin notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ================================
// DELETE /bulk-delete → Delete multiple admin notifications
// ================================
router.delete('/bulk-delete', adminAuth, [
  body('notificationIds')
    .isArray({ min: 1 })
    .withMessage('Notification IDs array is required')
    .custom((ids) => {
      return ids.every(id => mongoose.Types.ObjectId.isValid(id));
    })
    .withMessage('All notification IDs must be valid')
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

    const { notificationIds } = req.body;
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const objectIds = notificationIds.map(id => new mongoose.Types.ObjectId(id));

    const result = await notificationsCollection.deleteMany({
      _id: { $in: objectIds },
      userType: 'admin'
    });

    res.json({
      status: 'success',
      message: `${result.deletedCount} admin notifications deleted`,
      data: {
        requestedCount: notificationIds.length,
        deletedCount: result.deletedCount
      }
    });

  } catch (error) {
    console.error('Bulk delete admin notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting admin notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ================================
// GET /types → Get available notification types for admin
// ================================
router.get('/types', adminAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    // Get distinct notification types for admin
    const types = await notificationsCollection.distinct('type', {
      userType: 'admin'
    });

    res.json({
      status: 'success',
      data: {
        types: types.sort()
      }
    });

  } catch (error) {
    console.error('Get admin notification types error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching admin notification types',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Utility function to create admin notifications (can be used by other modules)
const createAdminNotification = async (notificationData) => {
  try {
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const notification = {
      ...notificationData,
      userType: 'admin',
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

module.exports = router;
module.exports.createAdminNotification = createAdminNotification;