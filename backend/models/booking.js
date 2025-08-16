// =======================
// models/Booking.js
// =======================
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  truck: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', required: true },
  load: { type: mongoose.Schema.Types.ObjectId, ref: 'Load', required: true },
  scheduledDate: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'in-progress', 'completed'], default: 'scheduled' },
}, { timestamps: true });

// Check if model already exists to prevent OverwriteModelError
const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

module.exports = Booking;