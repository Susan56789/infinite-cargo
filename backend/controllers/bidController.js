// =======================
// controllers/bidController.js
// =======================
const Bid = require('../models/bid');

exports.getBids = async (req, res) => {
  const bids = await Bid.find();
  res.status(200).json({ status: 'success', data: bids });
};

exports.getBidById = async (req, res) => {
  const bid = await Bid.findById(req.params.id);
  if (!bid) return res.status(404).json({ status: 'error', message: 'Bid not found' });
  res.status(200).json({ status: 'success', data: bid });
};

exports.createBid = async (req, res) => {
  const bid = await Bid.create(req.body);
  res.status(201).json({ status: 'success', data: bid });
};

exports.updateBid = async (req, res) => {
  const bid = await Bid.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.status(200).json({ status: 'success', data: bid });
};

exports.deleteBid = async (req, res) => {
  await Bid.findByIdAndDelete(req.params.id);
  res.status(200).json({ status: 'success', message: 'Bid deleted' });
};
