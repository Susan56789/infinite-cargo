// models/paymentMethod.js
const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  methodId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9_]+$/,
    maxlength: 30
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  enabled: {
    type: Boolean,
    required: true,
    default: true
  },
  details: {
    // For M-Pesa
    businessNumber: {
      type: String,
      trim: true
    },
    paybillNumber: {
      type: String,
      trim: true
    },
    accountName: {
      type: String,
      trim: true
    },
    
    // For Bank Transfer
    bankName: {
      type: String,
      trim: true
    },
    accountNumber: {
      type: String,
      trim: true
    },
    branchCode: {
      type: String,
      trim: true
    },
    swiftCode: {
      type: String,
      trim: true
    },
    
    // For Card payments (manual entry, no API keys)
    merchantName: {
      type: String,
      trim: true
    },
    merchantId: {
      type: String,
      trim: true
    },
    
    // For other payment methods
    phoneNumber: {
      type: String,
      trim: true,
      match: /^(\+254|0)[0-9]{9}$/
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    
    // Generic contact details
    contactPerson: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    
    // Additional custom details as key-value pairs
    customDetails: {
      type: Map,
      of: String,
      default: new Map()
    }
  },
  instructions: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  displayOrder: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    max: 100
  },
  minimumAmount: {
    type: Number,
    required: true,
    default: 1,
    min: 0
  },
  maximumAmount: {
    type: Number,
    required: true,
    default: 999999999,
    min: 1
  },
  processingFee: {
    type: Number,
    default: 0,
    min: 0
  },
  processingFeeType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed'
  },
  currency: {
    type: String,
    default: 'KES',
    enum: ['KES', 'USD', 'EUR', 'GBP'],
    uppercase: true
  },
  supportedCurrencies: [{
    type: String,
    enum: ['KES', 'USD', 'EUR', 'GBP'],
    uppercase: true
  }],
  processingTimeMinutes: {
    type: Number,
    default: 0,
    min: 0
  },
  availableHours: {
    start: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
      default: '00:00'
    },
    end: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
      default: '23:59'
    },
    timezone: {
      type: String,
      default: 'Africa/Nairobi'
    }
  },
  availableDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    lowercase: true
  }],
  requiresVerification: {
    type: Boolean,
    default: false
  },
  verificationInstructions: {
    type: String,
    trim: true
  },
  isManual: {
    type: Boolean,
    required: true,
    default: true // All payments are manually processed
  },
  adminSettings: {
    autoApprove: {
      type: Boolean,
      default: false
    },
    requiresApproval: {
      type: Boolean,
      default: true
    },
    notificationEmail: {
      type: String,
      trim: true,
      lowercase: true
    }
  },
  statistics: {
    totalTransactions: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    successfulTransactions: {
      type: Number,
      default: 0,
      min: 0
    },
    failedTransactions: {
      type: Number,
      default: 0,
      min: 0
    },
    lastTransactionDate: {
      type: Date
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'payment_methods'
});

// Indexes
paymentMethodSchema.index({ methodId: 1 });
paymentMethodSchema.index({ enabled: 1 });
paymentMethodSchema.index({ displayOrder: 1 });
paymentMethodSchema.index({ enabled: 1, displayOrder: 1 });

// Virtual for calculated processing fee
paymentMethodSchema.virtual('calculatedProcessingFee').get(function() {
  return function(amount) {
    if (this.processingFeeType === 'percentage') {
      return Math.round((amount * this.processingFee / 100) * 100) / 100; // Round to 2 decimal places
    }
    return this.processingFee;
  }.bind(this);
});

// Pre-save middleware
paymentMethodSchema.pre('save', function(next) {
  // Validate minimum and maximum amounts
  if (this.minimumAmount >= this.maximumAmount) {
    return next(new Error('Minimum amount must be less than maximum amount'));
  }
  
  // Ensure supported currencies includes the default currency
  if (this.currency && (!this.supportedCurrencies || this.supportedCurrencies.length === 0)) {
    this.supportedCurrencies = [this.currency];
  }
  
  // Ensure default days if not specified
  if (!this.availableDays || this.availableDays.length === 0) {
    this.availableDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  }
  
  next();
});

// Static methods
paymentMethodSchema.statics.getEnabledMethods = async function() {
  try {
    return await this.find({ enabled: true })
      .sort({ displayOrder: 1 })
      .select('-statistics -createdBy -updatedBy');
  } catch (error) {
    console.error('Error getting enabled payment methods:', error);
    return [];
  }
};

paymentMethodSchema.statics.getMethodById = async function(methodId) {
  try {
    return await this.findOne({ methodId: methodId.toLowerCase(), enabled: true });
  } catch (error) {
    console.error(`Error getting payment method ${methodId}:`, error);
    return null;
  }
};

paymentMethodSchema.statics.validateAmount = async function(methodId, amount) {
  try {
    const method = await this.getMethodById(methodId);
    if (!method) {
      return { valid: false, error: 'Payment method not found or disabled' };
    }
    
    if (amount < method.minimumAmount) {
      return { 
        valid: false, 
        error: `Minimum amount is ${method.currency} ${method.minimumAmount}` 
      };
    }
    
    if (amount > method.maximumAmount) {
      return { 
        valid: false, 
        error: `Maximum amount is ${method.currency} ${method.maximumAmount}` 
      };
    }
    
    return { valid: true, method };
  } catch (error) {
    console.error(`Error validating amount for ${methodId}:`, error);
    return { valid: false, error: 'Validation error' };
  }
};

// Instance methods
paymentMethodSchema.methods.calculateFee = function(amount) {
  if (this.processingFeeType === 'percentage') {
    return Math.round((amount * this.processingFee / 100) * 100) / 100;
  }
  return this.processingFee;
};

paymentMethodSchema.methods.getTotalAmount = function(amount) {
  return amount + this.calculateFee(amount);
};

paymentMethodSchema.methods.updateStatistics = async function(amount, success = true) {
  try {
    this.statistics.totalTransactions += 1;
    this.statistics.totalAmount += amount;
    this.statistics.lastTransactionDate = new Date();
    
    if (success) {
      this.statistics.successfulTransactions += 1;
    } else {
      this.statistics.failedTransactions += 1;
    }
    
    return await this.save();
  } catch (error) {
    console.error('Error updating payment method statistics:', error);
    throw error;
  }
};

paymentMethodSchema.methods.isAvailableNow = function() {
  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  // Check if current day is available
  if (!this.availableDays.includes(currentDay)) {
    return false;
  }
  
  // Check if current time is within available hours
  if (currentTime < this.availableHours.start || currentTime > this.availableHours.end) {
    return false;
  }
  
  return true;
};

// Transform function for JSON output
paymentMethodSchema.set('toJSON', {
  transform: function(doc, ret, options) {
    delete ret.__v;
    delete ret.createdBy;
    delete ret.updatedBy;
    if (!options.includeStatistics) {
      delete ret.statistics;
    }
    if (!options.includeAdminSettings) {
      delete ret.adminSettings;
    }
    return ret;
  }
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);