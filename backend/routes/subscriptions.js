// routes/subscriptions.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const {adminAuth} = require('../middleware/adminAuth');
const corsHandler = require('../middleware/corsHandler');

router.use(corsHandler);

// Rate limiting
const subscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many subscription requests, please try again later.'
  }
});

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic Plan',
    maxLoads: 3,
    features: ['Basic support', 'Load posting', 'Basic analytics'],
    price: 0,
    duration: 30 // days
  },
  pro: {
    name: 'Pro Plan', 
    maxLoads: 25,
    features: ['Priority support', 'Advanced analytics', 'Priority listings'],
    price: 999,
    duration: 30 // days
  },
  business: {
    name: 'Business Plan',
    maxLoads: 100, 
    features: ['Premium support', 'Custom integrations', 'Dedicated account manager'],
    price: 2499,
    duration: 30 // days
  }
};

// Helper function to ensure basic subscription exists
const ensureBasicSubscription = async (userId, db) => {
  try {
    const subscriptionsCollection = db.collection('subscriptions');
    
    // Check if user has any active basic subscription
    const activeBasic = await subscriptionsCollection.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      planId: 'basic',
      status: 'active',
      $or: [
        { expiresAt: { $exists: false } }, // No expiry
        { expiresAt: { $gt: new Date() } }  // Not expired
      ]
    });

    if (activeBasic) {
      return activeBasic._id;
    }

    // Create new basic subscription
    const subscriptionData = {
      userId: new mongoose.Types.ObjectId(userId),
      planId: SUBSCRIPTION_PLANS.basic.id,
      planName: SUBSCRIPTION_PLANS.basic.name,
      price: SUBSCRIPTION_PLANS.basic.price,
      currency: 'KES',
      billingCycle: 'monthly',
      duration: SUBSCRIPTION_PLANS.basic.duration,
      features: SUBSCRIPTION_PLANS.basic.features,
      status: 'active',
      paymentMethod: 'free',
      paymentDetails: { type: 'free_plan' },
      paymentStatus: 'completed',
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + SUBSCRIPTION_PLANS.basic.duration * 24 * 60 * 60 * 1000),
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      autoRenew: true,
      notes: 'Basic plan auto-created'
    };

    const result = await subscriptionsCollection.insertOne(subscriptionData);
    
    // Update user record
    const usersCollection = db.collection('cargo-owners');
    await usersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          currentSubscription: result.insertedId,
          subscriptionPlan: 'basic',
          subscriptionStatus: 'active',
          subscriptionExpiresAt: subscriptionData.expiresAt,
          updatedAt: new Date()
        }
      }
    );

    return result.insertedId;
  } catch (error) {
    console.error('Error ensuring basic subscription:', error);
    throw error;
  }
};

// Helper function to get current active subscription
const getCurrentActiveSubscription = async (userId, db) => {
  const subscriptionsCollection = db.collection('subscriptions');
  
  // First, try to find any active subscription that's not expired
  const activeSubscription = await subscriptionsCollection.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    status: 'active',
    $or: [
      { expiresAt: { $exists: false } }, // No expiry (basic plan)
      { expiresAt: { $gt: new Date() } }  // Not expired
    ]
  }, { sort: { createdAt: -1 } });

  if (activeSubscription) {
    return activeSubscription;
  }

  // If no active subscription, ensure basic plan exists
  const basicSubscriptionId = await ensureBasicSubscription(userId, db);
  
  // Return the basic subscription
  return await subscriptionsCollection.findOne({
    _id: basicSubscriptionId
  });
};

// @route   GET /api/subscriptions/status
// @desc    Get current user's subscription status (FIXED)
// @access  Private (Cargo owners only)
router.get('/status', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can view subscription status'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get current active subscription
    const subscription = await getCurrentActiveSubscription(req.user.id, db);

    if (!subscription) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to get or create subscription'
      });
    }

    // Check if subscription is expired (for non-basic plans)
    let isExpired = false;
    let daysUntilExpiry = null;
    
    if (subscription.expiresAt && subscription.planId !== 'basic') {
      const now = new Date();
      const expiryDate = new Date(subscription.expiresAt);
      isExpired = now > expiryDate;
      
      if (!isExpired) {
        const timeUntilExpiry = expiryDate - now;
        daysUntilExpiry = Math.max(0, Math.ceil(timeUntilExpiry / (1000 * 60 * 60 * 24)));
      }
      
      // If expired, auto-downgrade to basic
      if (isExpired && subscription.status === 'active' && subscription.planId !== 'basic') {
        await subscriptionsCollection.updateOne(
          { _id: subscription._id },
          { 
            $set: { 
              status: 'expired',
              updatedAt: new Date()
            }
          }
        );
        
        // Create/ensure basic subscription
        const basicSubscription = await getCurrentActiveSubscription(req.user.id, db);
        return res.json({
          status: 'success',
          data: {
            hasActiveSubscription: true,
            planId: basicSubscription.planId,
            planName: basicSubscription.planName,
            status: basicSubscription.status,
            features: basicSubscription.features,
            price: basicSubscription.price,
            isExpired: false,
            daysUntilExpiry: null,
            message: 'Your premium subscription has expired. You have been automatically downgraded to the Basic plan.'
          }
        });
      }
    }

    // Get current month's load count for usage tracking
    const loadsCollection = db.collection('loads');
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const monthlyUsage = await loadsCollection.countDocuments({
      postedBy: new mongoose.Types.ObjectId(req.user.id),
      createdAt: { $gte: currentMonthStart }
    });

    const maxLoads = subscription.features?.maxLoads || SUBSCRIPTION_PLANS[subscription.planId]?.maxLoads || 3;
    const remainingLoads = maxLoads === -1 ? -1 : Math.max(0, maxLoads - monthlyUsage);

    res.json({
      status: 'success',
      data: {
        hasActiveSubscription: subscription.status === 'active' && !isExpired,
        planId: subscription.planId,
        planName: subscription.planName,
        status: isExpired ? 'expired' : subscription.status,
        features: subscription.features || SUBSCRIPTION_PLANS[subscription.planId]?.features || [],
        price: subscription.price,
        currency: subscription.currency || 'KES',
        isExpired,
        daysUntilExpiry,
        expiresAt: subscription.expiresAt,
        usage: {
          loadsThisMonth: monthlyUsage,
          maxLoads: maxLoads,
          remainingLoads: remainingLoads,
          usagePercentage: maxLoads === -1 ? 0 : Math.min(100, (monthlyUsage / maxLoads) * 100)
        }
      }
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

// @route   GET /api/subscriptions/plans
// @desc    Get available subscription plans
// @access  Private
router.get('/plans', auth, async (req, res) => {
  try {
    const plans = {
      basic: {
        id: 'basic',
        name: 'Basic Plan',
        price: 0,
        currency: 'KES',
        interval: 'monthly',
        maxLoads: 3,
        features: [
          'Post up to 3 loads per month',
          'Basic analytics',
          'Email support',
          'Standard listing visibility'
        ],
        recommended: false
      },
      pro: {
        id: 'pro',
        name: 'Pro Plan',
        price: 999,
        currency: 'KES', 
        interval: 'monthly',
        maxLoads: 25,
        features: [
          'Post up to 25 loads per month',
          'Advanced analytics & reporting',
          'Priority support',
          'Enhanced listing visibility',
          'Bid management tools',
          'Performance insights'
        ],
        recommended: true
      },
      business: {
        id: 'business',
        name: 'Business Plan',
        price: 2499,
        currency: 'KES',
        interval: 'monthly', 
        maxLoads: 100,
        features: [
          'Unlimited load postings',
          'Premium analytics dashboard',
          'Dedicated account manager',
          'Priority listing placement',
          'Custom integrations',
          'Advanced reporting',
          'Phone & email support',
          'Bulk operations'
        ],
        recommended: false
      }
    };

    res.json({
      status: 'success',
      data: { plans }
    });

  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching subscription plans',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/subscriptions/subscribe
// @desc    Create a new subscription request (FIXED)
// @access  Private (Cargo owners only)
// @route   POST /api/subscriptions/subscribe
// @desc    Create a new subscription request (FIXED)
// @access  Private (Cargo owners only)
router.post('/subscribe', auth, subscriptionLimiter, [
  body('planId')
    .notEmpty()
    .withMessage('Plan ID is required')
    .isIn(['basic', 'pro', 'business'])
    .withMessage('Invalid plan selected'),
  body('paymentMethod')
    .isIn(['mpesa', 'bank_transfer', 'card'])
    .withMessage('Invalid payment method'),
  body('paymentDetails')
    .optional()
    .isObject()
    .withMessage('Payment details must be an object'),
  body('billingCycle')
    .optional()
    .isIn(['monthly', 'quarterly', 'yearly'])
    .withMessage('Invalid billing cycle')
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
        message: 'Only cargo owners can subscribe to plans'
      });
    }

    const { planId, paymentMethod, paymentDetails, billingCycle = 'monthly' } = req.body;

    // Validate plan exists
    const selectedPlan = SUBSCRIPTION_PLANS[planId];
    if (!selectedPlan) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subscription plan'
      });
    }

    // Prevent subscribing to basic plan (it's auto-assigned)
    if (planId === 'basic') {
      return res.status(400).json({
        status: 'error',
        message: 'Basic plan is automatically assigned. Please choose Pro or Business plan.'
      });
    }

    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');
    const usersCollection = db.collection('cargo-owners');
    const notificationsCollection = db.collection('notifications');

    // Check for existing pending subscription
    const existingPending = await subscriptionsCollection.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: 'pending',
      planId: { $ne: 'basic' }
    });

    if (existingPending) {
      return res.status(409).json({
        status: 'error',
        message: 'You already have a pending subscription request. Please wait for approval or cancel the existing request.',
        existingRequest: {
          id: existingPending._id,
          planName: existingPending.planName,
          requestedAt: existingPending.createdAt,
          status: existingPending.status
        }
      });
    }

    // Calculate pricing based on billing cycle
    let finalPrice = selectedPlan.price;
    let duration = selectedPlan.duration;

    if (billingCycle === 'quarterly') {
      finalPrice = selectedPlan.price * 3 * 0.95; // 5% discount
      duration = 90;
    } else if (billingCycle === 'yearly') {
      finalPrice = selectedPlan.price * 12 * 0.85; // 15% discount
      duration = 365;
    }

    // Validate payment details based on method
    if (paymentMethod === 'mpesa') {
      if (!paymentDetails?.mpesaCode || !paymentDetails?.userPhone) {
        return res.status(400).json({
          status: 'error',
          message: 'M-Pesa code and phone number are required for M-Pesa payments'
        });
      }
      
      // Validate M-Pesa code format
      if (!/^[A-Z0-9]{10,12}$/.test(paymentDetails.mpesaCode)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid M-Pesa transaction code format'
        });
      }
    }

    // Create subscription request
    const subscriptionData = {
      userId: new mongoose.Types.ObjectId(req.user.id),
      planId,
      planName: selectedPlan.name,
      price: finalPrice,
      currency: 'KES',
      billingCycle,
      duration,
      features: selectedPlan.features,
      status: 'pending', // Requires admin approval
      paymentMethod,
      paymentDetails: {
        ...paymentDetails,
        userInfo: {
          userId: req.user.id,
          userName: req.user.name,
          userEmail: req.user.email,
          userPhone: req.user.phone
        }
      },
      paymentStatus: 'pending',
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: `${billingCycle} subscription requested via ${paymentMethod}`,
      requestMetadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        origin: req.headers.origin
      }
    };

    // Insert subscription request
    const result = await subscriptionsCollection.insertOne(subscriptionData);
    
    if (!result.insertedId) {
      throw new Error('Failed to create subscription request');
    }

    // Update user with pending subscription reference
    await usersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      {
        $set: {
          pendingSubscription: result.insertedId,
          updatedAt: new Date()
        }
      }
    );

    // Create notification for user
    await notificationsCollection.insertOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      userType: 'cargo_owner',
      type: 'subscription_requested',
      title: 'Subscription Request Submitted',
      message: `Your ${selectedPlan.name} subscription request has been submitted and is pending approval. You will be notified once it's processed.`,
      data: {
        subscriptionId: result.insertedId,
        planId,
        planName: selectedPlan.name,
        price: finalPrice,
        paymentMethod
      },
      isRead: false,
      priority: 'medium',
      createdAt: new Date()
    });

    // Create notification for admins
    await notificationsCollection.insertOne({
      type: 'new_subscription_request',
      title: 'New Subscription Request',
      message: `${req.user.name} has requested a ${selectedPlan.name} subscription via ${paymentMethod}.`,
      data: {
        subscriptionId: result.insertedId,
        userId: req.user.id,
        userName: req.user.name,
        userEmail: req.user.email,
        planId,
        planName: selectedPlan.name,
        price: finalPrice,
        paymentMethod,
        paymentDetails: paymentDetails?.mpesaCode ? { mpesaCode: paymentDetails.mpesaCode } : {}
      },
      userType: 'admin',
      isRead: false,
      priority: 'high',
      createdAt: new Date()
    });

    console.log('Subscription request created:', {
      subscriptionId: result.insertedId,
      userId: req.user.id,
      planId,
      price: finalPrice,
      paymentMethod
    });

    res.status(201).json({
      status: 'success',
      message: `${selectedPlan.name} subscription request submitted successfully. You will receive a notification once it's approved.`,
      data: {
        subscriptionId: result.insertedId,
        planName: selectedPlan.name,
        price: finalPrice,
        currency: 'KES',
        billingCycle,
        status: 'pending',
        paymentMethod,
        requestedAt: new Date(),
        estimatedProcessingTime: '24-48 hours'
      }
    });

  } catch (error) {
    console.error('Subscribe error:', error);
    
    // Handle specific error types
    if (error.code === 11000) {
      return res.status(409).json({
        status: 'error',
        message: 'A subscription request with these details already exists'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Server error creating subscription request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/subscriptions/admin/:id/reject
// @desc    Reject a subscription request (FIXED)
// @access  Private (Admin only)
router.post('/admin/:id/reject', adminAuth, [
  body('reason').notEmpty().withMessage('Rejection reason is required'),
  body('reasonCategory').isIn([
    'payment_failed', 'invalid_details', 'fraud_suspected', 'other'
  ]).withMessage('Valid reason category is required'),
  body('notes').optional().isLength({ max: 500 }),
  body('refundRequired').optional().isBoolean()
], async (req, res) => {
  try {
    if (!req.admin || !req.admin.permissions?.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to reject subscriptions.'
      });
    }

    const { id } = req.params;
    const {
      reason,
      reasonCategory,
      notes = '',
      refundRequired = false
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subscription ID'
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
    const subscriptionsCollection = db.collection('subscriptions');
    const usersCollection = db.collection('cargo-owners');
    const notificationsCollection = db.collection('notifications');
    const auditLogsCollection = db.collection('audit_logs');

    const subscription = await subscriptionsCollection.findOne({
      _id: new mongoose.Types.ObjectId(id)
    });

    if (!subscription) {
      return res.status(404).json({
        status: 'error',
        message: 'Subscription not found'
      });
    }

    if (subscription.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: 'Only pending subscriptions can be rejected'
      });
    }

    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';
    const adminEmail = req.admin.email || '';

    // Update subscription to rejected
    await subscriptionsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          status: 'rejected',
          paymentStatus: 'failed',
          rejectedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
          rejectedAt: new Date(),
          rejectionReason: reason,
          rejectionCategory: reasonCategory,
          adminNotes: notes,
          refundRequired,
          rejectionDetails: {
            rejectedByName: adminName,
            rejectedByEmail: adminEmail,
            rejectionTimestamp: new Date()
          },
          updatedAt: new Date()
        }
      }
    );

    // Remove pendingSubscription from user
    await usersCollection.updateOne(
      { _id: subscription.userId },
      { $unset: { pendingSubscription: '' }, $set: { updatedAt: new Date() } }
    );

    // Ensure user has basic subscription
    await ensureBasicSubscription(subscription.userId, db);

    // Send notification to user
    const reasonMessages = {
      payment_failed: 'Payment could not be verified',
      invalid_details: 'Payment details were invalid',
      fraud_suspected: 'Suspicious activity detected',
      other: reason
    };

    await notificationsCollection.insertOne({
      userId: subscription.userId,
      userType: 'cargo_owner',
      type: 'subscription_rejected',
      title: 'Subscription Request Rejected',
      message: `Your ${subscription.planName} request was declined. Reason: ${reasonMessages[reasonCategory]}. You remain on the Basic plan.`,
      data: {
        subscriptionId: id,
        planName: subscription.planName,
        reason,
        reasonCategory,
        refundRequired,
        rejectedAt: new Date()
      },
      isRead: false,
      priority: 'high',
      createdAt: new Date()
    });

    // Create audit log
    await auditLogsCollection.insertOne({
      action: 'subscription_rejected',
      entityType: 'subscription',
      entityId: new mongoose.Types.ObjectId(subscriptionId),
      adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      adminName,
      userId: subscriptionId,
      details: {
        planId: subscription.planId,
        planName: subscription.planName,
        amount: subscription.price,
        paymentMethod: subscription.paymentMethod,
        reason,
        reasonCategory,
        refundRequired,
        notes
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    res.json({
      status: 'success',
      message: 'Subscription rejected successfully',
      data: {
        subscriptionId: id,
        rejectedAt: new Date(),
        reason,
        reasonCategory
      }
    });

  } catch (error) {
    console.error('Reject subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error rejecting subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/subscriptions/admin/pending
// @desc    Get pending subscription requests (FIXED)
// @access  Private (Admin only)
router.get('/admin/pending', adminAuth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'active', 'expired', 'cancelled', 'rejected']),
  query('paymentMethod').optional().isIn(['mpesa', 'bank_transfer', 'card']),
  query('sortBy').optional().isIn(['createdAt', 'price', 'planName']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    if (!req.admin.permissions.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage subscriptions.'
      });
    }

    const { 
      page = 1, 
      limit = 20, 
      status,
      paymentMethod,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');

    // Build query - exclude basic plan subscriptions from admin view
    let query = { planId: { $ne: 'basic' } };
    
    if (status) {
      query.status = status;
    } else {
      query.status = 'pending'; // Default to pending requests
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const subscriptions = await subscriptionsCollection.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'cargo-owners',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $project: {
          planId: 1,
          planName: 1,
          price: 1,
          currency: 1,
          billingCycle: 1,
          status: 1,
          paymentMethod: 1,
          paymentStatus: 1,
          paymentDetails: 1,
          requestedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          features: 1,
          duration: 1,
          'user.name': 1,
          'user.email': 1,
          'user.phone': 1,
          'user.companyName': 1,
          'user.location': 1,
          'user.createdAt': 1
        }
      },
      { $sort: { [sortBy]: sortDirection } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]).toArray();

    const totalSubscriptions = await subscriptionsCollection.countDocuments(query);
    const totalPages = Math.ceil(totalSubscriptions / parseInt(limit));

    // Get summary statistics (exclude basic plans)
    const summaryStats = await subscriptionsCollection.aggregate([
      { $match: { planId: { $ne: 'basic' } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [
                { $eq: ['$paymentStatus', 'completed'] },
                '$price',
                0
              ]
            }
          }
        }
      }
    ]).toArray();

    const summary = {
      pending: summaryStats.find(s => s._id === 'pending')?.count || 0,
      active: summaryStats.find(s => s._id === 'active')?.count || 0,
      expired: summaryStats.find(s => s._id === 'expired')?.count || 0,
      rejected: summaryStats.find(s => s._id === 'rejected')?.count || 0,
      totalRevenue: summaryStats.reduce((sum, s) => sum + s.totalRevenue, 0)
    };

    res.json({
      status: 'success',
      data: {
        subscriptions: subscriptions.map(sub => ({
          ...sub,
          user: sub.user[0] || null,
          paymentSummary: {
            method: sub.paymentMethod,
            amount: sub.price,
            currency: sub.currency,
            mpesaCode: sub.paymentDetails?.mpesaCode,
            reference: sub.paymentDetails?.reference || sub.paymentDetails?.userInfo?.userId,
            userPhone: sub.paymentDetails?.userInfo?.userPhone
          },
          requestAge: Math.floor((new Date() - new Date(sub.createdAt)) / (1000 * 60 * 60)), // hours
          priority: sub.price > 1000 ? 'high' : 'normal'
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalSubscriptions,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        summary,
        filters: {
          status: status || 'pending',
          paymentMethod: paymentMethod || 'all',
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Get pending subscriptions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching pending subscriptions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/subscriptions/admin/analytics
// @desc    Get comprehensive subscription analytics (Admin only)
// @access  Private (Admin only)
router.get('/admin/analytics', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');

    // Get comprehensive subscription statistics (exclude basic plans from revenue)
    const stats = await subscriptionsCollection.aggregate([
      {
        $group: {
          _id: null,
          totalSubscriptions: { $sum: 1 },
          totalPremiumSubscriptions: {
            $sum: { $cond: [{ $ne: ['$planId', 'basic'] }, 1, 0] }
          },
          activeSubscriptions: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          activePremiumSubscriptions: {
            $sum: { 
              $cond: [
                { $and: [{ $eq: ['$status', 'active'] }, { $ne: ['$planId', 'basic'] }] }, 
                1, 
                0
              ] 
            }
          },
          pendingSubscriptions: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          rejectedSubscriptions: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          totalRevenue: {
            $sum: { 
              $cond: [
                { $and: [{ $eq: ['$paymentStatus', 'completed'] }, { $ne: ['$planId', 'basic'] }] }, 
                '$price', 
                0
              ] 
            }
          },
          pendingRevenue: {
            $sum: { 
              $cond: [
                { $and: [{ $eq: ['$status', 'pending'] }, { $ne: ['$planId', 'basic'] }] }, 
                '$price', 
                0
              ] 
            }
          },
          averagePrice: {
            $avg: { 
              $cond: [
                { $and: [{ $gt: ['$price', 0] }, { $ne: ['$planId', 'basic'] }] }, 
                '$price', 
                null
              ] 
            }
          }
        }
      }
    ]).toArray();

    // Get plan distribution with revenue (exclude basic from revenue calculations)
    const planDistribution = await subscriptionsCollection.aggregate([
      {
        $group: {
          _id: '$planId',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          revenue: {
            $sum: { 
              $cond: [
                { $and: [{ $eq: ['$paymentStatus', 'completed'] }, { $ne: ['$_id', 'basic'] }] }, 
                '$price', 
                0
              ] 
            }
          },
          averagePrice: { 
            $avg: { 
              $cond: [{ $gt: ['$price', 0] }, '$price', null] 
            } 
          }
        }
      }
    ]).toArray();

    // Get payment method analytics (exclude basic plans)
    const paymentMethodStats = await subscriptionsCollection.aggregate([
      { 
        $match: { 
          status: { $ne: 'rejected' },
          planId: { $ne: 'basic' }
        } 
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          successRate: {
            $avg: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          totalAmount: { $sum: '$price' }
        }
      }
    ]).toArray();

    // Get monthly trends for the last 12 months (exclude basic plans)
    const monthlyTrends = await subscriptionsCollection.aggregate([
      {
        $match: {
          planId: { $ne: 'basic' },
          createdAt: {
            $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          subscriptions: { $sum: 1 },
          revenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'completed'] }, '$price', 0] }
          },
          newCustomers: { $addToSet: '$userId' }
        }
      },
      {
        $addFields: {
          uniqueCustomers: { $size: '$newCustomers' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      },
      { $limit: 12 }
    ]).toArray();

    // Get conversion funnel (exclude basic plans)
    const conversionStats = await subscriptionsCollection.aggregate([
      { $match: { planId: { $ne: 'basic' } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const analytics = {
      summary: stats[0] || {
        totalSubscriptions: 0,
        totalPremiumSubscriptions: 0,
        activeSubscriptions: 0,
        activePremiumSubscriptions: 0,
        pendingSubscriptions: 0,
        rejectedSubscriptions: 0,
        totalRevenue: 0,
        pendingRevenue: 0,
        averagePrice: 0
      },
      planDistribution: planDistribution.map(plan => ({
        planId: plan._id,
        planName: SUBSCRIPTION_PLANS[plan._id]?.name || plan._id,
        count: plan.count,
        activeCount: plan.activeCount,
        revenue: plan.revenue,
        averagePrice: plan.averagePrice || 0,
        conversionRate: plan.count > 0 ? (plan.activeCount / plan.count) * 100 : 0
      })),
      paymentMethods: paymentMethodStats.map(method => ({
        method: method._id,
        count: method.count,
        successRate: Math.round(method.successRate * 100 * 10) / 10, // Round to 1 decimal
        totalAmount: method.totalAmount
      })),
      monthlyTrends: monthlyTrends.map(trend => ({
        month: `${trend._id.year}-${String(trend._id.month).padStart(2, '0')}`,
        subscriptions: trend.subscriptions,
        revenue: trend.revenue,
        uniqueCustomers: trend.uniqueCustomers
      })),
      conversionFunnel: {
        total: conversionStats.reduce((sum, s) => sum + s.count, 0),
        pending: conversionStats.find(s => s._id === 'pending')?.count || 0,
        active: conversionStats.find(s => s._id === 'active')?.count || 0,
        rejected: conversionStats.find(s => s._id === 'rejected')?.count || 0,
        expired: conversionStats.find(s => s._id === 'expired')?.count || 0
      }
    };

    // Calculate conversion rates
    const totalRequests = analytics.conversionFunnel.total;
    if (totalRequests > 0) {
      analytics.conversionFunnel.conversionRate = 
        Math.round((analytics.conversionFunnel.active / totalRequests) * 100 * 10) / 10;
      analytics.conversionFunnel.rejectionRate = 
        Math.round((analytics.conversionFunnel.rejected / totalRequests) * 100 * 10) / 10;
    }

    res.json({
      status: 'success',
      data: analytics
    });

  } catch (error) {
    console.error('Get subscription analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching subscription analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/subscriptions/check-limits
// @desc    Check if user can create more loads based on subscription
// @access  Private (Cargo owners only)
router.get('/check-limits', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can check load limits'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get current active subscription
    const subscription = await getCurrentActiveSubscription(req.user.id, db);

    if (!subscription) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to get subscription information'
      });
    }

    // Get current month's load count
    const loadsCollection = db.collection('loads');
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const monthlyUsage = await loadsCollection.countDocuments({
      postedBy: new mongoose.Types.ObjectId(req.user.id),
      createdAt: { $gte: currentMonthStart }
    });

    const maxLoads = subscription.features?.maxLoads || SUBSCRIPTION_PLANS[subscription.planId]?.maxLoads || 3;
    const remainingLoads = maxLoads === -1 ? -1 : Math.max(0, maxLoads - monthlyUsage);
    const canCreateLoads = maxLoads === -1 || remainingLoads > 0;

    res.json({
      status: 'success',
      data: {
        canCreateLoads,
        currentPlan: subscription.planId,
        planName: subscription.planName,
        limits: {
          maxLoads,
          usedLoads: monthlyUsage,
          remainingLoads,
          resetDate: new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 1)
        }
      }
    });

  } catch (error) {
    console.error('Check limits error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error checking subscription limits',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/subscriptions/my-subscription
// @desc    Get current user's subscription with enhanced details (FIXED)
// @access  Private (Cargo owners only)
router.get('/my-subscription', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can view subscriptions'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get current active subscription
    const subscription = await getCurrentActiveSubscription(req.user.id, db);

    if (!subscription) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to get or create subscription'
      });
    }

    // Check if subscription is expired
    let isExpired = false;
    if (subscription.expiresAt && subscription.planId !== 'basic') {
      isExpired = new Date() > new Date(subscription.expiresAt);
      
      if (isExpired && subscription.status === 'active') {
        // Auto-downgrade to basic
        const subscriptionsCollection = db.collection('subscriptions');
        await subscriptionsCollection.updateOne(
          { _id: subscription._id },
          { 
            $set: { 
              status: 'expired',
              updatedAt: new Date()
            }
          }
        );
        
        // Get basic subscription
        const basicSubscription = await getCurrentActiveSubscription(req.user.id, db);
        subscription.isExpired = true;
        subscription.downgradedToBasic = true;
        subscription.basicSubscription = basicSubscription;
      }
    }

    // Get usage statistics
    const loadsCollection = db.collection('loads');
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const monthlyUsage = await loadsCollection.countDocuments({
      postedBy: new mongoose.Types.ObjectId(req.user.id),
      createdAt: { $gte: currentMonthStart }
    });

    // Calculate days until expiry
    let daysUntilExpiry = null;
    if (subscription.expiresAt && !isExpired) {
      const timeUntilExpiry = new Date(subscription.expiresAt) - new Date();
      daysUntilExpiry = Math.max(0, Math.ceil(timeUntilExpiry / (1000 * 60 * 60 * 24)));
    }

    // Get subscription history
    const subscriptionsCollection = db.collection('subscriptions');
    const subscriptionHistory = await subscriptionsCollection.find(
      { userId: new mongoose.Types.ObjectId(req.user.id) },
      { 
        projection: { 
          planId: 1, planName: 1, status: 1, activatedAt: 1, 
          expiresAt: 1, price: 1, createdAt: 1 
        },
        sort: { createdAt: -1 },
        limit: 5
      }
    ).toArray();

    // Check for any pending subscription
    const pendingSubscription = await subscriptionsCollection.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: 'pending'
    }, { sort: { createdAt: -1 } });

    const maxLoads = subscription.features?.maxLoads || SUBSCRIPTION_PLANS[subscription.planId]?.maxLoads || 3;

    res.json({
      status: 'success',
      data: {
        subscription: {
          ...subscription,
          daysUntilExpiry,
          isExpired,
          renewalDate: subscription.expiresAt
        },
        hasActiveSubscription: subscription.status === 'active' && !isExpired,
        hasPendingUpgrade: !!pendingSubscription,
        pendingSubscription: pendingSubscription || null,
        usage: {
          loadsThisMonth: monthlyUsage,
          maxLoads: maxLoads,
          remainingLoads: maxLoads === -1 
            ? -1 
            : Math.max(0, maxLoads - monthlyUsage),
          usagePercentage: maxLoads === -1 
            ? 0 
            : Math.min(100, (monthlyUsage / maxLoads) * 100)
        },
        billing: {
          nextBillingDate: subscription.expiresAt,
          autoRenew: subscription.autoRenew || false,
          billingCycle: subscription.billingCycle || 'monthly',
          currentPrice: subscription.price
        },
        history: subscriptionHistory
      }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;