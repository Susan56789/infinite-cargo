// routes/adminNotifications.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { adminAuth } = require('../middleware/adminAuth');
const User = require('../models/user');

// ================================
// GET / → Fetch all notifications addressed to admin
// ================================
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

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================================
// GET /summary → Count + unread
// ================================
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

    res.json({ summary: { total, unread } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================================
// PATCH /:userId/:notifId/read → Mark single notification as read
// ================================
router.patch('/:userId/:notifId/read', adminAuth, async (req, res) => {
  try {
    const { userId, notifId } = req.params;

    const user = await User.findOneAndUpdate(
      { _id: userId, "notifications._id": notifId, "notifications.target": "admin" },
      { $set: { "notifications.$.isRead": true } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================================
// PATCH /mark-all-read → Mark all as read
// ================================
router.patch('/mark-all-read', adminAuth, async (req, res) => {
  try {
    await User.updateMany(
      { "notifications.target": "admin", "notifications.isRead": false },
      { $set: { "notifications.$[elem].isRead": true } },
      { arrayFilters: [{ "elem.target": "admin", "elem.isRead": false }] }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================================
// DELETE /:userId/:notifId → Delete one
// ================================
router.delete('/:userId/:notifId', adminAuth, async (req, res) => {
  try {
    const { userId, notifId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { notifications: { _id: notifId, target: 'admin' } } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================================
// POST /broadcast → Send to all admins
// ================================
router.post(
  '/broadcast',
  adminAuth,
  body('message').notEmpty().withMessage('Message is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { message } = req.body;

      await User.updateMany(
        {},
        {
          $push: {
            notifications: {
              _id: new mongoose.Types.ObjectId(),
              message,
              isRead: false,
              target: 'admin',
              createdAt: new Date()
            }
          }
        }
      );

      res.json({ message: 'Broadcast sent to all admins' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
