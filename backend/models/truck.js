// =======================
// models/Truck.js
// =======================
const mongoose = require('mongoose');
const truckSchema = new mongoose.Schema({
  plateNumber: { type: String, required: true, unique: true },
  driverName: { type: String, required: true },
  capacity: { type: Number, required: true },
  status: { type: String, enum: ['available', 'in-transit', 'maintenance'], default: 'available' },
}, { timestamps: true });

module.exports = mongoose.model('Truck', truckSchema);