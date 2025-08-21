// routes/bookings.js - Booking Management Routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const corsHandler = require('../middleware/corsHandler');

router.use(corsHandler);


// Rate limiting
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    status: 'error',
    message: 'Too many booking requests, please try again later.'
  }
});



// Booking validation middleware
const bookingValidation = [
  body('loadId')
    .notEmpty()
    .withMessage('Load ID is required')
    .isMongoId()
    .withMessage('Invalid load ID'),
    
  body('driverId')
    .notEmpty()
    .withMessage('Driver ID is required')
    .isMongoId()
    .withMessage('Invalid driver ID'),
    
  body('proposedPrice')
    .optional()
    .isFloat({ min: 100 })
    .withMessage('Proposed price must be at least KES 100'),
    
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters')
];

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private
router.post('/',  auth, bookingLimiter, bookingValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { loadId, driverId, proposedPrice, notes } = req.body;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get load and validate
    const loadsCollection = db.collection('loads');
    const load = await loadsCollection.findOne({ _id: new mongoose.Types.ObjectId(loadId) });

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found'
      });
    }

    // Check if load is available for booking
    if (!['posted', 'receiving_bids'].includes(load.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'This load is no longer available for booking'
      });
    }

    // Get driver and validate
    const driversCollection = db.collection('drivers');
    const driver = await driversCollection.findOne({ _id: new mongoose.Types.ObjectId(driverId) });

    if (!driver) {
      return res.status(404).json({
        status: 'error',
        message: 'Driver not found'
      });
    }

    if (!driver.driverProfile?.isAvailable) {
      return res.status(400).json({
        status: 'error',
        message: 'Driver is not currently available'
      });
    }

    // Determine user types and permissions
    let cargoOwnerId, bookingType, status;

    if (req.user.userType === 'cargo_owner') {
      // Cargo owner is directly booking a driver
      if (load.postedBy.toString() !== req.user.id) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only book drivers for your own loads'
        });
      }
      cargoOwnerId = req.user.id;
      bookingType = 'direct_booking';
      status = 'accepted'; // Direct booking is immediately accepted
    } else if (req.user.userType === 'driver') {
      // Driver is requesting to book a load
      if (req.user.id !== driverId) {
        return res.status(403).json({
          status: 'error',
          message: 'You can only create bookings for yourself'
        });
      }
      cargoOwnerId = load.postedBy.toString();
      bookingType = 'driver_request';
      status = 'pending'; // Driver request needs cargo owner approval
    } else {
      return res.status(403).json({
        status: 'error',
        message: 'Invalid user type for creating bookings'
      });
    }

    // Check for existing active booking
    const bookingsCollection = db.collection('bookings');
    const existingBooking = await bookingsCollection.findOne({
      loadId: new mongoose.Types.ObjectId(loadId),
      driverId: new mongoose.Types.ObjectId(driverId),
      status: { $nin: ['cancelled', 'rejected'] }
    });

    if (existingBooking) {
      return res.status(400).json({
        status: 'error',
        message: 'An active booking already exists for this load and driver combination'
      });
    }

    // Create booking data
    const bookingData = {
      loadId: new mongoose.Types.ObjectId(loadId),
      driverId: new mongoose.Types.ObjectId(driverId),
      cargoOwnerId: new mongoose.Types.ObjectId(cargoOwnerId),
      loadTitle: load.title,
      pickupLocation: load.pickupLocation,
      deliveryLocation: load.deliveryLocation,
      pickupDate: load.pickupDate,
      deliveryDate: load.deliveryDate,
      proposedPrice: proposedPrice || load.budget,
      finalPrice: null,
      bookingType,
      status,
      notes,
      createdBy: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      
      // Snapshots for historical data
      loadSnapshot: {
        title: load.title,
        description: load.description,
        weight: load.weight,
        cargoType: load.cargoType,
        vehicleType: load.vehicleType,
        budget: load.budget
      },
      
      driverSnapshot: {
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        location: driver.location,
        vehicleType: driver.vehicleType,
        vehicleCapacity: driver.vehicleCapacity,
        rating: driver.driverProfile?.rating || 0
      }
    };

    // Insert booking
    const result = await bookingsCollection.insertOne(bookingData);

    if (!result.insertedId) {
      throw new Error('Failed to create booking');
    }

    // If it's a direct booking by cargo owner, update load status
    if (bookingType === 'direct_booking') {
      await loadsCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(loadId) },
        {
          $set: {
            status: 'driver_assigned',
            assignedDriver: new mongoose.Types.ObjectId(driverId),
            assignedDate: new Date(),
            updatedAt: new Date()
          }
        }
      );

      // Update driver availability
      await driversCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(driverId) },
        {
          $set: {
            'driverProfile.isAvailable': false,
            updatedAt: new Date()
          }
        }
      );
    }

    // Get the created booking with populated data
    const createdBooking = await bookingsCollection.findOne({ _id: result.insertedId });

    res.status(201).json({
      status: 'success',
      message: bookingType === 'direct_booking' 
        ? 'Driver booked successfully' 
        : 'Booking request submitted successfully',
      data: {
        booking: createdBooking
      }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error creating booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/bookings/statistics/summary
// @desc    Get booking statistics for current user
// @access  Private
router.get('/statistics/summary',  auth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    let query = {};
    
    if (req.user.userType === 'driver') {
      query.driverId = new mongoose.Types.ObjectId(req.user.id);
    } else if (req.user.userType === 'cargo_owner') {
      query.cargoOwnerId = new mongoose.Types.ObjectId(req.user.id);
    } else {
      return res.status(403).json({
        status: 'error',
        message: 'Invalid user type for accessing booking statistics'
      });
    }

    // Get statistics using aggregation
    const stats = await bookingsCollection.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                '$finalPrice',
                0
              ]
            }
          }
        }
      }
    ]).toArray();

    const summary = stats[0] || {
      total: 0,
      pending: 0,
      accepted: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      rejected: 0,
      totalRevenue: 0
    };

    // Get recent bookings
    const recentBookings = await bookingsCollection.find(query)
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    res.json({
      status: 'success',
      data: {
        summary,
        recentBookings,
        userType: req.user.userType
      }
    });

  } catch (error) {
    console.error('Get booking statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching booking statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/bookings/driver
// @desc    Get bookings for current driver (Alternative endpoint)
// @access  Private (Driver only)
router.get('/bookings/driver', auth, [
  query('status').optional().isIn(['all', 'active', 'completed', 'cancelled']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Driver account required.'
      });
    }

    const { status = 'all', page = 1, limit = 20 } = req.query;
    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    let query = { driverId };

    // Filter by status
    if (status === 'active') {
      query.status = { 
        $in: ['accepted', 'in_progress', 'driver_assigned', 'assigned', 'picked_up', 'in_transit'] 
      };
    } else if (status === 'completed') {
      query.status = 'completed';
    } else if (status === 'cancelled') {
      query.status = 'cancelled';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, totalCount] = await Promise.all([
      bookingsCollection.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray(),
      bookingsCollection.countDocuments(query)
    ]);

    // Format bookings consistently
    const formattedBookings = bookings.map(booking => ({
      _id: booking._id,
      title: booking.title || booking.loadTitle || 'Transport Job',
      pickupLocation: booking.pickupLocation || booking.origin || 'Pickup Location',
      deliveryLocation: booking.deliveryLocation || booking.destination || 'Delivery Location',
      cargoType: booking.cargoType || booking.loadType || 'General Cargo',
      budget: booking.totalAmount || booking.agreedAmount || booking.price || 0,
      price: booking.totalAmount || booking.agreedAmount || booking.price || 0,
      status: booking.status,
      pickupDate: booking.pickupDate || booking.scheduledPickupDate,
      deliveryDate: booking.deliveryDate || booking.scheduledDeliveryDate,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      assignedAt: booking.assignedAt || booking.acceptedAt,
      completedAt: booking.completedAt,
      rating: booking.rating,
      review: booking.review
    }));

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      status: 'success',
      data: {
        bookings: formattedBookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        filter: status
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

// @route   GET /api/bookings
// @desc    Get bookings for current user
// @access  Private
router.get('/',  auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected'])
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

    const { page = 1, limit = 20, status } = req.query;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    // Build query based on user type
    let query = {};
    
    if (req.user.userType === 'driver') {
      query.driverId = new mongoose.Types.ObjectId(req.user.id);
    } else if (req.user.userType === 'cargo_owner') {
      query.cargoOwnerId = new mongoose.Types.ObjectId(req.user.id);
    } else {
      return res.status(403).json({
        status: 'error',
        message: 'Invalid user type for accessing bookings'
      });
    }

    if (status) {
      query.status = status;
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
    console.error('Get bookings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking by ID
// @access  Private (Only participants)
router.get('/:id',  auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid booking ID'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    const booking = await bookingsCollection.findOne({ _id: new mongoose.Types.ObjectId(id) });

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Check if user has access to this booking
    const hasAccess = (
      booking.driverId.toString() === req.user.id ||
      booking.cargoOwnerId.toString() === req.user.id
    );

    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to view this booking'
      });
    }

    res.json({
      status: 'success',
      data: {
        booking
      }
    });

  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/bookings/:id/status
// @desc    Update booking status
// @access  Private (Only participants)
router.put('/:id/status',  auth, [
  body('status').isIn(['accepted', 'rejected', 'cancelled', 'in_progress', 'completed']).withMessage('Invalid status'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid booking ID'
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

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    const booking = await bookingsCollection.findOne({ _id: new mongoose.Types.ObjectId(id) });

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Check permissions based on status change
    let authorized = false;
    
    if (['accepted', 'rejected'].includes(status)) {
      // Only cargo owner can accept/reject
      authorized = booking.cargoOwnerId.toString() === req.user.id && req.user.userType === 'cargo_owner';
    } else if (status === 'cancelled') {
      // Either party can cancel
      authorized = (booking.driverId.toString() === req.user.id || booking.cargoOwnerId.toString() === req.user.id);
    } else if (['in_progress', 'completed'].includes(status)) {
      // Only driver can update to in_progress/completed
      authorized = booking.driverId.toString() === req.user.id && req.user.userType === 'driver';
    }

    if (!authorized) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update booking status to ' + status
      });
    }

    // Validate status transition
    const validTransitions = {
      'pending': ['accepted', 'rejected', 'cancelled'],
      'accepted': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': [],
      'rejected': []
    };

    if (!validTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot change status from ${booking.status} to ${status}`
      });
    }

    // Update booking
    const updateData = {
      status,
      updatedAt: new Date(),
      updatedBy: req.user.id
    };

    if (notes) {
      updateData.notes = notes;
    }

    // Add status-specific data
    if (status === 'accepted') {
      updateData.acceptedAt = new Date();
      updateData.finalPrice = booking.proposedPrice;
    } else if (status === 'in_progress') {
      updateData.startedAt = new Date();
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    // Add to status history
    updateData.$push = {
      statusHistory: {
        status,
        timestamp: new Date(),
        updatedBy: req.user.id,
        notes
      }
    };

    const result = await bookingsCollection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      updateData,
      { returnDocument: 'after' }
    );

    // Update related entities based on status
    const loadsCollection = db.collection('loads');
    const driversCollection = db.collection('drivers');

    if (status === 'accepted') {
      // Update load status and assign driver
      await loadsCollection.updateOne(
        { _id: booking.loadId },
        {
          $set: {
            status: 'driver_assigned',
            assignedDriver: booking.driverId,
            assignedDate: new Date(),
            updatedAt: new Date()
          }
        }
      );

      // Make driver unavailable
      await driversCollection.updateOne(
        { _id: booking.driverId },
        {
          $set: {
            'driverProfile.isAvailable': false,
            updatedAt: new Date()
          }
        }
      );

      // Cancel other pending bookings for this load
      await bookingsCollection.updateMany(
        {
          loadId: booking.loadId,
          _id: { $ne: new mongoose.Types.ObjectId(id) },
          status: 'pending'
        },
        {
          $set: {
            status: 'cancelled',
            notes: 'Load was assigned to another driver',
            updatedAt: new Date()
          }
        }
      );

    } else if (status === 'in_progress') {
      await loadsCollection.updateOne(
        { _id: booking.loadId },
        {
          $set: {
            status: 'in_transit',
            updatedAt: new Date()
          }
        }
      );

    } else if (status === 'completed') {
      await loadsCollection.updateOne(
        { _id: booking.loadId },
        {
          $set: {
            status: 'delivered',
            updatedAt: new Date()
          }
        }
      );

      // Make driver available again
      await driversCollection.updateOne(
        { _id: booking.driverId },
        {
          $set: {
            'driverProfile.isAvailable': true,
            updatedAt: new Date()
          },
          $inc: {
            'driverProfile.completedJobs': 1
          }
        }
      );

      // Update cargo owner's completed shipments
      const cargoOwnersCollection = db.collection('cargo-owners');
      await cargoOwnersCollection.updateOne(
        { _id: booking.cargoOwnerId },
        {
          $inc: {
            'cargoOwnerProfile.totalShipments': 1
          },
          $set: {
            updatedAt: new Date()
          }
        }
      );

    } else if (['cancelled', 'rejected'].includes(status)) {
      // If booking was previously accepted, make driver available again
      if (booking.status === 'accepted' || booking.status === 'in_progress') {
        await driversCollection.updateOne(
          { _id: booking.driverId },
          {
            $set: {
              'driverProfile.isAvailable': true,
              updatedAt: new Date()
            }
          }
        );

        // Reset load status if no other active bookings
        const activeBookings = await bookingsCollection.countDocuments({
          loadId: booking.loadId,
          status: { $in: ['accepted', 'in_progress'] },
          _id: { $ne: new mongoose.Types.ObjectId(id) }
        });

        if (activeBookings === 0) {
          await loadsCollection.updateOne(
            { _id: booking.loadId },
            {
              $set: {
                status: 'posted',
                assignedDriver: null,
                assignedDate: null,
                updatedAt: new Date()
              }
            }
          );
        }
      }
    }

    res.json({
      status: 'success',
      message: `Booking ${status} successfully`,
      data: {
        booking: result.value
      }
    });

  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error updating booking status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/bookings/:id/rate
// @desc    Rate and review a completed booking
// @access  Private (Only participants of completed booking)
router.post('/:id/rate',  auth, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('review').optional().isLength({ max: 1000 }).withMessage('Review cannot exceed 1000 characters')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid booking ID'
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

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    const booking = await bookingsCollection.findOne({ _id: new mongoose.Types.ObjectId(id) });

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Check if user is part of this booking
    const isDriver = booking.driverId.toString() === req.user.id;
    const isCargoOwner = booking.cargoOwnerId.toString() === req.user.id;

    if (!isDriver && !isCargoOwner) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to rate this booking'
      });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({
        status: 'error',
        message: 'Can only rate completed bookings'
      });
    }

    // Check if user already rated
    const ratingField = isDriver ? 'driverRating' : 'cargoOwnerRating';
    if (booking[ratingField]) {
      return res.status(400).json({
        status: 'error',
        message: 'You have already rated this booking'
      });
    }

    // Update booking with rating
    const updateData = {
      [ratingField]: {
        rating,
        review,
        ratedAt: new Date(),
        ratedBy: req.user.id
      },
      updatedAt: new Date()
    };

    await bookingsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: updateData }
    );

    // Update user's average rating
    const targetCollection = isDriver ? 'cargo-owners' : 'drivers';
    const targetId = isDriver ? booking.cargoOwnerId : booking.driverId;
    const profileField = isDriver ? 'cargoOwnerProfile' : 'driverProfile';

    const targetUserCollection = db.collection(targetCollection);

    // Get all ratings for this user
    const userBookings = await bookingsCollection.find({
      [isDriver ? 'cargoOwnerId' : 'driverId']: targetId,
      [ratingField]: { $exists: true }
    }).toArray();

    const ratings = userBookings.map(b => b[ratingField].rating).filter(r => r);
    const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;

    // Update user's profile
    await targetUserCollection.updateOne(
      { _id: targetId },
      {
        $set: {
          [`${profileField}.rating`]: Math.round(avgRating * 10) / 10,
          [`${profileField}.totalRatings`]: ratings.length,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      status: 'success',
      message: 'Rating submitted successfully',
      data: {
        rating,
        review,
        newAverageRating: Math.round(avgRating * 10) / 10
      }
    });

  } catch (error) {
    console.error('Rate booking error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error submitting rating',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});



module.exports = router;