//models/subscription.js
// Subscription model for managing user subscriptions in the Infinite Cargo application

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  planId: {
    type: String,
    enum: ['basic', 'pro', 'business'],
    required: true,
    default: 'basic'
  },
  planName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'KES',
    enum: ['KES', 'USD', 'EUR']
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  duration: {
    type: Number, // days
    required: true
  },
  features: {
    maxLoads: {
      type: Number,
      default: 3 // -1 for unlimited
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    advancedAnalytics: {
      type: Boolean,
      default: false
    },
    bulkOperations: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    },
    dedicatedManager: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'expired', 'cancelled', 'rejected'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['mpesa', 'bank_transfer', 'card'],
    required: true
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  // Dates
  requestedAt: {
    type: Date,
    default: Date.now
  },
  activatedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  // Admin actions
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  approvedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: String,
  adminNotes: String,
  // Usage tracking
  usage: {
    loadsThisMonth: {
      type: Number,
      default: 0
    },
    lastUsageReset: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  collection: 'subscriptions'
});

// Indexes for better performance
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ status: 1, expiresAt: 1 });
subscriptionSchema.index({ createdAt: -1 });

// Virtual for checking if subscription is expired
subscriptionSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Virtual for remaining days
subscriptionSchema.virtual('remainingDays').get(function() {
  if (!this.expiresAt) return 0;
  const diff = this.expiresAt - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Method to check if user can create more loads
subscriptionSchema.methods.canCreateLoad = function() {
  // Unlimited loads
  if (this.features.maxLoads === -1) return true;
  
  // Check current usage
  return this.usage.loadsThisMonth < this.features.maxLoads;
};

// Method to increment usage
subscriptionSchema.methods.incrementUsage = async function() {
  // Reset usage if it's a new month
  const now = new Date();
  const lastReset = new Date(this.usage.lastUsageReset);
  
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.usage.loadsThisMonth = 0;
    this.usage.lastUsageReset = now;
  }
  
  this.usage.loadsThisMonth += 1;
  return this.save();
};

// Static method to create default free subscription
subscriptionSchema.statics.createFreeSubscription = async function(userId) {
  const freeSubscription = new this({
    userId,
    planId: 'basic',
    planName: 'Basic Plan',
    price: 0,
    duration: 30,
    features: {
      maxLoads: 3,
      prioritySupport: false,
      advancedAnalytics: false,
      bulkOperations: false,
      apiAccess: false,
      dedicatedManager: false
    },
    status: 'active',
    paymentMethod: 'mpesa', // Default
    paymentStatus: 'completed',
    activatedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  });
  
  return freeSubscription.save();
};

// Static method to get user's active subscription
subscriptionSchema.statics.getUserActiveSubscription = async function(userId) {
  return this.findOne({
    userId,
    status: 'active',
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null }
    ]
  });
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);
module.exports = { Subscription };