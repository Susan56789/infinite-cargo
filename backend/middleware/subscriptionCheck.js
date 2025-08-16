// middleware/subscriptionCheck.js - Check subscription limits
const mongoose = require('mongoose');

const SubscriptionHelper = require('../utils/subscriptionHelper');

const checkLoadLimit = async (req, res, next) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return next(); // Only check for cargo owners
    }
    
    const { canCreate, remaining, subscription } = await SubscriptionHelper.canUserCreateLoad(req.user.id);
    
    if (!canCreate) {
      return res.status(403).json({
        status: 'error',
        message: 'Load limit exceeded for your current plan',
        data: {
          currentPlan: subscription?.planName || 'Basic Plan',
          limitReached: true,
          upgradeRequired: true
        }
      });
    }
    
    // Add subscription info to request
    req.subscription = subscription;
    req.loadLimitInfo = { canCreate, remaining };
    
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    // Allow request to continue on error
    next();
  }
};
const checkSubscriptionLimits = async (req, res, next) => {
  try {
    // Only apply to cargo owners
    if (req.user.userType !== 'cargo_owner') {
      return next();
    }

    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');
    const loadsCollection = db.collection('loads');

    // Get current active subscription
    const subscription = await subscriptionsCollection.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: 'active',
      expiresAt: { $gt: new Date() }
    });

    // If no active subscription, default to basic limits
    let maxLoads = 3; // Basic plan default
    let features = {
      maxLoads: 3,
      prioritySupport: false,
      advancedAnalytics: false,
      bulkOperations: false
    };

    if (subscription) {
      maxLoads = subscription.features.maxLoads;
      features = subscription.features;
    }

    // For unlimited plans (-1), skip count check
    if (maxLoads !== -1) {
      // Count loads posted this month
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);

      const monthlyLoads = await loadsCollection.countDocuments({
        postedBy: new mongoose.Types.ObjectId(req.user.id),
        createdAt: { $gte: currentMonthStart }
      });

      if (monthlyLoads >= maxLoads) {
        return res.status(403).json({
          status: 'error',
          message: 'Monthly load posting limit exceeded. Please upgrade your subscription plan.',
          data: {
            currentLoads: monthlyLoads,
            maxLoads: maxLoads,
            subscriptionPlan: subscription?.planId || 'basic'
          }
        });
      }
    }

    // Add subscription info to request for use in controllers
    req.subscription = {
      isActive: !!subscription,
      plan: subscription?.planId || 'basic',
      features: features,
      remainingLoads: maxLoads === -1 ? -1 : Math.max(0, maxLoads - (await loadsCollection.countDocuments({
        postedBy: new mongoose.Types.ObjectId(req.user.id),
        createdAt: { 
          $gte: (() => {
            const start = new Date();
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            return start;
          })()
        }
      })))
    };

    next();

  } catch (error) {
    console.error('Subscription check error:', error);
    // Don't block request on error, just log and continue
    req.subscription = {
      isActive: false,
      plan: 'basic',
      features: { maxLoads: 3, prioritySupport: false },
      remainingLoads: 3
    };
    next();
  }
};

// Middleware to check specific feature access
const checkFeatureAccess = (featureName) => {
  return (req, res, next) => {
    if (req.user.userType !== 'cargo_owner') {
      return next();
    }

    const hasFeature = req.subscription?.features?.[featureName];
    
    if (!hasFeature) {
      return res.status(403).json({
        status: 'error',
        message: `This feature requires a higher subscription plan. Current plan: ${req.subscription?.plan || 'basic'}`,
        data: {
          requiredFeature: featureName,
          currentPlan: req.subscription?.plan || 'basic'
        }
      });
    }

    next();
  };
};

module.exports = {
  checkSubscriptionLimits,
  checkFeatureAccess, 
  checkLoadLimit
};