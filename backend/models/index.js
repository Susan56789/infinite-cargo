const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: /^\+254\d{9}$/
  },
  passwordHash: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    required: true,
    enum: ['driver', 'cargo_owner']
  },
  location: {
    type: String,
    trim: true,
    maxlength: 100
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  avatar: {
    type: String, // URL to profile image
    default: null
  },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ location: 1 });

// Truck Schema
const truckSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  truckNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  truckType: {
    type: String,
    required: true,
    trim: true
  },
  capacityTonnes: {
    type: Number,
    required: true,
    min: 0.1,
    max: 100
  },
  currentLocation: {
    type: String,
    trim: true
  },
  destination: {
    type: String,
    trim: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  specifications: {
    length: Number, // in meters
    width: Number,  // in meters
    height: Number, // in meters
    fuelType: { type: String, enum: ['diesel', 'petrol', 'electric', 'hybrid'] }
  },
  documents: {
    license: String, // URL to license document
    insurance: String, // URL to insurance document
    roadworthiness: String // URL to roadworthiness certificate
  }
}, {
  timestamps: true
});

// Indexes
truckSchema.index({ driverId: 1 });
truckSchema.index({ truckNumber: 1 });
truckSchema.index({ isAvailable: 1 });
truckSchema.index({ currentLocation: 1 });

// Load Schema
const loadSchema = new mongoose.Schema({
  cargoOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  weightTonnes: {
    type: Number,
    required: true,
    min: 0.1,
    max: 100
  },
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
  pickupDate: {
    type: Date
  },
  deliveryDate: {
    type: Date
  },
  offeredPrice: {
    type: Number,
    min: 0
  },
  cargoType: {
    type: String,
    trim: true,
    enum: ['general', 'fragile', 'hazardous', 'perishable', 'livestock', 'construction', 'automotive', 'other']
  },
  specialRequirements: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    default: 'available',
    enum: ['available', 'assigned', 'in_transit', 'delivered', 'cancelled']
  },
  dimensions: {
    length: Number, // in meters
    width: Number,  // in meters
    height: Number  // in meters
  },
  images: [{
    type: String // URLs to cargo images
  }],
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Indexes
loadSchema.index({ cargoOwnerId: 1 });
loadSchema.index({ status: 1 });
loadSchema.index({ pickupLocation: 1 });
loadSchema.index({ deliveryLocation: 1 });
loadSchema.index({ cargoType: 1 });
loadSchema.index({ urgency: 1 });
loadSchema.index({ createdAt: -1 });

// Bid Schema
const bidSchema = new mongoose.Schema({
  loadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Load',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  truckId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck',
    required: true
  },
  bidAmount: {
    type: Number,
    required: true,
    min: 0
  },
  message: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'accepted', 'rejected', 'withdrawn']
  },
  estimatedDeliveryTime: {
    type: Date
  },
  validUntil: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  }
}, {
  timestamps: true
});

// Compound indexes
bidSchema.index({ loadId: 1, driverId: 1 }, { unique: true });
bidSchema.index({ loadId: 1 });
bidSchema.index({ driverId: 1 });
bidSchema.index({ status: 1 });

// Booking Schema
const bookingSchema = new mongoose.Schema({
  loadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Load',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  truckId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck',
    required: true
  },
  cargoOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  agreedPrice: {
    type: Number,
    required: true,
    min: 0
  },
  pickupDate: {
    type: Date
  },
  deliveryDate: {
    type: Date
  },
  actualPickupDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  status: {
    type: String,
    default: 'confirmed',
    enum: ['confirmed', 'picked_up', 'in_transit', 'delivered', 'cancelled']
  },
  trackingUpdates: [{
    timestamp: { type: Date, default: Date.now },
    location: String,
    status: String,
    notes: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  paymentStatus: {
    type: String,
    default: 'pending',
    enum: ['pending', 'paid', 'refunded', 'disputed']
  },
  documents: {
    pickupReceipt: String, // URL to pickup receipt
    deliveryReceipt: String, // URL to delivery receipt
    invoice: String // URL to invoice
  }
}, {
  timestamps: true
});

// Indexes
bookingSchema.index({ driverId: 1 });
bookingSchema.index({ cargoOwnerId: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });

// Review Schema
const reviewSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  revieweeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 500
  },
  categories: {
    punctuality: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 },
    cargoHandling: { type: Number, min: 1, max: 5 },
    professionalism: { type: Number, min: 1, max: 5 }
  }
}, {
  timestamps: true
});

// Indexes
reviewSchema.index({ bookingId: 1 });
reviewSchema.index({ reviewerId: 1 });
reviewSchema.index({ revieweeId: 1 });

// Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    default: 'info',
    enum: ['info', 'success', 'warning', 'error', 'bid', 'booking', 'payment']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId, // Can reference Load, Bid, Booking, etc.
    default: null
  },
  relatedModel: {
    type: String,
    enum: ['Load', 'Bid', 'Booking', 'User'],
    default: null
  }
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

// Create models
const User = mongoose.model('User', userSchema);
const Truck = mongoose.model('Truck', truckSchema);
const Load = mongoose.model('Load', loadSchema);
const Bid = mongoose.model('Bid', bidSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Review = mongoose.model('Review', reviewSchema);
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = {
  User,
  Truck,
  Load,
  Bid,
  Booking,
  Review,
  Notification
};