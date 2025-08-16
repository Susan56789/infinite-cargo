// jobs/subscriptionManager.js - Cron jobs for subscription management
const cron = require('node-cron');
const mongoose = require('mongoose');
const { Subscription, Notification } = require('../models/subscription');

class SubscriptionManager {
  constructor() {
    this.jobs = new Map();
  }

  // Initialize all cron jobs
  init() {
    console.log('Initializing subscription management cron jobs...');
    
    // Run every hour to check for expired subscriptions
    this.scheduleJob('expire-subscriptions', '0 * * * *', this.expireSubscriptions.bind(this));
    
    // Run daily at 9 AM to send expiry reminders
    this.scheduleJob('expiry-reminders', '0 9 * * *', this.sendExpiryReminders.bind(this));
    
    // Run weekly on Monday at 10 AM to clean old notifications
    this.scheduleJob('cleanup-notifications', '0 10 * * 1', this.cleanupNotifications.bind(this));
    
    // Run monthly on 1st at 8 AM to generate subscription reports
    this.scheduleJob('monthly-reports', '0 8 1 * *', this.generateMonthlyReports.bind(this));

    console.log(`Scheduled ${this.jobs.size} subscription management jobs`);
  }

  // Schedule a cron job
  scheduleJob(name, schedule, task) {
    try {
      const job = cron.schedule(schedule, async () => {
        console.log(`Running subscription job: ${name} at ${new Date().toISOString()}`);
        try {
          await task();
          console.log(`Completed subscription job: ${name}`);
        } catch (error) {
          console.error(`Error in subscription job ${name}:`, error);
        }
      }, {
        scheduled: false
      });

      this.jobs.set(name, job);
      job.start();
      
      console.log(`Scheduled subscription job: ${name} with schedule: ${schedule}`);
    } catch (error) {
      console.error(`Failed to schedule job ${name}:`, error);
    }
  }

  // Expire overdue subscriptions
  async expireSubscriptions() {
    try {
      const db = mongoose.connection.db;
      const subscriptionsCollection = db.collection('subscriptions');
      const usersCollection = db.collection('users');
      const notificationsCollection = db.collection('notifications');

      const now = new Date();
      
      // Find subscriptions that should be expired
      const expiredSubscriptions = await subscriptionsCollection.find({
        status: 'active',
        expiresAt: { $lt: now }
      }).toArray();

      if (expiredSubscriptions.length === 0) {
        console.log('No subscriptions to expire');
        return;
      }

      console.log(`Found ${expiredSubscriptions.length} subscriptions to expire`);

      for (const subscription of expiredSubscriptions) {
        try {
          // Update subscription status
          await subscriptionsCollection.updateOne(
            { _id: subscription._id },
            {
              $set: {
                status: 'expired',
                updatedAt: now
              }
            }
          );

          // Update user's subscription status
          await usersCollection.updateOne(
            { _id: subscription.userId },
            {
              $set: {
                subscriptionStatus: 'expired',
                subscriptionPlan: 'basic',
                updatedAt: now
              }
            }
          );

          // Create expiry notification
          await notificationsCollection.insertOne({
            userId: subscription.userId,
            userType: 'cargo_owner',
            type: 'subscription_expired',
            title: 'Subscription Expired',
            message: `Your ${subscription.planName} subscription has expired. Upgrade to continue using premium features.`,
            data: {
              subscriptionId: subscription._id,
              planName: subscription.planName,
              expiredAt: now
            },
            isRead: false,
            priority: 'high',
            actionRequired: true,
            actionUrl: '/pricing',
            createdAt: now
          });

          console.log(`Expired subscription ${subscription._id} for user ${subscription.userId}`);
        } catch (error) {
          console.error(`Error expiring subscription ${subscription._id}:`, error);
        }
      }

      console.log(`Successfully expired ${expiredSubscriptions.length} subscriptions`);
    } catch (error) {
      console.error('Error in expireSubscriptions job:', error);
    }
  }

  // Send expiry reminder notifications
  async sendExpiryReminders() {
    try {
      const db = mongoose.connection.db;
      const subscriptionsCollection = db.collection('subscriptions');
      const notificationsCollection = db.collection('notifications');

      const now = new Date();
      
      // Find subscriptions expiring in 3 days, 7 days, and 14 days
      const reminderDays = [3, 7, 14];
      
      for (const days of reminderDays) {
        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + days);
        
        // Get start and end of the reminder day
        const dayStart = new Date(reminderDate);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(reminderDate);
        dayEnd.setHours(23, 59, 59, 999);

        const expiringSubscriptions = await subscriptionsCollection.find({
          status: 'active',
          expiresAt: {
            $gte: dayStart,
            $lte: dayEnd
          }
        }).toArray();

        for (const subscription of expiringSubscriptions) {
          try {
            // Check if reminder already sent for this period
            const existingReminder = await notificationsCollection.findOne({
              userId: subscription.userId,
              type: 'subscription_reminder',
              'data.subscriptionId': subscription._id,
              'data.daysRemaining': days,
              createdAt: {
                $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            });

            if (!existingReminder) {
              await notificationsCollection.insertOne({
                userId: subscription.userId,
                userType: 'cargo_owner',
                type: 'subscription_reminder',
                title: `Subscription Expires in ${days} Days`,
                message: `Your ${subscription.planName} subscription expires on ${subscription.expiresAt.toLocaleDateString()}. Renew now to avoid service interruption.`,
                data: {
                  subscriptionId: subscription._id,
                  planName: subscription.planName,
                  daysRemaining: days,
                  expiresAt: subscription.expiresAt
                },
                isRead: false,
                priority: days <= 3 ? 'high' : 'medium',
                actionRequired: true,
                actionUrl: '/pricing',
                createdAt: now
              });

              console.log(`Sent ${days}-day reminder for subscription ${subscription._id}`);
            }
          } catch (error) {
            console.error(`Error sending reminder for subscription ${subscription._id}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Error in sendExpiryReminders job:', error);
    }
  }

  // Clean up old notifications (older than 90 days)
  async cleanupNotifications() {
    try {
      const db = mongoose.connection.db;
      const notificationsCollection = db.collection('notifications');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // 90 days ago

      const result = await notificationsCollection.deleteMany({
        createdAt: { $lt: cutoffDate },
        isRead: true // Only delete read notifications
      });

      console.log(`Cleaned up ${result.deletedCount} old notifications`);
    } catch (error) {
      console.error('Error in cleanupNotifications job:', error);
    }
  }

  // Generate monthly subscription reports
  async generateMonthlyReports() {
    try {
      const db = mongoose.connection.db;
      const subscriptionsCollection = db.collection('subscriptions');
      
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Generate report data
      const report = await subscriptionsCollection.aggregate([
        {
          $match: {
            createdAt: {
              $gte: lastMonth,
              $lt: thisMonth
            }
          }
        },
        {
          $group: {
            _id: null,
            totalSubscriptions: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$paymentStatus', 'completed'] },
                  '$price',
                  0
                ]
              }
            },
            planBreakdown: {
              $push: {
                planId: '$planId',
                price: '$price',
                status: '$status'
              }
            }
          }
        }
      ]).toArray();

      if (report.length > 0) {
        const reportData = report[0];
        
        // Count plans
        const planCounts = {};
        reportData.planBreakdown.forEach(item => {
          if (!planCounts[item.planId]) {
            planCounts[item.planId] = { count: 0, revenue: 0 };
          }
          planCounts[item.planId].count++;
          if (item.status === 'active' || item.status === 'expired') {
            planCounts[item.planId].revenue += item.price;
          }
        });

        // Create admin notification with report
        const notificationsCollection = db.collection('notifications');
        await notificationsCollection.insertOne({
          userType: 'admin',
          type: 'system_update',
          title: 'Monthly Subscription Report',
          message: `Monthly subscription report for ${lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          data: {
            period: {
              start: lastMonth,
              end: thisMonth
            },
            summary: {
              totalSubscriptions: reportData.totalSubscriptions,
              totalRevenue: reportData.totalRevenue,
              planBreakdown: planCounts
            }
          },
          isRead: false,
          priority: 'medium',
          createdAt: now
        });

        console.log(`Generated monthly report: ${reportData.totalSubscriptions} subscriptions, KES ${reportData.totalRevenue} revenue`);
      }

    } catch (error) {
      console.error('Error in generateMonthlyReports job:', error);
    }
  }

  // Manual method to process pending subscriptions (can be called by admin)
  async processPendingSubscriptions() {
    try {
      const db = mongoose.connection.db;
      const subscriptionsCollection = db.collection('subscriptions');

      const pendingSubscriptions = await subscriptionsCollection.find({
        status: 'pending',
        createdAt: {
          $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Older than 24 hours
        }
      }).toArray();

      console.log(`Found ${pendingSubscriptions.length} pending subscriptions older than 24 hours`);
      return pendingSubscriptions;
    } catch (error) {
      console.error('Error in processPendingSubscriptions:', error);
      return [];
    }
  }

  // Stop a specific job
  stopJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      console.log(`Stopped subscription job: ${name}`);
    }
  }

  // Stop all jobs
  stopAll() {
    console.log('Stopping all subscription management jobs...');
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`Stopped job: ${name}`);
    }
    this.jobs.clear();
  }

  // Get job status
  getJobStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running || false,
        scheduled: true
      };
    }
    return status;
  }

  // Manual subscription expiry check (for testing)
  async manualExpiryCheck() {
    console.log('Running manual subscription expiry check...');
    await this.expireSubscriptions();
    await this.sendExpiryReminders();
    console.log('Manual expiry check completed');
  }
}

// Singleton instance
const subscriptionManager = new SubscriptionManager();

module.exports = subscriptionManager;

// Usage in main app file (app.js or server.js):
/*
const subscriptionManager = require('./jobs/subscriptionManager');

// Initialize cron jobs when server starts
subscriptionManager.init();

// Gracefully stop jobs when server shuts down
process.on('SIGTERM', () => {
  console.log('SIGTERM received, stopping subscription jobs...');
  subscriptionManager.stopAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, stopping subscription jobs...');
  subscriptionManager.stopAll();
  process.exit(0);
});
*/

// Additional utility functions for subscription management

// Check user's subscription limits
async function checkUserSubscriptionLimits(userId) {
  try {
    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');
    const loadsCollection = db.collection('loads');

    const subscription = await subscriptionsCollection.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      status: 'active',
      expiresAt: { $gt: new Date() }
    });

    if (!subscription) {
      return {
        plan: 'basic',
        maxLoads: 3,
        currentLoads: 0,
        canCreateLoad: true,
        features: {
          maxLoads: 3,
          prioritySupport: false,
          advancedAnalytics: false,
          bulkOperations: false
        }
      };
    }

    // Count current month's loads
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const currentLoads = await loadsCollection.countDocuments({
      postedBy: new mongoose.Types.ObjectId(userId),
      createdAt: { $gte: currentMonthStart }
    });

    const canCreateLoad = subscription.features.maxLoads === -1 || 
                         currentLoads < subscription.features.maxLoads;

    return {
      plan: subscription.planId,
      maxLoads: subscription.features.maxLoads,
      currentLoads: currentLoads,
      canCreateLoad: canCreateLoad,
      features: subscription.features,
      expiresAt: subscription.expiresAt,
      daysRemaining: Math.ceil((new Date(subscription.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
    };

  } catch (error) {
    console.error('Error checking user subscription limits:', error);
    return {
      plan: 'basic',
      maxLoads: 3,
      currentLoads: 0,
      canCreateLoad: true,
      features: { maxLoads: 3, prioritySupport: false }
    };
  }
}

module.exports = {
  subscriptionManager,
  checkUserSubscriptionLimits
};