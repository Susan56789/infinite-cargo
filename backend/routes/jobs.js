// routes/jobs.js - Job Management Routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const corsHandler = require('../middleware/corsHandler');

router.use(corsHandler);

// Rate limiting
const jobsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Allow more requests for job operations
  message: {
    status: 'error',
    message: 'Too many job requests, please try again later.'
  }
});

// @route   GET /api/jobs/driver/active
// @desc    Get active jobs for current driver (matches frontend expectation)
// @access  Private (Driver only)
router.get('/driver/active', auth, jobsLimiter, async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Driver account required.'
      });
    }

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    // Get active jobs - jobs that are assigned to driver and in progress
    const activeJobs = await bookingsCollection.find({
      driverId,
      status: { $in: ['accepted', 'in_progress', 'driver_assigned', 'picked_up', 'in_transit'] }
    })
    .sort({ createdAt: -1 })
    .toArray();

    // Format jobs for frontend compatibility
    const formattedJobs = activeJobs.map(job => ({
      _id: job._id,
      title: job.title || job.loadTitle || 'Transport Job',
      pickupLocation: job.pickupLocation || job.origin,
      deliveryLocation: job.deliveryLocation || job.destination,
      pickupDate: job.pickupDate || job.scheduledPickupDate,
      deliveryDate: job.deliveryDate || job.scheduledDeliveryDate,
      cargoType: job.cargoType || job.loadType || 'General Cargo',
      weight: job.weight || job.cargoWeight,
      budget: job.totalAmount || job.agreedAmount || job.price,
      price: job.totalAmount || job.agreedAmount || job.price,
      currency: job.currency || 'KES',
      status: job.status,
      assignedAt: job.assignedAt || job.acceptedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      // Additional fields that might be useful
      cargoOwnerId: job.cargoOwnerId,
      loadId: job.loadId,
      estimatedDistance: job.estimatedDistance,
      estimatedDuration: job.estimatedDuration
    }));

    res.json({
      status: 'success',
      data: {
        activeJobs: formattedJobs,
        total: formattedJobs.length,
        summary: {
          inProgress: formattedJobs.filter(job => job.status === 'in_progress').length,
          accepted: formattedJobs.filter(job => job.status === 'accepted').length,
          assigned: formattedJobs.filter(job => job.status === 'driver_assigned').length
        }
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

// @route   GET /api/jobs/driver/completed
// @desc    Get completed jobs for current driver
// @access  Private (Driver only)
router.get('/driver/completed', auth, jobsLimiter, [
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

    const { page = 1, limit = 20 } = req.query;

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
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get completed jobs
    const completedJobs = await bookingsCollection.find({
      driverId,
      status: 'completed'
    })
    .sort({ completedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .toArray();

    // Get total count
    const totalJobs = await bookingsCollection.countDocuments({
      driverId,
      status: 'completed'
    });

    const totalPages = Math.ceil(totalJobs / parseInt(limit));

    // Format jobs for frontend
    const formattedJobs = completedJobs.map(job => ({
      _id: job._id,
      title: job.title || job.loadTitle || 'Transport Job',
      pickupLocation: job.pickupLocation || job.origin,
      deliveryLocation: job.deliveryLocation || job.destination,
      cargoType: job.cargoType || job.loadType || 'General Cargo',
      totalAmount: job.totalAmount || job.agreedAmount || job.price,
      currency: job.currency || 'KES',
      completedAt: job.completedAt,
      rating: job.rating,
      review: job.review,
      distance: job.actualDistance || job.estimatedDistance,
      duration: job.actualDuration || job.estimatedDuration
    }));

    res.json({
      status: 'success',
      data: {
        completedJobs: formattedJobs,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalJobs,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get completed jobs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching completed jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/jobs/driver/all
// @desc    Get all jobs for current driver (active, completed, cancelled)
// @access  Private (Driver only)
router.get('/driver/all', auth, jobsLimiter, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['active', 'completed', 'cancelled', 'all'])
], async (req, res) => {
  try {
    if (req.user.userType !== 'driver') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Driver account required.'
      });
    }

    const { page = 1, limit = 20, status = 'all' } = req.query;

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
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    // Build query based on status filter
    let query = { driverId };
    
    switch (status) {
      case 'active':
        query.status = { $in: ['accepted', 'in_progress', 'driver_assigned', 'picked_up', 'in_transit'] };
        break;
      case 'completed':
        query.status = 'completed';
        break;
      case 'cancelled':
        query.status = 'cancelled';
        break;
      case 'all':
      default:
        // No additional status filter
        break;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get jobs
    const jobs = await bookingsCollection.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    // Get total count
    const totalJobs = await bookingsCollection.countDocuments(query);
    const totalPages = Math.ceil(totalJobs / parseInt(limit));

    // Format jobs for frontend
    const formattedJobs = jobs.map(job => ({
      _id: job._id,
      title: job.title || job.loadTitle || 'Transport Job',
      pickupLocation: job.pickupLocation || job.origin,
      deliveryLocation: job.deliveryLocation || job.destination,
      pickupDate: job.pickupDate || job.scheduledPickupDate,
      deliveryDate: job.deliveryDate || job.scheduledDeliveryDate,
      cargoType: job.cargoType || job.loadType || 'General Cargo',
      weight: job.weight || job.cargoWeight,
      totalAmount: job.totalAmount || job.agreedAmount || job.price,
      currency: job.currency || 'KES',
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      assignedAt: job.assignedAt || job.acceptedAt,
      rating: job.rating,
      review: job.review
    }));

    res.json({
      status: 'success',
      data: {
        jobs: formattedJobs,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalJobs,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        filter: status
      }
    });

  } catch (error) {
    console.error('Get all driver jobs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/jobs/:id
// @desc    Get single job details
// @access  Private (Driver or Cargo Owner who owns the job)
router.get('/:id', auth, jobsLimiter, async (req, res) => {
  try {
    const { id: jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid job ID'
      });
    }

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    // Find the job
    const job = await bookingsCollection.findOne({
      _id: new mongoose.Types.ObjectId(jobId)
    });

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found'
      });
    }

    // Check authorization - driver must own the job or cargo owner must own the load
    const isAuthorized = 
      (req.user.userType === 'driver' && job.driverId?.toString() === req.user.id) ||
      (req.user.userType === 'cargo_owner' && job.cargoOwnerId?.toString() === req.user.id) ||
      req.user.userType === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to view this job'
      });
    }

    // Get related data if needed
    const driversCollection = db.collection('drivers');
    const usersCollection = db.collection('users');
    const loadsCollection = db.collection('loads');

    const [driver, cargoOwner, load] = await Promise.all([
      job.driverId ? driversCollection.findOne(
        { _id: job.driverId },
        { projection: { name: 1, phone: 1, vehicleType: 1, 'driverProfile.rating': 1 } }
      ) : null,
      job.cargoOwnerId ? usersCollection.findOne(
        { _id: job.cargoOwnerId },
        { projection: { name: 1, phone: 1, company: 1 } }
      ) : null,
      job.loadId ? loadsCollection.findOne(
        { _id: job.loadId },
        { projection: { title: 1, description: 1, specialRequirements: 1 } }
      ) : null
    ]);

    // Format comprehensive job details
    const jobDetails = {
      _id: job._id,
      title: job.title || job.loadTitle || load?.title || 'Transport Job',
      description: job.description || load?.description,
      
      // Location details
      pickupLocation: job.pickupLocation || job.origin,
      deliveryLocation: job.deliveryLocation || job.destination,
      pickupCoordinates: job.pickupCoordinates,
      deliveryCoordinates: job.deliveryCoordinates,
      
      // Scheduling
      pickupDate: job.pickupDate || job.scheduledPickupDate,
      deliveryDate: job.deliveryDate || job.scheduledDeliveryDate,
      actualPickupDate: job.actualPickupDate,
      actualDeliveryDate: job.actualDeliveryDate,
      
      // Cargo details
      cargoType: job.cargoType || job.loadType || 'General Cargo',
      weight: job.weight || job.cargoWeight,
      dimensions: job.dimensions,
      specialRequirements: job.specialRequirements || load?.specialRequirements,
      
      // Financial
      totalAmount: job.totalAmount || job.agreedAmount || job.price,
      currency: job.currency || 'KES',
      paymentStatus: job.paymentStatus,
      
      // Status and tracking
      status: job.status,
      statusHistory: job.statusHistory || [],
      trackingUpdates: job.trackingUpdates || [],
      
      // Participants
      driverId: job.driverId,
      cargoOwnerId: job.cargoOwnerId,
      loadId: job.loadId,
      
      // Related entities
      driver: driver ? {
        name: driver.name,
        phone: driver.phone,
        vehicleType: driver.vehicleType,
        rating: driver.driverProfile?.rating || 0
      } : null,
      
      cargoOwner: cargoOwner ? {
        name: cargoOwner.name,
        phone: cargoOwner.phone,
        company: cargoOwner.company
      } : null,
      
      // Timestamps
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      assignedAt: job.assignedAt || job.acceptedAt,
      completedAt: job.completedAt,
      
      // Performance metrics
      actualDistance: job.actualDistance,
      estimatedDistance: job.estimatedDistance,
      actualDuration: job.actualDuration,
      estimatedDuration: job.estimatedDuration,
      
      // Feedback
      rating: job.rating,
      review: job.review,
      driverRating: job.driverRating,
      driverReview: job.driverReview
    };

    res.json({
      status: 'success',
      data: {
        job: jobDetails
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

// @route   PUT /api/jobs/:id/status
// @desc    Update job status (driver actions like start, complete, etc.)
// @access  Private (Driver only)
router.put('/:id/status', auth, jobsLimiter, [
  body('status').isIn(['accepted', 'in_progress', 'picked_up', 'in_transit', 'delivered', 'completed']).withMessage('Invalid status'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
  body('location').optional().isObject(),
  body('location.latitude').optional().isFloat({ min: -90, max: 90 }),
  body('location.longitude').optional().isFloat({ min: -180, max: 180 })
], async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { status, notes, location } = req.body;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid job ID'
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
        message: 'Only drivers can update job status'
      });
    }

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    // Find and verify the job belongs to this driver
    const job = await bookingsCollection.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      driverId
    });

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found or not authorized'
      });
    }

    // Validate status transition
    const validTransitions = {
      'accepted': ['in_progress'],
      'driver_assigned': ['in_progress'],
      'in_progress': ['picked_up'],
      'picked_up': ['in_transit'],
      'in_transit': ['delivered'],
      'delivered': ['completed']
    };

    if (!validTransitions[job.status]?.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot change status from ${job.status} to ${status}`
      });
    }

    // Prepare update data
    const updateData = {
      status,
      updatedAt: new Date()
    };

    // Add timestamp based on status
    switch (status) {
      case 'in_progress':
        updateData.startedAt = new Date();
        break;
      case 'picked_up':
        updateData.actualPickupDate = new Date();
        break;
      case 'delivered':
        updateData.actualDeliveryDate = new Date();
        break;
      case 'completed':
        updateData.completedAt = new Date();
        break;
    }

    // Add tracking update
    const trackingUpdate = {
      status,
      timestamp: new Date(),
      notes: notes || '',
      location: location || null
    };

    updateData.$push = {
      trackingUpdates: trackingUpdate,
      statusHistory: {
        status,
        timestamp: new Date(),
        updatedBy: driverId
      }
    };

    // Update the job
    const result = await bookingsCollection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(jobId) },
      { 
        $set: updateData,
        $push: updateData.$push
      },
      { returnDocument: 'after' }
    );

    res.json({
      status: 'success',
      message: `Job status updated to ${status}`,
      data: {
        job: result,
        trackingUpdate
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

// @route   POST /api/jobs/:id/tracking
// @desc    Add tracking update to job
// @access  Private (Driver only)
router.post('/:id/tracking', auth, jobsLimiter, [
  body('message').isLength({ min: 1, max: 200 }).withMessage('Message must be 1-200 characters'),
  body('location').optional().isObject(),
  body('location.latitude').optional().isFloat({ min: -90, max: 90 }),
  body('location.longitude').optional().isFloat({ min: -180, max: 180 })
], async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { message, location } = req.body;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid job ID'
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
        message: 'Only drivers can add tracking updates'
      });
    }

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');
    const driverId = new mongoose.Types.ObjectId(req.user.id);

    // Verify job belongs to this driver
    const job = await bookingsCollection.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      driverId
    });

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found or not authorized'
      });
    }

    // Create tracking update
    const trackingUpdate = {
      _id: new mongoose.Types.ObjectId(),
      message,
      location: location || null,
      timestamp: new Date(),
      addedBy: driverId
    };

    // Add tracking update to job
    const result = await bookingsCollection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(jobId) },
      { 
        $push: { trackingUpdates: trackingUpdate },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    res.json({
      status: 'success',
      message: 'Tracking update added successfully',
      data: {
        trackingUpdate
      }
    });

  } catch (error) {
    console.error('Add tracking update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error adding tracking update',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/jobs/driver/earnings
// @desc    Get driver earnings summary
// @access  Private (Driver only)
router.get('/driver/earnings', auth, jobsLimiter, [
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
  query('year').optional().isInt({ min: 2020, max: 2030 }),
  query('month').optional().isInt({ min: 1, max: 12 })
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

    const now = new Date();
    let startDate, endDate;

    // Set date ranges
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
          totalAmount: { $exists: true, $ne: null, $gt: 0 }
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
          jobs: { $push: {
            _id: '$_id',
            title: '$title',
            amount: '$totalAmount',
            completedAt: '$completedAt'
          }}
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]).toArray();

    // Calculate summary
    const totalEarnings = earnings.reduce((sum, day) => sum + day.dailyEarnings, 0);
    const totalJobs = earnings.reduce((sum, day) => sum + day.jobCount, 0);

    res.json({
      status: 'success',
      data: {
        period,
        dateRange: { startDate, endDate },
        summary: {
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          totalJobs,
          avgEarningsPerJob: totalJobs > 0 ? Math.round((totalEarnings / totalJobs) * 100) / 100 : 0,
          avgEarningsPerDay: earnings.length > 0 ? Math.round((totalEarnings / earnings.length) * 100) / 100 : 0
        },
        dailyBreakdown: earnings.map(day => ({
          date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
          earnings: Math.round(day.dailyEarnings * 100) / 100,
          jobCount: day.jobCount,
          jobs: day.jobs
        }))
      }
    });

  } catch (error) {
    console.error('Get driver earnings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching earnings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;