//  routes/loads.js 
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const Load = require('../models/load');
const Bid = require('../models/bid');
const auth = require('../middleware/auth');
const corsHandler = require('../middleware/corsHandler');

router.use(corsHandler);


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
// @route   GET /api/loads/subscription-status
// @desc    Get current user's subscription status
// @access  Private
router.get('/subscription-status', auth, async (req, res) => {
  try {
    console.log('Subscription status request for user:', req.user?.id);

    // Check authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized - no valid user session'
      });
    }

    // Get user with subscription details
    const User = require('../models/user');
    const user = await User.findById(req.user.id)
      .select('subscriptionPlan subscriptionStatus subscriptionFeatures billing name email')
      .lean();

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    console.log('Found user:', { id: user._id, plan: user.subscriptionPlan, status: user.subscriptionStatus });

    // Get current month's load count for usage calculation
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let loadsThisMonth = 0;
    try {
      loadsThisMonth = await Load.countDocuments({
        postedBy: req.user.id,
        createdAt: { $gte: startOfMonth }
      });
    } catch (loadCountError) {
      console.warn('Error counting loads:', loadCountError);
      // Continue with 0 count
    }

    // Define subscription plans with fallbacks
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
        price: 999
      },
      business: {
        name: 'Business Plan',
        maxLoads: 100, 
        features: ['Premium support', 'Custom integrations', 'Dedicated account manager'],
        price: 2499
      },
      unlimited: {
        name: 'Unlimited Plan',
        maxLoads: -1,
        features: ['Premium support', 'Unlimited loads', 'Custom integrations'],
        price: 4999
      }
    };

    const currentPlan = user.subscriptionPlan || 'basic';
    const planDetails = subscriptionPlans[currentPlan] || subscriptionPlans.basic;
    const isActive = user.subscriptionStatus === 'active' || currentPlan === 'basic';
    
    const maxLoads = planDetails.maxLoads;
    const remainingLoads = maxLoads === -1 ? -1 : Math.max(0, maxLoads - loadsThisMonth);

    const subscriptionData = {
      plan: currentPlan,
      planName: planDetails.name,
      status: user.subscriptionStatus || (currentPlan === 'basic' ? 'active' : 'inactive'),
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
      limits: {
        canCreateLoads: maxLoads === -1 || loadsThisMonth < maxLoads,
        canAccessAnalytics: true,
        canContactSupport: true
      }
    };

    console.log('Returning subscription data:', subscriptionData);

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


// @route   GET /api/loads/user/my-loads
// @desc    Get cargo owner's loads with detailed information
// @access  Private (Cargo owners only)

router.get('/user/my-loads', auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['posted','receiving_bids','driver_assigned','assigned','in_transit','delivered','cancelled']),
  query('sortBy').optional().isIn(['createdAt','budget','title','status']),
  query('sortOrder').optional().isIn(['asc','desc'])
], async (req, res) => {
  console.log('=== MY LOADS REQUEST START ===');

  // ✅ AUTHENTICATION FIRST - avoid undefined req.user errors
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized or invalid token'
    });
  }

  // ✅ ROLE CHECK EARLY
  if (req.user.userType !== 'cargo_owner') {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied. Cargo owners only.'
    });
  }

  // ✅ Validate query parameters
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { page = 1, limit = 50, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  // ✅ DB connection check
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      status: 'error',
      message: 'Database connection unavailable. Please try again later.'
    });
  }

  // Build query
  let queryObj = { postedBy: new mongoose.Types.ObjectId(req.user.id) };
  if (status) queryObj.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortDirection = sortOrder === 'desc' ? -1 : 1;

  try {
    // MAIN LOAD FETCH
    const loads = await Load.find(queryObj)
      .populate({
        path: 'postedBy',
        select: 'name email phone companyName cargoOwnerProfile isVerified',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'assignedDriver',
        select: 'name phone email location vehicleType rating',
        options: { strictPopulate: false }
      })
      .sort({ [sortBy]: sortDirection, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean()
      .exec();

    const totalLoads = await Load.countDocuments(queryObj);
    const totalPages = Math.ceil(totalLoads / parseInt(limit));

    // BID COUNTS
    let bidMap = {};
    if (loads.length > 0) {
      try {
        const ids = loads.map(l => l._id);
        const bidCounts = await Bid.aggregate([
          { $match: { load: { $in: ids }, status: { $nin: ['withdrawn','expired'] } } },
          { $group: { _id: '$load', count: { $sum: 1 } } }
        ]);
        bidCounts.forEach(item => {
          bidMap[item._id.toString()] = item.count;
        });
      } catch (bidErr) {
        console.warn('Error fetching bids:', bidErr.message);
      }
    }

    const transformed = loads.map(l => {
      const cargoOwnerName =
        l?.postedBy?.cargoOwnerProfile?.companyName ||
        l?.postedBy?.companyName ||
        l?.postedBy?.name ||
        'Anonymous Cargo Owner';

      return {
        _id: l._id,
        title: l.title || 'Untitled Load',
        description: l.description || '',
        pickupLocation: l.pickupLocation || '',
        deliveryLocation: l.deliveryLocation || '',
        // ... other fields ...
        budget: l.budget || 0,
        status: l.status || 'posted',
        createdAt: l.createdAt,
        isUrgent: l.isUrgent || false,
        bidCount: bidMap[l._id.toString()] || 0,
        cargoOwnerName,
        postedByName: cargoOwnerName
      };
    });

    // SUMMARY STATS
    let summary = {
      totalLoads: 0, activeLoads: 0, completedLoads: 0, totalBudget: 0, avgBudget: 0
    };

    try {
      const statsResult = await Load.aggregate([
        { $match: { postedBy: new mongoose.Types.ObjectId(req.user.id) } },
        {
          $group: {
            _id: null,
            totalLoads: { $sum: 1 },
            activeLoads: { $sum: { $cond: [{ $in: ['$status',['posted','receiving_bids', 'assigned','in_transit']]}, 1, 0] } },
            completedLoads: { $sum: { $cond: [{ $eq: ['$status','delivered']}, 1, 0] } },
            totalBudget: { $sum: '$budget' },
            avgBudget: { $avg: '$budget' }
          }
        }
      ]);
      if (statsResult.length > 0) summary = statsResult[0];
    } catch (statsErr) {
      console.warn('Summary stats error:', statsErr.message);
    }

    // ✅ SUCCESS RESPONSE
    return res.json({
      status: 'success',
      data: {
        loads: transformed,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLoads,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        summary,
        filters: { status: status || 'all', sortBy, sortOrder }
      }
    });
  } catch (err) {
    console.error('=== MY LOADS **SERVER ERROR** ===');
    console.error(err);

    // Generic server error
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching loads',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// @route   GET /api/loads/analytics/dashboard
// @desc    Get dashboard analytics for current user
// @access  Private (Cargo Owners only)
router.get('/analytics/dashboard',  auth, async (req, res) => {
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
// @access  Private
router.post('/', auth, [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ min: 5, max: 100 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ min: 10, max: 1000 }),
  body('pickupLocation').trim().notEmpty().withMessage('Pickup location is required'),
  body('deliveryLocation').trim().notEmpty().withMessage('Delivery location is required'),
  body('weight').isFloat({ min: 0.1 }).withMessage('Weight must be at least 0.1 kg'),
  body('budget').isFloat({ min: 100 }).withMessage('Budget must be at least KES 100'),
  body('vehicleCapacityRequired').isFloat({ min: 0.1 }).withMessage('Vehicle capacity must be at least 0.1 tons'),
  body('pickupDate').isISO8601().withMessage('Invalid pickup date format'),
  body('deliveryDate').isISO8601().withMessage('Invalid delivery date format'),
  body('cargoType').isIn([
    'electronics', 'furniture', 'construction_materials', 'food_beverages',
    'automotive_parts', 'textiles', 'chemicals', 'machinery', 'medical_supplies',
    'agricultural_products', 'fragile_items', 'hazardous_materials', 'livestock',
    'containers', 'other'
  ]).withMessage('Invalid cargo type'),
  body('vehicleType').isIn([
    'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck',
    'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
  ]).withMessage('Invalid vehicle type')
], async (req, res) => {
  try {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Enhanced user authentication and authorization check
    if (!req.user || !req.user.id) {
      console.error('No user found in request object');
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required - no user found'
      });
    }

    // Check user authorization
    if (req.user.userType !== 'cargo_owner') {
      console.error('User type check failed:', req.user.userType);
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can create loads'
      });
    }

    // FIXED: Get the user from the correct collection based on userType
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    let user;
    
    try {
      // Get user ID from various possible sources
      const userId = req.user.id || req.user._id || req.user.userId;
      console.log('Looking for user with ID:', userId, 'Type:', req.user.userType);
      
      // Convert to ObjectId if it's a string
      const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;

      // CRITICAL FIX: Search in the correct collection based on userType
      if (req.user.userType === 'cargo_owner') {
        user = await db.collection('cargo-owners').findOne({ _id: userObjectId });
      } else if (req.user.userType === 'driver') {
        user = await db.collection('drivers').findOne({ _id: userObjectId });
      }
      
      // If not found by ID, try by email as fallback
      if (!user && req.user.email) {
        console.log('User not found by ID, trying email:', req.user.email);
        
        if (req.user.userType === 'cargo_owner') {
          user = await db.collection('cargo-owners').findOne({ email: req.user.email });
        } else if (req.user.userType === 'driver') {
          user = await db.collection('drivers').findOne({ email: req.user.email });
        }
      }
      
      if (!user) {
        console.error('User not found in database:', {
          searchedId: userId,
          userType: req.user.userType,
          email: req.user.email,
          userKeys: Object.keys(req.user)
        });
        
        return res.status(404).json({
          status: 'error',
          message: 'User not found in database. Please log out and log back in.',
          debug: process.env.NODE_ENV === 'development' ? {
            searchedId: userId,
            userType: req.user.userType,
            userKeys: Object.keys(req.user)
          } : undefined
        });
      }

      console.log('User found successfully:', { 
        id: user._id, 
        email: user.email, 
        name: user.name,
        userType: req.user.userType 
      });

    } catch (dbError) {
      console.error('Database error finding user:', dbError);
      return res.status(500).json({
        status: 'error',
        message: 'Database error while finding user',
        error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

    // Date validation
    const pickupDate = new Date(req.body.pickupDate);
    const deliveryDate = new Date(req.body.deliveryDate);
    const now = new Date();

    if (pickupDate < now) {
      return res.status(400).json({
        status: 'error',
        message: 'Pickup date cannot be in the past'
      });
    }

    if (pickupDate >= deliveryDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Delivery date must be after pickup date'
      });
    }

    // IMPROVED: Enhanced cargo owner name extraction
    const getCargoOwnerName = (userData) => {
      // Define all possible name sources in order of preference
      const nameSources = [
        // From request body (if explicitly provided)
        req.body.cargoOwnerName,
        req.body.postedByName,
        
        // From user profile - company names first
        userData?.cargoOwnerProfile?.companyName,
        userData?.companyName,
        userData?.profile?.companyName,
        userData?.businessProfile?.companyName,
        
        // From user profile - personal names
        userData?.name,
        userData?.fullName,
        userData?.firstName && userData?.lastName ? `${userData.firstName} ${userData.lastName}` : null,
        
        // Last resort - email username
        userData?.email ? userData.email.split('@')[0] : null
      ];

      // Find the first valid name
      for (const nameOption of nameSources) {
        if (nameOption && 
            typeof nameOption === 'string' && 
            nameOption.trim().length > 0 && 
            nameOption.trim().toLowerCase() !== 'anonymous') {
          return nameOption.trim();
        }
      }
      return 'Anonymous Cargo Owner';
    };

    const cargoOwnerName = getCargoOwnerName(user);

    // Prepare contact person information with fallbacks
    const contactPerson = {
      name: req.body.contactPerson?.name || user.name || cargoOwnerName,
      phone: req.body.contactPerson?.phone || user.phone || '',
      email: req.body.contactPerson?.email || user.email || ''
    };

    // Prepare comprehensive load data
    const loadData = {
      // Basic load information
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      pickupLocation: req.body.pickupLocation.trim(),
      deliveryLocation: req.body.deliveryLocation.trim(),
      pickupAddress: req.body.pickupAddress?.trim() || '',
      deliveryAddress: req.body.deliveryAddress?.trim() || '',
      
      // Cargo specifications
      weight: parseFloat(req.body.weight),
      cargoType: req.body.cargoType,
      vehicleType: req.body.vehicleType,
      vehicleCapacityRequired: parseFloat(req.body.vehicleCapacityRequired),
      budget: parseFloat(req.body.budget),
      
      // Dates and timing
      pickupDate: pickupDate.toISOString(),
      deliveryDate: deliveryDate.toISOString(),
      biddingEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      
      // Special requirements and instructions
      specialInstructions: req.body.specialInstructions?.trim() || '',
      specialRequirements: req.body.specialRequirements?.trim() || '',
      isUrgent: Boolean(req.body.isUrgent),
      
      // CRITICAL: Multiple cargo owner name fields for consistency
      cargoOwnerName: cargoOwnerName,
      postedByName: cargoOwnerName,
      
      // Contact and user information - Use the actual found user ID
      contactPerson: contactPerson,
      postedBy: user._id, // Use the actual user _id from database
      cargoOwnerId: user._id, // ADDED: Explicit cargo owner ID field
      
      // Metadata for tracking and analytics
      createdBy: {
        userId: user._id, // Use the actual user _id
        userType: req.user.userType,
        name: cargoOwnerName,
        timestamp: new Date()
      },
      
      // Status and lifecycle
      status: 'available', 
      isActive: true,
      
      // Additional business fields
      paymentTerms: req.body.paymentTerms || 'on_delivery',
      insuranceRequired: Boolean(req.body.insuranceRequired),
      insuranceValue: req.body.insuranceValue ? parseFloat(req.body.insuranceValue) : null,
      
      // Coordinates if provided
      pickupCoordinates: req.body.pickupCoordinates || null,
      deliveryCoordinates: req.body.deliveryCoordinates || null,
      
      // Initialize counters
      viewCount: 0,
      bidCount: 0,
      
      // Boost and priority settings
      isBoosted: false,
      boostLevel: 0,
      isPriorityListing: false,
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Calculate distance if coordinates are provided
    if (loadData.pickupCoordinates && loadData.deliveryCoordinates) {
      const pickup = loadData.pickupCoordinates;
      const delivery = loadData.deliveryCoordinates;
      
      if (pickup.lat && pickup.lng && delivery.lat && delivery.lng) {
        loadData.distance = calculateDistance(pickup.lat, pickup.lng, delivery.lat, delivery.lng);
      }
    }

    console.log('Creating load with data:', {
      cargoOwnerId: loadData.cargoOwnerId,
      cargoOwnerName: loadData.cargoOwnerName,
      title: loadData.title,
      status: loadData.status
    });

    // Create and save the load using direct database insertion for consistency
    try {
      const loadsCollection = db.collection('loads');
      const result = await loadsCollection.insertOne(loadData);
      
      if (!result.insertedId) {
        throw new Error('Failed to insert load into database');
      }

      console.log('Load saved successfully with ID:', result.insertedId);
      
      // Retrieve the created load
      const createdLoad = await loadsCollection.findOne({ _id: result.insertedId });
      
      // Ensure cargo owner name is in the response
      const responseLoad = {
        ...createdLoad,
        cargoOwnerName: cargoOwnerName,
        postedByName: cargoOwnerName,
        bidCount: 0,
        statusHistory: [{
          status: 'available',
          changedBy: user._id,
          changedAt: new Date(),
          reason: 'Load created',
          userRole: req.user.userType
        }],
        // Add populated user data for response
        postedByDetails: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          location: user.location,
          isVerified: user.isVerified || false,
          rating: user.cargoOwnerProfile?.rating || 0
        }
      };

      console.log('=== LOAD CREATED SUCCESSFULLY ===');
      console.log('Response load:', {
        id: responseLoad._id,
        cargoOwnerId: responseLoad.cargoOwnerId,
        cargoOwnerName: responseLoad.cargoOwnerName,
        title: responseLoad.title,
        status: responseLoad.status
      });

      return res.status(201).json({
        status: 'success',
        message: 'Load created successfully',
        data: {
          load: responseLoad
        }
      });

    } catch (saveError) {
      console.error('Error saving load:', saveError);
      throw saveError;
    }

  } catch (error) {
    console.error('=== CREATE LOAD ERROR ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        status: 'error',
        message: 'Load validation failed',
        errors: validationErrors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Duplicate load detected',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    return res.status(500).json({
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
// @access  Public
router.get('/', optionalAuth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('search').optional().isLength({ max: 100 }),
  query('cargoType').optional().isString(),
  query('vehicleType').optional().isString(),
  query('pickupLocation').optional().isString(),
  query('deliveryLocation').optional().isString(),
  query('minBudget').optional().isFloat({ min: 0 }),
  query('maxBudget').optional().isFloat({ min: 0 }),
  query('minWeight').optional().isFloat({ min: 0 }),
  query('maxWeight').optional().isFloat({ min: 0 }),
  query('urgentOnly').optional().isBoolean(),
  query('sortBy').optional()
    .isIn(['createdAt', 'budget', 'weight', 'pickupDate', 'boostLevel']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
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

    // Ensure DB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        status: 'error',
        message: 'Database not connected. Please try again later.'
      });
    }

    // Base query
    const baseQuery = {
      status: { $in: ['posted', 'receiving_bids'] },
      isActive: true,
      pickupDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // allow slight past tolerance
    };

    // Text search
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      baseQuery.$or = [
        { title: regex },
        { description: regex },
        { pickupLocation: regex },
        { deliveryLocation: regex }
      ];
    }

    // Filters
    if (cargoType) baseQuery.cargoType = new RegExp(cargoType, 'i');
    if (vehicleType) baseQuery.vehicleType = new RegExp(vehicleType, 'i');
    if (pickupLocation) baseQuery.pickupLocation = new RegExp(pickupLocation, 'i');
    if (deliveryLocation) baseQuery.deliveryLocation = new RegExp(deliveryLocation, 'i');

    // Budget filter
    if (minBudget || maxBudget) {
      baseQuery.budget = {};
      if (minBudget) baseQuery.budget.$gte = parseFloat(minBudget);
      if (maxBudget) baseQuery.budget.$lte = parseFloat(maxBudget);
    }

    // Weight filter
    if (minWeight || maxWeight) {
      baseQuery.weight = {};
      if (minWeight) baseQuery.weight.$gte = parseFloat(minWeight);
      if (maxWeight) baseQuery.weight.$lte = parseFloat(maxWeight);
    }

    if (urgentOnly === 'true' || urgentOnly === true) {
      baseQuery.isUrgent = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    // Sort configuration
    const sortOptions = {
      boostLevel: -1,
      isBoosted: -1,
      [sortBy]: sortDirection
    };
    if (sortBy !== 'createdAt') {
      sortOptions['createdAt'] = -1;
    }

    // Aggregation pipeline with postedBy user info
    const pipeline = [
      { $match: baseQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'postedBy',
          foreignField: '_id',
          as: 'postedByUser'
        }
      },
      { $addFields: { postedBy: { $arrayElemAt: ['$postedByUser', 0] } } },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          cargoType: 1,
          weight: 1,
          pickupLocation: 1,
          deliveryLocation: 1,
          budget: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          isUrgent: 1,
          isPriorityListing: 1,
          isBoosted: 1,
          boostLevel: 1,
          vehicleType: 1,
          pickupDate: 1,
          deliveryDate: 1,
          // Extract name
          cargoOwnerName: {
            $ifNull: [
              '$postedBy.cargoOwnerProfile.companyName',
              { $ifNull: ['$postedBy.companyName', { $ifNull: ['$postedBy.name', 'Anonymous'] }] }
            ]
          },
          postedBy: {
            _id: '$postedBy._id',
            name: '$postedBy.name',
            companyName: {
              $ifNull: [
                '$postedBy.cargoOwnerProfile.companyName',
                { $ifNull: ['$postedBy.companyName', '$postedBy.name'] }
              ]
            },
            rating: { $ifNull: ['$postedBy.rating', 4.5] },
            isVerified: { $ifNull: ['$postedBy.isVerified', false] },
            location: '$postedBy.location'
          }
        }
      },
      { $sort: sortOptions },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    const loads = await Load.aggregate(pipeline);
    const totalLoads = await Load.countDocuments(baseQuery);
    const totalPages = Math.ceil(totalLoads / parseInt(limit));

    // Response
    return res.json({
      status: 'success',
      data: {
        loads,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLoads,
          limit: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (err) {
    console.error('GET /api/loads error:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching loads. Please try again.'
    });
  }
});


// @route   PUT /api/loads/:id
// @desc    Update a load (AUTHENTICATION REQUIRED - Load owner only)
// @access  Private (Load owner or admin)
router.put('/:id',  auth, [
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
router.delete('/:id',  auth, async (req, res) => {
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
router.get('/:id',  optionalAuth, async (req, res) => {
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
router.patch('/:id/status',  auth, [
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
router.get('/:userId/my-loads',  auth, [
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
router.get('/:id/status-history',  auth, async (req, res) => {
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
router.post('/:id/bid',  auth, [
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