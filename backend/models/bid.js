const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  // Core Bid Information
  load: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Load',
    required: [true, 'Load reference is required'],
    index: true
  },
  
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Driver reference is required'],
    index: true
  },
  
  cargoOwner: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Cargo owner reference is required'],
    index: true
  },

  // Bid Details
  bidAmount: {
    type: Number,
    required: [true, 'Bid amount is required'],
    min: [1, 'Bid amount must be at least 1']
  },
  
  currency: {
    type: String,
    default: 'KES',
    enum: ['KES', 'USD', 'EUR']
  },

  proposedPickupDate: {
    type: Date,
    required: [true, 'Proposed pickup date is required']
  },
  
  proposedDeliveryDate: {
    type: Date,
    required: [true, 'Proposed delivery date is required']
  },

  // Driver's Message and Proposal
  message: {
    type: String,
    maxlength: [1000, 'Message cannot exceed 1000 characters'],
    trim: true
  },
  
  coverLetter: {
    type: String,
    maxlength: [2000, 'Cover letter cannot exceed 2000 characters'],
    trim: true
  },

  // Vehicle Information for this bid
  vehicleDetails: {
    type: {
      type: String,
      enum: [
        'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck', 
        'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
      ]
    },
    capacity: Number, // in tonnes
    year: Number,
    make: String,
    model: String,
    licensePlate: String,
    insuranceValid: { type: Boolean, default: true },
    specialFeatures: [String]
  },

  // Value-added Services
  additionalServices: [{
    service: {
      type: String,
      enum: [
        'loading_assistance',
        'unloading_assistance', 
        'packaging_materials',
        'insurance_coverage',
        'real_time_tracking',
        'photo_updates',
        'express_delivery',
        'weekend_delivery',
        'fragile_handling',
        'secure_transport'
      ]
    },
    cost: Number,
    description: String
  }],

  // Pricing Breakdown
  pricingBreakdown: {
    baseFare: Number,
    distanceFare: Number,
    weightSurcharge: Number,
    urgencySurcharge: Number,
    serviceFees: Number,
    taxes: Number,
    discount: Number,
    totalAmount: Number
  },

  // Terms and Conditions
  terms: {
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'mobile_money', 'check'],
      default: 'cash'
    },
    paymentTiming: {
      type: String,
      enum: ['upfront', 'on_pickup', 'on_delivery', '50_50_split'],
      default: 'on_delivery'
    },
    cancellationPolicy: String,
    specialTerms: String
  },

  // Bid Status
  status: {
    type: String,
    enum: [
      'submitted',
      'viewed',
      'under_review',
      'shortlisted',
      'accepted',
      'rejected',
      'withdrawn',
      'expired',
      'counter_offered'
    ],
    default: 'submitted',
    index: true
  },

  // Timeline
  submittedAt: {
    type: Date,
    default: Date.now
  },
  
  viewedAt: Date,
  
  respondedAt: Date,
  
  expiresAt: {
    type: Date,
    default: function() {
      // Bids expire after 7 days by default
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  },

  // Response from Cargo Owner
  response: {
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'counter_offered']
    },
    message: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Counter offer details
    counterOffer: {
      amount: Number,
      message: String,
      expiresAt: Date
    }
  },

  // Driver Information Snapshot (for historical purposes)
  driverInfo: {
    name: String,
    phone: String,
    email: String,
    location: String,
    rating: Number,
    totalTrips: Number,
    experienceYears: Number,
    isVerified: Boolean
  },

  // Load Information Snapshot
  loadInfo: {
    title: String,
    pickupLocation: String,
    deliveryLocation: String,
    weight: Number,
    budget: Number
  },

  // Bid Analytics
  analytics: {
    views: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    contactAttempts: { type: Number, default: 0 }
  },

  // Communication History
  communications: [{
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ['message', 'call', 'email'],
      default: 'message'
    },
    isRead: { type: Boolean, default: false }
  }],

  // Notifications
  notifications: {
    driverNotified: { type: Boolean, default: false },
    cargoOwnerNotified: { type: Boolean, default: false },
    reminderSent: { type: Boolean, default: false }
  },

  // System Fields
  isActive: {
    type: Boolean,
    default: true
  },
  
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },

  flags: [{
    type: {
      type: String,
      enum: ['spam', 'inappropriate', 'unrealistic_price', 'fake_profile']
    },
    flaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    flaggedAt: { type: Date, default: Date.now }
  }],

  // Version control
  version: {
    type: Number,
    default: 1
  },

  // Status change history
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for optimal queries
bidSchema.index({ load: 1, status: 1 });
bidSchema.index({ driver: 1, status: 1 });
bidSchema.index({ cargoOwner: 1, status: 1 });
bidSchema.index({ status: 1, submittedAt: -1 });
bidSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual fields
bidSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

bidSchema.virtual('daysRemaining').get(function() {
  if (!this.expiresAt) return null;
  const diffTime = this.expiresAt - new Date();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

bidSchema.virtual('isUrgent').get(function() {
  return this.daysRemaining && this.daysRemaining <= 1;
});

bidSchema.virtual('pricePerKm').get(function() {
  if (!this.load || !this.load.distance) return null;
  return (this.bidAmount / this.load.distance).toFixed(2);
});

bidSchema.virtual('competitiveness').get(function() {
  if (!this.load || !this.load.budget) return 'unknown';
  const percentage = (this.bidAmount / this.load.budget) * 100;
  if (percentage <= 80) return 'very_competitive';
  if (percentage <= 95) return 'competitive';
  if (percentage <= 105) return 'market_rate';
  if (percentage <= 120) return 'above_market';
  return 'expensive';
});

// Pre-save middleware
bidSchema.pre('save', function(next) {
  // Update status history when status changes
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }

  // Auto-expire old bids
  if (this.expiresAt && this.expiresAt < new Date() && this.status === 'submitted') {
    this.status = 'expired';
  }

  // Validate dates
  if (this.proposedPickupDate >= this.proposedDeliveryDate) {
    return next(new Error('Proposed delivery date must be after pickup date'));
  }

  next();
});

// Instance methods
bidSchema.methods.accept = function(acceptedBy) {
  this.status = 'accepted';
  this.response = {
    status: 'accepted',
    respondedAt: new Date(),
    respondedBy: acceptedBy
  };
  this.respondedAt = new Date();
  return this.save();
};

bidSchema.methods.reject = function(rejectedBy, reason) {
  this.status = 'rejected';
  this.response = {
    status: 'rejected',
    message: reason,
    respondedAt: new Date(),
    respondedBy: rejectedBy
  };
  this.respondedAt = new Date();
  return this.save();
};

bidSchema.methods.counterOffer = function(amount, message, expiresAt, counteredBy) {
  this.status = 'counter_offered';
  this.response = {
    status: 'counter_offered',
    message: message,
    respondedAt: new Date(),
    respondedBy: counteredBy,
    counterOffer: {
      amount: amount,
      message: message,
      expiresAt: expiresAt || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days default
    }
  };
  this.respondedAt = new Date();
  return this.save();
};

bidSchema.methods.withdraw = function() {
  this.status = 'withdrawn';
  return this.save();
};

bidSchema.methods.markAsViewed = function() {
  if (this.status === 'submitted') {
    this.status = 'viewed';
    this.viewedAt = new Date();
  }
  this.analytics.views += 1;
  return this.save();
};

bidSchema.methods.addCommunication = function(from, message, type = 'message') {
  this.communications.push({
    from: from,
    message: message,
    type: type,
    timestamp: new Date()
  });
  return this.save();
};

bidSchema.methods.canWithdraw = function() {
  return ['submitted', 'viewed', 'under_review'].includes(this.status);
};

bidSchema.methods.canAccept = function() {
  return ['submitted', 'viewed', 'under_review', 'shortlisted'].includes(this.status) && 
         !this.isExpired;
};

// Static methods
bidSchema.statics.getBidsByLoad = function(loadId, status = null) {
  const query = { load: loadId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('driver', 'name phone email location rating totalTrips experienceYears isVerified vehicleType vehicleCapacity')
    .sort({ bidAmount: 1, submittedAt: 1 });
};

bidSchema.statics.getBidsByDriver = function(driverId, status = null) {
  const query = { driver: driverId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('load', 'title pickupLocation deliveryLocation weight budget status pickupDate deliveryDate')
    .populate('cargoOwner', 'name location rating isVerified')
    .sort({ submittedAt: -1 });
};

bidSchema.statics.getBidsByCargoOwner = function(cargoOwnerId, status = null) {
  const query = { cargoOwner: cargoOwnerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('driver', 'name phone email location rating totalTrips experienceYears isVerified')
    .populate('load', 'title pickupLocation deliveryLocation weight budget')
    .sort({ submittedAt: -1 });
};

bidSchema.statics.getCompetitiveAnalysis = function(loadId) {
  return this.aggregate([
    { $match: { load: mongoose.Types.ObjectId(loadId), status: { $in: ['submitted', 'viewed', 'under_review'] } } },
    {
      $group: {
        _id: '$load',
        totalBids: { $sum: 1 },
        avgBid: { $avg: '$bidAmount' },
        minBid: { $min: '$bidAmount' },
        maxBid: { $max: '$bidAmount' },
        medianBid: {
          $percentile: {
            input: '$bidAmount',
            p: [0.5],
            method: 'approximate'
          }
        }
      }
    }
  ]);
};

const Bid = mongoose.model('Bid', bidSchema);

module.exports = Bid;