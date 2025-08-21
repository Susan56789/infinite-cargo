// routes/bids.js - Bid Management Routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const Bid = require('../models/bid');
const Load = require('../models/load');
const auth = require('../middleware/auth');
const corsHandler = require('../middleware/corsHandler');
const {notificationUtils} = require('./notifications')

router.use(corsHandler);

//Payment timimng
const mapPaymentTiming = (frontendValue) => {
  const mapping = {
    'advance': '50_50_split',
    'weekly': 'on_delivery',
    'upfront': 'upfront',
    'on_pickup': 'on_pickup', 
    'on_delivery': 'on_delivery',
    '50_50_split': '50_50_split'
  };
  
  return mapping[frontendValue] || 'on_delivery';
};

// Rate limiting for bid operations
const bidLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 bid requests per windowMs
  message: {
    status: 'error',
    message: 'Too many bid requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});



// Bid validation middleware
const bidValidation = [
  body('load').isMongoId().withMessage('Valid load ID is required'),
  body('bidAmount').isFloat({ min: 1 }).withMessage('Bid amount must be at least 1'),
  body('currency').optional().isIn(['KES', 'USD', 'EUR']).withMessage('Invalid currency'),
  body('proposedPickupDate').isISO8601().withMessage('Valid pickup date is required'),
  body('proposedDeliveryDate').isISO8601().withMessage('Valid delivery date is required'),
  body('message').optional().isLength({ max: 1000 }).withMessage('Message cannot exceed 1000 characters'),
  body('coverLetter').optional().isLength({ max: 2000 }).withMessage('Cover letter cannot exceed 2000 characters'),
  body('vehicleDetails.type').optional().isIn([
    'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck', 
    'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
  ]).withMessage('Invalid vehicle type'),
  body('vehicleDetails.capacity').optional().isFloat({ min: 0.1 }).withMessage('Vehicle capacity must be at least 0.1 tonnes'),
  body('additionalServices').optional().isArray().withMessage('Additional services must be an array'),
  body('terms.paymentMethod').optional().isIn(['cash', 'bank_transfer', 'mobile_money', 'check', 'cheque']).withMessage('Invalid payment method'),
  
  // Fixed: Accept both schema and frontend values
  body('terms.paymentTiming').optional().isIn([
    'upfront', 'on_pickup', 'on_delivery', '50_50_split', // Schema values
    'advance', 'weekly' // Frontend values that will be mapped
  ]).withMessage('Invalid payment timing'),
  
  // Custom validation for date logic
  body('proposedDeliveryDate').custom((value, { req }) => {
    const pickupDate = new Date(req.body.proposedPickupDate);
    const deliveryDate = new Date(value);
    
    if (deliveryDate <= pickupDate) {
      throw new Error('Delivery date must be after pickup date');
    }
    
    if (pickupDate < new Date()) {
      throw new Error('Pickup date cannot be in the past');
    }
    
    return true;
  })
];

// @route   POST /api/bids
// @desc    Create a new bid on a load
// @access  Private (Drivers only)
router.post('/', auth, bidLimiter, bidValidation, async (req, res) => {
  try {
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
        message: 'Only drivers can place bids'
      });
    }

    // Accept both load or loadId
    const loadId = req.body.load || req.body.loadId;
    if (!loadId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing load ID'
      });
    }

    // Get the load and validate it
    const load = await Load.findById(loadId);
    if (!load) {
      return res.status(404).json({ status: 'error', message: 'Load not found' });
    }

    if (!load.canReceiveBids()) {
      return res.status(400).json({
        status: 'error',
        message: 'This load is no longer accepting bids'
      });
    }

    // Check if driver already has a bid on this load
    const existingBid = await Bid.findOne({
      load: loadId,
      driver: req.user.id,
      status: { $nin: ['withdrawn', 'expired', 'rejected'] }
    });
    if (existingBid) {
      return res.status(400).json({
        status: 'error',
        message: 'You already have an active bid on this load'
      });
    }

    // Get driver information snapshot
    const driver = await mongoose.connection.db.collection('drivers').findOne({
      _id: new mongoose.Types.ObjectId(req.user.id)
    });
    if (!driver) {
      return res.status(404).json({
        status: 'error',
        message: 'Driver profile not found'
      });
    }

    // Prepare bid data matching your existing schema structure
    const bidData = {
      load: loadId,
      driver: req.user.id,
      cargoOwner: load.postedBy,
      bidAmount: req.body.bidAmount,
      currency: req.body.currency || 'KES',
      proposedPickupDate: req.body.proposedPickupDate,
      proposedDeliveryDate: req.body.proposedDeliveryDate,
      message: req.body.message,
      coverLetter: req.body.coverLetter,

      // Vehicle details (matching your schema)
      vehicleDetails: req.body.vehicleDetails ? {
        type: req.body.vehicleDetails.type,
        capacity: req.body.vehicleDetails.capacity,
        year: req.body.vehicleDetails.year,
        make: req.body.vehicleDetails.make,
        model: req.body.vehicleDetails.model,
        licensePlate: req.body.vehicleDetails.licensePlate,
        insuranceValid: req.body.vehicleDetails.insuranceValid !== false,
        specialFeatures: req.body.vehicleDetails.specialFeatures || []
      } : undefined,

      // Additional services (matching your schema enum values)
      additionalServices: req.body.additionalServices ? req.body.additionalServices.map(service => ({
        service: service.service || service, // Handle both object and string formats
        cost: service.cost || service.additionalCost || 0,
        description: service.description
      })) : [],

      // Pricing breakdown (matching your schema)
      pricingBreakdown: {
        baseFare: req.body.pricingBreakdown?.baseFare || req.body.bidAmount,
        distanceFare: req.body.pricingBreakdown?.distanceFare || 0,
        weightSurcharge: req.body.pricingBreakdown?.weightSurcharge || 0,
        urgencySurcharge: req.body.pricingBreakdown?.urgencySurcharge || 0,
        serviceFees: req.body.pricingBreakdown?.serviceFees || 0,
        taxes: req.body.pricingBreakdown?.taxes || 0,
        discount: req.body.pricingBreakdown?.discount || 0,
        totalAmount: req.body.pricingBreakdown?.totalAmount || req.body.bidAmount
      },

      // Terms 
terms: {
  paymentMethod: req.body.terms?.paymentMethod || 'cash',
  paymentTiming: mapPaymentTiming(req.body.terms?.paymentTiming),
  cancellationPolicy: req.body.terms?.cancellationPolicy,
  specialTerms: req.body.terms?.additionalTerms
},

      // Driver info snapshot 
      driverInfo: {
        name: driver.name,
        phone: driver.phone,
        email: driver.email,
        location: driver.location,
        rating: driver.driverProfile?.rating || 0,
        totalTrips: driver.driverProfile?.completedJobs || 0,
        experienceYears: driver.driverProfile?.experienceYears || 0,
        isVerified: driver.driverProfile?.verified || false
      },

      // Load info snapshot (matching your schema)
      loadInfo: {
        title: load.title,
        pickupLocation: load.pickupLocation,
        deliveryLocation: load.deliveryLocation,
        weight: load.weight,
        budget: load.budget
      },

      // Set status to 'submitted' as per your schema
      status: 'submitted',
      
      // Initialize analytics
      analytics: {
        views: 0,
        profileViews: 0,
        contactAttempts: 0
      },

      // Initialize notifications
      notifications: {
        driverNotified: false,
        cargoOwnerNotified: false,
        reminderSent: false
      },

      // System fields
      isActive: true,
      priority: 0,
      version: 1
    };

    // Create and save the bid
    const bid = new Bid(bidData);
    await bid.save();

    // Increment bid count on load (use your existing field name)
    await Load.findByIdAndUpdate(loadId, { 
      $inc: { bidsReceived: 1 },
      $set: { lastBidDate: new Date() }
    });

    // Populate the created bid for response
    await bid.populate([
      { path: 'driver', select: 'name phone email location rating isVerified' },
      { path: 'load', select: 'title pickupLocation deliveryLocation weight budget status' }
    ]);

    // Send success response with data matching your schema structure
    res.status(201).json({
      status: 'success',
      message: 'Bid submitted successfully',
      data: { 
        bid: {
          _id: bid._id,
          bidAmount: bid.bidAmount,
          currency: bid.currency,
          proposedPickupDate: bid.proposedPickupDate,
          proposedDeliveryDate: bid.proposedDeliveryDate,
          status: bid.status,
          submittedAt: bid.submittedAt,
          expiresAt: bid.expiresAt,
          vehicleDetails: bid.vehicleDetails,
          terms: bid.terms,
          pricingBreakdown: bid.pricingBreakdown,
          additionalServices: bid.additionalServices,
          driverInfo: {
            name: bid.driverInfo.name,
            rating: bid.driverInfo.rating,
            totalTrips: bid.driverInfo.totalTrips,
            isVerified: bid.driverInfo.isVerified
          },
          loadInfo: bid.loadInfo,
          createdAt: bid.createdAt,
          updatedAt: bid.updatedAt
        }
      }
    });

    // Send notification to cargo owner
try {
  await notificationUtils.sendNewBidNotification(
    load.postedBy, // cargo owner ID
    {
      bidId: bid._id,
      driverId: req.user.id,
      driverName: driver.name,
      bidAmount: `${bid.currency} ${bid.bidAmount.toLocaleString()}`
    },
    {
      loadId: load._id,
      title: load.title
    }
  );
} catch (notificationError) {
  console.error('Failed to send bid notification:', notificationError);
  // Don't fail the bid creation if notification fails
}

  } catch (error) {
    console.error('Create bid error:', error);
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        status: 'error',
        message: 'Bid validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Server error creating bid',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// @route   GET /api/bids
// @desc    Get bids for current user (driver gets their bids, cargo owner gets bids on their loads)
// @access  Private
router.get('/',  auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn([
    'submitted', 'viewed', 'under_review', 'shortlisted', 'accepted', 
    'rejected', 'withdrawn', 'expired', 'counter_offered'
  ]),
  query('loadId').optional().isMongoId()
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

    const { page = 1, limit = 20, status, loadId } = req.query;

    let bids;
    let totalBids;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (req.user.userType === 'driver') {
      // Driver gets their own bids
      let query = { driver: req.user.id };
      if (status) query.status = status;
      if (loadId) query.load = loadId;

      bids = await Bid.find(query)
        .populate('load', 'title pickupLocation deliveryLocation weight budget status pickupDate deliveryDate')
        .populate('cargoOwner', 'name location rating isVerified')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      totalBids = await Bid.countDocuments(query);

    } else if (req.user.userType === 'cargo_owner') {
      // Cargo owner gets bids on their loads
      let query = { cargoOwner: req.user.id };
      if (status) query.status = status;
      if (loadId) query.load = loadId;

      bids = await Bid.find(query)
        .populate('driver', 'name phone email location rating totalTrips experienceYears isVerified vehicleType vehicleCapacity profilePicture')
        .populate('load', 'title pickupLocation deliveryLocation weight budget')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      totalBids = await Bid.countDocuments(query);

    } else {
      return res.status(403).json({
        status: 'error',
        message: 'Invalid user type for accessing bids'
      });
    }

    const totalPages = Math.ceil(totalBids / parseInt(limit));

    res.json({
      status: 'success',
      data: {
        bids,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBids,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get bids error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching bids',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/bids/:id
// @desc    Get single bid by ID
// @access  Private (Bid owner, load owner, or admin)
router.get('/:id',  auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid bid ID'
      });
    }

    const bid = await Bid.findById(id)
      .populate('driver', 'name phone email location rating totalTrips experienceYears isVerified vehicleType vehicleCapacity profilePicture')
      .populate('load', 'title pickupLocation deliveryLocation weight budget status pickupDate deliveryDate postedBy')
      .populate('cargoOwner', 'name location rating isVerified profilePicture');

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found'
      });
    }

    // Check if user has access to this bid
    const hasAccess = (
      bid.driver._id.toString() === req.user.id ||  // Driver who made the bid
      bid.cargoOwner._id.toString() === req.user.id ||  // Cargo owner
      bid.load.postedBy.toString() === req.user.id  // Load owner (should be same as cargo owner)
    );

    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to view this bid'
      });
    }

    // Mark as viewed if cargo owner is viewing
    if (req.user.userType === 'cargo_owner' && bid.cargoOwner._id.toString() === req.user.id) {
      await bid.markAsViewed();
    }

    res.json({
      status: 'success',
      data: {
        bid
      }
    });

  } catch (error) {
    console.error('Get bid error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching bid',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/bids/:id
// @desc    Update bid (driver can update their own bid if still in submitted/viewed status)
// @access  Private (Bid owner only)
router.put('/:id',  auth, bidValidation, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
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

    const bid = await Bid.findById(id);

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found'
      });
    }

    // Check if user owns the bid
    if (bid.driver.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to update this bid'
      });
    }

    // Check if bid can be updated
    if (!['submitted', 'viewed'].includes(bid.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Bid cannot be updated in its current status'
      });
    }

    // Update bid
    const updateData = {
      bidAmount: req.body.bidAmount,
      proposedPickupDate: req.body.proposedPickupDate,
      proposedDeliveryDate: req.body.proposedDeliveryDate,
      message: req.body.message,
      coverLetter: req.body.coverLetter,
      vehicleDetails: req.body.vehicleDetails,
      additionalServices: req.body.additionalServices || [],
      pricingBreakdown: req.body.pricingBreakdown || {
        baseFare: req.body.bidAmount,
        totalAmount: req.body.bidAmount
      },
      terms: req.body.terms || bid.terms,
      version: bid.version + 1
    };

    const updatedBid = await Bid.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    }).populate([
      { path: 'driver', select: 'name phone email location rating isVerified vehicleType vehicleCapacity' },
      { path: 'load', select: 'title pickupLocation deliveryLocation weight budget status' }
    ]);

    res.json({
      status: 'success',
      message: 'Bid updated successfully',
      data: {
        bid: updatedBid
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

// @route   POST /api/bids/:id/withdraw
// @desc    Withdraw bid
// @access  Private (Bid owner only)
router.post('/:id/withdraw',  auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid bid ID'
      });
    }

    const bid = await Bid.findById(id);

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found'
      });
    }

    // Check if user owns the bid
    if (bid.driver.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to withdraw this bid'
      });
    }

    // Check if bid can be withdrawn
    if (!bid.canWithdraw()) {
      return res.status(400).json({
        status: 'error',
        message: 'Bid cannot be withdrawn in its current status'
      });
    }

    await bid.withdraw();

    // Decrement load bid count
    await Load.findByIdAndUpdate(bid.load, {
      $inc: { bidsReceived: -1 }
    });

    res.json({
      status: 'success',
      message: 'Bid withdrawn successfully'
    });

  } catch (error) {
    console.error('Withdraw bid error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error withdrawing bid',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/bids/:id/accept
// @desc    Accept bid (cargo owner only) - 
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate bid ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid bid ID format'
      });
    }

    // Check user type
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can accept bids'
      });
    }
    // Find bid with populated data
    const bid = await Bid.findById(id)
      .populate('load')
      .populate('driver', 'name phone email location rating vehicleType vehicleCapacity')
      .populate('cargoOwner', 'name email');

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found or has been removed'
      });
    }
    // Check if load exists
    if (!bid.load) {
      
      return res.status(404).json({
        status: 'error',
        message: 'Associated load not found'
      });
    }

    // Check if user owns the load
    const loadOwnerId = bid.load.postedBy?.toString() || bid.cargoOwner?._id?.toString();
    if (loadOwnerId !== req.user.id) {
      
      return res.status(403).json({
        status: 'error',
        message: 'You are not authorized to accept this bid'
      });
    }

    // Check if bid is in acceptable status
    const acceptableStatuses = ['submitted', 'viewed', 'under_review', 'shortlisted', 'pending'];
    if (!acceptableStatuses.includes(bid.status)) {
      
      return res.status(400).json({
        status: 'error',
        message: `Cannot accept bid in '${bid.status}' status. Only bids in ${acceptableStatuses.join(', ')} status can be accepted.`
      });
    }

    // Check if load can still receive acceptances
    if (bid.load.status === 'driver_assigned' || bid.load.status === 'completed' || bid.load.status === 'cancelled') {
  
      return res.status(400).json({
        status: 'error',
        message: 'This load is no longer accepting bids'
      });
    }

    // Check if driver exists
    if (!bid.driver) {
     
      return res.status(404).json({
        status: 'error',
        message: 'Driver associated with this bid not found'
      });
    }



    // Start database transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update the bid status
      bid.status = 'accepted';
      bid.acceptedAt = new Date();
      bid.acceptedBy = req.user.id;
      bid.response = {
        status: 'accepted',
        message: 'Bid accepted by cargo owner',
        respondedAt: new Date(),
        respondedBy: req.user.id
      };
      
      await bid.save({ session });

      

      // Update the load
      const load = bid.load;
      load.assignedDriver = bid.driver._id;
      load.assignedDate = new Date();
      load.status = 'driver_assigned';
      load.acceptedBid = {
        bidId: bid._id,
        amount: bid.bidAmount,
        acceptedDate: new Date()
      };
      
      await load.save({ session });

    

      // CREATE ACTIVE JOB/BOOKING RECORD
      try {
        const db = mongoose.connection.db;
        const bookingsCollection = db.collection('bookings');
        
        const activeJob = {
          loadId: load._id,
          bidId: bid._id,
          driverId: bid.driver._id,
          cargoOwnerId: req.user.id,
          
          // Job details from load
          title: load.title,
          pickupLocation: load.pickupLocation,
          deliveryLocation: load.deliveryLocation,
          pickupDate: bid.proposedPickupDate,
          deliveryDate: bid.proposedDeliveryDate,
          
          // Cargo details
          cargoType: load.cargoType,
          weight: load.weight,
          dimensions: load.dimensions,
          specialInstructions: load.specialInstructions,
          
          // Financial details
          agreedAmount: bid.bidAmount,
          currency: bid.currency || 'KES',
          paymentMethod: bid.terms?.paymentMethod || 'cash',
          paymentTiming: bid.terms?.paymentTiming || 'on_delivery',
          
          // Status tracking
          status: 'assigned', // assigned -> in_progress -> delivered -> completed
          assignedAt: new Date(),
          
          // Driver and vehicle info
          driverInfo: {
            name: bid.driverInfo?.name || bid.driver.name,
            phone: bid.driverInfo?.phone || bid.driver.phone,
            rating: bid.driverInfo?.rating || bid.driver.rating || 0,
            vehicleType: bid.vehicleDetails?.type || bid.driver.vehicleType,
            vehicleCapacity: bid.vehicleDetails?.capacity || bid.driver.vehicleCapacity
          },
          
          // Timeline
          timeline: [{
            event: 'job_assigned',
            timestamp: new Date(),
            description: `Job assigned to ${bid.driverInfo?.name || bid.driver.name}`,
            userId: req.user.id
          }],
          
          // Created/updated timestamps
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const jobResult = await bookingsCollection.insertOne(activeJob, { session });
        
      } catch (jobError) {
        console.error('Error creating active job:', jobError);
        // Don't fail the entire transaction for job creation error
        // The main bid acceptance should still succeed
      }

      // Reject all other pending bids for this load
      const otherBidsUpdate = await Bid.updateMany(
        { 
          load: bid.load._id, 
          _id: { $ne: bid._id },
          status: { $in: ['submitted', 'viewed', 'under_review', 'shortlisted', 'pending'] }
        },
        { 
          status: 'rejected',
          'response.status': 'rejected',
          'response.message': 'Load was assigned to another driver',
          'response.respondedAt': new Date(),
          'response.respondedBy': req.user.id,
          rejectedAt: new Date(),
          rejectedBy: req.user.id
        },
        { session }
      );
      // Commit the transaction
      await session.commitTransaction();

      // Send notifications (don't fail if this errors)
      try {
        if (notificationUtils && typeof notificationUtils.sendBidAcceptedNotification === 'function') {
          await notificationUtils.sendBidAcceptedNotification(
            bid.driver._id,
            {
              bidId: bid._id,
              bidAmount: `${bid.currency || 'KES'} ${bid.bidAmount?.toLocaleString() || '0'}`
            },
            {
              loadId: load._id,
              title: load.title
            }
          );
        }

        if (notificationUtils && typeof notificationUtils.createNotification === 'function') {
          await notificationUtils.createNotification({
            userId: req.user.id,
            userType: 'cargo_owner',
            type: 'load_assigned',
            title: 'Driver Assigned',
            message: `${bid.driverInfo?.name || bid.driver.name} has been assigned to your load "${load.title}"`,
            priority: 'high',
            icon: 'truck',
            data: {
              loadId: load._id,
              driverId: bid.driver._id,
              bidId: bid._id
            },
            actionUrl: `/loads/${load._id}/tracking`
          });
        }
      } catch (notificationError) {
        console.error('Failed to send acceptance notifications:', notificationError);
        // Don't fail the response for notification errors
      }

      // Return success response
      res.status(200).json({
        status: 'success',
        message: 'Bid accepted successfully',
        data: {
          bid: {
            _id: bid._id,
            status: bid.status,
            acceptedAt: bid.acceptedAt,
            bidAmount: bid.bidAmount,
            currency: bid.currency
          },
          load: {
            _id: load._id,
            status: load.status,
            assignedDriver: load.assignedDriver,
            assignedDate: load.assignedDate
          },
          driver: {
            _id: bid.driver._id,
            name: bid.driver.name,
            phone: bid.driver.phone
          }
        }
      });

    } catch (transactionError) {
      // Rollback transaction on any error
      await session.abortTransaction();
      console.error('Transaction error:', transactionError);
      throw transactionError;
    } finally {
      // End session
      await session.endSession();
    }

  } catch (error) {
    console.error('=== BID ACCEPTANCE ERROR ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);

    // Handle specific error types
    let statusCode = 500;
    let errorMessage = 'Server error while accepting bid';

    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = 'Validation failed: ' + Object.values(error.errors).map(e => e.message).join(', ');
    } else if (error.name === 'CastError') {
      statusCode = 400;
      errorMessage = 'Invalid ID format provided';
    } else if (error.message.includes('duplicate key')) {
      statusCode = 409;
      errorMessage = 'This bid has already been processed';
    } else if (error.message.includes('not found')) {
      statusCode = 404;
      errorMessage = error.message;
    } else if (error.message.includes('authorization') || error.message.includes('permission')) {
      statusCode = 403;
      errorMessage = error.message;
    } else if (error.code === 11000) {
      statusCode = 409;
      errorMessage = 'Duplicate operation detected';
    }

    // Return appropriate error response
    res.status(statusCode).json({
      status: 'error',
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

// @route   POST /api/bids/:id/reject
// @desc    Reject bid (cargo owner only)
// @access  Private (Cargo owner only)
router.post('/:id/reject',  auth, [
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
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

    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can reject bids'
      });
    }

    const bid = await Bid.findById(id).populate('load');

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found'
      });
    }

    // Check if user owns the load
    if (bid.load.postedBy.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to reject this bid'
      });
    }

    // Check if bid can be rejected
    if (!['submitted', 'viewed', 'under_review', 'shortlisted'].includes(bid.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Bid cannot be rejected in its current status'
      });
    }

    // Reject the bid
    await bid.reject(req.user.id, reason);

    res.json({
      status: 'success',
      message: 'Bid rejected successfully'
    });

  } catch (error) {
    console.error('Reject bid error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error rejecting bid',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/bids/load/:loadId
// @desc    Get all bids for a specific load
// @access  Private (Load owner only)
router.get('/load/:loadId',  auth, async (req, res) => {
  try {
    const { loadId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(loadId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load ID'
      });
    }

    // Check if load exists and user owns it
    const load = await Load.findById(loadId);
    
    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found'
      });
    }

    if (load.postedBy.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to view bids for this load'
      });
    }

    const bids = await Bid.getBidsByLoad(loadId);

    // Get competitive analysis
    const analysis = await Bid.getCompetitiveAnalysis(loadId);

    res.json({
      status: 'success',
      data: {
        bids,
        analysis: analysis[0] || {
          totalBids: 0,
          avgBid: 0,
          minBid: 0,
          maxBid: 0,
          medianBid: 0
        }
      }
    });

  } catch (error) {
    console.error('Get bids for load error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching bids',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/bids/:id/shortlist
// @desc    Shortlist a bid (cargo owner only)
// @access  Private (Cargo owner only)
router.post('/:id/shortlist',  auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid bid ID'
      });
    }

    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can shortlist bids'
      });
    }

    const bid = await Bid.findById(id).populate('load');

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found'
      });
    }

    // Check if user owns the load
    if (bid.load.postedBy.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to shortlist this bid'
      });
    }

    // Check if bid can be shortlisted
    if (!['submitted', 'viewed', 'under_review'].includes(bid.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Bid cannot be shortlisted in its current status'
      });
    }

    // Shortlist the bid
    bid.status = 'shortlisted';
    bid.shortlistedAt = new Date();
    bid.shortlistedBy = req.user.id;
    await bid.save();

    res.json({
      status: 'success',
      message: 'Bid shortlisted successfully'
    });

  } catch (error) {
    console.error('Shortlist bid error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error shortlisting bid',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/bids/statistics/summary
// @desc    Get bid statistics for current user
// @access  Private
router.get('/statistics/summary',  auth, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.userType === 'driver') {
      query.driver = req.user.id;
    } else if (req.user.userType === 'cargo_owner') {
      query.cargoOwner = req.user.id;
    } else {
      return res.status(403).json({
        status: 'error',
        message: 'Invalid user type for accessing bid statistics'
      });
    }

    // Get statistics using aggregation
    const stats = await Bid.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
          viewed: { $sum: { $cond: [{ $eq: ['$status', 'viewed'] }, 1, 0] } },
          underReview: { $sum: { $cond: [{ $eq: ['$status', 'under_review'] }, 1, 0] } },
          shortlisted: { $sum: { $cond: [{ $eq: ['$status', 'shortlisted'] }, 1, 0] } },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          withdrawn: { $sum: { $cond: [{ $eq: ['$status', 'withdrawn'] }, 1, 0] } },
          avgBidAmount: { $avg: '$bidAmount' },
          totalBidValue: { $sum: '$bidAmount' },
          winRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [
                { $divide: [{ $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } }, '$total'] },
                100
              ]},
              0
            ]
          }
        }
      }
    ]);

    const summary = stats[0] || {
      total: 0,
      submitted: 0,
      viewed: 0,
      underReview: 0,
      shortlisted: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
      avgBidAmount: 0,
      totalBidValue: 0,
      winRate: 0
    };

    // Get recent bids
    const recentBids = await Bid.find(query)
      .populate('load', 'title pickupLocation deliveryLocation weight budget')
      .populate(req.user.userType === 'driver' ? 'cargoOwner' : 'driver', 'name location rating')
      .sort({ submittedAt: -1 })
      .limit(5);

    res.json({
      status: 'success',
      data: {
        summary,
        recentBids,
        userType: req.user.userType
      }
    });

  } catch (error) {
    console.error('Get bid statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching bid statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/bids/:id/counter-offer
// @desc    Make a counter offer on a bid (cargo owner only)
// @access  Private (Cargo owner only)
router.post('/:id/counter-offer',  auth, [
  body('counterAmount').isFloat({ min: 1 }).withMessage('Counter amount must be at least 1 KES'),
  body('message').optional().isLength({ max: 1000 }).withMessage('Message cannot exceed 1000 characters'),
  body('proposedPickupDate').optional().isISO8601().toDate(),
  body('proposedDeliveryDate').optional().isISO8601().toDate()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { counterAmount, message, proposedPickupDate, proposedDeliveryDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
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

    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can make counter offers'
      });
    }

    const bid = await Bid.findById(id).populate('load');

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found'
      });
    }

    // Check if user owns the load
    if (bid.load.postedBy.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to counter offer this bid'
      });
    }

    // Check if bid can be counter offered
    if (!['submitted', 'viewed', 'under_review', 'shortlisted'].includes(bid.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot make counter offer on bid in current status'
      });
    }

    // Create counter offer
    const counterOffer = {
      amount: counterAmount,
      message,
      proposedPickupDate: proposedPickupDate || bid.proposedPickupDate,
      proposedDeliveryDate: proposedDeliveryDate || bid.proposedDeliveryDate,
      createdAt: new Date(),
      createdBy: req.user.id
    };

    bid.status = 'counter_offered';
    bid.counterOffer = counterOffer;
    bid.counterOfferedAt = new Date();
    bid.counterOfferedBy = req.user.id;
    
    await bid.save();

    res.json({
      status: 'success',
      message: 'Counter offer sent successfully',
      data: {
        counterOffer
      }
    });

  } catch (error) {
    console.error('Counter offer bid error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error creating counter offer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/bids/:id/accept-counter
// @desc    Accept counter offer (driver only)
// @access  Private (Bid owner only)
router.post('/:id/accept-counter',  auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid bid ID'
      });
    }

    const bid = await Bid.findById(id).populate('load');

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found'
      });
    }

    // Check if user owns the bid
    if (bid.driver.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to accept this counter offer'
      });
    }

    // Check if there's a counter offer to accept
    if (bid.status !== 'counter_offered' || !bid.counterOffer) {
      return res.status(400).json({
        status: 'error',
        message: 'No counter offer available to accept'
      });
    }

    // Update bid with counter offer details
    bid.bidAmount = bid.counterOffer.amount;
    bid.proposedPickupDate = bid.counterOffer.proposedPickupDate;
    bid.proposedDeliveryDate = bid.counterOffer.proposedDeliveryDate;
    bid.status = 'accepted';
    bid.acceptedAt = new Date();
    bid.finalAmount = bid.counterOffer.amount;
    
    await bid.save();

    // Update the load
    const load = bid.load;
    load.assignedDriver = bid.driver;
    load.assignedDate = new Date();
    load.status = 'driver_assigned';
    load.acceptedBid = {
      bidId: bid._id,
      amount: bid.counterOffer.amount,
      acceptedDate: new Date()
    };
    await load.save();

    // Reject all other bids for this load
    await Bid.updateMany(
      { 
        load: bid.load._id, 
        _id: { $ne: bid._id },
        status: { $in: ['submitted', 'viewed', 'under_review', 'shortlisted', 'counter_offered'] }
      },
      { 
        status: 'rejected',
        'response.status': 'rejected',
        'response.message': 'Load was assigned to another driver',
        'response.respondedAt': new Date(),
        respondedAt: new Date()
      }
    );

    res.json({
      status: 'success',
      message: 'Counter offer accepted successfully',
      data: {
        bid,
        load
      }
    });

  } catch (error) {
    console.error('Accept counter offer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error accepting counter offer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/bids/:id/decline-counter
// @desc    Decline counter offer (driver only)
// @access  Private (Bid owner only)
router.post('/:id/decline-counter',  auth, [
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
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

    const bid = await Bid.findById(id);

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found'
      });
    }

    // Check if user owns the bid
    if (bid.driver.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to decline this counter offer'
      });
    }

    // Check if there's a counter offer to decline
    if (bid.status !== 'counter_offered' || !bid.counterOffer) {
      return res.status(400).json({
        status: 'error',
        message: 'No counter offer available to decline'
      });
    }

    // Decline counter offer
    bid.status = 'under_review';
    bid.counterOfferDeclined = {
      declinedAt: new Date(),
      reason: reason || 'Counter offer declined',
      declinedBy: req.user.id
    };
    
    await bid.save();

    res.json({
      status: 'success',
      message: 'Counter offer declined successfully'
    });

  } catch (error) {
    console.error('Decline counter offer error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error declining counter offer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;