//  routes/loads.js 
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const Load = require('../models/load');
const Bid = require('../models/bid');
const auth = require('../middleware/auth');
const corsHandler = require('../middleware/corsHandler');


const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    let token = req.header('x-auth-token');

    // Check for Bearer token format first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      req.user = null;
      return next();
    }

    // Verify token
    const jwt = require('jsonwebtoken');
    
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not configured - skipping token verification');
      req.user = null;
      return next();
    }

    let decoded;
    try {
      // First try with issuer/audience if they're expected
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'infinite-cargo',
        audience: 'infinite-cargo-users'
      });
    } catch (jwtError) {
      // If that fails, try without issuer/audience (fallback for older tokens)
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (fallbackError) {
        console.warn('Invalid token in optional auth:', fallbackError.message);
        req.user = null;
        return next();
      }
    }

    // Check token structure
    if (!decoded.user || !decoded.user.email) {
      req.user = null;
      return next();
    }

    // Set user info (limited for optional auth)
    req.user = {
      id: decoded.user.id,
      email: decoded.user.email,
      userType: decoded.user.userType || 'user',
      role: decoded.user.role || 'user'
    };

    next();
  } catch (error) {
    console.warn('Error in optional auth middleware:', error.message);
    req.user = null;
    next();
  }
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

// =====================================================================
// PROTECTED ROUTES FIRST (These need specific auth and route matching)
// =====================================================================

// @route   GET /api/loads/user/my-loads
// @desc    Get cargo owner's loads with detailed information
// @access  Private (Cargo owners only)
router.get('/user/my-loads', corsHandler, auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['posted', 'receiving_bids', 'driver_assigned', 'in_transit', 'delivered', 'cancelled']),
  query('sortBy').optional().isIn(['createdAt', 'budget', 'title', 'status']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    // Check token
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized or invalid token'
      });
    }
    
    // Only allow cargo_owner
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    const { 
      page = 1, 
      limit = 50, 
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Build query
    let query = { 
      postedBy: new mongoose.Types.ObjectId(req.user.id) 
    };
    
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Fetch with aggregation (same as before)
    const loads = await Load.aggregate([
      { $match: query },
      // ... your lookups, projections remain the same here ...
      { $sort: { [sortBy]: sortDirection } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    const totalLoads = await Load.countDocuments(query);
    const totalPages = Math.ceil(totalLoads / parseInt(limit));

    // Transform the data for frontend
    const transformedLoads = loads.map(load => ({
      _id: load._id,
      title: load.title,
      description: load.description,
      cargoType: load.cargoType,
      weight: load.weight,
      dimensions: load.dimensions,
      pickupLocation: load.pickupLocation,
      deliveryLocation: load.deliveryLocation,
      pickupDate: load.pickupDate,
      deliveryDate: load.deliveryDate,
      budget: load.budget,
      vehicleType: load.vehicleType,
      specialRequirements: load.specialRequirements,
      status: load.status,
      isUrgent: load.isUrgent,
      boostLevel: load.boostLevel || 0,
      isBoosted: load.isBoosted || false,
      createdAt: load.createdAt,
      updatedAt: load.updatedAt,
      assignedAt: load.assignedAt,
      
      // Bid information
      bidCount: load.bidStats?.total || 0,
      pendingBids: load.bidStats?.pending || 0,
      acceptedBids: load.bidStats?.accepted || 0,
      averageBidAmount: load.bidStats?.avgBidAmount || null,
      lowestBid: load.bidStats?.lowestBid || null,
      highestBid: load.bidStats?.highestBid || null,
      
      // Driver and accepted bid info
      assignedDriver: load.assignedDriver,
      acceptedBidAmount: load.acceptedBidAmount,
      
      // Calculate savings if bid was accepted
      savings: load.acceptedBidAmount && load.budget 
        ? load.budget - load.acceptedBidAmount 
        : null,
      
      // Calculate days since posted
      daysSincePosted: Math.floor((new Date() - new Date(load.createdAt)) / (1000 * 60 * 60 * 24)),
      
      // Status helpers for frontend
      canReceiveBids: ['posted', 'receiving_bids'].includes(load.status),
      isActive: ['posted', 'receiving_bids', 'driver_assigned', 'in_transit'].includes(load.status),
      isCompleted: load.status === 'delivered',
      isCancelled: load.status === 'cancelled'
    }));

    // Get summary statistics
    const summaryStats = await Load.aggregate([
      { $match: { postedBy: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: null,
          totalLoads: { $sum: 1 },
          activeLoads: {
            $sum: {
              $cond: [
                { $in: ['$status', ['posted', 'receiving_bids', 'driver_assigned', 'in_transit']] },
                1,
                0
              ]
            }
          },
          completedLoads: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
            }
          },
          totalBudget: { $sum: '$budget' }
        }
      }
    ]);

    return res.json({
      status: 'success',
      data: {
        loads: transformedLoads,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLoads,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        summary: summaryStats[0] || {
          totalLoads: 0,
          activeLoads: 0,
          completedLoads: 0,
          totalBudget: 0
        },
        filters: {
          status: status || 'all',
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Get my loads error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching loads',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/loads/subscription-status
// @desc    Get current user's subscription status
// @access  Private
router.get('/subscription-status', corsHandler, auth, async (req, res) => {
  try {
    // Get user with subscription details
    const User = require('../models/user');
    const user = await User.findById(req.user.id)
      .select('subscriptionPlan subscriptionStatus subscriptionFeatures billing')
      .lean();

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get current month's load count for usage calculation
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const loadsThisMonth = await Load.countDocuments({
      postedBy: req.user.id,
      createdAt: { $gte: startOfMonth }
    });

    // Define subscription plans (you might want to move this to a config file)
    const subscriptionPlans = {
      basic: {
        name: 'Basic Plan',
        maxLoads: 3,
        features: ['Basic support', 'Load posting', 'Basic analytics'],
        price: 0
      },
      pro: {
        name: 'Pro Plan', 
        maxLoads: 25,
        features: ['Priority support', 'Advanced analytics', 'Priority listings'],
        price: 2999
      },
      business: {
        name: 'Business Plan',
        maxLoads: -1, // Unlimited
        features: ['Premium support', 'Custom integrations', 'Dedicated account manager'],
        price: 9999
      }
    };

    const currentPlan = user.subscriptionPlan || 'basic';
    const planDetails = subscriptionPlans[currentPlan];
    const isActive = user.subscriptionStatus === 'active';
    
    const maxLoads = planDetails.maxLoads;
    const remainingLoads = maxLoads === -1 ? -1 : Math.max(0, maxLoads - loadsThisMonth);

    const subscriptionData = {
      plan: currentPlan,
      planName: planDetails.name,
      status: user.subscriptionStatus || 'inactive',
      isActive,
      features: {
        maxLoads,
        supportLevel: currentPlan === 'basic' ? 'basic' : currentPlan === 'pro' ? 'priority' : 'premium',
        analyticsLevel: currentPlan === 'basic' ? 'basic' : 'advanced',
        priorityListings: currentPlan !== 'basic'
      },
      usage: {
        loadsThisMonth,
        maxLoads,
        remainingLoads,
        usagePercentage: maxLoads === -1 ? 0 : Math.round((loadsThisMonth / maxLoads) * 100)
      },
      billing: {
        nextBillingDate: user.billing?.nextBillingDate || null,
        amount: planDetails.price,
        currency: 'KES',
        interval: 'monthly'
      },
      // Add any additional subscription features
      limits: {
        canCreateLoads: maxLoads === -1 || loadsThisMonth < maxLoads,
        canAccessAnalytics: true,
        canContactSupport: true
      }
    };

    res.json({
      status: 'success',
      data: subscriptionData
    });

  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching subscription status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/loads/analytics/dashboard
// @desc    Get dashboard analytics for current user
// @access  Private (Cargo Owners only)
router.get('/analytics/dashboard', corsHandler, auth, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can access dashboard analytics'
      });
    }

    const userId = req.user.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      // Basic load statistics
      const totalLoads = await Load.countDocuments({ postedBy: userId });
      const activeLoads = await Load.countDocuments({ 
        postedBy: userId, 
        isActive: true, 
        status: { $in: ['posted', 'receiving_bids', 'assigned', 'in_transit'] } 
      });
      const completedLoads = await Load.countDocuments({ 
        postedBy: userId, 
        status: 'delivered' 
      });
      const inTransitLoads = await Load.countDocuments({ 
        postedBy: userId, 
        status: 'in_transit' 
      });

      // Loads created this month
      const loadsThisMonth = await Load.countDocuments({
        postedBy: userId,
        createdAt: { $gte: startOfMonth }
      });

      // Get all user loads for detailed analytics
      const userLoads = await Load.find({ postedBy: userId }).lean();
      
      // Calculate average bids per load
      let totalBids = 0;
      if (userLoads.length > 0) {
        const loadIds = userLoads.map(load => load._id);
        const bidCounts = await Bid.aggregate([
          { $match: { load: { $in: loadIds }, status: { $nin: ['withdrawn', 'expired'] } } },
          { $group: { _id: '$load', count: { $sum: 1 } } }
        ]);
        totalBids = bidCounts.reduce((sum, item) => sum + item.count, 0);
      }
      
      const averageBidsPerLoad = userLoads.length > 0 ? totalBids / userLoads.length : 0;

      // Monthly performance data for charts (last 6 months)
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        
        const monthLoads = await Load.countDocuments({
          postedBy: userId,
          createdAt: { $gte: monthStart, $lte: monthEnd }
        });
        
        const monthCompleted = await Load.countDocuments({
          postedBy: userId,
          status: 'delivered',
          deliveredAt: { $gte: monthStart, $lte: monthEnd }
        });

        monthlyData.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          loads: monthLoads,
          completed: monthCompleted
        });
      }

      // Status distribution
      const statusDistribution = await Load.aggregate([
        { $match: { postedBy: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Recent activity (last 30 days)
      const recentLoads = await Load.find({
        postedBy: userId,
        createdAt: { $gte: thirtyDaysAgo }
      }).select('title status createdAt').sort({ createdAt: -1 }).limit(10);

      // Budget analytics
      const budgetStats = await Load.aggregate([
        { $match: { postedBy: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            avgBudget: { $avg: '$budget' },
            minBudget: { $min: '$budget' },
            maxBudget: { $max: '$budget' },
            totalBudget: { $sum: '$budget' }
          }
        }
      ]);

      const response = {
        status: 'success',
        data: {
          // Basic stats
          totalLoads,
          activeLoads,
          completedLoads,
          inTransitLoads,
          loadsThisMonth,
          averageBidsPerLoad: Math.round(averageBidsPerLoad * 100) / 100,
          totalBids,

          // Performance metrics
          completionRate: totalLoads > 0 ? Math.round((completedLoads / totalLoads) * 100) : 0,
          avgTimeToComplete: 0, // Could calculate from delivered loads
          
          // Charts data
          monthlyPerformance: monthlyData,
          statusDistribution: statusDistribution.map(item => ({
            status: item._id,
            count: item.count
          })),

          // Budget analytics
          budgetAnalytics: budgetStats[0] || {
            avgBudget: 0,
            minBudget: 0,
            maxBudget: 0,
            totalBudget: 0
          },

          // Recent activity
          recentActivity: recentLoads,

          // Calculated at
          calculatedAt: new Date()
        }
      };

      res.json(response);

    } catch (aggregationError) {
      console.error('Error in dashboard analytics aggregation:', aggregationError);
      
      // Fallback to basic stats if aggregation fails
      const basicStats = {
        totalLoads: await Load.countDocuments({ postedBy: userId }),
        activeLoads: await Load.countDocuments({ 
          postedBy: userId, 
          status: { $in: ['posted', 'receiving_bids', 'assigned', 'in_transit'] } 
        }),
        completedLoads: await Load.countDocuments({ 
          postedBy: userId, 
          status: 'delivered' 
        }),
        inTransitLoads: await Load.countDocuments({ 
          postedBy: userId, 
          status: 'in_transit' 
        }),
        averageBidsPerLoad: 0
      };

      res.json({
        status: 'success',
        data: basicStats,
        fallback: true
      });
    }

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching dashboard analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/loads
// @desc    Create a new load (CARGO OWNER AUTHENTICATION REQUIRED)
// @access  Private (Cargo Owners only)
router.post('/', corsHandler, auth, [
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
  cargoOwnerName: req.user.cargoOwnerProfile?.companyName || req.user.companyName || req.user.name,
  status: 'posted',
  isActive: true,
  biddingEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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

// =====================================================================
// PUBLIC AND SEMI-PUBLIC ROUTES (Order matters - more specific first)
// =====================================================================

// @route   GET /api/loads
// @desc    Get loads with search, filter, and pagination (PUBLIC ACCESS)
// @access  Public (with optional authentication)
router.get('/', corsHandler, optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('search').optional().isLength({ max: 100 }).withMessage('Search query too long'),
  query('cargoType').optional().isString().withMessage('Invalid cargo type'),
  query('vehicleType').optional().isString().withMessage('Invalid vehicle type'),
  query('pickupLocation').optional().isString().withMessage('Invalid pickup location'),
  query('deliveryLocation').optional().isString().withMessage('Invalid delivery location'),
  query('minBudget').optional().isFloat({ min: 0 }).withMessage('Invalid minimum budget'),
  query('maxBudget').optional().isFloat({ min: 0 }).withMessage('Invalid maximum budget'),
  query('minWeight').optional().isFloat({ min: 0 }).withMessage('Invalid minimum weight'),
  query('maxWeight').optional().isFloat({ min: 0 }).withMessage('Invalid maximum weight'),
  query('urgentOnly').optional().isBoolean().withMessage('urgentOnly must be boolean'),
  query('sortBy').optional().isIn(['createdAt', 'budget', 'weight', 'pickupDate', 'boostLevel']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Invalid sort order')
], async (req, res) => {
  try {
    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request parameters',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 12,
      search,
      cargoType,
      vehicleType,
      pickupLocation,
      deliveryLocation,
      minBudget,
      maxBudget,
      minWeight,
      maxWeight,
      urgentOnly,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    console.log('Load search request:', { 
      page, limit, search, filters: { cargoType, vehicleType, pickupLocation, deliveryLocation }
    });

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected, state:', mongoose.connection.readyState);
      return res.status(500).json({
        status: 'error',
        message: 'Database connection not available. Please try again later.'
      });
    }

    // Build the base query - only show loads that can receive bids
    let query = {
      status: { $in: ['posted', 'receiving_bids'] },
      isActive: true,
      // Ensure pickup date is in the future or within reasonable range
      $or: [
        { pickupDate: { $gte: new Date() } },
        { pickupDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Allow 1 day past
      ]
    };

    // Apply text search
    if (search && search.trim()) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: new RegExp(search.trim(), 'i') },
          { description: new RegExp(search.trim(), 'i') },
          { pickupLocation: new RegExp(search.trim(), 'i') },
          { deliveryLocation: new RegExp(search.trim(), 'i') }
        ]
      });
    }

    // Apply filters
    if (cargoType && cargoType.trim()) {
      query.cargoType = new RegExp(cargoType.trim(), 'i');
    }

    if (vehicleType && vehicleType.trim()) {
      query.vehicleType = new RegExp(vehicleType.trim(), 'i');
    }

    if (pickupLocation && pickupLocation.trim()) {
      query.pickupLocation = new RegExp(pickupLocation.trim(), 'i');
    }

    if (deliveryLocation && deliveryLocation.trim()) {
      query.deliveryLocation = new RegExp(deliveryLocation.trim(), 'i');
    }

    // Budget range filter
    if (minBudget || maxBudget) {
      query.budget = {};
      if (minBudget) query.budget.$gte = parseFloat(minBudget);
      if (maxBudget) query.budget.$lte = parseFloat(maxBudget);
    }

    // Weight range filter
    if (minWeight || maxWeight) {
      query.weight = {};
      if (minWeight) query.weight.$gte = parseFloat(minWeight);
      if (maxWeight) query.weight.$lte = parseFloat(maxWeight);
    }

    // Urgent filter
    if (urgentOnly === 'true') {
      query.isUrgent = true;
    }

    console.log('Final query:', JSON.stringify(query, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Create sort object - prioritize boosted loads
    let sortOptions = {};
    
    // First sort by boost level (higher boost = higher priority)
    sortOptions.boostLevel = -1;
    sortOptions.isBoosted = -1;
    
    // Then by the requested sort field
    sortOptions[sortBy] = sortDirection;
    
    // Finally by creation date as tiebreaker
    if (sortBy !== 'createdAt') {
      sortOptions.createdAt = -1;
    }
    try {
       // Get loads with cargo owner information
    const loads = await Load.find(query)
      .populate({
        path: 'postedBy',
        select: 'name companyName cargoOwnerProfile.companyName location rating isVerified',
        options: { 
          strictPopulate: false 
        }
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
      .exec();

      // Get total count for pagination
      const totalLoads = await Load.countDocuments(query);
      const totalPages = Math.ceil(totalLoads / parseInt(limit));

      // Get bid counts separately for better error handling
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

      // Transform data for frontend with safe property access
     // Transform data to include cargo owner name
    const transformedLoads = loads.map(load => {
      // Get cargo owner name from different possible sources
      const cargoOwnerName = load.postedBy?.cargoOwnerProfile?.companyName 
        || load.postedBy?.companyName 
        || load.postedBy?.name 
        || 'Anonymous';

      return {
        _id: load._id,
        title: load.title || 'Untitled Load',
        description: load.description || '',
        cargoType: load.cargoType || 'other',
        weight: load.weight || 0,
        pickupLocation: load.pickupLocation || '',
        deliveryLocation: load.deliveryLocation || '',
        budget: load.budget || 0,
        status: load.status,
        createdAt: load.createdAt,
        
        // Cargo owner information
        cargoOwnerName, 
        postedBy: {
          name: load.postedBy?.name || 'Anonymous',
          companyName: cargoOwnerName,
          location: load.postedBy?.location || '',
          rating: load.postedBy?.rating || 4.5,
          isVerified: load.postedBy?.isVerified || false
        },
         };
    });
      // Response
      res.json({
        status: 'success',
        data: {
          loads: transformedLoads,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalLoads,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1,
            limit: parseInt(limit)
          },
          filters: {
            applied: {
              search: search || '',
              cargoType: cargoType || '',
              vehicleType: vehicleType || '',
              pickupLocation: pickupLocation || '',
              deliveryLocation: deliveryLocation || '',
              minBudget: minBudget || '',
              maxBudget: maxBudget || '',
              minWeight: minWeight || '',
              maxWeight: maxWeight || '',
              urgentOnly: urgentOnly || '',
              sortBy,
              sortOrder
            }
          }
        }
      });

    } catch (dbError) {
      console.error('Database query error:', dbError);
      
      // Handle specific database errors
      if (dbError.name === 'MongoServerError' || dbError.name === 'MongoError') {
        return res.status(500).json({
          status: 'error',
          message: 'Database query failed. Please try again.',
          error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
        });
      }

      if (dbError.name === 'CastError') {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid query parameters provided'
        });
      }

      throw dbError; // Re-throw to be caught by outer catch
    }

  } catch (error) {
    console.error('Load search error:', error);
    
    // Handle different types of errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    if (error.message && error.message.includes('Database connection')) {
      return res.status(500).json({
        status: 'error',
        message: 'Database connection error. Please try again later.'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error occurred while fetching loads. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/loads/:id
// @desc    Update a load (AUTHENTICATION REQUIRED - Load owner only)
// @access  Private (Load owner or admin)
router.put('/:id', corsHandler, auth, [
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
router.delete('/:id', corsHandler, auth, async (req, res) => {
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
        const User = require('../models/user');
        const driver = await User.findById(assignedDriver);
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
    const User = require('../models/user');
    const users = await User.find(
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

module.exports = router;