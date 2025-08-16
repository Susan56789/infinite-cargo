const mongoose = require('mongoose');

const LoadSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  pickupLocation: { type: String, required: true },
  deliveryLocation: { type: String, required: true },
  pickupAddress: String,
  deliveryAddress: String,
  pickupCoordinates: {
    latitude: Number,
    longitude: Number
  },
  deliveryCoordinates: {
    latitude: Number,
    longitude: Number
  },
  distance: Number,
  weight: Number,
  cargoType: String,
  vehicleType: String,
  vehicleCapacityRequired: Number,
  budget: Number,
  pickupDate: Date,
  deliveryDate: Date,
  specialInstructions: String,
  specialRequirements: String,
  pickupTimeWindow: String,
  deliveryTimeWindow: String,
  isUrgent: { type: Boolean, default: false },
  paymentTerms: String,
  insuranceRequired: { type: Boolean, default: false },
  insuranceValue: Number,
  contactPerson: String,
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'cargo-owners' },
  status: { type: String, default: 'posted' },
  isActive: { type: Boolean, default: true },
  biddingEndDate: Date,

  // Subscription context
  subscriptionPlan: { type: String, default: 'basic' },
  isPriorityListing: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('load', LoadSchema);
