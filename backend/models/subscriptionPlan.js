// models/subscriptionPlan.js
const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9_]+$/,
    maxlength: 30,
    enum: ['basic', 'pro', 'business']
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'KES',
    enum: ['KES', 'USD', 'EUR', 'GBP'],
    uppercase: true
  },
  duration: {
    type: Number, // in days
    required: true,
    min: 1,
    default: 30
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  features: {
    maxLoads: {
      type: Number,
      required: true,
      default: 0 // -1 for unlimited
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
  isActive: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0,
    min: 0
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  targetAudience: {
    type: String,
    enum: ['individual', 'small_business', 'enterprise', 'all'],
    default: 'all'
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true,
  collection: 'subscription_plans'
});

// Indexes for better performance
subscriptionPlanSchema.index({ planId: 1 }, { unique: true });
subscriptionPlanSchema.index({ isActive: 1 });
subscriptionPlanSchema.index({ isVisible: 1 });
subscriptionPlanSchema.index({ displayOrder: 1 });
subscriptionPlanSchema.index({ isActive: 1, isVisible: 1, displayOrder: 1 });
subscriptionPlanSchema.index({ price: 1 });
subscriptionPlanSchema.index({ targetAudience: 1 });
subscriptionPlanSchema.index({ validFrom: 1, validUntil: 1 });
subscriptionPlanSchema.index({ isPopular: 1 });

// Virtual for checking if plan is currently valid
subscriptionPlanSchema.virtual('isCurrentlyValid').get(function() {
  const now = new Date();
  const validFrom = this.validFrom || new Date(0);
  const validUntil = this.validUntil || new Date('9999-12-31');
  
  return now >= validFrom && now <= validUntil;
});

// Virtual for formatted price
subscriptionPlanSchema.virtual('formattedPrice').get(function() {
  if (this.price === 0) {
    return 'Free';
  }
  
  const formatter = new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: this.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  
  return formatter.format(this.price);
});

// Static method to get active plans
subscriptionPlanSchema.statics.getActivePlans = async function() {
  return this.find({
    isActive: true,
    isVisible: true,
    $or: [
      { validUntil: { $exists: false } },
      { validUntil: { $gte: new Date() } }
    ]
  }).sort({ displayOrder: 1, price: 1 });
};

// Static method to get plan by ID
subscriptionPlanSchema.statics.getPlanById = async function(planId) {
  return this.findOne({
    planId: planId.toLowerCase(),
    isActive: true,
    $or: [
      { validUntil: { $exists: false } },
      { validUntil: { $gte: new Date() } }
    ]
  });
};

// Instance method to validate plan for user
subscriptionPlanSchema.methods.isValidForUser = function(userType = 'individual') {
  if (!this.isActive || !this.isVisible) return false;
  if (!this.isCurrentlyValid) return false;
  if (this.targetAudience !== 'all' && this.targetAudience !== userType) return false;
  
  return true;
};

// Pre-save middleware
subscriptionPlanSchema.pre('save', function(next) {
  // Ensure only one plan can be marked as popular per target audience
  if (this.isPopular && this.isModified('isPopular')) {
    this.constructor.updateMany(
      { 
        targetAudience: this.targetAudience,
        _id: { $ne: this._id }
      },
      { $set: { isPopular: false } }
    ).exec();
  }
  
  // Validate date ranges
  if (this.validUntil && this.validFrom && this.validUntil <= this.validFrom) {
    return next(new Error('Valid until date must be after valid from date'));
  }
  
  next();
});

// Transform function for JSON output
subscriptionPlanSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret, options) {
    delete ret.__v;
    delete ret.id; // Remove the virtual id field
    return ret;
  }
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);