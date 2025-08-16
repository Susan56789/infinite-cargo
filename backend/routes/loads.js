//  routes/loads.js 
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const Load = require('../models/load');
const Bid = require('../models/bid');
const auth = require('../middleware/auth');

// Rate limiting for load operations
const loadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS handler
const corsHandler = (req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://infinitecargo.co.ke',
    'https://www.infinitecargo.co.ke'
  ];
  
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*'); 
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,x-auth-token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
};

// Optional authentication middleware 
const optionalAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
  
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded.user;
    } catch (error) {
      console.warn('Invalid token in optional auth:', error.message);
      req.user = null;
    }
  } else {
    req.user = null;
  }
  
  next();
};

// Helper functions
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return null;
  
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 100) / 100;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// @route   GET /api/loads
// @desc    Get all available loads with filtering and search (PUBLIC ACCESS)
// @access  Public
router.get('/', corsHandler, loadLimiter, optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('pickupLocation').optional().trim(),
  query('deliveryLocation').optional().trim(),
  query('cargoType').optional().isIn([
    'electronics', 'furniture', 'construction_materials', 'food_beverages',
    'textiles', 'machinery', 'medical_supplies', 'automotive_parts',
    'agricultural_products', 'chemicals', 'fragile_items', 'hazardous_materials',
    'livestock', 'containers', 'other'
  ]),
  query('vehicleType').optional().isIn([
    'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck',
    'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
  ]),
  query('minBudget').optional().isFloat({ min: 0 }),
  query('maxBudget').optional().isFloat({ min: 0 }),
  query('minWeight').optional().isFloat({ min: 0 }),
  query('maxWeight').optional().isFloat({ min: 0 }),
  query('isUrgent').optional().isBoolean(),
  query('search').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      pickupLocation,
      deliveryLocation,
      cargoType,
      vehicleType,
      minBudget,
      maxBudget,
      minWeight,
      maxWeight,
      isUrgent,
      search
    } = req.query;

    // Build query for active loads only
    let query = {
      status: { $in: ['posted', 'receiving_bids'] },
      isActive: true
    };

    // Filter out expired loads
    const now = new Date();
    query.$or = [
      { biddingEndDate: { $exists: false } },
      { biddingEndDate: null },
      { biddingEndDate: { $gt: now } }
    ];

    // Apply filters
    if (pickupLocation && pickupLocation.trim()) {
      query.pickupLocation = new RegExp(pickupLocation.trim(), 'i');
    }
    
    if (deliveryLocation && deliveryLocation.trim()) {
      query.deliveryLocation = new RegExp(deliveryLocation.trim(), 'i');
    }
    
    if (cargoType) {
      query.cargoType = cargoType;
    }
    
    if (vehicleType) {
      query.vehicleType = vehicleType;
    }
    
    if (minBudget || maxBudget) {
      query.budget = {};
      if (minBudget) query.budget.$gte = parseFloat(minBudget);
      if (maxBudget) query.budget.$lte = parseFloat(maxBudget);
    }
    
    if (minWeight || maxWeight) {
      query.weight = {};
      if (minWeight) query.weight.$gte = parseFloat(minWeight);
      if (maxWeight) query.weight.$lte = parseFloat(maxWeight);
    }
    
    if (isUrgent !== undefined) {
      query.isUrgent = isUrgent === 'true';
    }

    // Text search
    if (search && search.trim()) {
      query.$text = { $search: search.trim() };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting with priority
    let sortCriteria = {};
    
    if (search && search.trim()) {
      sortCriteria.score = { $meta: 'textScore' };
    }
    
    // Priority sorting: boosted, priority, urgent, then newest
    sortCriteria = {
      ...sortCriteria,
      boostLevel: -1,
      isPriorityListing: -1,
      isUrgent: -1,
      createdAt: -1
    };

    console.log('Query:', JSON.stringify(query, null, 2));
    console.log('Sort:', JSON.stringify(sortCriteria, null, 2));

    // Execute query with proper error handling
    let loads, totalLoads;
    
    try {
      // Get loads with populated fields, but only show basic user info for privacy
      loads = await Load.find(query)
        .populate('postedBy', 'name location isVerified subscriptionPlan')
        .sort(sortCriteria)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(); // Use lean for better performance

      totalLoads = await Load.countDocuments(query);
    } catch (queryError) {
      console.error('Database query error:', queryError);
      return res.status(500).json({
        status: 'error',
        message: 'Database error while fetching loads',
        error: process.env.NODE_ENV === 'development' ? queryError.message : undefined
      });
    }

    const totalPages = Math.ceil(totalLoads / parseInt(limit));

    // Get bid counts for each load
    let bidCountMap = {};
    if (loads.length > 0) {
      try {
        const loadIds = loads.map(load => load._id);
        const bidCounts = await Bid.aggregate([
          { $match: { load: { $in: loadIds }, status: { $nin: ['withdrawn', 'expired'] } } },
          { $group: { _id: '$load', count: { $sum: 1 } } }
        ]);

        bidCounts.forEach(item => {
          bidCountMap[item._id.toString()] = item.count;
        });
      } catch (bidError) {
        console.warn('Error fetching bid counts:', bidError);
        // Continue without bid counts
      }
    }

    // Add bid counts and clean up data for public access
    const loadsWithBidCounts = loads.map(load => {
      const cleanLoad = {
        _id: load._id,
        title: load.title,
        description: load.description,
        pickupLocation: load.pickupLocation,
        deliveryLocation: load.deliveryLocation,
        weight: load.weight,
        cargoType: load.cargoType,
        vehicleType: load.vehicleType,
        vehicleCapacityRequired: load.vehicleCapacityRequired,
        budget: load.budget,
        pickupDate: load.pickupDate,
        deliveryDate: load.deliveryDate,
        isUrgent: load.isUrgent,
        isPriorityListing: load.isPriorityListing || false,
        status: load.status,
        createdAt: load.createdAt,
        distance: load.distance,
        bidCount: bidCountMap[load._id.toString()] || 0,
        postedBy: {
          name: load.postedBy?.name || 'User',
          location: load.postedBy?.location,
          isVerified: load.postedBy?.isVerified || false
        },
        subscriptionBadges: {
          isPremium: ['pro', 'business'].includes(load.subscriptionPlan),
          isBusiness: load.subscriptionPlan === 'business',
          isPriority: load.isPriorityListing || false
        }
      };

      // Only include sensitive info if user is authenticated and authorized
      if (req.user) {
        if (req.user.userType === 'driver') {
          // Drivers can see more details
          cleanLoad.specialInstructions = load.specialInstructions;
          cleanLoad.pickupAddress = load.pickupAddress;
          cleanLoad.deliveryAddress = load.deliveryAddress;
        }
        
        if (req.user.id === load.postedBy._id.toString()) {
          // Load owner can see all details
          cleanLoad.postedBy.email = load.postedBy.email;
          cleanLoad.postedBy.phone = load.postedBy.phone;
          cleanLoad.viewCount = load.viewCount;
        }
      }

      return cleanLoad;
    });

    const response = {
      status: 'success',
      data: {
        loads: loadsWithBidCounts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLoads,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        filters: {
          pickupLocation,
          deliveryLocation,
          cargoType,
          vehicleType,
          budgetRange: { min: minBudget, max: maxBudget },
          weightRange: { min: minWeight, max: maxWeight },
          isUrgent,
          search
        }
      }
    };

    console.log(`Returning ${loadsWithBidCounts.length} loads out of ${totalLoads} total`);
    
    res.json(response);

  } catch (error) {
    console.error('Get loads error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching loads',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/loads/:userId/my-loads
// @desc    Get all loads posted by a specific user (AUTHENTICATION REQUIRED)
// @access  Private (User can only access their own loads, or admin)
router.get('/:userId/my-loads', corsHandler, auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn([
    'posted', 'receiving_bids', 'assigned', 'in_transit', 'delivered', 'cancelled', 'expired'
  ]).withMessage('Invalid status'),
  query('search').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      search
    } = req.query;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    // Authorization check: user can only access their own loads (unless admin)
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You can only view your own loads'
      });
    }

    // Build query
    let query = { postedBy: userId };

    // Apply status filter
    if (status) {
      query.status = status;
    }

    // Text search across title and description
    if (search && search.trim()) {
      query.$or = [
        { title: new RegExp(search.trim(), 'i') },
        { description: new RegExp(search.trim(), 'i') },
        { pickupLocation: new RegExp(search.trim(), 'i') },
        { deliveryLocation: new RegExp(search.trim(), 'i') }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const loads = await Load.find(query)
      .populate('postedBy', 'name email phone location isVerified')
      .populate('assignedDriver', 'name phone email location vehicleType rating profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalLoads = await Load.countDocuments(query);
    const totalPages = Math.ceil(totalLoads / parseInt(limit));

    // Get bid counts for each load
    let bidCountMap = {};
    if (loads.length > 0) {
      try {
        const loadIds = loads.map(load => load._id);
        const bidCounts = await Bid.aggregate([
          { $match: { load: { $in: loadIds }, status: { $nin: ['withdrawn', 'expired'] } } },
          { $group: { _id: '$load', count: { $sum: 1 } } }
        ]);

        bidCounts.forEach(item => {
          bidCountMap[item._id.toString()] = item.count;
        });
      } catch (bidError) {
        console.warn('Error fetching bid counts:', bidError);
      }
    }

    // Add bid counts and additional analytics
    const loadsWithAnalytics = loads.map(load => ({
      ...load,
      bidCount: bidCountMap[load._id.toString()] || 0,
      daysActive: Math.floor((new Date() - new Date(load.createdAt)) / (1000 * 60 * 60 * 24)),
      isExpired: load.biddingEndDate && new Date() > new Date(load.biddingEndDate)
    }));

    // Calculate summary statistics
    const summary = {
      totalLoads,
      activeLoads: loads.filter(l => l.isActive && ['posted', 'receiving_bids'].includes(l.status)).length,
      completedLoads: loads.filter(l => l.status === 'delivered').length,
      inTransitLoads: loads.filter(l => l.status === 'in_transit').length,
      totalBids: Object.values(bidCountMap).reduce((sum, count) => sum + count, 0)
    };

    res.json({
      status: 'success',
      data: {
        loads: loadsWithAnalytics,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLoads,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        summary,
        filters: {
          status,
          search
        }
      }
    });

  } catch (error) {
    console.error('Get user loads error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching user loads',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/loads/:id
// @desc    Update a load (AUTHENTICATION REQUIRED - Load owner only)
// @access  Private (Load owner or admin)
router.put('/:id', corsHandler, [
  body('title').optional().trim().isLength({ min: 5, max: 100 }).withMessage('Title must be 5-100 characters'),
  body('description').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('pickupLocation').optional().trim().notEmpty().withMessage('Pickup location cannot be empty'),
  body('deliveryLocation').optional().trim().notEmpty().withMessage('Delivery location cannot be empty'),
  body('weight').optional().isFloat({ min: 0.1 }).withMessage('Weight must be at least 0.1 kg'),
  body('budget').optional().isFloat({ min: 100 }).withMessage('Budget must be at least KES 100'),
  body('cargoType').optional().isIn([
    'electronics', 'furniture', 'construction_materials', 'food_beverages',
    'textiles', 'machinery', 'medical_supplies', 'automotive_parts',
    'agricultural_products', 'chemicals', 'fragile_items', 'hazardous_materials',
    'livestock', 'containers', 'other'
  ]).withMessage('Invalid cargo type'),
  body('vehicleType').optional().isIn([
    'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck',
    'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
  ]).withMessage('Invalid vehicle type'),
  body('pickupDate').optional().isISO8601().withMessage('Invalid pickup date format'),
  body('deliveryDate').optional().isISO8601().withMessage('Invalid delivery date format'),
  body('isUrgent').optional().isBoolean().withMessage('isUrgent must be boolean'),
  body('status').optional().isIn([
    'posted', 'receiving_bids', 'assigned', 'in_transit', 'delivered', 'cancelled'
  ]).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load ID'
      });
    }

    // Find the load
    const load = await Load.findById(id);

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found'
      });
    }

    // Authorization check: only load owner or admin can update
    if (load.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You can only update your own loads'
      });
    }

    // Restrict updates based on load status
    const restrictedStatuses = ['assigned', 'in_transit', 'delivered'];
    if (restrictedStatuses.includes(load.status)) {
      // Only allow limited updates for loads in progress
      const allowedFields = ['specialInstructions', 'contactPerson'];
      const updateFields = Object.keys(req.body);
      const hasRestrictedFields = updateFields.some(field => !allowedFields.includes(field));
      
      if (hasRestrictedFields) {
        return res.status(400).json({
          status: 'error',
          message: `Load cannot be fully updated when status is ${load.status}. Only special instructions and contact person can be modified.`
        });
      }
    }

    // If updating dates, validate pickup date is before delivery date
    const pickupDate = req.body.pickupDate ? new Date(req.body.pickupDate) : load.pickupDate;
    const deliveryDate = req.body.deliveryDate ? new Date(req.body.deliveryDate) : load.deliveryDate;
    
    if (pickupDate && deliveryDate && pickupDate >= deliveryDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Pickup date must be before delivery date'
      });
    }

    // Calculate distance if coordinates are provided or updated
    let distance = load.distance;
    if (req.body.pickupCoordinates || req.body.deliveryCoordinates) {
      const pickup = req.body.pickupCoordinates || load.pickupCoordinates;
      const delivery = req.body.deliveryCoordinates || load.deliveryCoordinates;
      
      if (pickup && delivery && pickup.lat && pickup.lng && delivery.lat && delivery.lng) {
        distance = calculateDistance(pickup.lat, pickup.lng, delivery.lat, delivery.lng);
      }
    }

    // Update the load
    const updateData = {
      ...req.body,
      distance,
      updatedAt: new Date()
    };

    // If status is being changed to 'posted' or 'receiving_bids', ensure isActive is true
    if (['posted', 'receiving_bids'].includes(updateData.status)) {
      updateData.isActive = true;
    }

    // If cancelling, set isActive to false
    if (updateData.status === 'cancelled') {
      updateData.isActive = false;
    }

    const updatedLoad = await Load.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('postedBy', 'name email phone location isVerified')
    .populate('assignedDriver', 'name phone email location vehicleType rating profilePicture');

    // If status changed to cancelled, update related bids
    if (updateData.status === 'cancelled' && load.status !== 'cancelled') {
      try {
        await Bid.updateMany(
          { load: id, status: { $in: ['submitted', 'viewed', 'under_review'] } },
          { status: 'expired', updatedAt: new Date() }
        );
      } catch (bidUpdateError) {
        console.warn('Error updating bids after load cancellation:', bidUpdateError);
      }
    }

    res.json({
      status: 'success',
      message: 'Load updated successfully',
      data: {
        load: updatedLoad
      }
    });

  } catch (error) {
    console.error('Update load error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error updating load',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/loads/:id
// @desc    Delete a load (AUTHENTICATION REQUIRED - Load owner only)
// @access  Private (Load owner or admin)
router.delete('/:id', corsHandler, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load ID'
      });
    }

    const load = await Load.findById(id);

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found'
      });
    }

    // Authorization check
    if (load.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You can only delete your own loads'
      });
    }

    // Check if load can be deleted
    if (['assigned', 'in_transit'].includes(load.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete loads that are assigned or in transit. Cancel the load instead.'
      });
    }

    // Soft delete: mark as inactive and cancelled instead of actual deletion
    await Load.findByIdAndUpdate(id, {
      isActive: false,
      status: 'cancelled',
      updatedAt: new Date()
    });

    // Update related bids
    try {
      await Bid.updateMany(
        { load: id, status: { $in: ['submitted', 'viewed', 'under_review'] } },
        { status: 'expired', updatedAt: new Date() }
      );
    } catch (bidUpdateError) {
      console.warn('Error updating bids after load deletion:', bidUpdateError);
    }

    res.json({
      status: 'success',
      message: 'Load deleted successfully'
    });

  } catch (error) {
    console.error('Delete load error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting load',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/loads/:id
// @desc    Get single load by ID (PUBLIC ACCESS with limited info)
// @access  Public
router.get('/:id', corsHandler, optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load ID'
      });
    }

    const load = await Load.findById(id)
      .populate('postedBy', 'name email phone location rating totalRatings isVerified profilePicture')
      .populate('assignedDriver', 'name phone email location vehicleType vehicleCapacity rating profilePicture');

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found'
      });
    }

    // Check if load is publicly viewable
    if (!load.isActive || !['posted', 'receiving_bids'].includes(load.status)) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not available'
      });
    }

    // Increment view count (non-owner views only)
    if (!req.user || req.user.id !== load.postedBy._id.toString()) {
      try {
        await Load.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
      } catch (viewError) {
        console.warn('Failed to increment view count:', viewError);
      }
    }

    // Get bids if user is authorized
    let bids = [];
    if (req.user) {
      if (req.user.userType === 'cargo_owner' && req.user.id === load.postedBy._id.toString()) {
        // Load owner can see all bids
        bids = await Bid.find({ 
          load: id, 
          status: { $nin: ['withdrawn', 'expired'] } 
        })
        .populate('driver', 'name phone email location rating totalTrips experienceYears isVerified vehicleType vehicleCapacity profilePicture')
        .sort({ bidAmount: 1, submittedAt: 1 });
      } else if (req.user.userType === 'driver') {
        // Driver can only see their own bids
        bids = await Bid.find({ 
          load: id, 
          driver: req.user.id,
          status: { $nin: ['withdrawn', 'expired'] } 
        })
        .populate('driver', 'name phone email location rating totalTrips experienceYears isVerified vehicleType vehicleCapacity profilePicture')
        .sort({ bidAmount: 1, submittedAt: 1 });
      }
    }

    // Get basic bid analytics for public view
    let bidAnalytics = { totalBids: 0, avgBid: 0, minBid: 0, maxBid: 0 };
    try {
      const competitiveAnalysis = await Bid.aggregate([
        { $match: { load: new mongoose.Types.ObjectId(id), status: { $in: ['submitted', 'viewed', 'under_review'] } } },
        {
          $group: {
            _id: null,
            totalBids: { $sum: 1 },
            avgBid: { $avg: '$bidAmount' },
            minBid: { $min: '$bidAmount' },
            maxBid: { $max: '$bidAmount' }
          }
        }
      ]);
      
      if (competitiveAnalysis.length > 0) {
        bidAnalytics = competitiveAnalysis[0];
      }
    } catch (analyticsError) {
      console.warn('Error fetching bid analytics:', analyticsError);
    }

    // Clean load data based on user authorization
    const loadData = {
      _id: load._id,
      title: load.title,
      description: load.description,
      pickupLocation: load.pickupLocation,
      deliveryLocation: load.deliveryLocation,
      weight: load.weight,
      cargoType: load.cargoType,
      vehicleType: load.vehicleType,
      vehicleCapacityRequired: load.vehicleCapacityRequired,
      budget: load.budget,
      pickupDate: load.pickupDate,
      deliveryDate: load.deliveryDate,
      isUrgent: load.isUrgent,
      isPriorityListing: load.isPriorityListing || false,
      status: load.status,
      createdAt: load.createdAt,
      distance: load.distance,
      postedBy: {
        name: load.postedBy.name,
        location: load.postedBy.location,
        isVerified: load.postedBy.isVerified || false,
        rating: load.postedBy.rating
      },
      bidAnalytics,
      bids: req.user ? bids : [] // Only include bids if user is authenticated
    };

    // Add sensitive information based on authorization
    if (req.user) {
      if (req.user.userType === 'driver') {
        loadData.specialInstructions = load.specialInstructions;
        loadData.specialRequirements = load.specialRequirements;
        loadData.pickupAddress = load.pickupAddress;
        loadData.deliveryAddress = load.deliveryAddress;
        loadData.pickupTimeWindow = load.pickupTimeWindow;
        loadData.deliveryTimeWindow = load.deliveryTimeWindow;
        loadData.paymentTerms = load.paymentTerms;
        loadData.insuranceRequired = load.insuranceRequired;
        loadData.insuranceValue = load.insuranceValue;
        
        // Contact info for serious drivers
        if (bidAnalytics.totalBids > 0) {
          loadData.contactPerson = load.contactPerson;
        }
      }
      
      if (req.user.id === load.postedBy._id.toString()) {
        // Load owner gets full access
        loadData.postedBy.email = load.postedBy.email;
        loadData.postedBy.phone = load.postedBy.phone;
        loadData.viewCount = load.viewCount;
        loadData.specialInstructions = load.specialInstructions;
        loadData.specialRequirements = load.specialRequirements;
        loadData.pickupAddress = load.pickupAddress;
        loadData.deliveryAddress = load.deliveryAddress;
        loadData.pickupCoordinates = load.pickupCoordinates;
        loadData.deliveryCoordinates = load.deliveryCoordinates;
        loadData.contactPerson = load.contactPerson;
        loadData.pickupTimeWindow = load.pickupTimeWindow;
        loadData.deliveryTimeWindow = load.deliveryTimeWindow;
        loadData.paymentTerms = load.paymentTerms;
        loadData.insuranceRequired = load.insuranceRequired;
        loadData.insuranceValue = load.insuranceValue;
      }
    }

    res.json({
      status: 'success',
      data: {
        load: loadData
      }
    });

  } catch (error) {
    console.error('Get load error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching load',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PATCH /api/loads/:id/status
// @desc    Update load status with business logic and validations
// @access  Private (Load owner, assigned driver, or admin)
router.patch('/:id/status', corsHandler, auth, [
  body('status')
    .isIn([
      'posted', 'receiving_bids', 'assigned', 'in_transit', 'delivered', 
      'cancelled', 'expired', 'on_hold'
    ])
    .withMessage('Invalid status'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
  body('assignedDriver')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid driver ID');
      }
      return true;
    }),
  body('estimatedDeliveryTime')
    .optional()
    .isISO8601()
    .withMessage('Invalid estimated delivery time format'),
  body('actualDeliveryTime')
    .optional()
    .isISO8601()
    .withMessage('Invalid actual delivery time format'),
  body('completionNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Completion notes must not exceed 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { 
      status, 
      reason, 
      assignedDriver, 
      estimatedDeliveryTime, 
      actualDeliveryTime,
      completionNotes 
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load ID format'
      });
    }

    // Find the load with populated fields
    const load = await Load.findById(id)
      .populate('postedBy', 'name email phone')
      .populate('assignedDriver', 'name email phone vehicleType');

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found'
      });
    }

    // Authorization check - who can update status
    const isOwner = req.user.id === load.postedBy._id.toString();
    const isAssignedDriver = load.assignedDriver && req.user.id === load.assignedDriver._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAssignedDriver && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Only load owner, assigned driver, or admin can update status'
      });
    }

    // Define valid status transitions
    const statusTransitions = {
      'posted': ['receiving_bids', 'cancelled', 'on_hold'],
      'receiving_bids': ['assigned', 'cancelled', 'expired', 'on_hold'],
      'assigned': ['in_transit', 'cancelled', 'on_hold'],
      'in_transit': ['delivered', 'cancelled', 'on_hold'],
      'delivered': [], // Final state
      'cancelled': ['posted'], // Can repost if cancelled
      'expired': ['posted', 'receiving_bids'], // Can reactivate
      'on_hold': ['posted', 'receiving_bids', 'assigned', 'cancelled']
    };

    // Check if status transition is valid
    const validTransitions = statusTransitions[load.status] || [];
    if (!validTransitions.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot change status from '${load.status}' to '${status}'. Valid transitions: ${validTransitions.join(', ')}`
      });
    }

    // Role-specific status change permissions
    const rolePermissions = {
      'cargo_owner': [
        'posted', 'receiving_bids', 'assigned', 'cancelled', 
        'expired', 'on_hold'
      ],
      'driver': ['in_transit', 'delivered'],
      'admin': [
        'posted', 'receiving_bids', 'assigned', 'in_transit', 
        'delivered', 'cancelled', 'expired', 'on_hold'
      ]
    };

    const userRole = req.user.role || req.user.userType;
    const allowedStatuses = rolePermissions[userRole] || [];

    if (!allowedStatuses.includes(status)) {
      return res.status(403).json({
        status: 'error',
        message: `Your role (${userRole}) cannot set status to '${status}'`
      });
    }

    // Status-specific validations and business logic
    const updateData = {
      status,
      updatedAt: new Date(),
      statusHistory: [
        ...(load.statusHistory || []),
        {
          status: status,
          changedBy: req.user.id,
          changedAt: new Date(),
          reason: reason || `Status changed to ${status}`,
          userRole: userRole
        }
      ]
    };

    // Handle specific status changes
    switch (status) {
      case 'assigned':
        // Must provide assigned driver
        if (!assignedDriver) {
          return res.status(400).json({
            status: 'error',
            message: 'assignedDriver is required when status is set to assigned'
          });
        }

        // Validate driver exists and is a driver
        const driver = await require('../models/user').findById(assignedDriver);
        if (!driver || driver.userType !== 'driver') {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid driver ID or user is not a driver'
          });
        }

        updateData.assignedDriver = assignedDriver;
        updateData.assignedAt = new Date();
        updateData.isActive = true;

        // Update the winning bid status
        try {
          await Bid.findOneAndUpdate(
            { load: id, driver: assignedDriver, status: { $in: ['submitted', 'viewed', 'under_review'] } },
            { status: 'accepted', acceptedAt: new Date() }
          );

          // Mark other bids as rejected
          await Bid.updateMany(
            { 
              load: id, 
              driver: { $ne: assignedDriver }, 
              status: { $in: ['submitted', 'viewed', 'under_review'] } 
            },
            { status: 'rejected', rejectedAt: new Date() }
          );
        } catch (bidError) {
          console.warn('Error updating bid statuses:', bidError);
        }
        break;

      case 'in_transit':
        // Only assigned driver can set to in_transit
        if (!isAssignedDriver && !isAdmin) {
          return res.status(403).json({
            status: 'error',
            message: 'Only the assigned driver can mark load as in transit'
          });
        }
        
        updateData.startedAt = new Date();
        if (estimatedDeliveryTime) {
          updateData.estimatedDeliveryTime = new Date(estimatedDeliveryTime);
        }
        break;

      case 'delivered':
        // Only assigned driver can set to delivered
        if (!isAssignedDriver && !isAdmin) {
          return res.status(403).json({
            status: 'error',
            message: 'Only the assigned driver can mark load as delivered'
          });
        }

        updateData.deliveredAt = actualDeliveryTime ? new Date(actualDeliveryTime) : new Date();
        updateData.completionNotes = completionNotes;
        updateData.isActive = false; // Job complete
        break;

      case 'cancelled':
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = reason;
        updateData.isActive = false;

        // Cancel all active bids
        try {
          await Bid.updateMany(
            { load: id, status: { $in: ['submitted', 'viewed', 'under_review'] } },
            { 
              status: 'expired', 
              expiredAt: new Date(),
              expireReason: 'Load cancelled'
            }
          );
        } catch (bidError) {
          console.warn('Error expiring bids:', bidError);
        }
        break;

      case 'expired':
        updateData.expiredAt = new Date();
        updateData.isActive = false;

        // Expire all active bids
        try {
          await Bid.updateMany(
            { load: id, status: { $in: ['submitted', 'viewed', 'under_review'] } },
            { 
              status: 'expired', 
              expiredAt: new Date(),
              expireReason: 'Load expired'
            }
          );
        } catch (bidError) {
          console.warn('Error expiring bids:', bidError);
        }
        break;

      case 'posted':
      case 'receiving_bids':
        updateData.isActive = true;
        // Reset dates if reactivating
        if (['cancelled', 'expired'].includes(load.status)) {
          updateData.biddingEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        }
        break;

      case 'on_hold':
        updateData.onHoldAt = new Date();
        updateData.onHoldReason = reason;
        updateData.isActive = false;
        break;
    }

    // Update the load
    const updatedLoad = await Load.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('postedBy', 'name email phone location')
    .populate('assignedDriver', 'name email phone location vehicleType');

    // Get updated bid counts if relevant
    let bidCount = 0;
    if (['posted', 'receiving_bids'].includes(status)) {
      try {
        bidCount = await Bid.countDocuments({
          load: id,
          status: { $nin: ['withdrawn', 'expired', 'rejected'] }
        });
      } catch (countError) {
        console.warn('Error counting bids:', countError);
      }
    }

    // Prepare response data
    const responseData = {
      load: {
        _id: updatedLoad._id,
        title: updatedLoad.title,
        status: updatedLoad.status,
        isActive: updatedLoad.isActive,
        updatedAt: updatedLoad.updatedAt,
        assignedDriver: updatedLoad.assignedDriver,
        statusHistory: updatedLoad.statusHistory,
        bidCount
      },
      statusChange: {
        from: load.status,
        to: status,
        changedBy: {
          id: req.user.id,
          role: userRole
        },
        reason: reason || `Status changed to ${status}`,
        timestamp: new Date()
      }
    };

    // Add status-specific data
    if (status === 'delivered') {
      responseData.completionInfo = {
        deliveredAt: updatedLoad.deliveredAt,
        completionNotes: updatedLoad.completionNotes,
        actualDeliveryTime: updatedLoad.deliveredAt
      };
    }

    if (status === 'assigned') {
      responseData.assignmentInfo = {
        assignedDriver: updatedLoad.assignedDriver,
        assignedAt: updatedLoad.assignedAt
      };
    }

    res.json({
      status: 'success',
      message: `Load status successfully updated to '${status}'`,
      data: responseData
    });

  } catch (error) {
    console.error('Update load status error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error updating load status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/loads/:id/status-history
// @desc    Get status change history for a load
// @access  Private (Load owner, assigned driver, or admin)
router.get('/:id/status-history', corsHandler, auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load ID format'
      });
    }

    const load = await Load.findById(id)
      .populate('postedBy', 'name')
      .populate('assignedDriver', 'name')
      .select('statusHistory postedBy assignedDriver')
      .lean();

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found'
      });
    }

    // Authorization check
    const isOwner = req.user.id === load.postedBy._id.toString();
    const isAssignedDriver = load.assignedDriver && req.user.id === load.assignedDriver._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAssignedDriver && !isAdmin) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Only authorized users can view status history'
      });
    }

    // Get user details for status history
    const userIds = [...new Set(load.statusHistory?.map(h => h.changedBy.toString()) || [])];
    const users = await require('../models/user').find(
      { _id: { $in: userIds } },
      'name userType'
    ).lean();

    const userMap = users.reduce((map, user) => {
      map[user._id.toString()] = user;
      return map;
    }, {});

    // Enhance status history with user details
    const enhancedHistory = (load.statusHistory || []).map(entry => ({
      status: entry.status,
      reason: entry.reason,
      changedAt: entry.changedAt,
      changedBy: {
        id: entry.changedBy,
        name: userMap[entry.changedBy.toString()]?.name || 'Unknown User',
        role: entry.userRole || userMap[entry.changedBy.toString()]?.userType
      }
    })).sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));

    res.json({
      status: 'success',
      data: {
        loadId: id,
        statusHistory: enhancedHistory,
        totalChanges: enhancedHistory.length
      }
    });

  } catch (error) {
    console.error('Get status history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching status history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/loads/:id/bid
// @desc    Place a bid on a load (DRIVER AUTHENTICATION REQUIRED)
// @access  Private (Drivers only)
router.post('/:id/bid', corsHandler, auth, [
  body('bidAmount')
    .isFloat({ min: 100 })
    .withMessage('Bid amount must be at least KES 100'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message must not exceed 500 characters'),
  body('estimatedDeliveryTime')
    .optional()
    .isISO8601()
    .withMessage('Invalid delivery time format')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { bidAmount, message, estimatedDeliveryTime } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user is a driver
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can place bids on loads'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load ID'
      });
    }

    // Check if load exists and is available for bidding
    const load = await Load.findById(id);

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found'
      });
    }

    if (!load.isActive || !['posted', 'receiving_bids'].includes(load.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'This load is no longer accepting bids'
      });
    }

    // Check if driver has already bid on this load
    const existingBid = await Bid.findOne({
      load: id,
      driver: req.user.id,
      status: { $in: ['submitted', 'viewed', 'under_review'] }
    });

    if (existingBid) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already placed a bid on this load'
      });
    }

    // Create new bid
    const bidData = {
      load: id,
      driver: req.user.id,
      bidAmount: parseFloat(bidAmount),
      message: message ? message.trim() : '',
      estimatedDeliveryTime: estimatedDeliveryTime ? new Date(estimatedDeliveryTime) : null,
      status: 'submitted',
      submittedAt: new Date()
    };

    const bid = new Bid(bidData);
    await bid.save();

    await bid.populate('driver', 'name phone email location rating totalTrips experienceYears vehicleType vehicleCapacity');

    res.status(201).json({
      status: 'success',
      message: 'Bid placed successfully',
      data: {
        bid
      }
    });

  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error placing bid',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Protected routes that require authentication
router.use('*', auth); // All routes below require authentication

// @route   POST /api/loads
// @desc    Create a new load (CARGO OWNER AUTHENTICATION REQUIRED)
// @access  Private (Cargo Owners only)
router.post('/', corsHandler, [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ min: 5, max: 100 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ min: 10, max: 1000 }),
  body('pickupLocation').trim().notEmpty().withMessage('Pickup location is required'),
  body('deliveryLocation').trim().notEmpty().withMessage('Delivery location is required'),
  body('weight').isFloat({ min: 0.1 }).withMessage('Weight must be at least 0.1 kg'),
  body('budget').isFloat({ min: 100 }).withMessage('Budget must be at least KES 100'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can create loads'
      });
    }

    const loadData = {
      ...req.body,
      postedBy: req.user.id,
      status: 'posted',
      isActive: true,
      biddingEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    };

    const load = new Load(loadData);
    await load.save();

    await load.populate('postedBy', 'name email phone location');

    res.status(201).json({
      status: 'success',
      message: 'Load created successfully',
      data: { load }
    });

  } catch (error) {
    console.error('Create load error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error creating load',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;