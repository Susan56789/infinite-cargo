// routes/drivers.js - Complete Driver Management Routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const corsHandler = require('../middleware/corsHandler');


router.use(corsHandler);

// Rate limiting
const driverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  }
});

// Contact rate limiting (more restrictive)
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Only 10 contact requests per hour per IP
  message: {
    status: 'error',
    message: 'Too many contact requests, please try again later.'
  }
});

// Profile validation middleware
const profileValidation = [
  body('vehicleType')
    .optional()
    .isIn([
      'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck',
      'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
    ])
    .withMessage('Invalid vehicle type'),
    
  body('vehicleCapacity')
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage('Vehicle capacity must be at least 0.1 tonnes'),
    
  body('licenseNumber')
    .optional()
    .isLength({ min: 5, max: 20 })
    .withMessage('License number must be between 5 and 20 characters'),
    
  body('experienceYears')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Experience years must be between 0 and 50'),
    
  body('bio')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Bio cannot exceed 1000 characters'),

  body('coordinates.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude required'),

  body('coordinates.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude required')
];

// @route   GET /api/drivers
// @desc    Get all drivers with filtering
// @access  Public
router.get('/',  [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('location').optional().trim(),
  query('vehicleType').optional().isIn([
    'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck',
    'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
  ]),
  query('minCapacity').optional().isFloat({ min: 0 }),
  query('maxCapacity').optional().isFloat({ min: 0 }),
  query('isAvailable').optional().isBoolean(),
  query('isVerified').optional().isBoolean(),
  query('minRating').optional().isFloat({ min: 0, max: 5 })
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
      location,
      vehicleType,
      minCapacity,
      maxCapacity,
      isAvailable,
      isVerified,
      minRating
    } = req.query;

    const db = mongoose.connection.db;
    const collection = db.collection('drivers');

    // Build query
    let query = { isActive: { $ne: false } };

    if (location) {
      query.location = new RegExp(location, 'i');
    }

    if (vehicleType) {
      query.vehicleType = vehicleType;
    }

    if (minCapacity || maxCapacity) {
      query.vehicleCapacity = {};
      if (minCapacity) query.vehicleCapacity.$gte = parseFloat(minCapacity);
      if (maxCapacity) query.vehicleCapacity.$lte = parseFloat(maxCapacity);
    }

    if (isAvailable !== undefined) {
      query['driverProfile.isAvailable'] = isAvailable === 'true';
    }

    if (isVerified !== undefined) {
      query['driverProfile.verified'] = isVerified === 'true';
    }

    if (minRating) {
      query['driverProfile.rating'] = { $gte: parseFloat(minRating) };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const drivers = await collection.find(query)
      .project({
        password: 0,
        loginHistory: 0,
        registrationIp: 0,
        failedLoginAttempts: 0
      })
      .sort({ 'driverProfile.rating': -1, 'driverProfile.completedJobs': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const totalDrivers = await collection.countDocuments(query);
    const totalPages = Math.ceil(totalDrivers / parseInt(limit));

    res.json({
      status: 'success',
      data: {
        drivers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalDrivers,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        filters: {
          location,
          vehicleType,
          capacityRange: { min: minCapacity, max: maxCapacity },
          isAvailable,
          isVerified,
          minRating
        }
      }
    });

  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/drivers/nearby
// @desc    Get nearby drivers based on coordinates
// @access  Public
router.get('/nearby/search',  [
  query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  query('radius').optional().isFloat({ min: 1, max: 1000 }).withMessage('Radius must be between 1 and 1000 km'),
  query('vehicleType').optional().isIn([
    'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck',
    'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
  ])
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

    const { latitude, longitude, radius = 50, vehicleType } = req.query;

    const db = mongoose.connection.db;
    const collection = db.collection('drivers');

    // Build aggregation pipeline for geospatial query
    let pipeline = [];

    // Match basic criteria
    let matchCriteria = {
      'driverProfile.isAvailable': true,
      'driverProfile.verified': true,
      'coordinates.latitude': { $exists: true },
      'coordinates.longitude': { $exists: true },
      isActive: { $ne: false }
    };

    if (vehicleType) {
      matchCriteria.vehicleType = vehicleType;
    }

    pipeline.push({ $match: matchCriteria });

    // Add geospatial query if coordinates exist in driver profiles
    pipeline.push({
      $addFields: {
        distance: {
          $multiply: [
            {
              $acos: {
                $add: [
                  {
                    $multiply: [
                      { $sin: { $degreesToRadians: parseFloat(latitude) } },
                      { $sin: { $degreesToRadians: "$coordinates.latitude" } }
                    ]
                  },
                  {
                    $multiply: [
                      { $cos: { $degreesToRadians: parseFloat(latitude) } },
                      { $cos: { $degreesToRadians: "$coordinates.latitude" } },
                      { $cos: { $degreesToRadians: { $subtract: [parseFloat(longitude), "$coordinates.longitude"] } } }
                    ]
                  }
                ]
              }
            },
            6371 // Earth's radius in km
          ]
        }
      }
    });

    // Filter by radius
    pipeline.push({
      $match: {
        distance: { $lte: parseFloat(radius) }
      }
    });

    // Sort by distance and rating
    pipeline.push({
      $sort: {
        distance: 1,
        'driverProfile.rating': -1
      }
    });

    // Project required fields
    pipeline.push({
      $project: {
        password: 0,
        loginHistory: 0,
        registrationIp: 0,
        failedLoginAttempts: 0
      }
    });

    // Limit results
    pipeline.push({ $limit: 50 });

    const nearbyDrivers = await collection.aggregate(pipeline).toArray();

    res.json({
      status: 'success',
      data: {
        drivers: nearbyDrivers,
        searchCriteria: {
          center: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
          radius: parseFloat(radius),
          vehicleType
        },
        totalFound: nearbyDrivers.length
      }
    });

  } catch (error) {
    console.error('Get nearby drivers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error finding nearby drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/drivers/stats
// @desc    Get driver statistics (own stats only) - FIXED VERSION
// @access  Private (Driver only)
router.get('/stats', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can view driver statistics'
      });
    }

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');
    const bidsCollection = db.collection('bids');
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    // Get current date for monthly calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Parallel queries for better performance
    const [
      totalBookings,
      completedBookings,
      activeBookings,
      cancelledBookings,
      ratingStats,
      monthlyEarnings,
      lastMonthEarnings,
      totalEarnings,
      totalBids,
      acceptedBids
    ] = await Promise.all([
      // Total bookings
      bookingsCollection.countDocuments({ driverId }),
      
      // Completed bookings
      bookingsCollection.countDocuments({ driverId, status: 'completed' }),
      
      // Active bookings (accepted, in_progress, driver_assigned)
      bookingsCollection.countDocuments({ 
        driverId, 
        status: { $in: ['accepted', 'in_progress', 'driver_assigned'] } 
      }),
      
      // Cancelled bookings
      bookingsCollection.countDocuments({ driverId, status: 'cancelled' }),
      
      // Average rating
      bookingsCollection.aggregate([
        { $match: { driverId, rating: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]).toArray(),
      
      // Current month earnings
      bookingsCollection.aggregate([
        {
          $match: {
            driverId,
            status: 'completed',
            completedAt: { $gte: startOfMonth },
            totalAmount: { $exists: true, $ne: null }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]).toArray(),
      
      // Last month earnings
      bookingsCollection.aggregate([
        {
          $match: {
            driverId,
            status: 'completed',
            completedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
            totalAmount: { $exists: true, $ne: null }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]).toArray(),
      
      // Total earnings
      bookingsCollection.aggregate([
        {
          $match: {
            driverId,
            status: 'completed',
            totalAmount: { $exists: true, $ne: null }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]).toArray(),
      
      // Total bids
      bidsCollection.countDocuments({ driverId }),
      
      // Accepted bids
      bidsCollection.countDocuments({ driverId, status: 'accepted' })
    ]);

    // Calculate success rate
    const successRate = totalBookings > 0 ? 
      Math.round((completedBookings / totalBookings) * 100) : 0;

    // Get average rating
    const averageRating = ratingStats.length > 0 ? 
      Math.round(ratingStats[0].avgRating * 10) / 10 : 0;

    // Extract earnings
    const currentMonthEarnings = monthlyEarnings.length > 0 ? monthlyEarnings[0].total : 0;
    const previousMonthEarnings = lastMonthEarnings.length > 0 ? lastMonthEarnings[0].total : 0;
    const allTimeEarnings = totalEarnings.length > 0 ? totalEarnings[0].total : 0;

    res.json({
      status: 'success',
      data: {
        stats: {
          totalJobs: totalBookings,
          activeJobs: activeBookings,
          completedJobs: completedBookings,
          cancelledJobs: cancelledBookings,
          successRate,
          completionRate: successRate, // Alias for compatibility
          averageRating,
          rating: averageRating, // Alias for compatibility
          totalBids,
          acceptedBids,
          monthlyEarnings: currentMonthEarnings,
          totalEarnings: allTimeEarnings
        },
        earnings: {
          thisMonth: currentMonthEarnings,
          lastMonth: previousMonthEarnings,
          total: allTimeEarnings
        }
      }
    });

  } catch (error) {
    console.error('Get driver stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/drivers/dashboard
// @desc    Get comprehensive driver dashboard data
// @access  Private (Driver only)
router.get('/dashboard', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can access driver dashboard'
      });
    }

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');
    const loadsCollection = db.collection('loads');
    const bidsCollection = db.collection('bids');
    const driversCollection = db.collection('drivers');
    const notificationsCollection = db.collection('notifications');
    
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    // Get driver profile
    const driver = await driversCollection.findOne(
      { _id: driverId },
      { 
        projection: { 
          password: 0, 
          loginHistory: 0, 
          registrationIp: 0, 
          failedLoginAttempts: 0 
        } 
      }
    );

    if (!driver) {
      return res.status(404).json({
        status: 'error',
        message: 'Driver profile not found'
      });
    }

    // Parallel queries for dashboard data
    const [
      activeBookings,
      completedBookings,
      availableLoads,
      myBids,
      stats,
      notifications
    ] = await Promise.all([
      // Active bookings
      bookingsCollection.find({
        driverId,
        status: { $in: ['accepted', 'in_progress', 'driver_assigned'] }
      }).sort({ createdAt: -1 }).limit(10).toArray(),

      // Recent completed bookings
      bookingsCollection.find({
        driverId,
        status: 'completed'
      }).sort({ completedAt: -1 }).limit(5).toArray(),

      // Available loads (based on driver location and vehicle type)
      loadsCollection.find({
        status: 'active',
        $or: [
          { vehicleTypeRequired: driver.vehicleType },
          { vehicleTypeRequired: { $exists: false } },
          { vehicleTypeRequired: null }
        ],
        // Add location-based filtering if coordinates exist
        ...(driver.coordinates ? {
          $expr: {
            $lte: [
              {
                $multiply: [
                  {
                    $acos: {
                      $add: [
                        {
                          $multiply: [
                            { $sin: { $degreesToRadians: driver.coordinates.latitude } },
                            { $sin: { $degreesToRadians: "$pickupLocation.coordinates.latitude" } }
                          ]
                        },
                        {
                          $multiply: [
                            { $cos: { $degreesToRadians: driver.coordinates.latitude } },
                            { $cos: { $degreesToRadians: "$pickupLocation.coordinates.latitude" } },
                            { $cos: { $degreesToRadians: { $subtract: [driver.coordinates.longitude, "$pickupLocation.coordinates.longitude"] } } }
                          ]
                        }
                      ]
                    }
                  },
                  6371
                ]
              },
              100 // Within 100km
            ]
          }
        } : {})
      }).sort({ createdAt: -1 }).limit(20).toArray(),

      // Driver's bids
      bidsCollection.find({ driverId })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),

      // Driver statistics (reuse the logic from stats endpoint)
      (async () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const [total, completed, active, earnings, ratingData, bidsCount] = await Promise.all([
          bookingsCollection.countDocuments({ driverId }),
          bookingsCollection.countDocuments({ driverId, status: 'completed' }),
          bookingsCollection.countDocuments({ driverId, status: { $in: ['accepted', 'in_progress', 'driver_assigned'] } }),
          bookingsCollection.aggregate([
            { $match: { driverId, status: 'completed', completedAt: { $gte: startOfMonth }, totalAmount: { $exists: true } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]).toArray(),
          bookingsCollection.aggregate([
            { $match: { driverId, rating: { $exists: true, $ne: null } } },
            { $group: { _id: null, avg: { $avg: '$rating' } } }
          ]).toArray(),
          bidsCollection.countDocuments({ driverId })
        ]);

        return {
          totalJobs: total,
          activeJobs: active,
          completedJobs: completed,
          successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          rating: ratingData.length > 0 ? Math.round(ratingData[0].avg * 10) / 10 : 0,
          monthlyEarnings: earnings.length > 0 ? earnings[0].total : 0,
          totalBids: bidsCount
        };
      })(),

      // Recent notifications
      notificationsCollection.find({ 
        userId: driverId,
        $or: [{ isRead: false }, { isRead: { $exists: false } }]
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()
    ]);

    res.json({
      status: 'success',
      data: {
        driver,
        activeBookings,
        completedBookings,
        availableLoads,
        myBids,
        stats,
        notifications,
        summary: {
          activeJobs: activeBookings.length,
          availableLoads: availableLoads.length,
          pendingBids: myBids.filter(bid => bid.status === 'submitted').length,
          unreadNotifications: notifications.length
        }
      }
    });

  } catch (error) {
    console.error('Get driver dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/drivers/bid
// @desc    Place a bid on a load (alternative to /api/bids)
// @access  Private (Driver only)
router.post('/bid', auth, [
  body('loadId').isMongoId().withMessage('Valid load ID required'),
  body('bidAmount').isFloat({ min: 1 }).withMessage('Bid amount must be at least 1'),
  body('proposedPickupDate').optional().isISO8601().withMessage('Valid pickup date required'),
  body('proposedDeliveryDate').optional().isISO8601().withMessage('Valid delivery date required'),
  body('message').optional().isLength({ max: 500 }).withMessage('Message cannot exceed 500 characters')
], async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can place bids'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { loadId, bidAmount, proposedPickupDate, proposedDeliveryDate, message } = req.body;
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    const db = mongoose.connection.db;
    const loadsCollection = db.collection('loads');
    const bidsCollection = db.collection('bids');
    const driversCollection = db.collection('drivers');

    // Check if load exists and is active
    const load = await loadsCollection.findOne({
      _id: new mongoose.Types.ObjectId(loadId),
      status: 'active'
    });

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found or not available for bidding'
      });
    }

    // Check if driver already has a bid on this load
    const existingBid = await bidsCollection.findOne({
      loadId: new mongoose.Types.ObjectId(loadId),
      driverId
    });

    if (existingBid) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already placed a bid on this load'
      });
    }

    // Get driver info
    const driver = await driversCollection.findOne(
      { _id: driverId },
      { 
        projection: { 
          name: 1, 
          vehicleType: 1, 
          vehicleCapacity: 1,
          'driverProfile.rating': 1,
          'driverProfile.completedJobs': 1
        } 
      }
    );

    // Create new bid
    const newBid = {
      loadId: new mongoose.Types.ObjectId(loadId),
      driverId,
      cargoOwnerId: new mongoose.Types.ObjectId(load.cargoOwnerId),
      bidAmount: parseFloat(bidAmount),
      proposedPickupDate: proposedPickupDate ? new Date(proposedPickupDate) : null,
      proposedDeliveryDate: proposedDeliveryDate ? new Date(proposedDeliveryDate) : null,
      message: message || '',
      status: 'submitted',
      driverInfo: {
        name: driver.name,
        vehicleType: driver.vehicleType,
        vehicleCapacity: driver.vehicleCapacity,
        rating: driver.driverProfile?.rating || 0,
        completedJobs: driver.driverProfile?.completedJobs || 0
      },
      loadInfo: {
        title: load.title,
        pickupLocation: load.pickupLocation,
        deliveryLocation: load.deliveryLocation,
        estimatedAmount: load.estimatedAmount
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await bidsCollection.insertOne(newBid);

    // Update load with new bid count
    await loadsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(loadId) },
      { 
        $inc: { bidCount: 1 },
        $set: { updatedAt: new Date() }
      }
    );

    res.json({
      status: 'success',
      message: 'Bid placed successfully',
      data: {
        bid: {
          _id: result.insertedId,
          ...newBid
        }
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

// @route   PUT /api/drivers/bid/:id
// @desc    Update/withdraw a bid
// @access  Private (Driver only)
router.put('/bid/:id', auth, [
  body('action').isIn(['update', 'withdraw']).withMessage('Action must be update or withdraw'),
  body('bidAmount').optional().isFloat({ min: 1 }).withMessage('Bid amount must be at least 1'),
  body('message').optional().isLength({ max: 500 }).withMessage('Message cannot exceed 500 characters')
], async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can update bids'
      });
    }

    const { id: bidId } = req.params;
    const { action, bidAmount, message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(bidId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid bid ID'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = mongoose.connection.db;
    const bidsCollection = db.collection('bids');
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    // Find the bid
    const bid = await bidsCollection.findOne({
      _id: new mongoose.Types.ObjectId(bidId),
      driverId
    });

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found or not authorized'
      });
    }

    // Check if bid can be modified
    if (bid.status !== 'submitted') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot ${action} bid with status: ${bid.status}`
      });
    }

    let updateData = { updatedAt: new Date() };

    if (action === 'withdraw') {
      updateData.status = 'withdrawn';
      updateData.withdrawnAt = new Date();
    } else if (action === 'update') {
      if (bidAmount) updateData.bidAmount = parseFloat(bidAmount);
      if (message !== undefined) updateData.message = message;
    }

    const result = await bidsCollection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(bidId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    res.json({
      status: 'success',
      message: `Bid ${action}d successfully`,
      data: {
        bid: result
      }
    });

  } catch (error) {
    console.error('Update bid error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error updating bid',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/drivers/earnings
// @desc    Get detailed earnings data for driver
// @access  Private (Driver only)
router.get('/earnings', auth, [
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']).withMessage('Invalid period'),
  query('year').optional().isInt({ min: 2020, max: 2030 }).withMessage('Invalid year'),
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Invalid month')
], async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can view earnings'
      });
    }

    const { period = 'month', year, month } = req.query;
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    const now = new Date();
    let startDate, endDate;

    // Set date ranges based on period
    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        endDate = now;
        break;
      case 'month':
        if (year && month) {
          startDate = new Date(year, month - 1, 1);
          endDate = new Date(year, month, 0);
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'year':
        const targetYear = year || now.getFullYear();
        startDate = new Date(targetYear, 0, 1);
        endDate = new Date(targetYear, 11, 31);
        break;
    }

    // Get earnings data
    const earnings = await bookingsCollection.aggregate([
      {
        $match: {
          driverId,
          status: 'completed',
          completedAt: { $gte: startDate, $lte: endDate },
          totalAmount: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$completedAt' },
            month: { $month: '$completedAt' },
            day: { $dayOfMonth: '$completedAt' }
          },
          dailyEarnings: { $sum: '$totalAmount' },
          jobCount: { $sum: 1 },
          avgAmount: { $avg: '$totalAmount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]).toArray();

    // Calculate totals
    const totalEarnings = earnings.reduce((sum, day) => sum + day.dailyEarnings, 0);
    const totalJobs = earnings.reduce((sum, day) => sum + day.jobCount, 0);
    const avgEarningsPerJob = totalJobs > 0 ? totalEarnings / totalJobs : 0;

    res.json({
      status: 'success',
      data: {
        period,
        dateRange: { startDate, endDate },
        summary: {
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          totalJobs,
          avgEarningsPerJob: Math.round(avgEarningsPerJob * 100) / 100,
          avgEarningsPerDay: earnings.length > 0 ? Math.round((totalEarnings / earnings.length) * 100) / 100 : 0
        },
        dailyBreakdown: earnings.map(day => ({
          date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
          earnings: Math.round(day.dailyEarnings * 100) / 100,
          jobCount: day.jobCount,
          avgAmount: Math.round(day.avgAmount * 100) / 100
        }))
      }
    });

  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching earnings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/drivers/:id
// @desc    Get single driver by ID
// @access  Public
router.get('/:id',  async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid driver ID'
      });
    }

    const db = mongoose.connection.db;
    const collection = db.collection('drivers');

    const driver = await collection.findOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        projection: {
          password: 0,
          loginHistory: 0,
          registrationIp: 0,
          failedLoginAttempts: 0
        }
      }
    );

    if (!driver) {
      return res.status(404).json({
        status: 'error',
        message: 'Driver not found'
      });
    }

    // Get driver's completed bookings count and recent reviews
    const bookingsCollection = db.collection('bookings');
    const completedBookings = await bookingsCollection.countDocuments({
      driverId: new mongoose.Types.ObjectId(id),
      status: 'completed'
    });

    // Get recent reviews
    const recentBookings = await bookingsCollection.find({
      driverId: new mongoose.Types.ObjectId(id),
      status: 'completed',
      rating: { $exists: true }
    })
    .sort({ updatedAt: -1 })
    .limit(5)
    .toArray();

    const driverData = {
      ...driver,
      stats: {
        completedTrips: completedBookings,
        recentReviews: recentBookings.map(booking => ({
          rating: booking.rating,
          review: booking.review,
          date: booking.updatedAt,
          loadTitle: booking.loadTitle
        }))
      }
    };

    res.json({
      status: 'success',
      data: {
        driver: driverData
      }
    });

  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/drivers/contact/:id
// @desc    Send contact request to driver
// @access  Private (Cargo owners only)
router.post('/contact/:id',  auth, contactLimiter, [
  body('message')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters'),
  body('loadId')
    .optional()
    .isMongoId()
    .withMessage('Invalid load ID'),
  body('contactType')
    .optional()
    .isIn(['inquiry', 'booking_request', 'quote_request'])
    .withMessage('Invalid contact type')
], async (req, res) => {
  try {
    const { id: driverId } = req.params;
    const { message = '', loadId, contactType = 'inquiry' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid driver ID'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Only cargo owners and admins can contact drivers
    if (req.user.userType !== 'cargo_owner' && req.user.userType !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can contact drivers'
      });
    }

    const db = mongoose.connection.db;
    const driversCollection = db.collection('drivers');
    const usersCollection = db.collection('users');
    const contactRequestsCollection = db.collection('contact_requests');

    // Check if driver exists and is active
    const driver = await driversCollection.findOne(
      { _id: new mongoose.Types.ObjectId(driverId), isActive: { $ne: false } },
      { projection: { name: 1, email: 1, phone: 1, 'driverProfile.isAvailable': 1 } }
    );

    if (!driver) {
      return res.status(404).json({
        status: 'error',
        message: 'Driver not found or inactive'
      });
    }

    // Get requester information
    const requester = await usersCollection.findOne(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      { projection: { name: 1, email: 1, phone: 1, company: 1 } }
    );

    if (!requester) {
      return res.status(404).json({
        status: 'error',
        message: 'Requester not found'
      });
    }

    // Check for recent contact requests to prevent spam
    const recentContact = await contactRequestsCollection.findOne({
      requesterId: new mongoose.Types.ObjectId(req.user.id),
      driverId: new mongoose.Types.ObjectId(driverId),
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // 1 hour ago
    });

    if (recentContact) {
      return res.status(429).json({
        status: 'error',
        message: 'You can only contact this driver once per hour'
      });
    }

    // Create contact request record
    const contactRequest = {
      requesterId: new mongoose.Types.ObjectId(req.user.id),
      driverId: new mongoose.Types.ObjectId(driverId),
      requesterInfo: {
        name: requester.name,
        email: requester.email,
        phone: requester.phone,
        company: requester.company
      },
      driverInfo: {
        name: driver.name,
        email: driver.email
      },
      message,
      contactType,
      loadId: loadId ? new mongoose.Types.ObjectId(loadId) : null,
      status: 'sent',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await contactRequestsCollection.insertOne(contactRequest);

    // TODO: Send email/SMS notification to driver
    // You can integrate with your notification service here

    // Log the contact attempt
    console.log(`Contact request sent from ${requester.name} (${requester.email}) to driver ${driver.name} (${driver.email})`);

    res.json({
      status: 'success',
      message: 'Contact request sent successfully',
      data: {
        contactRequestId: contactRequest._id,
        driverInfo: {
          name: driver.name,
          isAvailable: driver.driverProfile?.isAvailable
        },
        message: 'The driver will be notified about your contact request'
      }
    });

  } catch (error) {
    console.error('Contact driver error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error sending contact request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/drivers/contact-requests/received
// @desc    Get contact requests received by driver
// @access  Private (Driver only)
router.get('/contact-requests/received',  auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['sent', 'read', 'responded'])
], async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can view received contact requests'
      });
    }

    const { page = 1, limit = 20, status } = req.query;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const db = mongoose.connection.db;
    const contactRequestsCollection = db.collection('contact_requests');

    let query = { driverId: new mongoose.Types.ObjectId(req.user.id) };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const contactRequests = await contactRequestsCollection.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const totalRequests = await contactRequestsCollection.countDocuments(query);
    const totalPages = Math.ceil(totalRequests / parseInt(limit));

    res.json({
      status: 'success',
      data: {
        contactRequests,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRequests,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get contact requests error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching contact requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/drivers/profile
// @desc    Update driver profile
// @access  Private (Driver only)
router.put('/profile',  auth, driverLimiter, profileValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can update driver profiles'
      });
    }

    const db = mongoose.connection.db;
    const collection = db.collection('drivers');

    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };

    // If updating vehicle info, update the main fields too
    if (updateData.vehicleType) {
      updateData['driverProfile.vehicleType'] = updateData.vehicleType;
    }
    if (updateData.vehicleCapacity) {
      updateData['driverProfile.vehicleCapacity'] = updateData.vehicleCapacity;
    }

    const result = await collection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      { $set: updateData },
      { 
        returnDocument: 'after',
        projection: {
          password: 0,
          loginHistory: 0,
          registrationIp: 0,
          failedLoginAttempts: 0
        }
      }
    );

    if (!result) {
      return res.status(404).json({
        status: 'error',
        message: 'Driver not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        driver: result
      }
    });

  } catch (error) {
    console.error('Update driver profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/drivers/profile
// @desc    Get driver's own profile
// @access  Private (Driver only)
router.get('/profile', auth, driverLimiter, async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can access driver profiles'
      });
    }

    const db = mongoose.connection.db;
    const driversCollection = db.collection('drivers');
    const bookingsCollection = db.collection('bookings');
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    // Get driver profile
    const driver = await driversCollection.findOne(
      { _id: driverId },
      {
        projection: {
          password: 0,
          loginHistory: 0,
          registrationIp: 0,
          failedLoginAttempts: 0,
          __v: 0
        }
      }
    );

    if (!driver) {
      return res.status(404).json({
        status: 'error',
        message: 'Driver profile not found'
      });
    }

    // Get additional profile statistics in parallel
    const [
      totalBookings,
      completedBookings,
      activeBookings,
      averageRatingData,
      totalEarnings,
      recentBookings
    ] = await Promise.all([
      // Total bookings count
      bookingsCollection.countDocuments({ driverId }),
      
      // Completed bookings count
      bookingsCollection.countDocuments({ driverId, status: 'completed' }),
      
      // Active bookings count
      bookingsCollection.countDocuments({ 
        driverId, 
        status: { $in: ['accepted', 'in_progress', 'driver_assigned'] } 
      }),
      
      // Average rating calculation
      bookingsCollection.aggregate([
        { 
          $match: { 
            driverId, 
            rating: { $exists: true, $ne: null, $gte: 1 } 
          } 
        },
        { 
          $group: { 
            _id: null, 
            avgRating: { $avg: '$rating' },
            totalRatings: { $sum: 1 }
          } 
        }
      ]).toArray(),
      
      // Total earnings from completed bookings
      bookingsCollection.aggregate([
        {
          $match: {
            driverId,
            status: 'completed',
            totalAmount: { $exists: true, $ne: null, $gt: 0 }
          }
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$totalAmount' },
            earningsCount: { $sum: 1 }
          }
        }
      ]).toArray(),
      
      // Recent bookings for activity feed
      bookingsCollection.find({ driverId })
        .sort({ createdAt: -1 })
        .limit(5)
        .project({
          loadTitle: 1,
          status: 1,
          totalAmount: 1,
          createdAt: 1,
          completedAt: 1,
          pickupLocation: 1,
          deliveryLocation: 1
        })
        .toArray()
    ]);

    // Calculate derived statistics
    const successRate = totalBookings > 0 ? 
      Math.round((completedBookings / totalBookings) * 100) : 0;
    
    const averageRating = averageRatingData.length > 0 ? 
      Math.round(averageRatingData[0].avgRating * 10) / 10 : 0;
    
    const totalRatingsReceived = averageRatingData.length > 0 ? 
      averageRatingData[0].totalRatings : 0;
    
    const lifetimeEarnings = totalEarnings.length > 0 ? 
      totalEarnings[0].totalEarnings : 0;
    
    const completedJobsWithEarnings = totalEarnings.length > 0 ? 
      totalEarnings[0].earningsCount : 0;

    // Enhanced driver profile with statistics
    const enhancedProfile = {
      ...driver,
      statistics: {
        totalJobs: totalBookings,
        activeJobs: activeBookings,
        completedJobs: completedBookings,
        successRate,
        averageRating,
        totalRatingsReceived,
        lifetimeEarnings,
        completedJobsWithEarnings
      },
      recentActivity: recentBookings,
      profileCompletion: calculateProfileCompletion(driver),
      lastUpdated: driver.updatedAt || driver.createdAt
    };

    res.json({
      status: 'success',
      message: 'Driver profile retrieved successfully',
      data: {
        driver: enhancedProfile
      }
    });

  } catch (error) {
    console.error('Get driver profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error retrieving driver profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to calculate profile completion percentage
function calculateProfileCompletion(driver) {
  const requiredFields = [
    'firstName',
    'lastName', 
    'email',
    'phone',
    'vehicleType',
    'vehicleCapacity',
    'licenseNumber'
  ];
  
  const optionalFields = [
    'address',
    'city', 
    'state',
    'zipCode',
    'licenseExpiry',
    'vehiclePlate',
    'vehicleModel',
    'vehicleYear',
    'emergencyContact',
    'emergencyPhone',
    'experienceYears',
    'driverProfile.bio'
  ];

  let completedRequired = 0;
  let completedOptional = 0;

  // Check required fields
  requiredFields.forEach(field => {
    const fieldValue = getNestedValue(driver, field);
    if (fieldValue && fieldValue.toString().trim() !== '') {
      completedRequired++;
    }
  });

  // Check optional fields  
  optionalFields.forEach(field => {
    const fieldValue = getNestedValue(driver, field);
    if (fieldValue && fieldValue.toString().trim() !== '') {
      completedOptional++;
    }
  });

  const requiredPercentage = (completedRequired / requiredFields.length) * 70; // 70% weight for required
  const optionalPercentage = (completedOptional / optionalFields.length) * 30; // 30% weight for optional
  
  return Math.round(requiredPercentage + optionalPercentage);
}

// Helper function to get nested object values
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// @route   POST /api/drivers/availability
// @desc    Toggle driver availability
// @access  Private (Driver only)
router.post('/availability',  auth, [
  body('isAvailable').isBoolean().withMessage('isAvailable must be a boolean')
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

    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can update availability'
      });
    }

    const { isAvailable } = req.body;

    const db = mongoose.connection.db;
    const collection = db.collection('drivers');

    const result = await collection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      { 
        $set: { 
          'driverProfile.isAvailable': isAvailable,
          'driverProfile.lastAvailabilityUpdate': new Date(),
          updatedAt: new Date()
        }
      },
      { 
        returnDocument: 'after',
        projection: { 'driverProfile.isAvailable': 1, name: 1 }
      }
    );

    if (!result) {
      return res.status(404).json({
        status: 'error',
        message: 'Driver not found'
      });
    }

    res.json({
      status: 'success',
      message: `Availability ${isAvailable ? 'enabled' : 'disabled'} successfully`,
      data: {
        isAvailable: result.driverProfile.isAvailable
      }
    });

  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error updating availability',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/drivers/location
// @desc    Update driver location
// @access  Private (Driver only)
router.post('/location',  auth, [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required')
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

    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can update location'
      });
    }

    const { latitude, longitude } = req.body;

    const db = mongoose.connection.db;
    const collection = db.collection('drivers');

    const result = await collection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      { 
        $set: { 
          coordinates: { latitude, longitude },
          'driverProfile.lastLocationUpdate': new Date(),
          updatedAt: new Date()
        }
      },
      { 
        returnDocument: 'after',
        projection: { coordinates: 1, name: 1 }
      }
    );

    if (!result) {
      return res.status(404).json({
        status: 'error',
        message: 'Driver not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Location updated successfully',
      data: {
        coordinates: result.coordinates
      }
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error updating location',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/drivers/:id/bookings
// @desc    Get driver's bookings
// @access  Private (Driver only for own bookings, or cargo owner)
router.get('/:id/bookings',  auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'accepted', 'in_progress', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid driver ID'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Check if user can view these bookings
    if (req.user.id !== id && req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to view these bookings'
      });
    }

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    let query = { driverId: new mongoose.Types.ObjectId(id) };
    if (status) {
      query.status = status;
    }

    // If cargo owner is requesting, only show bookings for their loads
    if (req.user.userType === 'cargo_owner' && req.user.id !== id) {
      query.cargoOwnerId = new mongoose.Types.ObjectId(req.user.id);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await bookingsCollection.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const totalBookings = await bookingsCollection.countDocuments(query);
    const totalPages = Math.ceil(totalBookings / parseInt(limit));

    res.json({
      status: 'success',
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBookings,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get driver bookings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/drivers/stats
// @desc    Get driver statistics (own stats only)
// @access  Private (Driver only)
router.get('/stats',  auth, async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can view driver statistics'
      });
    }

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    // Get booking statistics
    const [
      totalBookings,
      completedBookings,
      pendingBookings,
      cancelledBookings,
      averageRating
    ] = await Promise.all([
      bookingsCollection.countDocuments({ driverId }),
      bookingsCollection.countDocuments({ driverId, status: 'completed' }),
      bookingsCollection.countDocuments({ driverId, status: 'pending' }),
      bookingsCollection.countDocuments({ driverId, status: 'cancelled' }),
      bookingsCollection.aggregate([
        { $match: { driverId, rating: { $exists: true } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]).toArray()
    ]);

    // Get earnings for current month
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const monthlyEarnings = await bookingsCollection.aggregate([
      {
        $match: {
          driverId,
          status: 'completed',
          completedAt: { $gte: currentMonth },
          totalAmount: { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$totalAmount' }
        }
      }
    ]).toArray();

    res.json({
      status: 'success',
      data: {
        stats: {
          totalBookings,
          completedBookings,
          pendingBookings,
          cancelledBookings,
          successRate: totalBookings > 0 ? ((completedBookings / totalBookings) * 100).to(1) : 0,
          averageRating: averageRating.length > 0 ? averageRating[0].avgRating.to(1) : 0,
          monthlyEarnings: monthlyEarnings.length > 0 ? monthlyEarnings[0].totalEarnings : 0
        }
      }
    });

  } catch (error) {
    console.error('Get driver stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/drivers/contact-requests/:id/status
// @desc    Update contact request status (mark as read/responded)
// @access  Private (Driver only)
router.put('/contact-requests/:id/status',  auth, [
  body('status').isIn(['read', 'responded']).withMessage('Status must be read or responded'),
  body('response').optional().isLength({ max: 1000 }).withMessage('Response cannot exceed 1000 characters')
], async (req, res) => {
  try {
    const { id: requestId } = req.params;
    const { status, response } = req.body;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request ID'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can update contact request status'
      });
    }

    const db = mongoose.connection.db;
    const contactRequestsCollection = db.collection('contact_requests');

    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (status === 'responded' && response) {
      updateData.response = response;
      updateData.respondedAt = new Date();
    } else if (status === 'read') {
      updateData.readAt = new Date();
    }

    const result = await contactRequestsCollection.findOneAndUpdate(
      { 
        _id: new mongoose.Types.ObjectId(requestId),
        driverId: new mongoose.Types.ObjectId(req.user.id)
      },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({
        status: 'error',
        message: 'Contact request not found or not authorized'
      });
    }

    res.json({
      status: 'success',
      message: `Contact request marked as ${status}`,
      data: {
        contactRequest: result
      }
    });

  } catch (error) {
    console.error('Update contact request status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error updating contact request status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/drivers/search
// @desc    Search drivers with advanced filters
// @access  Public
router.get('/search',  [
  query('q').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Search query must be 2-100 characters'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('sortBy').optional().isIn(['rating', 'experience', 'completedJobs', 'distance']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('vehicleTypes').optional().custom((value) => {
    const types = value.split(',');
    const validTypes = ['pickup', 'van', 'small_truck', 'medium_truck', 'large_truck', 'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'];
    return types.every(type => validTypes.includes(type.trim()));
  }),
  query('minExperience').optional().isInt({ min: 0, max: 50 }),
  query('maxDistance').optional().isFloat({ min: 1, max: 1000 }),
  query('userLat').optional().isFloat({ min: -90, max: 90 }),
  query('userLng').optional().isFloat({ min: -180, max: 180 })
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
      q,
      page = 1,
      limit = 20,
      sortBy = 'rating',
      sortOrder = 'desc',
      vehicleTypes,
      minExperience,
      maxDistance,
      userLat,
      userLng
    } = req.query;

    const db = mongoose.connection.db;
    const collection = db.collection('drivers');

    // Build aggregation pipeline
    let pipeline = [];

    // Match stage
    let matchStage = {
      isActive: { $ne: false },
      'driverProfile.isAvailable': true
    };

    if (q) {
      matchStage.$or = [
        { name: new RegExp(q, 'i') },
        { location: new RegExp(q, 'i') },
        { vehicleType: new RegExp(q, 'i') },
        { 'driverProfile.bio': new RegExp(q, 'i') }
      ];
    }

    if (vehicleTypes) {
      const typeArray = vehicleTypes.split(',').map(type => type.trim());
      matchStage.vehicleType = { $in: typeArray };
    }

    if (minExperience) {
      matchStage.experienceYears = { $gte: parseInt(minExperience) };
    }

    pipeline.push({ $match: matchStage });

    // Add distance calculation if coordinates provided
    if (userLat && userLng && sortBy === 'distance') {
      pipeline.push({
        $addFields: {
          distance: {
            $cond: {
              if: {
                $and: [
                  { $ne: ['$coordinates.latitude', null] },
                  { $ne: ['$coordinates.longitude', null] }
                ]
              },
              then: {
                $multiply: [
                  {
                    $acos: {
                      $add: [
                        {
                          $multiply: [
                            { $sin: { $degreesToRadians: parseFloat(userLat) } },
                            { $sin: { $degreesToRadians: '$coordinates.latitude' } }
                          ]
                        },
                        {
                          $multiply: [
                            { $cos: { $degreesToRadians: parseFloat(userLat) } },
                            { $cos: { $degreesToRadians: '$coordinates.latitude' } },
                            { $cos: { $degreesToRadians: { $subtract: [parseFloat(userLng), '$coordinates.longitude'] } } }
                          ]
                        }
                      ]
                    }
                  },
                  6371
                ]
              },
              else: 999999
            }
          }
        }
      });

      // Filter by max distance if specified
      if (maxDistance) {
        pipeline.push({
          $match: {
            distance: { $lte: parseFloat(maxDistance) }
          }
        });
      }
    }

    // Sort stage
    let sortStage = {};
    switch (sortBy) {
      case 'rating':
        sortStage['driverProfile.rating'] = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'experience':
        sortStage.experienceYears = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'completedJobs':
        sortStage['driverProfile.completedJobs'] = sortOrder === 'asc' ? 1 : -1;
        break;
      case 'distance':
        if (userLat && userLng) {
          sortStage.distance = sortOrder === 'asc' ? 1 : -1;
        } else {
          sortStage['driverProfile.rating'] = -1; // Fallback to rating
        }
        break;
      default:
        sortStage['driverProfile.rating'] = -1;
    }

    pipeline.push({ $sort: sortStage });

    // Project stage - exclude sensitive data
    pipeline.push({
      $project: {
        password: 0,
        loginHistory: 0,
        registrationIp: 0,
        failedLoginAttempts: 0
      }
    });

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    // Execute aggregation
    const drivers = await collection.aggregate(pipeline).toArray();

    // Get total count for pagination (without skip/limit)
    const countPipeline = pipeline.slice(0, -2); // Remove skip and limit
    countPipeline.push({ $count: 'total' });
    const countResult = await collection.aggregate(countPipeline).toArray();
    const totalDrivers = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalDrivers / parseInt(limit));

    res.json({
      status: 'success',
      data: {
        drivers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalDrivers,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        searchCriteria: {
          query: q,
          vehicleTypes: vehicleTypes ? vehicleTypes.split(',') : [],
          minExperience,
          maxDistance,
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Search drivers error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error searching drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;