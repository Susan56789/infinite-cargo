const mongoose = require('mongoose');

const LoadSchema = new mongoose.Schema({
  // Basic load information
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxLength: 100
  },
  description: { 
    type: String, 
    required: true,
    trim: true,
    maxLength: 1000
  },
  loadNumber: {
    type: String,
    unique: true,
    sparse: true // Allow multiple documents without this field
  },

  // Location details
  pickupLocation: { 
    type: String, 
    required: true,
    trim: true
  },
  deliveryLocation: { 
    type: String, 
    required: true,
    trim: true
  },
  pickupAddress: {
    type: String,
    trim: true
  },
  deliveryAddress: {
    type: String,
    trim: true
  },
  pickupCoordinates: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
  },
  deliveryCoordinates: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
  },
  distance: { 
    type: Number,
    min: 0
  },

  // Cargo details
  weight: { 
    type: Number,
    required: true,
    min: 0.1
  },
  cargoType: {
    type: String,
    enum: [
      'electronics', 'furniture', 'construction_materials', 'food_beverages',
      'textiles', 'machinery', 'medical_supplies', 'automotive_parts',
      'agricultural_products', 'chemicals', 'fragile_items', 'hazardous_materials',
      'livestock', 'containers', 'other'
    ],
    default: 'other'
  },
  
  // Vehicle requirements
  vehicleType: {
    type: String,
    enum: [
      'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck',
      'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
    ]
  },
  vehicleCapacityRequired: {
    type: Number,
    min: 0
  },

  // Financial details
  budget: { 
    type: Number,
    required: true,
    min: 100
  },

  // Scheduling
  pickupDate: {
    type: Date,
    required: true
  },
  deliveryDate: {
    type: Date,
    required: true
  },
  pickupTimeWindow: {
    type: String,
    trim: true
  },
  deliveryTimeWindow: {
    type: String,
    trim: true
  },
  biddingEndDate: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  },

  // Special requirements
  specialInstructions: {
    type: String,
    trim: true,
    maxLength: 1000
  },
  specialRequirements: {
    type: String,
    trim: true,
    maxLength: 500
  },
  isUrgent: { 
    type: Boolean, 
    default: false 
  },

  // Payment and insurance
  paymentTerms: {
    type: String,
    enum: ['immediate', 'on_delivery', '7_days', '14_days', '30_days'],
    default: 'on_delivery'
  },
  insuranceRequired: { 
    type: Boolean, 
    default: false 
  },
  insuranceValue: {
    type: Number,
    min: 0
  },

  // Contact information
  contactPerson: {
    type: String,
    trim: true
  },

  // References - FIXED: Use consistent collection names
  postedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', // Changed from 'cargo-owners' to 'User'
    required: true
  },
  assignedDriver: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' // Changed from 'drivers' to 'User'
  },
  acceptedBid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid'
  },

  // Status and lifecycle
  status: { 
    type: String,
    enum: [
      'posted', 'receiving_bids', 'driver_assigned', 'assigned', 
      'in_transit', 'delivered', 'cancelled', 'expired', 'on_hold'
    ],
    default: 'posted'
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  
  // Status history for tracking
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      trim: true
    },
    userRole: {
      type: String
    }
  }],

  // Subscription and boost features
  subscriptionPlan: { 
    type: String,
    enum: ['basic', 'pro', 'business'],
    default: 'basic'
  },
  isPriorityListing: { 
    type: Boolean, 
    default: false 
  },
  isBoosted: {
    type: Boolean,
    default: false
  },
  boostLevel: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  
  // Analytics
  viewCount: {
    type: Number,
    default: 0
  },

  // Timestamps for lifecycle events
  assignedAt: Date,
  startedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  expiredAt: Date,
  onHoldAt: Date,
  
  // Completion details
  completionNotes: {
    type: String,
    trim: true,
    maxLength: 1000
  },
  estimatedDeliveryTime: Date,
  actualDeliveryTime: Date,
  cancellationReason: {
    type: String,
    trim: true
  },
  onHoldReason: {
    type: String,
    trim: true
  },

  // System timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  // Schema options
  timestamps: true, // This will automatically handle createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
LoadSchema.index({ postedBy: 1, status: 1 });
LoadSchema.index({ status: 1, isActive: 1 });
LoadSchema.index({ createdAt: -1 });
LoadSchema.index({ pickupLocation: 'text', deliveryLocation: 'text', title: 'text', description: 'text' });
LoadSchema.index({ pickupDate: 1 });
LoadSchema.index({ budget: 1 });
LoadSchema.index({ cargoType: 1 });
LoadSchema.index({ vehicleType: 1 });
LoadSchema.index({ isUrgent: 1 });
LoadSchema.index({ isPriorityListing: 1, boostLevel: -1 });

// Virtual fields
LoadSchema.virtual('daysActive').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

LoadSchema.virtual('daysUntilPickup').get(function() {
  if (!this.pickupDate) return null;
  return Math.ceil((new Date(this.pickupDate) - new Date()) / (1000 * 60 * 60 * 24));
});

LoadSchema.virtual('isExpiringSoon').get(function() {
  const daysUntilPickup = this.daysUntilPickup;
  return daysUntilPickup !== null && daysUntilPickup <= 2 && daysUntilPickup >= 0;
});

// Pre-save middleware
LoadSchema.pre('save', function(next) {
  // Update the updatedAt field
  this.updatedAt = new Date();
  
  // Generate load number if not exists
  if (!this.loadNumber && this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.loadNumber = `LD${year}${month}${day}${random}`;
  }
  
  // Validate pickup date is before delivery date
  if (this.pickupDate && this.deliveryDate && this.pickupDate >= this.deliveryDate) {
    return next(new Error('Pickup date must be before delivery date'));
  }
  
  // Validate budget against bid amount if bid is accepted
  if (this.acceptedBid && this.status === 'assigned') {
    // This validation would need to be done with the bid data
  }
  
  next();
});

// Pre-update middleware
LoadSchema.pre('findOneAndUpdate', function() {
  this.set({ updatedAt: new Date() });
});

// Instance methods
LoadSchema.methods.canReceiveBids = function() {
  return this.isActive && ['posted', 'receiving_bids'].includes(this.status);
};

LoadSchema.methods.isOwnedBy = function(userId) {
  return this.postedBy.toString() === userId.toString();
};

LoadSchema.methods.addStatusChange = function(status, changedBy, reason = '', userRole = '') {
  this.statusHistory.push({
    status,
    changedBy,
    changedAt: new Date(),
    reason,
    userRole
  });
  this.status = status;
  return this.save();
};

// Static methods
LoadSchema.statics.findActiveLoads = function() {
  return this.find({ 
    isActive: true, 
    status: { $in: ['posted', 'receiving_bids'] } 
  });
};

LoadSchema.statics.findByOwner = function(ownerId, options = {}) {
  const query = { postedBy: ownerId };
  if (options.status) query.status = options.status;
  if (options.isActive !== undefined) query.isActive = options.isActive;
  
  return this.find(query);
};

// Export the model
module.exports = mongoose.model('Load', LoadSchema);