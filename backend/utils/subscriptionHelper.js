// utils/subscriptionHelper.js
const { Subscription } = require('../models/subscription');

class SubscriptionHelper {
  static async getUserSubscription(userId) {
    try {
      return await Subscription.getUserActiveSubscription(userId);
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      return null;
    }
  }
  
  static async canUserCreateLoad(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        // Create free subscription if none exists
        await Subscription.createFreeSubscription(userId);
        return { canCreate: true, remaining: 3 };
      }
      
      const canCreate = subscription.canCreateLoad();
      const remaining = subscription.features.maxLoads === -1 
        ? -1 
        : subscription.features.maxLoads - subscription.usage.loadsThisMonth;
      
      return { canCreate, remaining, subscription };
    } catch (error) {
      console.error('Error checking load creation permission:', error);
      return { canCreate: false, remaining: 0 };
    }
  }
  
  static async incrementUserUsage(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (subscription) {
        await subscription.incrementUsage();
      }
    } catch (error) {
      console.error('Error incrementing user usage:', error);
    }
  }
  
  static async getSubscriptionStats(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) return null;
      
      return {
        planName: subscription.planName,
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        remainingDays: subscription.remainingDays,
        usage: {
          current: subscription.usage.loadsThisMonth,
          limit: subscription.features.maxLoads,
          remaining: subscription.features.maxLoads === -1 
            ? -1 
            : subscription.features.maxLoads - subscription.usage.loadsThisMonth
        },
        features: subscription.features
      };
    } catch (error) {
      console.error('Error getting subscription stats:', error);
      return null;
    }
  }
}

module.exports = SubscriptionHelper;