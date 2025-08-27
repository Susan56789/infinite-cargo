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


// @route   GET /api/drivers/dashboard
// @desc    Get comprehensive driver dashboard data - FIXED VERSION
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

    // Get driver profile first
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

    // Date calculations for statistics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // COMPREHENSIVE ACTIVE JOB STATUSES - This was a major issue in the original
    const activeJobStatuses = [
      // Initial assignment and acceptance
      'assigned', 'accepted', 'driver_assigned',
      // Confirmation and preparation
      'confirmed', 'in_progress', 'started',
      // Pickup phase
      'en_route_pickup', 'en_route_to_pickup', 'going_to_pickup',
      'arrived_pickup', 'at_pickup_location', 'at_pickup',
      'picked_up', 'pickup_completed', 'loading', 'loaded',
      // Transit phase
      'in_transit', 'on_route', 'en_route_delivery', 'en_route_to_delivery',
      'transporting', 'delivering',
      // Near completion (still active until fully completed)
      'arrived_delivery', 'at_delivery_location', 'at_delivery',
      'unloading', 'delivery_in_progress'
    ];

    // Parallel queries for dashboard data
    const [
      // Active bookings with comprehensive status matching
      activeBookings,
      
      // Completed bookings  
      completedBookings,
      
      // Available loads matching driver criteria
      availableLoads,
      
      // Driver's bids with load information
      myBids,
      
      // Comprehensive booking statistics
      bookingStats,
      earningsStats,
      ratingStats,
      bidStats,
      
      // Notifications
      notifications
    ] = await Promise.all([
      //  Active bookings with comprehensive status matching
      bookingsCollection.find({
        driverId,
        status: { $in: activeJobStatuses }
      }).sort({ 
        assignedAt: -1,
        acceptedAt: -1,
        createdAt: -1 
      }).limit(20).toArray(),

      // Recent completed bookings
      bookingsCollection.find({
        driverId,
        status: 'completed'
      }).sort({ completedAt: -1 }).limit(5).toArray(),

      // IMPROVED: Available loads with better filtering
      loadsCollection.aggregate([
        {
          $match: {
            status: 'active',
            // Exclude loads where driver already has a bid
            _id: { $nin: await bidsCollection.distinct('loadId', { driverId }) }
          }
        },
        // Add vehicle type matching if driver has vehicle type
        ...(driver.vehicleType ? [{
          $match: {
            $or: [
              { vehicleTypeRequired: driver.vehicleType },
              { vehicleTypeRequired: { $exists: false } },
              { vehicleTypeRequired: null },
              { vehicleTypeRequired: '' }
            ]
          }
        }] : []),
        // Sort by creation date and urgency
        {
          $addFields: {
            urgencyScore: {
              $switch: {
                branches: [
                  { case: { $eq: ['$urgency', 'urgent'] }, then: 3 },
                  { case: { $eq: ['$urgency', 'high'] }, then: 2 },
                  { case: { $eq: ['$urgency', 'medium'] }, then: 1 }
                ],
                default: 0
              }
            }
          }
        },
        { $sort: { urgencyScore: -1, createdAt: -1 } },
        { $limit: 25 }
      ]).toArray(),

      // IMPROVED: Driver's bids with comprehensive load info
      bidsCollection.aggregate([
        { $match: { driverId } },
        { $sort: { createdAt: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'loads',
            localField: 'loadId',
            foreignField: '_id',
            as: 'loadInfo'
          }
        },
        {
          $unwind: {
            path: '$loadInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        // Add cargo owner information
        {
          $lookup: {
            from: 'users',
            localField: 'cargoOwnerId',
            foreignField: '_id',
            as: 'cargoOwnerInfo',
            pipeline: [
              { $project: { name: 1, phone: 1, email: 1, companyName: 1 } }
            ]
          }
        },
        {
          $unwind: {
            path: '$cargoOwnerInfo',
            preserveNullAndEmptyArrays: true
          }
        }
      ]).toArray(),

      // COMPREHENSIVE booking statistics
      bookingsCollection.aggregate([
        { $match: { driverId } },
        {
          $group: {
            _id: null,
            totalJobs: { $sum: 1 },
            completedJobs: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            activeJobs: {
              $sum: { 
                $cond: [
                  { $in: ['$status', activeJobStatuses] }, 
                  1, 
                  0
                ] 
              }
            },
            cancelledJobs: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            pendingJobs: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            }
          }
        }
      ]).toArray(),

      // IMPROVED earnings statistics with better date handling
      bookingsCollection.aggregate([
        {
          $match: {
            driverId,
            status: 'completed',
            $or: [
              { totalAmount: { $exists: true, $ne: null, $gt: 0 } },
              { agreedAmount: { $exists: true, $ne: null, $gt: 0 } },
              { price: { $exists: true, $ne: null, $gt: 0 } }
            ]
          }
        },
        {
          $addFields: {
            earningsAmount: {
              $ifNull: [
                '$totalAmount',
                { $ifNull: ['$agreedAmount', '$price'] }
              ]
            },
            completionDate: {
              $ifNull: [
                '$completedAt',
                { $ifNull: ['$updatedAt', '$createdAt'] }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$earningsAmount' },
            thisMonthEarnings: {
              $sum: {
                $cond: [
                  { $gte: ['$completionDate', startOfMonth] },
                  '$earningsAmount',
                  0
                ]
              }
            },
            lastMonthEarnings: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$completionDate', startOfLastMonth] },
                      { $lte: ['$completionDate', endOfLastMonth] }
                    ]
                  },
                  '$earningsAmount',
                  0
                ]
              }
            },
            yearlyEarnings: {
              $sum: {
                $cond: [
                  { $gte: ['$completionDate', startOfYear] },
                  '$earningsAmount',
                  0
                ]
              }
            },
            avgEarningsPerJob: { $avg: '$earningsAmount' },
            totalJobsWithEarnings: { $sum: 1 }
          }
        }
      ]).toArray(),

      // IMPROVED rating statistics
      bookingsCollection.aggregate([
        {
          $match: {
            driverId,
            rating: { $exists: true, $ne: null, $gte: 1, $lte: 5 }
          }
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalRatings: { $sum: 1 },
            fiveStars: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            fourStars: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            threeStars: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            twoStars: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            oneStars: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
          }
        }
      ]).toArray(),

      // COMPREHENSIVE bid statistics
      bidsCollection.aggregate([
        { $match: { driverId } },
        {
          $group: {
            _id: null,
            totalBids: { $sum: 1 },
            acceptedBids: {
              $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
            },
            pendingBids: {
              $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] }
            },
            rejectedBids: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            withdrawnBids: {
              $sum: { $cond: [{ $eq: ['$status', 'withdrawn'] }, 1, 0] }
            },
            avgBidAmount: { $avg: '$bidAmount' },
            totalBidValue: { $sum: '$bidAmount' }
          }
        }
      ]).toArray(),

      // IMPROVED notifications query
      notificationsCollection.find({ 
        userId: driverId,
        $or: [
          { isRead: false }, 
          { isRead: { $exists: false } },
          { 
            createdAt: { 
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            } 
          }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(15)
      .toArray()
    ]);

    // Process statistics with better error handling
    const bookingData = bookingStats[0] || {
      totalJobs: 0, completedJobs: 0, activeJobs: 0, cancelledJobs: 0, pendingJobs: 0
    };

    const earningsData = earningsStats[0] || {
      totalEarnings: 0, thisMonthEarnings: 0, lastMonthEarnings: 0, yearlyEarnings: 0,
      avgEarningsPerJob: 0, totalJobsWithEarnings: 0
    };

    const ratingData = ratingStats[0] || {
      averageRating: 0, totalRatings: 0, fiveStars: 0, fourStars: 0, threeStars: 0, twoStars: 0, oneStars: 0
    };

    const bidData = bidStats[0] || {
      totalBids: 0, acceptedBids: 0, pendingBids: 0, rejectedBids: 0, withdrawnBids: 0,
      avgBidAmount: 0, totalBidValue: 0
    };

    // Calculate derived statistics
    const successRate = bookingData.totalJobs > 0 
      ? Math.round((bookingData.completedJobs / bookingData.totalJobs) * 100) 
      : 0;

    const bidAcceptanceRate = bidData.totalBids > 0
      ? Math.round((bidData.acceptedBids / bidData.totalBids) * 100)
      : 0;

    // IMPROVED: Format active bookings with comprehensive field mapping
    const formattedActiveBookings = activeBookings.map(booking => {
      // Helper to get the best available date
      const getBestDate = (...dateFields) => {
        for (const field of dateFields) {
          if (booking[field]) return booking[field];
        }
        return null;
      };

      const pickupDate = getBestDate('pickupDate', 'scheduledPickupDate', 'startDate', 'pickupTime');
      const deliveryDate = getBestDate('deliveryDate', 'scheduledDeliveryDate', 'endDate', 'deliveryTime');
      
      // Status normalization for consistent frontend display
      const normalizeStatus = (status) => {
        const statusMap = {
          'driver_assigned': 'assigned',
          'pickup_completed': 'picked_up',
          'loading': 'picked_up',
          'loaded': 'picked_up',
          'on_route': 'in_transit',
          'transporting': 'in_transit',
          'delivering': 'in_transit',
          'delivery_in_progress': 'at_delivery'
        };
        return statusMap[status] || status;
      };

      const normalizedStatus = normalizeStatus(booking.status);

      // Priority calculation
      const now = new Date();
      const isOverdue = deliveryDate ? new Date(deliveryDate) < now : false;
      const isUrgent = booking.urgency === 'urgent' || booking.isUrgent || 
                     (pickupDate && new Date(pickupDate) <= new Date(now.getTime() + 24 * 60 * 60 * 1000));
      
      return {
        _id: booking._id,
        bidId: booking.bidId,
        loadId: booking.loadId,
        
        // Basic information with fallbacks
        title: booking.title || booking.loadTitle || booking.description || 'Transport Job',
        pickupLocation: booking.pickupLocation || booking.origin || booking.fromLocation || 'Pickup Location',
        deliveryLocation: booking.deliveryLocation || booking.destination || booking.toLocation || 'Delivery Location',
        
        // Dates
        pickupDate,
        deliveryDate,
        
        // Cargo information
        cargoType: booking.cargoType || booking.loadType || booking.type || 'General Cargo',
        weight: booking.weight || booking.cargoWeight || booking.estimatedWeight,
        dimensions: booking.dimensions,
        
        // Financial details with multiple fallbacks
        budget: booking.totalAmount || booking.agreedAmount || booking.price || booking.amount || 0,
        price: booking.totalAmount || booking.agreedAmount || booking.price || booking.amount || 0,
        totalAmount: booking.totalAmount || booking.agreedAmount || booking.price || booking.amount || 0,
        agreedAmount: booking.agreedAmount || booking.totalAmount || booking.price || booking.amount || 0,
        currency: booking.currency || 'KES',
        
        // Status information
        status: normalizedStatus,
        originalStatus: booking.status,
        statusDisplay: getStatusDisplayName(normalizedStatus),
        
        // Timestamps
        assignedAt: booking.assignedAt || booking.acceptedAt || booking.createdAt,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        
        // Related entities
        cargoOwnerId: booking.cargoOwnerId,
        driverId: booking.driverId,
        
        // Additional information
        specialInstructions: booking.specialInstructions || booking.instructions,
        trackingUpdates: booking.trackingUpdates || [],
        timeline: booking.timeline || [],
        
        // UI helpers
        isUrgent,
        isOverdue,
        priority: isOverdue ? 'critical' : isUrgent ? 'high' : 'normal',
        
        // Action availability
        availableActions: getAvailableActions(normalizedStatus),
        canUpdateStatus: true,
        canViewDetails: true
      };
    });

    // IMPROVED: Format available loads with better filtering
    const formattedAvailableLoads = availableLoads.map(load => ({
      _id: load._id,
      title: load.title || 'Transport Required',
      pickupLocation: load.pickupLocation || load.origin || 'Pickup Location',
      deliveryLocation: load.deliveryLocation || load.destination || 'Delivery Location',
      cargoType: load.cargoType || load.loadType || 'General Cargo',
      weight: load.weight || load.estimatedWeight || 0,
      estimatedAmount: load.estimatedAmount || load.budget || 0,
      pickupDate: load.pickupDate || load.scheduledPickupDate,
      deliveryDate: load.deliveryDate || load.scheduledDeliveryDate,
      description: load.description,
      urgency: load.urgency || 'normal',
      bidCount: load.bidCount || 0,
      createdAt: load.createdAt,
      cargoOwnerId: load.cargoOwnerId || load.postedBy,
      vehicleTypeRequired: load.vehicleTypeRequired,
      
      // UI helpers
      isUrgent: load.urgency === 'urgent' || load.isUrgent,
      canBid: true,
      matchesVehicle: !load.vehicleTypeRequired || load.vehicleTypeRequired === driver.vehicleType
    }));

    // IMPROVED: Format bids with comprehensive information
    const formattedBids = myBids.map(bid => ({
      _id: bid._id,
      loadId: bid.loadId,
      bidAmount: bid.bidAmount,
      status: bid.status,
      message: bid.message,
      createdAt: bid.createdAt,
      updatedAt: bid.updatedAt,
      acceptedAt: bid.acceptedAt,
      rejectedAt: bid.rejectedAt,
      
      // Load information
      loadTitle: bid.loadInfo?.title || bid.loadTitle || 'Load',
      pickupLocation: bid.loadInfo?.pickupLocation || bid.loadInfo?.origin || bid.pickupLocation,
      deliveryLocation: bid.loadInfo?.deliveryLocation || bid.loadInfo?.destination || bid.deliveryLocation,
      estimatedAmount: bid.loadInfo?.estimatedAmount || bid.loadInfo?.budget || bid.estimatedAmount,
      
      // Cargo owner information
      cargoOwnerName: bid.cargoOwnerInfo?.name,
      cargoOwnerCompany: bid.cargoOwnerInfo?.companyName,
      
      // Status helpers
      canWithdraw: bid.status === 'submitted',
      canUpdate: bid.status === 'submitted',
      isActive: ['submitted', 'accepted'].includes(bid.status),
      
      // Display helpers
      statusDisplay: getBidStatusDisplay(bid.status),
      statusColor: getBidStatusColor(bid.status)
    }));

    // Sort active bookings by priority and date
    formattedActiveBookings.sort((a, b) => {
      if (a.priority === 'critical' && b.priority !== 'critical') return -1;
      if (a.priority !== 'critical' && b.priority === 'critical') return 1;
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      
      if (a.pickupDate && b.pickupDate) {
        return new Date(a.pickupDate) - new Date(b.pickupDate);
      }
      
      return new Date(b.assignedAt) - new Date(a.assignedAt);
    });

    const responseData = {
      driver,
      activeBookings: formattedActiveBookings,
      completedBookings: completedBookings.map(booking => ({
        _id: booking._id,
        title: booking.title || booking.loadTitle || 'Transport Job',
        totalAmount: booking.totalAmount || booking.agreedAmount || booking.price || 0,
        completedAt: booking.completedAt || booking.updatedAt,
        rating: booking.rating,
        review: booking.review,
        pickupLocation: booking.pickupLocation || booking.origin,
        deliveryLocation: booking.deliveryLocation || booking.destination,
        cargoType: booking.cargoType || booking.loadType
      })),
      availableLoads: formattedAvailableLoads,
      myBids: formattedBids,
      
      // Comprehensive statistics
      stats: {
        totalJobs: bookingData.totalJobs,
        activeJobs: bookingData.activeJobs,
        completedJobs: bookingData.completedJobs,
        cancelledJobs: bookingData.cancelledJobs,
        pendingJobs: bookingData.pendingJobs,
        successRate,
        completionRate: successRate, // Alias for frontend compatibility
        rating: Math.round(ratingData.averageRating * 10) / 10,
        averageRating: Math.round(ratingData.averageRating * 10) / 10,
        totalRatings: ratingData.totalRatings,
        ratingBreakdown: {
          five: ratingData.fiveStars,
          four: ratingData.fourStars,
          three: ratingData.threeStars,
          two: ratingData.twoStars,
          one: ratingData.oneStars
        },
        totalBids: bidData.totalBids,
        acceptedBids: bidData.acceptedBids,
        pendingBids: bidData.pendingBids,
        rejectedBids: bidData.rejectedBids,
        bidAcceptanceRate,
        monthlyEarnings: earningsData.thisMonthEarnings,
        avgEarningsPerJob: Math.round(earningsData.avgEarningsPerJob * 100) / 100
      },
      
      // Comprehensive earnings data
      earnings: {
        thisMonth: earningsData.thisMonthEarnings,
        lastMonth: earningsData.lastMonthEarnings,
        total: earningsData.totalEarnings,
        yearly: earningsData.yearlyEarnings,
        avgPerJob: Math.round(earningsData.avgEarningsPerJob * 100) / 100,
        totalJobsWithEarnings: earningsData.totalJobsWithEarnings
      },
      
      notifications,
      
      // Summary for quick overview
      summary: {
        activeJobs: formattedActiveBookings.length,
        urgentJobs: formattedActiveBookings.filter(job => job.isUrgent).length,
        overdueJobs: formattedActiveBookings.filter(job => job.isOverdue).length,
        availableLoads: formattedAvailableLoads.length,
        matchingLoads: formattedAvailableLoads.filter(load => load.matchesVehicle).length,
        pendingBids: bidData.pendingBids,
        unreadNotifications: notifications.filter(n => !n.isRead).length,
        monthlyProgress: {
          earnings: earningsData.thisMonthEarnings,
          jobs: bookingData.activeJobs + bookingData.completedJobs,
          target: 50000 // This could be configurable per driver
        }
      },
      
      // Metadata
      lastUpdated: new Date(),
      dataVersion: '2.0'
    };

    res.json({
      status: 'success',
      data: responseData
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

// Helper functions for status handling
function getStatusDisplayName(status) {
  const displays = {
    'assigned': 'Assigned',
    'accepted': 'Accepted',
    'confirmed': 'Confirmed',
    'in_progress': 'In Progress',
    'en_route_pickup': 'En Route to Pickup',
    'at_pickup': 'At Pickup Location',
    'picked_up': 'Cargo Picked Up',
    'in_transit': 'In Transit',
    'at_delivery': 'At Delivery Location',
    'completed': 'Completed'
  };
  return displays[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getAvailableActions(status) {
  const actions = {
    'assigned': ['confirm', 'start'],
    'accepted': ['confirm', 'start'],
    'confirmed': ['start', 'pickup'],
    'in_progress': ['pickup', 'en_route_pickup'],
    'en_route_pickup': ['arrive_pickup'],
    'at_pickup': ['pickup_complete'],
    'picked_up': ['start_transit'],
    'in_transit': ['arrive_delivery'],
    'at_delivery': ['complete_delivery']
  };
  return actions[status] || [];
}

function getBidStatusDisplay(status) {
  const displays = {
    'submitted': 'Pending Review',
    'accepted': 'Accepted',
    'rejected': 'Rejected',
    'withdrawn': 'Withdrawn',
    'expired': 'Expired'
  };
  return displays[status] || status;
}

function getBidStatusColor(status) {
  const colors = {
    'submitted': 'bg-yellow-100 text-yellow-800',
    'accepted': 'bg-green-100 text-green-800',
    'rejected': 'bg-red-100 text-red-800',
    'withdrawn': 'bg-gray-100 text-gray-800',
    'expired': 'bg-gray-100 text-gray-600'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}


// @route   GET /api/drivers/active-jobs
// @desc    Get active jobs for current driver 
// @access  Private (Driver only)
router.get('/active-jobs', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Driver account required.'
      });
    }

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');
    const bidsCollection = db.collection('bids');
    const loadsCollection = db.collection('loads');
    const driverId = new mongoose.Types.ObjectId(req.user.id);

   

    // COMPREHENSIVE status matching - This is the key fix
    const activeStatuses = [
      // Initial assignment states
      'assigned', 'accepted', 'driver_assigned',
      // Confirmation and preparation states
      'confirmed', 'in_progress', 'started',
      // Pickup phase states
      'en_route_pickup', 'en_route_to_pickup', 'going_to_pickup',
      'arrived_pickup', 'at_pickup_location', 'at_pickup',
      'picked_up', 'pickup_completed', 'loading', 'loaded',
      // Transit phase states
      'in_transit', 'on_route', 'en_route_delivery', 'en_route_to_delivery',
      'transporting', 'delivering',
      // Near completion states (still active until fully completed)
      'arrived_delivery', 'at_delivery_location', 'at_delivery',
      'unloading', 'delivery_in_progress'
    ];

    // Primary query: Get active jobs from bookings collection
    const activeJobs = await bookingsCollection.find({
      driverId,
      status: { $in: activeStatuses }
    })
    .sort({ 
      assignedAt: -1,
      acceptedAt: -1,
      createdAt: -1 
    })
    .toArray();

   

    // Secondary query: Check for recently accepted bids that might not have been converted to bookings yet
    if (activeJobs.length === 0) {
      const recentlyAcceptedBids = await bidsCollection.aggregate([
        {
          $match: {
            driverId,
            status: 'accepted',
            acceptedAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } // Last 48 hours
          }
        },
        {
          $lookup: {
            from: 'loads',
            localField: 'loadId',
            foreignField: '_id',
            as: 'loadInfo'
          }
        },
        {
          $unwind: {
            path: '$loadInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'cargoOwnerId',
            foreignField: '_id',
            as: 'cargoOwnerInfo',
            pipeline: [
              { $project: { name: 1, phone: 1, email: 1, companyName: 1 } }
            ]
          }
        },
        {
          $unwind: {
            path: '$cargoOwnerInfo',
            preserveNullAndEmptyArrays: true
          }
        }
      ]).toArray();

      // Convert bids to job-like objects
      for (const bid of recentlyAcceptedBids) {
        if (bid.loadInfo) {
          const jobFromBid = {
            _id: bid._id,
            bidId: bid._id,
            loadId: bid.loadId,
            title: bid.loadInfo.title || 'Transport Job',
            pickupLocation: bid.loadInfo.pickupLocation || bid.loadInfo.origin,
            deliveryLocation: bid.loadInfo.deliveryLocation || bid.loadInfo.destination,
            pickupDate: bid.proposedPickupDate || bid.loadInfo.pickupDate,
            deliveryDate: bid.proposedDeliveryDate || bid.loadInfo.deliveryDate,
            cargoType: bid.loadInfo.cargoType || bid.loadInfo.loadType,
            weight: bid.loadInfo.weight,
            dimensions: bid.loadInfo.dimensions,
            agreedAmount: bid.bidAmount,
            totalAmount: bid.bidAmount,
            currency: bid.currency || 'KES',
            status: 'accepted', // Status from bid acceptance
            assignedAt: bid.acceptedAt,
            acceptedAt: bid.acceptedAt,
            createdAt: bid.createdAt,
            updatedAt: bid.updatedAt,
            cargoOwnerId: bid.cargoOwnerId,
            specialInstructions: bid.loadInfo.specialInstructions,
            source: 'bid', // Mark as coming from bid
            
            // Cargo owner info
            cargoOwnerInfo: bid.cargoOwnerInfo
          };
          
          activeJobs.push(jobFromBid);
          
        }
      }
    }

    // Format jobs for frontend with comprehensive field mapping
    const formattedJobs = activeJobs.map(job => {
      // Comprehensive date handling
      const getDate = (...dateFields) => {
        for (const field of dateFields) {
          const value = job[field];
          if (value) return value;
        }
        return null;
      };

      const pickupDate = getDate('pickupDate', 'scheduledPickupDate', 'startDate', 'pickupTime');
      const deliveryDate = getDate('deliveryDate', 'scheduledDeliveryDate', 'endDate', 'deliveryTime');

      // Calculate derived fields
      const now = new Date();
      const isUrgent = job.urgency === 'urgent' || job.isUrgent || 
                     (pickupDate && new Date(pickupDate) <= new Date(now.getTime() + 24 * 60 * 60 * 1000));
      const isOverdue = deliveryDate ? new Date(deliveryDate) < now : false;
      
      let timeToPickup = null;
      if (pickupDate) {
        const diffTime = new Date(pickupDate) - now;
        timeToPickup = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }

      // Status normalization for frontend consistency
      const normalizeStatus = (status) => {
        const statusMap = {
          'assigned': 'assigned',
          'driver_assigned': 'assigned',
          'accepted': 'accepted',
          'confirmed': 'confirmed',
          'in_progress': 'in_progress',
          'started': 'in_progress',
          'en_route_pickup': 'en_route_pickup',
          'en_route_to_pickup': 'en_route_pickup',
          'going_to_pickup': 'en_route_pickup',
          'arrived_pickup': 'at_pickup',
          'at_pickup_location': 'at_pickup',
          'at_pickup': 'at_pickup',
          'picked_up': 'picked_up',
          'pickup_completed': 'picked_up',
          'loading': 'picked_up',
          'loaded': 'picked_up',
          'in_transit': 'in_transit',
          'on_route': 'in_transit',
          'transporting': 'in_transit',
          'en_route_delivery': 'in_transit',
          'en_route_to_delivery': 'in_transit',
          'delivering': 'in_transit',
          'arrived_delivery': 'at_delivery',
          'at_delivery_location': 'at_delivery',
          'at_delivery': 'at_delivery',
          'unloading': 'at_delivery',
          'delivery_in_progress': 'at_delivery'
        };
        return statusMap[status] || status;
      };

      const normalizedStatus = normalizeStatus(job.status);

      return {
        _id: job._id,
        bidId: job.bidId,
        loadId: job.loadId,
        
        // Basic job information
        title: job.title || job.loadTitle || job.description || 'Transport Job',
        pickupLocation: job.pickupLocation || job.origin || job.fromLocation || 'Pickup Location',
        deliveryLocation: job.deliveryLocation || job.destination || job.toLocation || 'Delivery Location',
        
        // Dates
        pickupDate,
        deliveryDate,
        
        // Cargo details
        cargoType: job.cargoType || job.loadType || job.type || 'General Cargo',
        weight: job.weight || job.cargoWeight || job.estimatedWeight,
        dimensions: job.dimensions,
        
        // Financial information
        agreedAmount: job.agreedAmount || job.totalAmount || job.price || job.amount || 0,
        totalAmount: job.totalAmount || job.agreedAmount || job.price || job.amount || 0,
        budget: job.totalAmount || job.agreedAmount || job.price || job.amount || 0,
        currency: job.currency || 'KES',
        paymentMethod: job.paymentMethod,
        paymentTiming: job.paymentTiming,
        
        // Status information
        status: normalizedStatus,
        originalStatus: job.status,
        statusDisplay: getStatusDisplayName(normalizedStatus),
        
        // Timestamps
        assignedAt: job.assignedAt || job.acceptedAt || job.createdAt,
        acceptedAt: job.acceptedAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        
        // Related IDs
        cargoOwnerId: job.cargoOwnerId,
        driverId: job.driverId,
        
        // Additional details
        specialInstructions: job.specialInstructions || job.instructions,
        trackingUpdates: job.trackingUpdates || [],
        timeline: job.timeline || [],
        estimatedDistance: job.estimatedDistance,
        estimatedDuration: job.estimatedDuration,
        
        // Contact information
        driverInfo: job.driverInfo,
        cargoOwnerInfo: job.cargoOwnerInfo,
        
        // Derived fields for UI
        isUrgent,
        isOverdue,
        timeToPickup,
        priority: isOverdue ? 'critical' : isUrgent ? 'high' : timeToPickup <= 1 ? 'high' : 'normal',
        
        // Action helpers
        availableActions: getAvailableActions(normalizedStatus),
        canConfirm: ['assigned', 'accepted'].includes(normalizedStatus),
        canStart: ['assigned', 'accepted', 'confirmed'].includes(normalizedStatus),
        canUpdateLocation: ['in_progress', 'picked_up', 'in_transit'].includes(normalizedStatus),
        canCompletePickup: ['en_route_pickup', 'at_pickup'].includes(normalizedStatus),
        canCompleteDelivery: ['in_transit', 'at_delivery'].includes(normalizedStatus),
        canUpdateStatus: true,
        canViewDetails: true,
        
        // Source tracking
        source: job.source || 'booking'
      };
    });

    // Enhanced sorting logic
    formattedJobs.sort((a, b) => {
      // Critical/overdue jobs first
      if (a.priority === 'critical' && b.priority !== 'critical') return -1;
      if (a.priority !== 'critical' && b.priority === 'critical') return 1;
      
      // High priority jobs next
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      
      // Then by pickup date (soonest first)
      if (a.pickupDate && b.pickupDate) {
        return new Date(a.pickupDate) - new Date(b.pickupDate);
      }
      if (a.pickupDate && !b.pickupDate) return -1;
      if (!a.pickupDate && b.pickupDate) return 1;
      
      // Finally by assignment date (newest first)
      return new Date(b.assignedAt) - new Date(a.assignedAt);
    });

    // Calculate comprehensive summary statistics
    const summary = {
      total: formattedJobs.length,
      urgent: formattedJobs.filter(job => job.isUrgent).length,
      overdue: formattedJobs.filter(job => job.isOverdue).length,
      critical: formattedJobs.filter(job => job.priority === 'critical').length,
      high: formattedJobs.filter(job => job.priority === 'high').length,
      today: formattedJobs.filter(job => 
        job.pickupDate && 
        new Date(job.pickupDate).toDateString() === new Date().toDateString()
      ).length,
      thisWeek: formattedJobs.filter(job => {
        if (!job.pickupDate) return false;
        const pickupDate = new Date(job.pickupDate);
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return pickupDate >= now && pickupDate <= weekFromNow;
      }).length,
      byStatus: formattedJobs.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {}),
      totalValue: formattedJobs.reduce((sum, job) => sum + (job.agreedAmount || 0), 0),
      avgValue: formattedJobs.length > 0 
        ? Math.round((formattedJobs.reduce((sum, job) => sum + (job.agreedAmount || 0), 0) / formattedJobs.length) * 100) / 100 
        : 0
    };

    res.json({
      status: 'success',
      data: {
        activeJobs: formattedJobs,
        total: formattedJobs.length,
        summary,
        message: formattedJobs.length === 0 ? 'No active jobs found. Check for new opportunities in available loads!' : undefined,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    console.error('Get active jobs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching active jobs',
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

// @route   GET /api/drivers/profile
// @desc    Get driver's own profile
// @access  Private (Driver only)
router.get('/profile', auth, driverLimiter, async (req, res) => {
  try {
    console.log('Driver profile GET request - User:', req.user);

    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can access driver profiles'
      });
    }

    const db = mongoose.connection.db;
    const driversCollection = db.collection('drivers');
    const bookingsCollection = db.collection('bookings');
    
    // Convert user ID to ObjectId properly
    let driverId;
    try {
      driverId = new mongoose.Types.ObjectId(req.user.id);
      console.log('Driver ID converted:', driverId);
    } catch (error) {
      console.error('Invalid driver ID format:', req.user.id);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

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
      console.log('Driver not found for ID:', driverId);
      return res.status(404).json({
        status: 'error',
        message: 'Driver profile not found'
      });
    }

    console.log('Driver found:', driver.email);

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

// @route   PUT /api/drivers/profile
// @desc    Update driver profile
// @access  Private (Driver only)
router.put('/profile', auth, driverLimiter, profileValidation, async (req, res) => {
  try {
    console.log('Driver profile PUT request - User:', req.user);
    console.log('Update data:', req.body);

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

    // Convert user ID to ObjectId properly
    let driverId;
    try {
      driverId = new mongoose.Types.ObjectId(req.user.id);
      console.log('Driver ID for update:', driverId);
    } catch (error) {
      console.error('Invalid driver ID format:', req.user.id);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID format'
      });
    }

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

    console.log('Final update data:', updateData);

    const result = await collection.findOneAndUpdate(
      { _id: driverId },
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
      console.log('Driver not found for update, ID:', driverId);
      return res.status(404).json({
        status: 'error',
        message: 'Driver not found'
      });
    }

    console.log('Driver profile updated successfully');

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

// Helper function for profile completion calculation
function calculateProfileCompletion(driver) {
  const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'vehicleType', 'vehicleCapacity', 'licenseNumber'];
  const optionalFields = ['location', 'address', 'city', 'vehiclePlate', 'vehicleModel', 'experienceYears', 'bio'];
  
  const completedRequired = requiredFields.filter(field => driver[field] && driver[field].toString().trim() !== '').length;
  const completedOptional = optionalFields.filter(field => driver[field] && driver[field].toString().trim() !== '').length;
  
  const requiredPercentage = (completedRequired / requiredFields.length) * 70;
  const optionalPercentage = (completedOptional / optionalFields.length) * 30;
  
  return Math.round(requiredPercentage + optionalPercentage);
}

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

    // Active job statuses for consistency
    const activeStatuses = [
      'assigned', 'accepted', 'driver_assigned', 'confirmed', 'in_progress', 'started',
      'en_route_pickup', 'en_route_to_pickup', 'going_to_pickup',
      'arrived_pickup', 'at_pickup_location', 'at_pickup',
      'picked_up', 'pickup_completed', 'loading', 'loaded',
      'in_transit', 'on_route', 'en_route_delivery', 'en_route_to_delivery',
      'transporting', 'delivering',
      'arrived_delivery', 'at_delivery_location', 'at_delivery',
      'unloading', 'delivery_in_progress'
    ];

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
      acceptedBids,
      pendingBids,
      rejectedBids
    ] = await Promise.all([
      // Total bookings
      bookingsCollection.countDocuments({ driverId }),
      
      // Completed bookings
      bookingsCollection.countDocuments({ driverId, status: 'completed' }),
      
      // Active bookings (using comprehensive status list)
      bookingsCollection.countDocuments({ 
        driverId, 
        status: { $in: activeStatuses } 
      }),
      
      // Cancelled bookings
      bookingsCollection.countDocuments({ driverId, status: 'cancelled' }),
      
      // Average rating with comprehensive calculation
      bookingsCollection.aggregate([
        { 
          $match: { 
            driverId, 
            rating: { $exists: true, $ne: null, $gte: 1, $lte: 5 } 
          } 
        },
        { 
          $group: { 
            _id: null, 
            avgRating: { $avg: '$rating' },
            count: { $sum: 1 },
            totalRating: { $sum: '$rating' },
            fiveStars: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            fourStars: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } }
          } 
        }
      ]).toArray(),
      
      // Current month earnings with multiple amount field fallbacks
      bookingsCollection.aggregate([
        {
          $match: {
            driverId,
            status: 'completed',
            $or: [
              { completedAt: { $gte: startOfMonth } },
              { updatedAt: { $gte: startOfMonth } }
            ],
            $or: [
              { totalAmount: { $exists: true, $ne: null, $gt: 0 } },
              { agreedAmount: { $exists: true, $ne: null, $gt: 0 } },
              { price: { $exists: true, $ne: null, $gt: 0 } }
            ]
          }
        },
        {
          $addFields: {
            earningsAmount: {
              $ifNull: [
                '$totalAmount',
                { $ifNull: ['$agreedAmount', '$price'] }
              ]
            }
          }
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$earningsAmount' },
            count: { $sum: 1 },
            avg: { $avg: '$earningsAmount' }
          } 
        }
      ]).toArray(),
      
      // Last month earnings
      bookingsCollection.aggregate([
        {
          $match: {
            driverId,
            status: 'completed',
            $or: [
              { 
                completedAt: { 
                  $gte: startOfLastMonth, 
                  $lte: endOfLastMonth 
                } 
              },
              { 
                updatedAt: { 
                  $gte: startOfLastMonth, 
                  $lte: endOfLastMonth 
                } 
              }
            ],
            $or: [
              { totalAmount: { $exists: true, $ne: null, $gt: 0 } },
              { agreedAmount: { $exists: true, $ne: null, $gt: 0 } },
              { price: { $exists: true, $ne: null, $gt: 0 } }
            ]
          }
        },
        {
          $addFields: {
            earningsAmount: {
              $ifNull: [
                '$totalAmount',
                { $ifNull: ['$agreedAmount', '$price'] }
              ]
            }
          }
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$earningsAmount' } 
          } 
        }
      ]).toArray(),
      
      // Total earnings
      bookingsCollection.aggregate([
        {
          $match: {
            driverId,
            status: 'completed',
            $or: [
              { totalAmount: { $exists: true, $ne: null, $gt: 0 } },
              { agreedAmount: { $exists: true, $ne: null, $gt: 0 } },
              { price: { $exists: true, $ne: null, $gt: 0 } }
            ]
          }
        },
        {
          $addFields: {
            earningsAmount: {
              $ifNull: [
                '$totalAmount',
                { $ifNull: ['$agreedAmount', '$price'] }
              ]
            }
          }
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$earningsAmount' },
            count: { $sum: 1 }
          } 
        }
      ]).toArray(),
      
      // Total bids
      bidsCollection.countDocuments({ driverId }),
      
      // Accepted bids
      bidsCollection.countDocuments({ driverId, status: 'accepted' }),
      
      // Pending bids
      bidsCollection.countDocuments({ driverId, status: 'submitted' }),
      
      // Rejected bids
      bidsCollection.countDocuments({ driverId, status: 'rejected' })
    ]);

    // Calculate success/completion rate
    const successRate = totalBookings > 0 ? 
      Math.round((completedBookings / totalBookings) * 100) : 0;

    // Get average rating with fallback
    const averageRating = ratingStats.length > 0 ? 
      Math.round(ratingStats[0].avgRating * 10) / 10 : 0;

    const totalRatings = ratingStats.length > 0 ? ratingStats[0].count : 0;

    // Extract earnings with fallbacks
    const currentMonthEarnings = monthlyEarnings.length > 0 ? monthlyEarnings[0].total : 0;
    const currentMonthJobs = monthlyEarnings.length > 0 ? monthlyEarnings[0].count : 0;
    const avgMonthlyEarnings = monthlyEarnings.length > 0 ? monthlyEarnings[0].avg : 0;

    const previousMonthEarnings = lastMonthEarnings.length > 0 ? lastMonthEarnings[0].total : 0;
    const allTimeEarnings = totalEarnings.length > 0 ? totalEarnings[0].total : 0;
    const totalJobsWithEarnings = totalEarnings.length > 0 ? totalEarnings[0].count : 0;

    // Calculate bid acceptance rate
    const bidAcceptanceRate = totalBids > 0 ? 
      Math.round((acceptedBids / totalBids) * 100) : 0;

    // Calculate growth rates
    const earningsGrowth = previousMonthEarnings > 0 ? 
      Math.round(((currentMonthEarnings - previousMonthEarnings) / previousMonthEarnings) * 100) : 0;

    const statsResponse = {
      // Core statistics
      totalJobs: totalBookings,
      activeJobs: activeBookings,
      completedJobs: completedBookings,
      cancelledJobs: cancelledBookings,
      pendingJobs: totalBookings - completedBookings - cancelledBookings - activeBookings,
      
      // Performance metrics
      successRate,
      completionRate: successRate, // Alias for compatibility
      averageRating,
      rating: averageRating, // Alias for compatibility
      totalRatings,
      
      // Bid statistics
      totalBids,
      acceptedBids,
      pendingBids,
      rejectedBids,
      bidAcceptanceRate,
      
      // Financial metrics
      monthlyEarnings: currentMonthEarnings,
      totalEarnings: allTimeEarnings,
      avgEarningsPerJob: totalJobsWithEarnings > 0 ? 
        Math.round((allTimeEarnings / totalJobsWithEarnings) * 100) / 100 : 0,
      avgMonthlyEarnings: Math.round(avgMonthlyEarnings * 100) / 100,
      
      // Growth metrics
      earningsGrowth,
      jobsThisMonth: currentMonthJobs,
      
      // Rating breakdown
      ratingBreakdown: ratingStats.length > 0 ? {
        five: ratingStats[0].fiveStars || 0,
        four: ratingStats[0].fourStars || 0,
        total: ratingStats[0].count || 0
      } : { five: 0, four: 0, total: 0 }
    };

    const earningsResponse = {
      thisMonth: currentMonthEarnings,
      lastMonth: previousMonthEarnings,
      total: allTimeEarnings,
      growth: earningsGrowth,
      avgPerJob: statsResponse.avgEarningsPerJob,
      jobsWithEarnings: totalJobsWithEarnings
    };

    res.json({
      status: 'success',
      data: {
        stats: statsResponse,
        earnings: earningsResponse
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

// @route   GET /api/drivers/quick-stats
// @desc    Get essential driver statistics quickly
// @access  Private (Driver only)
router.get('/quick-stats', auth, async (req, res) => {
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

    // Active statuses for consistency
    const activeStatuses = [
      'assigned', 'accepted', 'driver_assigned', 'confirmed', 'in_progress', 
      'picked_up', 'in_transit'
    ];

    // Quick parallel queries
    const [activeJobs, pendingBids, totalJobs, monthlyEarnings] = await Promise.all([
      bookingsCollection.countDocuments({ 
        driverId, 
        status: { $in: activeStatuses } 
      }),
      
      bidsCollection.countDocuments({ 
        driverId, 
        status: 'submitted' 
      }),
      
      bookingsCollection.countDocuments({ driverId }),
      
      bookingsCollection.aggregate([
        {
          $match: {
            driverId,
            status: 'completed',
            $or: [
              { completedAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
              { updatedAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }
            ],
            totalAmount: { $exists: true, $ne: null, $gt: 0 }
          }
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$totalAmount' } 
          } 
        }
      ]).toArray()
    ]);

    const currentMonthEarnings = monthlyEarnings.length > 0 ? monthlyEarnings[0].total : 0;

    res.json({
      status: 'success',
      data: {
        activeJobs,
        pendingBids,
        totalJobs,
        monthlyEarnings: currentMonthEarnings,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    console.error('Get quick stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching quick statistics'
    });
  }
});



// @route   POST /api/drivers/availability
// @desc    Toggle driver availability
// @access  Private (Driver only)
router.post('/availability', auth, [
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

    //  Use the correct collection and handle the result properly
    const db = mongoose.connection.db;
    
    // Try updating in the drivers collection first
    let result = await db.collection('drivers').findOneAndUpdate(
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

    // If not found in drivers collection, try users collection
    if (!result) {
      result = await db.collection('users').findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(req.user.id), userType: 'driver' },
        { 
          $set: { 
            'driverProfile.isAvailable': isAvailable,
            'driverProfile.lastAvailabilityUpdate': new Date(),
            updatedAt: new Date()
          }
        },
        { 
          returnDocument: 'after',
          projection: { 'driverProfile.isAvailable': 1, name: 1, userType: 1 }
        }
      );
    }

    if (!result) {
      return res.status(404).json({
        status: 'error',
        message: 'Driver profile not found'
      });
    }

    //  Ensure we have the correct data structure
    const updatedAvailability = result.driverProfile?.isAvailable ?? isAvailable;

    console.log(`Driver ${req.user.id} availability updated to: ${updatedAvailability}`);

    res.json({
      status: 'success',
      message: `Availability ${updatedAvailability ? 'enabled' : 'disabled'} successfully`,
      data: {
        isAvailable: updatedAvailability,
        lastUpdate: new Date().toISOString(),
        driverName: result.name
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

// @route   DELETE /api/drivers/profile
// @desc    Delete driver profile and account
// @access  Private (Driver only)
router.delete('/profile', auth, driverLimiter, async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Only drivers can delete driver profiles'
      });
    }

    const db = mongoose.connection.db;
    const driverId = new mongoose.Types.ObjectId(req.user.id);
    
    // Check for active bookings before deletion
    const activeBookings = await db.collection('bookings').countDocuments({
      driverId,
      status: { $in: ['accepted', 'in_progress', 'driver_assigned'] }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete profile while you have active bookings. Please complete or cancel all active jobs first.'
      });
    }

    // Start transaction to ensure data consistency
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Delete driver profile
        const deleteResult = await db.collection('drivers').deleteOne(
          { _id: driverId },
          { session }
        );

        if (deleteResult.deletedCount === 0) {
          throw new Error('Driver profile not found');
        }

        // Update related bookings to mark driver as deleted (for historical records)
        await db.collection('bookings').updateMany(
          { driverId },
          { 
            $set: { 
              driverDeleted: true,
              driverDeletedAt: new Date()
            }
          },
          { session }
        );

        // Log the deletion for audit purposes
        await db.collection('audit-logs').insertOne({
          action: 'driver_profile_deleted',
          driverId,
          driverEmail: req.user.email,
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }, { session });

      });

      await session.endSession();

      res.json({
        status: 'success',
        message: 'Driver profile deleted successfully'
      });

    } catch (transactionError) {
      await session.endSession();
      throw transactionError;
    }

  } catch (error) {
    console.error('Delete driver profile error:', error);
    
    if (error.message === 'Driver profile not found') {
      return res.status(404).json({
        status: 'error',
        message: 'Driver profile not found'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error deleting profile',
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

// @route   POST /api/drivers/jobs/:jobId/update-status
// @desc    Update job status (driver can update their active job status)
// @access  Private (Driver only)
router.post('/jobs/:jobId/update-status', auth, [
  body('status').isIn([
    'confirmed', 'en_route_pickup', 'arrived_pickup', 'picked_up', 
    'in_transit', 'arrived_delivery', 'delivered', 'completed'
  ]).withMessage('Invalid status'),
  body('location').optional().isObject(),
  body('notes').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Driver account required.'
      });
    }

    const { jobId } = req.params;
    const { status, location, notes } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    // Find the job
    const job = await bookingsCollection.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      driverId: new mongoose.Types.ObjectId(req.user.id)
    });

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found or not assigned to you'
      });
    }

    // Validate status transition
    const validTransitions = {
      'assigned': ['confirmed', 'en_route_pickup'],
      'confirmed': ['en_route_pickup', 'arrived_pickup'],
      'en_route_pickup': ['arrived_pickup'],
      'arrived_pickup': ['picked_up'],
      'picked_up': ['in_transit'],
      'in_transit': ['arrived_delivery'],
      'arrived_delivery': ['delivered'],
      'delivered': ['completed']
    };

    const currentStatus = job.status;
    if (!validTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot transition from ${currentStatus} to ${status}`
      });
    }

    // Update job status
    const updateData = {
      status,
      updatedAt: new Date(),
      [`${status}At`]: new Date() // e.g., confirmedAt, pickedUpAt, etc.
    };

    // Add location if provided
    if (location) {
      updateData.currentLocation = location;
      updateData.locationHistory = job.locationHistory || [];
      updateData.locationHistory.push({
        ...location,
        timestamp: new Date(),
        status
      });
    }

    // Add timeline entry
    const timelineEntry = {
      event: status,
      timestamp: new Date(),
      description: notes || `Status updated to ${status.replace(/_/g, ' ')}`,
      location: location || undefined
    };

    updateData.timeline = job.timeline || [];
    updateData.timeline.push(timelineEntry);

    // Update the job
    await bookingsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(jobId) },
      { $set: updateData }
    );

    // If job is completed, also update the load status
    if (status === 'completed') {
      const Load = require('../models/load');
      await Load.findByIdAndUpdate(job.loadId, {
        status: 'delivered',
        deliveredAt: new Date(),
        completedAt: new Date()
      });

      // Update bid status as well
      const Bid = require('../models/bid');
      if (job.bidId) {
        await Bid.findByIdAndUpdate(job.bidId, {
          status: 'completed',
          completedAt: new Date()
        });
      }
    }

    // Send notifications to cargo owner about status updates
    try {
      const {notificationUtils} = require('./notifications');
      const statusMessages = {
        'confirmed': 'Driver has confirmed the job',
        'en_route_pickup': 'Driver is en route to pickup location',
        'arrived_pickup': 'Driver has arrived at pickup location',
        'picked_up': 'Cargo has been picked up',
        'in_transit': 'Cargo is in transit',
        'arrived_delivery': 'Driver has arrived at delivery location',
        'delivered': 'Cargo has been delivered',
        'completed': 'Job completed successfully'
      };

      await notificationUtils.createNotification({
        userId: job.cargoOwnerId,
        userType: 'cargo_owner',
        type: 'job_status_update',
        title: 'Job Status Update',
        message: statusMessages[status] || `Job status updated to ${status}`,
        priority: ['delivered', 'completed'].includes(status) ? 'high' : 'normal',
        icon: 'truck',
        data: {
          jobId: job._id,
          loadId: job.loadId,
          status,
          driverId: req.user.id
        },
        actionUrl: `/loads/${job.loadId}/tracking`
      });
    } catch (notificationError) {
      console.error('Failed to send status update notification:', notificationError);
    }

    res.json({
      status: 'success',
      message: 'Job status updated successfully',
      data: {
        jobId,
        newStatus: status,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error updating job status',
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

// @route   GET /api/drivers/jobs/:jobId/details
// @desc    Get detailed information for a specific job
// @access  Private (Driver only)
router.get('/jobs/:jobId/details', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Driver account required.'
      });
    }

    const { jobId } = req.params;
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    const job = await bookingsCollection.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      driverId: new mongoose.Types.ObjectId(req.user.id)
    });

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found or not assigned to you'
      });
    }

    // Get additional details from load
    const Load = require('../models/load');
    const load = await Load.findById(job.loadId)
      .populate('postedBy', 'name phone email location companyName');

    // Get cargo owner details if not populated
    let cargoOwner = load?.postedBy;
    if (!cargoOwner && job.cargoOwnerId) {
      const User = require('../models/user');
      cargoOwner = await User.findById(job.cargoOwnerId)
        .select('name phone email location companyName');
    }

    const detailedJob = {
      ...job,
      loadDetails: load ? {
        title: load.title,
        description: load.description,
        pickupAddress: load.pickupAddress,
        deliveryAddress: load.deliveryAddress,
        specialInstructions: load.specialInstructions,
        insuranceRequired: load.insuranceRequired,
        cargoValue: load.cargoValue,
        dimensions: load.dimensions
      } : null,
      cargoOwnerDetails: cargoOwner ? {
        name: cargoOwner.name,
        phone: cargoOwner.phone,
        email: cargoOwner.email,
        location: cargoOwner.location,
        companyName: cargoOwner.companyName
      } : job.cargoOwnerInfo || null
    };

    res.json({
      status: 'success',
      data: {
        job: detailedJob
      }
    });

  } catch (error) {
    console.error('Get job details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching job details',
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

// @route   POST /api/drivers/rate
// @desc    Rate a driver (Cargo Owner only) 
// @access  Private (Cargo Owner only)
router.post('/rate/:driverId', auth, [
  body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('review').optional().isLength({ max: 500 }).withMessage('Review cannot exceed 500 characters'),
  body('bookingId').isMongoId().withMessage('Valid booking ID required')
], async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can rate drivers'
      });
    }

    const { driverId } = req.params;
    const { rating, review, bookingId } = req.body;

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

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');
    const driversCollection = db.collection('drivers');

    // Verify the booking exists and belongs to this cargo owner and driver
    const booking = await bookingsCollection.findOne({
      _id: new mongoose.Types.ObjectId(bookingId),
      driverId: new mongoose.Types.ObjectId(driverId),
      cargoOwnerId: new mongoose.Types.ObjectId(req.user.id),
      status: 'completed'
    });

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found or not eligible for rating'
      });
    }

    // Check if already rated
    if (booking.rating) {
      return res.status(400).json({
        status: 'error',
        message: 'This booking has already been rated'
      });
    }

    // Update the booking with rating
    await bookingsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(bookingId) },
      {
        $set: {
          rating: parseFloat(rating),
          review: review || '',
          ratedAt: new Date(),
          ratedBy: new mongoose.Types.ObjectId(req.user.id)
        }
      }
    );

    // Calculate new average rating for driver
    const ratingStats = await bookingsCollection.aggregate([
      {
        $match: {
          driverId: new mongoose.Types.ObjectId(driverId),
          rating: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]).toArray();

    const newAverageRating = ratingStats.length > 0 ? ratingStats[0].averageRating : rating;
    const totalRatings = ratingStats.length > 0 ? ratingStats[0].totalRatings : 1;

    // Update driver's profile with new rating
    await driversCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(driverId) },
      {
        $set: {
          'driverProfile.rating': Math.round(newAverageRating * 10) / 10,
          'driverProfile.totalRatings': totalRatings,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      status: 'success',
      message: 'Driver rated successfully',
      data: {
        rating: parseFloat(rating),
        review: review || '',
        bookingId,
        driverId,
        newAverageRating: Math.round(newAverageRating * 10) / 10,
        totalRatings
      }
    });

  } catch (error) {
    console.error('Rate driver error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error rating driver',
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

module.exports = router;