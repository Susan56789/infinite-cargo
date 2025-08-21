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

  
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Multiple ways to store cargo owner name for reliability
  cargoOwnerName: {
    type: String,
    required: true,
    default: 'Anonymous',
    trim: true,
    maxlength: 100
  },
  
  postedByName: {
    type: String,
    required: true,
    default: 'Anonymous',
    trim: true,
    maxlength: 100
  },
  
  // Enhanced contact information
  contactPerson: {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      default: function() {
        return this.cargoOwnerName || 'Anonymous';
      }
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100
    }
  },
  
  // Metadata for tracking
  createdBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userType: {
      type: String,
      enum: ['cargo_owner', 'driver', 'admin'],
      default: 'cargo_owner'
    },
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Anonymous'
    }
  },
  assignedDriver: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
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
  timestamps: true, 
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

// Complete Pre-save middleware for Load model
LoadSchema.pre('save', async function(next) {
  try {
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
      
      // Ensure load number is unique
      let counter = 0;
      while (counter < 10) { // Prevent infinite loop
        const existingLoad = await this.constructor.findOne({ loadNumber: this.loadNumber });
        if (!existingLoad) break;
        
        // Generate new random number if collision
        const newRandom = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.loadNumber = `LD${year}${month}${day}${newRandom}`;
        counter++;
      }
    }
    
    // Validate pickup date is before delivery date
    if (this.pickupDate && this.deliveryDate && this.pickupDate >= this.deliveryDate) {
      return next(new Error('Pickup date must be before delivery date'));
    }
    
    // Ensure cargo owner name is set
    if (!this.cargoOwnerName || this.cargoOwnerName.trim() === '' || this.cargoOwnerName === 'Anonymous') {
      try {
        const User = this.constructor.db.model('User');
        const user = await User.findById(this.postedBy).lean();
        
        if (user) {
          const possibleNames = [
            user.cargoOwnerProfile?.companyName,
            user.companyName,
            user.profile?.companyName,
            user.businessProfile?.companyName,
            user.name,
            user.fullName,
            user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null,
            user.email?.split('@')[0]
          ];

          for (const name of possibleNames) {
            if (name && typeof name === 'string' && name.trim().length > 0) {
              this.cargoOwnerName = name.trim();
              this.postedByName = name.trim();
              break;
            }
          }
        }
      } catch (userFetchError) {
        console.warn('Could not fetch user for cargo owner name:', userFetchError.message);
      }
    }

    // Ensure postedByName matches cargoOwnerName
    if (!this.postedByName || this.postedByName.trim() === '') {
      this.postedByName = this.cargoOwnerName || 'Anonymous';
    }

    // Ensure contactPerson is properly set
    if (!this.contactPerson || !this.contactPerson.name) {
      if (!this.contactPerson) this.contactPerson = {};
      this.contactPerson.name = this.cargoOwnerName || 'Anonymous';
    }

    // Ensure createdBy metadata is properly set
    if (!this.createdBy || !this.createdBy.name) {
      if (!this.createdBy) this.createdBy = {};
      this.createdBy.userId = this.postedBy;
      this.createdBy.userType = 'cargo_owner';
      this.createdBy.name = this.cargoOwnerName || 'Anonymous';
    }
    
    // Validate budget against accepted bid amount if bid is accepted
    if (this.acceptedBid && this.status === 'assigned') {
      try {
        const Bid = this.constructor.db.model('Bid');
        const acceptedBid = await Bid.findById(this.acceptedBid).lean();
        
        if (acceptedBid) {
          // Store the accepted bid amount for reference
          this.acceptedBidAmount = acceptedBid.bidAmount;
          
          // Validate that bid amount is reasonable compared to budget
          if (acceptedBid.bidAmount > this.budget * 1.5) {
            console.warn(`Accepted bid amount (${acceptedBid.bidAmount}) is significantly higher than budget (${this.budget})`);
          }
          
          // Store driver information from the accepted bid
          if (acceptedBid.driver && !this.assignedDriver) {
            this.assignedDriver = acceptedBid.driver;
          }
        }
      } catch (bidFetchError) {
        console.warn('Could not validate accepted bid:', bidFetchError.message);
      }
    }
    
    // Set bidding end date if not already set (for new loads)
    if (this.isNew && !this.biddingEndDate && ['posted', 'receiving_bids'].includes(this.status)) {
      // Default to 7 days from creation, or 1 day before pickup date (whichever is sooner)
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const oneDayBeforePickup = this.pickupDate ? 
        new Date(this.pickupDate.getTime() - 24 * 60 * 60 * 1000) : 
        null;
      
      if (oneDayBeforePickup && oneDayBeforePickup < sevenDaysFromNow) {
        this.biddingEndDate = oneDayBeforePickup;
      } else {
        this.biddingEndDate = sevenDaysFromNow;
      }
    }
    
    // Calculate and store distance if coordinates are available
    if (this.pickupCoordinates && this.deliveryCoordinates && 
        this.pickupCoordinates.lat && this.pickupCoordinates.lng &&
        this.deliveryCoordinates.lat && this.deliveryCoordinates.lng) {
      
      this.distance = this.calculateDistance(
        this.pickupCoordinates.lat, 
        this.pickupCoordinates.lng,
        this.deliveryCoordinates.lat, 
        this.deliveryCoordinates.lng
      );
    }
    
    // Set appropriate status flags based on status
    switch (this.status) {
      case 'posted':
      case 'receiving_bids':
        this.isActive = true;
        this.canReceiveBids = true;
        break;
        
        case 'available':
      case 'receiving_bids':
        this.isActive = true;
        this.canReceiveBids = true;
        break;
        
      case 'assigned':
        this.isActive = true;
        this.canReceiveBids = false;
        if (!this.assignedAt) {
          this.assignedAt = new Date();
        }
        break;
        
      case 'in_transit':
        this.isActive = true;
        this.canReceiveBids = false;
        if (!this.startedAt) {
          this.startedAt = new Date();
        }
        break;
        
      case 'delivered':
        this.isActive = false;
        this.canReceiveBids = false;
        if (!this.deliveredAt) {
          this.deliveredAt = new Date();
        }
        break;
        
      case 'cancelled':
      case 'expired':
        this.isActive = false;
        this.canReceiveBids = false;
        if (!this.cancelledAt && this.status === 'cancelled') {
          this.cancelledAt = new Date();
        }
        if (!this.expiredAt && this.status === 'expired') {
          this.expiredAt = new Date();
        }
        break;
        
      case 'on_hold':
        this.isActive = false;
        this.canReceiveBids = false;
        if (!this.onHoldAt) {
          this.onHoldAt = new Date();
        }
        break;
    }
    
    // Validate required fields based on status
    if (this.status === 'assigned' && !this.assignedDriver) {
      return next(new Error('Assigned driver is required when status is assigned'));
    }
    
    // Validate urgency and priority settings
    if (this.isUrgent && !this.urgencyReason) {
      this.urgencyReason = 'Marked as urgent by cargo owner';
    }
    
    // Ensure pickup date is not in the past (for new loads)
    if (this.isNew && this.pickupDate && this.pickupDate < new Date()) {
      return next(new Error('Pickup date cannot be in the past'));
    }
    
    // Validate weight and vehicle capacity requirements
    if (this.weight && this.vehicleCapacityRequired && this.weight > this.vehicleCapacityRequired) {
      console.warn(`Load weight (${this.weight}kg) exceeds required vehicle capacity (${this.vehicleCapacityRequired}kg)`);
    }
    
    // Set search-friendly text for better indexing
    this.searchText = [
      this.title,
      this.description,
      this.pickupLocation,
      this.deliveryLocation,
      this.cargoType,
      this.vehicleType,
      this.cargoOwnerName
    ].filter(Boolean).join(' ').toLowerCase();
    
    // Add to status history if status changed
    if (this.isModified('status') && !this.isNew) {
      if (!this.statusHistory) {
        this.statusHistory = [];
      }
      
      this.statusHistory.push({
        status: this.status,
        changedAt: new Date(),
        changedBy: this.modifiedBy || this.postedBy, // Set by the route handler
        reason: this.statusChangeReason || `Status changed to ${this.status}`
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Error in load pre-save middleware:', error);
    next(error);
  }
});

// Helper method for distance calculation
LoadSchema.methods.calculateDistance = function(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return null;
  
  const R = 6371; // Radius of the Earth in km
  const dLat = this.deg2rad(lat2 - lat1);
  const dLon = this.deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Math.round(d * 100) / 100; // Round to 2 decimal places
};

LoadSchema.methods.deg2rad = function(deg) {
  return deg * (Math.PI / 180);
};

// Pre-update middleware to handle updates
LoadSchema.pre('findOneAndUpdate', async function(next) {
  try {
    const update = this.getUpdate();
    
    // Update the updatedAt field
    if (!update.$set) update.$set = {};
    update.$set.updatedAt = new Date();
    
    // If status is being updated, add to status history
    if (update.status || update.$set.status) {
      const newStatus = update.status || update.$set.status;
      const statusHistoryEntry = {
        status: newStatus,
        changedAt: new Date(),
        changedBy: update.modifiedBy || update.$set.modifiedBy,
        reason: update.statusChangeReason || update.$set.statusChangeReason || `Status changed to ${newStatus}`
      };
      
      if (!update.$push) update.$push = {};
      update.$push.statusHistory = statusHistoryEntry;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-update middleware
LoadSchema.pre('findOneAndUpdate', function() {
  this.set({ updatedAt: new Date() });
});

// Instance methods
LoadSchema.methods.canReceiveBids = function() {
  return this.isActive && ['posted','available', 'receiving_bids'].includes(this.status);
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