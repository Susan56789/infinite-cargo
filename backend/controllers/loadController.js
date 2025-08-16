// =======================
// controllers/loadController.js
// =======================
const Load = require('../models/load');

exports.getLoads = async (req, res) => {
  const loads = await Load.find();
  res.status(200).json({ status: 'success', data: loads });
};

exports.getLoadById = async (req, res) => {
  const load = await Load.findById(req.params.id);
  if (!load) return res.status(404).json({ status: 'error', message: 'Load not found' });
  res.status(200).json({ status: 'success', data: load });
};

exports.createLoad = async (req, res) => {
  const load = await Load.create(req.body);
  res.status(201).json({ status: 'success', data: load });
};

exports.updateLoad = async (req, res) => {
  const load = await Load.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.status(200).json({ status: 'success', data: load });
};

exports.deleteLoad = async (req, res) => {
  await Load.findByIdAndDelete(req.params.id);
  res.status(200).json({ status: 'success', message: 'Load deleted' });
};