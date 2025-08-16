
// =======================
// controllers/bookingController.js
// =======================
const Booking = require('../models/booking');

exports.getBookings = async (req, res) => {
  const bookings = await Booking.find();
  res.status(200).json({ status: 'success', data: bookings });
};

exports.getBookingById = async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ status: 'error', message: 'Booking not found' });
  res.status(200).json({ status: 'success', data: booking });
};

exports.createBooking = async (req, res) => {
  const booking = await Booking.create(req.body);
  res.status(201).json({ status: 'success', data: booking });
};

exports.updateBooking = async (req, res) => {
  const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.status(200).json({ status: 'success', data: booking });
};

exports.deleteBooking = async (req, res) => {
  await Booking.findByIdAndDelete(req.params.id);
  res.status(200).json({ status: 'success', message: 'Booking deleted' });
};