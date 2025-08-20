const express = require('express');
const router = express.Router();
const { adminAuth} = require('../middleware/adminAuth');
const User = require('../models/user');

/**
 * GET /api/admin/notifications
 * Fetch all notifications addressed to admin
 */
router.get('/', adminAuth, async (req, res) => {
  try {
    const users = await User.find(
      { "notifications.target": "admin" },
      { notifications: 1, email: 1 }
    );

    const notifications = users.flatMap(user =>
      user.notifications
        .filter(n => n.target === 'admin')
        .map(n => ({
          ...n.toObject(),
          userId: user._id,
          userEmail: user.email
        }))
    );

    res.json({ status: 'success', count: notifications.length, notifications });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /api/admin/notifications/summary
 * Fetch total + unread counts
 */
router.get('/summary', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ "notifications.target": "admin" }, { notifications: 1 });

    let total = 0;
    let unread = 0;

    users.forEach(user => {
      user.notifications.forEach(n => {
        if (n.target === 'admin') {
          total++;
          if (!n.isRead) unread++;
        }
      });
    });

    res.json({ status: 'success', total, unread });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * PATCH /api/admin/notifications/:userId/:notifId/read
 * Mark a single notification as read
 */
router.patch('/:userId/:notifId/read', adminAuth, async (req, res) => {
  try {
    const { userId, notifId } = req.params;

    const user = await User.findOneAndUpdate(
      { _id: userId, "notifications.id": notifId },
      { $set: { "notifications.$.isRead": true } },
      { new: true }
    );

    if (!user) return res.status(404).json({ status: 'error', message: 'Notification not found' });

    res.json({ status: 'success', message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * PATCH /api/admin/notifications/mark-all-read
 * Mark all admin notifications as read
 */
router.patch('/mark-all-read', adminAuth, async (req, res) => {
  try {
    await User.updateMany(
      { "notifications.target": "admin", "notifications.isRead": false },
      { $set: { "notifications.$[elem].isRead": true } },
      { arrayFilters: [{ "elem.target": "admin", "elem.isRead": false }] }
    );

    res.json({ status: 'success', message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * DELETE /api/admin/notifications/:userId/:notifId
 * Delete a notification
 */
router.delete('/:userId/:notifId', adminAuth, async (req, res) => {
  try {
    const { userId, notifId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { notifications: { id: notifId, target: "admin" } } },
      { new: true }
    );

    if (!user) return res.status(404).json({ status: 'error', message: 'Notification not found' });

    res.json({ status: 'success', message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /api/admin/notifications/broadcast
 * Send a broadcast notification to all users
 */
router.post('/broadcast', adminAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ status: 'error', message: 'Message is required' });
    }

    const notification = {
      id: new Date().getTime().toString(),
      message,
      type: 'system',
      target: 'user',
      isRead: false,
      createdAt: new Date()
    };

    await User.updateMany({}, { $push: { notifications: notification } });

    res.json({ status: 'success', message: 'Broadcast sent to all users' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
