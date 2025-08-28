// routes/cargo-owners.js - Cargo Owner Management Routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const corsHandler = require('../middleware/corsHandler');

router.use(corsHandler);


// Rate limiting
const cargoOwnerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  }
});



// Profile validation middleware
const profileValidation = [
  body('companyName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
    
  body('businessType')
    .optional()
    .isIn([
      'manufacturing', 'retail', 'wholesale', 'import_export', 
      'agriculture', 'construction', 'logistics', 'other'
    ])
    .withMessage('Invalid business type'),
    
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
    
  body('website')
    .optional()
    .isURL()
    .withMessage('Website must be a valid URL'),
    
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters'),
    
  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
    
  body('country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters')
];

// @route   GET /api/cargo-owners/dashboard
// @desc    Get cargo owner dashboard data
// @access  Private (Cargo owners only)
router.get('/dashboard',  auth, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    // Get collections
    const loadsCollection = db.collection('loads');
    const bidsCollection = db.collection('bids');
    const bookingsCollection = db.collection('bookings');

    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Get load statistics
    const loadStats = await loadsCollection.aggregate([
      { $match: { postedBy: userId } },
      {
        $group: {
          _id: null,
          totalLoads: { $sum: 1 },
          activeLoads: {
            $sum: {
              $cond: [{ $in: ['$status', ['posted', 'receiving_bids', 'driver_assigned', 'in_transit']] }, 1, 0]
            }
          },
          completedLoads: {
            $sum: {
              $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0]
            }
          },
          cancelledLoads: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
            }
          },
          totalBudget: { $sum: '$budget' },
          avgBudget: { $avg: '$budget' }
        }
      }
    ]).toArray();

    // Get bid statistics
    const bidStats = await bidsCollection.aggregate([
      {
        $lookup: {
          from: 'loads',
          localField: 'load',
          foreignField: '_id',
          as: 'loadInfo'
        }
      },
      {
        $match: {
          'loadInfo.postedBy': userId,
          status: { $nin: ['withdrawn', 'expired'] }
        }
      },
      {
        $group: {
          _id: null,
          totalBids: { $sum: 1 },
          avgBidAmount: { $avg: '$bidAmount' },
          acceptedBids: {
            $sum: {
              $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0]
            }
          }
        }
      }
    ]).toArray();

    // Get recent loads
    const recentLoads = await loadsCollection.find({ postedBy: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    // Get recent bids on user's loads
    const recentBids = await bidsCollection.aggregate([
      {
        $lookup: {
          from: 'loads',
          localField: 'load',
          foreignField: '_id',
          as: 'loadInfo'
        }
      },
      {
        $match: {
          'loadInfo.postedBy': userId,
          status: { $nin: ['withdrawn', 'expired'] }
        }
      },
      {
        $lookup: {
          from: 'drivers',
          localField: 'driver',
          foreignField: '_id',
          as: 'driverInfo'
        }
      },
      {
        $sort: { submittedAt: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          bidAmount: 1,
          status: 1,
          submittedAt: 1,
          'loadInfo.title': 1,
          'loadInfo.pickupLocation': 1,
          'loadInfo.deliveryLocation': 1,
          'driverInfo.name': 1,
          'driverInfo.phone': 1,
          'driverInfo.driverProfile.rating': 1,
          'driverInfo.vehicleType': 1
        }
      }
    ]).toArray();

    // Calculate average bids per load
    const avgBidsPerLoad = bidStats[0]?.totalBids && loadStats[0]?.totalLoads 
      ? bidStats[0].totalBids / loadStats[0].totalLoads 
      : 0;

    const dashboardData = {
      stats: {
        totalLoads: loadStats[0]?.totalLoads || 0,
        activeLoads: loadStats[0]?.activeLoads || 0,
        completedLoads: loadStats[0]?.completedLoads || 0,
        cancelledLoads: loadStats[0]?.cancelledLoads || 0,
        totalBudget: loadStats[0]?.totalBudget || 0,
        averageBudget: loadStats[0]?.avgBudget || 0,
        totalBids: bidStats[0]?.totalBids || 0,
        averageBidAmount: bidStats[0]?.avgBidAmount || 0,
        acceptedBids: bidStats[0]?.acceptedBids || 0,
        averageBidsPerLoad: Math.round(avgBidsPerLoad * 100) / 100
      },
      recentLoads: recentLoads.map(load => ({
        _id: load._id,
        title: load.title,
        status: load.status,
        pickupLocation: load.pickupLocation,
        deliveryLocation: load.deliveryLocation,
        budget: load.budget,
        createdAt: load.createdAt,
        bidCount: 0 // Will be populated separately if needed
      })),
      recentBids: recentBids.map(bid => ({
        _id: bid._id,
        bidAmount: bid.bidAmount,
        status: bid.status,
        submittedAt: bid.submittedAt,
        load: {
          title: bid.loadInfo[0]?.title,
          pickupLocation: bid.loadInfo[0]?.pickupLocation,
          deliveryLocation: bid.loadInfo[0]?.deliveryLocation
        },
        driver: {
          name: bid.driverInfo[0]?.name,
          phone: bid.driverInfo[0]?.phone,
          rating: bid.driverInfo[0]?.driverProfile?.rating || 0,
          vehicleType: bid.driverInfo[0]?.vehicleType
        }
      }))
    };

    res.json({
      status: 'success',
      data: dashboardData
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/cargo-owners/profile
// @desc    Get cargo owner profile
// @access  Private (Cargo owners only)
router.get('/profile',  auth, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const cargoOwnersCollection = db.collection('cargo-owners');

    const cargoOwner = await cargoOwnersCollection.findOne(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      {
        projection: {
          password: 0,
          loginHistory: 0,
          registrationIp: 0
        }
      }
    );

    if (!cargoOwner) {
      return res.status(404).json({
        status: 'error',
        message: 'Cargo owner profile not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        profile: cargoOwner
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/cargo-owners/profile
// @desc    Update cargo owner profile
// @access  Private (Cargo owners only)
router.put('/profile',  auth, cargoOwnerLimiter, profileValidation, async (req, res) => {
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
        message: 'Access denied. Cargo owners only.'
      });
    }

    const {
      companyName,
      businessType,
      description,
      website,
      address,
      city,
      country,
      phone,
      alternatePhone
    } = req.body;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const cargoOwnersCollection = db.collection('cargo-owners');

    // Build update object
    const updateData = {
      updatedAt: new Date()
    };

    // Update basic info
    if (phone !== undefined) updateData.phone = phone;
    if (alternatePhone !== undefined) updateData.alternatePhone = alternatePhone;

    // Update cargo owner profile
    const cargoOwnerProfile = {};
    if (companyName !== undefined) cargoOwnerProfile.companyName = companyName;
    if (businessType !== undefined) cargoOwnerProfile.businessType = businessType;
    if (description !== undefined) cargoOwnerProfile.description = description;
    if (website !== undefined) cargoOwnerProfile.website = website;
    if (address !== undefined) cargoOwnerProfile.address = address;
    if (city !== undefined) cargoOwnerProfile.city = city;
    if (country !== undefined) cargoOwnerProfile.country = country;

    if (Object.keys(cargoOwnerProfile).length > 0) {
      updateData.cargoOwnerProfile = cargoOwnerProfile;
    }

    // Update profile
    const result = await cargoOwnersCollection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      { $set: updateData },
      { 
        returnDocument: 'after',
        projection: {
          password: 0,
          loginHistory: 0,
          registrationIp: 0
        }
      }
    );

    if (!result.value) {
      return res.status(404).json({
        status: 'error',
        message: 'Cargo owner not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        profile: result.value
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/cargo-owners/profile
// @desc    Delete cargo owner profile and account
// @access  Private (Cargo owners only)
router.delete('/profile', auth, cargoOwnerLimiter, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const cargoOwnersCollection = db.collection('cargo-owners');
    const loadsCollection = db.collection('loads');
    const bidsCollection = db.collection('bids');
    const subscriptionsCollection = db.collection('subscriptions');
    const notificationsCollection = db.collection('notifications');

    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Check for active loads or subscriptions that prevent deletion
    const activeLoads = await loadsCollection.countDocuments({
      postedBy: userId,
      status: { $in: ['posted', 'receiving_bids', 'driver_assigned', 'in_transit'] }
    });

    if (activeLoads > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot delete account. You have ${activeLoads} active load(s). Please cancel or complete them first.`,
        activeLoads
      });
    }

    const activeSubscription = await subscriptionsCollection.findOne({
      userId: userId,
      status: 'active'
    });

    if (activeSubscription) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete account with active subscription. Please cancel subscription first.',
        subscription: {
          planName: activeSubscription.planName,
          status: activeSubscription.status
        }
      });
    }

    // Begin deletion process - use transactions for data integrity
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // 1. Delete or anonymize completed loads
        await loadsCollection.updateMany(
          { 
            postedBy: userId,
            status: { $in: ['delivered', 'completed', 'cancelled'] }
          },
          { 
            $set: { 
              postedByName: 'Deleted User',
              cargoOwnerName: 'Deleted User',
              contactPerson: {
                name: 'Deleted User',
                phone: '',
                email: ''
              },
              deletedAt: new Date()
            },
            $unset: { postedBy: 1 }
          },
          { session }
        );

        // 2. Delete associated bids for the user's loads
        const userLoadIds = await loadsCollection.distinct('_id', { postedBy: userId }, { session });
        if (userLoadIds.length > 0) {
          await bidsCollection.deleteMany(
            { loadId: { $in: userLoadIds } },
            { session }
          );
        }

        // 3. Delete notifications related to the user
        await notificationsCollection.deleteMany(
          { 
            $or: [
              { userId: userId },
              { 'data.cargoOwnerId': req.user.id }
            ]
          },
          { session }
        );

        // 4. Delete expired/inactive subscriptions
        await subscriptionsCollection.deleteMany(
          { 
            userId: userId,
            status: { $in: ['expired', 'cancelled', 'rejected'] }
          },
          { session }
        );

        // 5. Finally delete the cargo owner profile
        const deleteResult = await cargoOwnersCollection.deleteOne(
          { _id: userId },
          { session }
        );

        if (deleteResult.deletedCount === 0) {
          throw new Error('Cargo owner profile not found');
        }
      });

      // Log the deletion for audit purposes
      console.log(`Cargo owner profile deleted: ${req.user.id} at ${new Date().toISOString()}`);

      res.json({
        status: 'success',
        message: 'Profile and account deleted successfully',
        data: {
          deletedAt: new Date().toISOString(),
          completedLoadsAnonymized: true,
          relatedDataCleaned: true
        }
      });

    } catch (transactionError) {
      console.error('Transaction error during profile deletion:', transactionError);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete profile completely. Please try again.',
        error: process.env.NODE_ENV === 'development' ? transactionError.message : undefined
      });
    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/cargo-owners/profile/deactivate
// @desc    Deactivate cargo owner profile (soft delete alternative)
// @access  Private (Cargo owners only)
router.post('/profile/deactivate', auth, cargoOwnerLimiter, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    const { reason } = req.body;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const cargoOwnersCollection = db.collection('cargo-owners');

    // Check for active loads
    const loadsCollection = db.collection('loads');
    const activeLoads = await loadsCollection.countDocuments({
      postedBy: new mongoose.Types.ObjectId(req.user.id),
      status: { $in: ['posted', 'receiving_bids', 'driver_assigned', 'in_transit'] }
    });

    if (activeLoads > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot deactivate account. You have ${activeLoads} active load(s). Please cancel or complete them first.`,
        activeLoads
      });
    }

    // Deactivate the account
    const result = await cargoOwnersCollection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      { 
        $set: { 
          isActive: false,
          deactivatedAt: new Date(),
          deactivationReason: reason || 'User requested deactivation',
          updatedAt: new Date()
        }
      },
      { 
        returnDocument: 'after',
        projection: {
          password: 0,
          loginHistory: 0,
          registrationIp: 0
        }
      }
    );

    if (!result.value) {
      return res.status(404).json({
        status: 'error',
        message: 'Cargo owner not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Account deactivated successfully. You can reactivate by contacting support.',
      data: {
        profile: result.value
      }
    });

  } catch (error) {
    console.error('Deactivate profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deactivating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/cargo-owners/loads/:id/bids
// @desc    Get bids for a specific load
// @access  Private (Cargo owner - load owner only)
router.get('/loads/:id/bids',  auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['submitted', 'viewed', 'under_review', 'accepted', 'rejected', 'withdrawn'])
], async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load ID'
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
    
    // Verify load ownership
    const loadsCollection = db.collection('loads');
    const load = await loadsCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id),
      postedBy: new mongoose.Types.ObjectId(req.user.id)
    });

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found or access denied'
      });
    }

    // Build bids query
    const bidsCollection = db.collection('bids');
    let query = { 
      load: new mongoose.Types.ObjectId(id),
      status: { $nin: ['withdrawn', 'expired'] }
    };

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bids with driver information
    const bids = await bidsCollection.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'drivers',
          localField: 'driver',
          foreignField: '_id',
          as: 'driverInfo'
        }
      },
      {
        $lookup: {
          from: 'trucks',
          localField: 'driver',
          foreignField: 'ownerId',
          as: 'vehicleInfo'
        }
      },
      {
        $project: {
          bidAmount: 1,
          message: 1,
          status: 1,
          submittedAt: 1,
          availableFrom: 1,
          expectedDelivery: 1,
          'driverInfo.name': 1,
          'driverInfo.phone': 1,
          'driverInfo.email': 1,
          'driverInfo.location': 1,
          'driverInfo.vehicleType': 1,
          'driverInfo.vehicleCapacity': 1,
          'driverInfo.driverProfile.rating': 1,
          'driverInfo.driverProfile.totalTrips': 1,
          'driverInfo.driverProfile.experienceYears': 1,
          'driverInfo.driverProfile.isVerified': 1,
          'vehicleInfo.make': 1,
          'vehicleInfo.model': 1,
          'vehicleInfo.year': 1,
          'vehicleInfo.licensePlate': 1,
          'vehicleInfo.capacity': 1,
          'vehicleInfo.vehicleType': 1
        }
      },
      { $sort: { bidAmount: 1, submittedAt: 1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]).toArray();

    const totalBids = await bidsCollection.countDocuments(query);
    const totalPages = Math.ceil(totalBids / parseInt(limit));

    // Mark bids as viewed if they were submitted
    await bidsCollection.updateMany(
      { 
        load: new mongoose.Types.ObjectId(id),
        status: 'submitted'
      },
      { 
        $set: { 
          status: 'viewed',
          viewedAt: new Date()
        }
      }
    );

    res.json({
      status: 'success',
      data: {
        load: {
          _id: load._id,
          title: load.title,
          budget: load.budget,
          status: load.status
        },
        bids: bids.map(bid => ({
          ...bid,
          driver: bid.driverInfo[0] || {},
          vehicle: bid.vehicleInfo[0] || {}
        })),
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
    console.error('Get load bids error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching bids',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/cargo-owners/loads/:loadId/bids/:bidId/accept
// @desc    Accept a bid for a load
// @access  Private (Cargo owner - load owner only)
router.post('/loads/:loadId/bids/:bidId/accept',  auth, cargoOwnerLimiter, [
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], async (req, res) => {
  try {
    const { loadId, bidId } = req.params;
    const { notes } = req.body;

    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(loadId) || !mongoose.Types.ObjectId.isValid(bidId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load or bid ID'
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
    
    // Verify load ownership
    const loadsCollection = db.collection('loads');
    const load = await loadsCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(loadId),
      postedBy: new mongoose.Types.ObjectId(req.user.id)
    });

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found or access denied'
      });
    }

    // Check if load can accept bids
    if (!['posted', 'receiving_bids'].includes(load.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot accept bids for load in current status'
      });
    }

    // Get and verify bid
    const bidsCollection = db.collection('bids');
    const bid = await bidsCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(bidId),
      load: new mongoose.Types.ObjectId(loadId)
    });

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found'
      });
    }

    if (!['submitted', 'viewed', 'under_review'].includes(bid.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot accept bid in current status'
      });
    }

    // Accept the bid
    await bidsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(bidId) },
      { 
        $set: { 
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedBy: new mongoose.Types.ObjectId(req.user.id),
          acceptanceNotes: notes,
          updatedAt: new Date()
        }
      }
    );

    // Update load with assigned driver
    await loadsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(loadId) },
      {
        $set: {
          status: 'driver_assigned',
          assignedDriver: bid.driver,
          acceptedBid: new mongoose.Types.ObjectId(bidId),
          acceptedBidAmount: bid.bidAmount,
          assignedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    // Reject all other pending bids for this load
    await bidsCollection.updateMany(
      { 
        load: new mongoose.Types.ObjectId(loadId),
        _id: { $ne: new mongoose.Types.ObjectId(bidId) },
        status: { $in: ['submitted', 'viewed', 'under_review'] }
      },
      { 
        $set: { 
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: new mongoose.Types.ObjectId(req.user.id),
          rejectionReason: 'Another bid was accepted',
          updatedAt: new Date()
        }
      }
    );

    // Update driver availability
    const driversCollection = db.collection('drivers');
    await driversCollection.updateOne(
      { _id: bid.driver },
      {
        $set: {
          'driverProfile.isAvailable': false,
          updatedAt: new Date()
        }
      }
    );

    // Get updated bid with driver info for response
    const updatedBid = await bidsCollection.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(bidId) } },
      {
        $lookup: {
          from: 'drivers',
          localField: 'driver',
          foreignField: '_id',
          as: 'driverInfo'
        }
      },
      {
        $project: {
          bidAmount: 1,
          status: 1,
          acceptedAt: 1,
          'driverInfo.name': 1,
          'driverInfo.phone': 1,
          'driverInfo.email': 1
        }
      }
    ]).toArray();

    res.json({
      status: 'success',
      message: 'Bid accepted successfully',
      data: {
        bid: updatedBid[0],
        load: {
          _id: loadId,
          status: 'driver_assigned',
          assignedDriver: bid.driver
        }
      }
    });

  } catch (error) {
    console.error('Accept bid error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error accepting bid',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/cargo-owners/loads/:loadId/bids/:bidId/reject
// @desc    Reject a bid for a load
// @access  Private (Cargo owner - load owner only)
router.post('/loads/:loadId/bids/:bidId/reject',  auth, cargoOwnerLimiter, [
  body('reason').notEmpty().withMessage('Rejection reason is required'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], async (req, res) => {
  try {
    const { loadId, bidId } = req.params;
    const { reason, notes } = req.body;

    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(loadId) || !mongoose.Types.ObjectId.isValid(bidId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load or bid ID'
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
    
    // Verify load ownership
    const loadsCollection = db.collection('loads');
    const load = await loadsCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(loadId),
      postedBy: new mongoose.Types.ObjectId(req.user.id)
    });

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found or access denied'
      });
    }

    // Get and verify bid
    const bidsCollection = db.collection('bids');
    const bid = await bidsCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(bidId),
      load: new mongoose.Types.ObjectId(loadId)
    });

    if (!bid) {
      return res.status(404).json({
        status: 'error',
        message: 'Bid not found'
      });
    }

    if (!['submitted', 'viewed', 'under_review'].includes(bid.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot reject bid in current status'
      });
    }

    // Reject the bid
    await bidsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(bidId) },
      { 
        $set: { 
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: new mongoose.Types.ObjectId(req.user.id),
          rejectionReason: reason,
          rejectionNotes: notes,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      status: 'success',
      message: 'Bid rejected successfully',
      data: {
        bidId,
        status: 'rejected',
        rejectionReason: reason
      }
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

// @route   GET /api/cargo-owners/analytics
// @desc    Get detailed analytics for cargo owner
// @access  Private (Cargo owners only)
router.get('/analytics',  auth, [
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    const { period = 'month', startDate, endDate } = req.query;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const userId = new mongoose.Types.ObjectId(req.user.id);

    // Calculate date range
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      const now = new Date();
      let startPeriod;
      
      switch (period) {
        case 'week':
          startPeriod = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'quarter':
          startPeriod = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startPeriod = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default: // month
          startPeriod = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      dateFilter = {
        createdAt: { $gte: startPeriod }
      };
    }

    // Get comprehensive analytics
    const loadsCollection = db.collection('loads');
    const bidsCollection = db.collection('bids');

    // Load analytics
    const loadAnalytics = await loadsCollection.aggregate([
      { 
        $match: { 
          postedBy: userId,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalLoads: { $sum: 1 },
          totalBudget: { $sum: '$budget' },
          avgBudget: { $avg: '$budget' },
          avgWeight: { $avg: '$weight' },
          statusBreakdown: {
            $push: '$status'
          },
          cargoTypes: {
            $push: '$cargoType'
          },
          vehicleTypes: {
            $push: '$vehicleType'
          },
          routes: {
            $push: {
              pickup: '$pickupLocation',
              delivery: '$deliveryLocation'
            }
          }
        }
      }
    ]).toArray();

    // Bid analytics for user's loads
    const bidAnalytics = await bidsCollection.aggregate([
      {
        $lookup: {
          from: 'loads',
          localField: 'load',
          foreignField: '_id',
          as: 'loadInfo'
        }
      },
      {
        $match: {
          'loadInfo.postedBy': userId,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalBids: { $sum: 1 },
          avgBidAmount: { $avg: '$bidAmount' },
          minBidAmount: { $min: '$bidAmount' },
          maxBidAmount: { $max: '$bidAmount' },
          acceptedBids: {
            $sum: {
              $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0]
            }
          },
          rejectedBids: {
            $sum: {
              $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0]
            }
          }
        }
      }
    ]).toArray();

    // Time series data for charts
    const timeSeriesData = await loadsCollection.aggregate([
      {
        $match: {
          postedBy: userId,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          loadsPosted: { $sum: 1 },
          totalBudget: { $sum: '$budget' }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.day': 1
        }
      }
    ]).toArray();

    // Top routes
    const topRoutes = await loadsCollection.aggregate([
      {
        $match: {
          postedBy: userId,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            pickup: '$pickupLocation',
            delivery: '$deliveryLocation'
          },
          count: { $sum: 1 },
          totalBudget: { $sum: '$budget' },
          avgBudget: { $avg: '$budget' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]).toArray();

    // Performance metrics
    const performanceMetrics = {
      completionRate: 0,
      avgTimeToAssign: 0,
      avgBidsPerLoad: 0,
      budgetAccuracy: 0
    };

    if (loadAnalytics[0]) {
      const stats = loadAnalytics[0];
      const statusCounts = {};
      stats.statusBreakdown.forEach(status => {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      performanceMetrics.completionRate = statusCounts.delivered 
        ? (statusCounts.delivered / stats.totalLoads) * 100 
        : 0;

      if (bidAnalytics[0] && stats.totalLoads > 0) {
        performanceMetrics.avgBidsPerLoad = bidAnalytics[0].totalBids / stats.totalLoads;
        
        if (bidAnalytics[0].acceptedBids > 0) {
          performanceMetrics.budgetAccuracy = (bidAnalytics[0].avgBidAmount / stats.avgBudget) * 100;
        }
      }
    }

    const analytics = {
      summary: {
        totalLoads: loadAnalytics[0]?.totalLoads || 0,
        totalSpent: bidAnalytics[0]?.acceptedBids * bidAnalytics[0]?.avgBidAmount || 0,
        totalBudget: loadAnalytics[0]?.totalBudget || 0,
        avgLoadValue: loadAnalytics[0]?.avgBudget || 0,
        totalBids: bidAnalytics[0]?.totalBids || 0,
        acceptanceRate: bidAnalytics[0]?.acceptedBids && bidAnalytics[0]?.totalBids 
          ? (bidAnalytics[0].acceptedBids / bidAnalytics[0].totalBids) * 100 
          : 0
      },
      performance: performanceMetrics,
      trends: {
        timeSeriesData: timeSeriesData.map(item => ({
          date: new Date(item._id.year, item._id.month - 1, item._id.day),
          loadsPosted: item.loadsPosted,
          totalBudget: item.totalBudget
        })),
        topRoutes: topRoutes.map(route => ({
          route: `${route._id.pickup} → ${route._id.delivery}`,
          count: route.count,
          totalBudget: route.totalBudget,
          avgBudget: route.avgBudget
        }))
      },
      breakdowns: {
        status: loadAnalytics[0] ? 
          loadAnalytics[0].statusBreakdown.reduce((acc, status) => {
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {}) : {},
        cargoTypes: loadAnalytics[0] ? 
          loadAnalytics[0].cargoTypes.reduce((acc, type) => {
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {}) : {},
        vehicleTypes: loadAnalytics[0] ? 
          loadAnalytics[0].vehicleTypes.reduce((acc, type) => {
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {}) : {}
      },
      period: {
        type: period,
        startDate: dateFilter.createdAt?.$gte,
        endDate: dateFilter.createdAt?.$lte || new Date()
      }
    };

    res.json({
      status: 'success',
      data: analytics
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/cargo-owners/notifications
// @desc    Get notifications for cargo owner
// @access  Private (Cargo owners only)
router.get('/notifications',  auth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('unreadOnly').optional().isBoolean()
], async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    const { page = 1, limit = 20, unreadOnly } = req.query;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    let query = { 
      userId: new mongoose.Types.ObjectId(req.user.id),
      userType: 'cargo_owner'
    };

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await notificationsCollection.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const totalNotifications = await notificationsCollection.countDocuments(query);
    const unreadCount = await notificationsCollection.countDocuments({
      userId: new mongoose.Types.ObjectId(req.user.id),
      userType: 'cargo_owner',
      isRead: false
    });

    const totalPages = Math.ceil(totalNotifications / parseInt(limit));

    res.json({
      status: 'success',
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalNotifications,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        unreadCount
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/cargo-owners/notifications/:id/read
// @desc    Mark notification as read
// @access  Private (Cargo owners only)
router.put('/notifications/:id/read',  auth, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification ID'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const result = await notificationsCollection.updateOne(
      { 
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(req.user.id),
        userType: 'cargo_owner'
      },
      { 
        $set: { 
          isRead: true,
          readAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/cargo-owners/loads/:id/boost
// @desc    Boost a load for better visibility
// @access  Private (Cargo owners only)
router.post('/loads/:id/boost',  auth, cargoOwnerLimiter, [
  body('boostType').isIn(['standard', 'premium', 'urgent']).withMessage('Invalid boost type'),
  body('duration').optional().isInt({ min: 1, max: 30 }).withMessage('Duration must be between 1 and 30 days')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { boostType, duration = 7 } = req.body;

    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Cargo owners only.'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid load ID'
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
    const loadsCollection = db.collection('loads');

    // Verify load ownership
    const load = await loadsCollection.findOne({ 
      _id: new mongoose.Types.ObjectId(id),
      postedBy: new mongoose.Types.ObjectId(req.user.id)
    });

    if (!load) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found or access denied'
      });
    }

    // Check if load can be boosted
    if (!['posted', 'receiving_bids'].includes(load.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot boost load in current status'
      });
    }

    // Calculate boost level and end date
    const boostLevels = {
      'standard': 1,
      'premium': 2,
      'urgent': 3
    };

    const boostEndDate = new Date();
    boostEndDate.setDate(boostEndDate.getDate() + parseInt(duration));

    // Update load with boost
    const result = await loadsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          boostLevel: boostLevels[boostType],
          boostType,
          boostStartDate: new Date(),
          boostEndDate,
          isBoosted: true,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Load not found'
      });
    }

    res.json({
      status: 'success',
      message: `Load boosted with ${boostType} plan for ${duration} days`,
      data: {
        loadId: id,
        boostType,
        boostLevel: boostLevels[boostType],
        duration,
        boostEndDate
      }
    });

  } catch (error) {
    console.error('Boost load error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error boosting load',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;