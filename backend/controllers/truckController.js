// =======================
// controllers/truckController.js
// =======================
const Truck = require('../models/truck');

exports.getTrucks = async (req, res) => {
  const trucks = await Truck.find();
  res.status(200).json({ status: 'success', data: trucks });
};

exports.getTruckById = async (req, res) => {
  const truck = await Truck.findById(req.params.id);
  if (!truck) return res.status(404).json({ status: 'error', message: 'Truck not found' });
  res.status(200).json({ status: 'success', data: truck });
};

exports.createTruck = async (req, res) => {
  const truck = await Truck.create(req.body);
  res.status(201).json({ status: 'success', data: truck });
};

exports.updateTruck = async (req, res) => {
  const truck = await Truck.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.status(200).json({ status: 'success', data: truck });
};

exports.deleteTruck = async (req, res) => {
  await Truck.findByIdAndDelete(req.params.id);
  res.status(200).json({ status: 'success', message: 'Truck deleted' });
};
