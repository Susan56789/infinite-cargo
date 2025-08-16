// =======================
// controllers/userController.js
// =======================
const User = require('../models/user');

exports.getUsers = async (req, res) => {
  const users = await User.find().select('-password');
  res.status(200).json({ status: 'success', data: users });
};

exports.getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
  res.status(200).json({ status: 'success', data: user });
};

exports.updateUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.status(200).json({ status: 'success', data: user });
};

exports.deleteUser = async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.status(200).json({ status: 'success', message: 'User deleted' });
};
