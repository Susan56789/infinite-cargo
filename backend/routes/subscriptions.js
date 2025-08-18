// routes/subscriptions.js
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
      }
};

// @route   GET /api/subscriptions/status
// @desc    Get current user's subscription status (simplified)
// @access  Private (Cargo owners only)
router.get('/status',  auth, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can view subscription status'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');

    // Get the most recent active or pending subscription
    const subscription = await subscriptionsCollection.findOne(
      {
        userId: new mongoose.Types.ObjectId(req.user.id),
        status: { $in: ['active', 'pending'] }
      },
      { sort: { createdAt: -1 } }
    );

    // If no subscription found, return basic plan
    if (!subscription) {
      return res.json({
        status: 'success',
        data: {
          hasActiveSubscription: false,
          planId: 'basic',
          planName: 'Basic Plan',
          status: 'active',
          features: SUBSCRIPTION_PLANS.basic.features,
          price: 0,
          isExpired: false,
          daysUntilExpiry: null
        }
      });
    }

    // Check if subscription is expired
    let isExpired = false;
    let daysUntilExpiry = null;
    
    if (subscription.expiresAt) {
      const now = new Date();
      const expiryDate = new Date(subscription.expiresAt);
      isExpired = now > expiryDate;
      
      if (!isExpired) {
        const timeUntilExpiry = expiryDate - now;
        daysUntilExpiry = Math.max(0, Math.ceil(timeUntilExpiry / (1000 * 60 * 60 * 24)));
      }
      
      // Auto-update expired subscriptions
      if (isExpired && subscription.status === 'active') {
        await subscriptionsCollection.updateOne(
          { _id: subscription._id },
          { 
            $set: { 
              status: 'expired',
              updatedAt: new Date()
            }
          }
        );
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

    const maxLoads = subscription.features?.maxLoads || 0;
    const remainingLoads = maxLoads === -1 ? -1 : Math.max(0, maxLoads - monthlyUsage);

    res.json({
      status: 'success',
      data: {
        hasActiveSubscription: subscription.status === 'active' && !isExpired,
        planId: subscription.planId,
        planName: subscription.planName,
        status: isExpired ? 'expired' : subscription.status,
        features: subscription.features,
        price: subscription.price,
        currency: subscription.currency,
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
router.get('/plans',  auth, async (req, res) => {
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
        price: 999,
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
      data: {
        plans
      }
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
// @desc    Create a new subscription request with enhanced payment details
// @access  Private (Cargo owners only)
router.post('/subscribe',  auth, subscriptionLimiter, [
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

    // Check if user is cargo owner
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

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');
    const usersCollection = db.collection('cargo-owners');

    // Check for existing active subscription
    const existingSubscription = await subscriptionsCollection.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: { $in: ['active', 'pending'] }
    });

    if (existingSubscription && existingSubscription.planId !== 'basic') {
      return res.status(400).json({
        status: 'error',
        message: 'You already have an active or pending premium subscription'
      });
    }

    // Calculate pricing based on billing cycle
    let finalPrice = selectedPlan.price;
    let durationDays = selectedPlan.duration;

    if (billingCycle === 'quarterly') {
      finalPrice = finalPrice * 3 * 0.95; // 5% discount for quarterly
      durationDays = durationDays * 3;
    } else if (billingCycle === 'yearly') {
      finalPrice = finalPrice * 12 * 0.85; // 15% discount for yearly
      durationDays = durationDays * 12;
    }

    // Get user details for notification
    const user = await usersCollection.findOne(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      { projection: { name: 1, email: 1, phone: 1, companyName: 1 } }
    );

    // Enhanced payment details structure
    const enhancedPaymentDetails = {
      ...paymentDetails,
      userInfo: {
        userId: req.user.id,
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone,
        companyName: user.companyName || null
      },
      planInfo: {
        planId,
        planName: selectedPlan.name,
        originalPrice: selectedPlan.price,
        finalPrice,
        billingCycle,
        duration: durationDays
      },
      paymentTimestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Create subscription record
    const subscriptionData = {
      userId: new mongoose.Types.ObjectId(req.user.id),
      planId,
      planName: selectedPlan.name,
      price: finalPrice,
      currency: selectedPlan.currency,
      billingCycle,
      duration: durationDays,
      features: selectedPlan.features,
      status: selectedPlan.price === 0 ? 'active' : 'pending',
      paymentMethod,
      paymentDetails: enhancedPaymentDetails,
      paymentStatus: selectedPlan.price === 0 ? 'completed' : 'pending',
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      // Add upgrade tracking if upgrading from basic
      ...(existingSubscription?.planId === 'basic' && {
        upgradedFrom: 'basic',
        previousSubscriptionId: existingSubscription._id
      })
    };

    // For free plan, set activation dates immediately
    if (selectedPlan.price === 0) {
      subscriptionData.activatedAt = new Date();
      subscriptionData.expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }

    const result = await subscriptionsCollection.insertOne(subscriptionData);
    
    // Update user's subscription reference
    await usersCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      {
        $set: {
          ...(selectedPlan.price > 0 && { pendingSubscription: result.insertedId }),
          subscriptionPlan: planId,
          updatedAt: new Date()
        }
      }
    );

    // If upgrading from basic, deactivate the basic subscription
    if (existingSubscription?.planId === 'basic' && selectedPlan.price > 0) {
      await subscriptionsCollection.updateOne(
        { _id: existingSubscription._id },
        {
          $set: {
            status: 'upgraded',
            deactivatedAt: new Date(),
            upgradedTo: planId,
            updatedAt: new Date()
          }
        }
      );
    }

    // Create enhanced notification for admins (for paid plans)
    if (selectedPlan.price > 0) {
      const notificationsCollection = db.collection('notifications');
      await notificationsCollection.insertOne({
        type: 'subscription_request',
        title: 'New Subscription Request',
        message: `${user.name} has requested to upgrade to ${selectedPlan.name}`,
        data: {
          subscriptionId: result.insertedId,
          userId: req.user.id,
          userName: user.name,
          userEmail: user.email,
          userPhone: user.phone,
          planId,
          planName: selectedPlan.name,
          amount: finalPrice,
          currency: selectedPlan.currency,
          paymentMethod,
          paymentDetails: enhancedPaymentDetails,
          billingCycle,
          requestedAt: new Date(),
          priority: 'high'
        },
        userType: 'admin',
        isRead: false,
        createdAt: new Date()
      });

      // Create audit log
      const auditLogsCollection = db.collection('audit_logs');
      await auditLogsCollection.insertOne({
        action: 'subscription_request_created',
        entityType: 'subscription',
        entityId: result.insertedId,
        userId: new mongoose.Types.ObjectId(req.user.id),
        userType: 'cargo_owner',
        details: {
          planId,
          planName: selectedPlan.name,
          amount: finalPrice,
          paymentMethod,
          billingCycle
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        createdAt: new Date()
      });
    }

    // Get the created subscription for response
    const createdSubscription = await subscriptionsCollection.findOne({
      _id: result.insertedId
    });

    // Generate payment instructions based on method
    let paymentInstructions = null;
    if (selectedPlan.price > 0) {
      switch (paymentMethod) {
        case 'mpesa':
          paymentInstructions = {
            method: 'M-Pesa',
            instructions: [
              'Go to M-Pesa menu on your phone',
              'Select Pay Bill',
              'Enter Business Number: 174379',
              `Enter Account Number: IC${req.user.id.slice(-6)}`,
              `Enter Amount: KES ${finalPrice.toLocaleString()}`,
              'Enter your M-Pesa PIN',
              'Confirm payment and note the transaction code',
              'Submit the transaction code in the subscription form'
            ],
            details: {
              businessNumber: '174379',
              accountNumber: `IC${req.user.id.slice(-6)}`,
              amount: finalPrice,
              reference: `${selectedPlan.name} Subscription - ${user.name}`
            }
          };
          break;
        case 'bank_transfer':
          paymentInstructions = {
            method: 'Bank Transfer',
            instructions: [
              'Visit your bank or use online banking',
              'Transfer to the account details below',
              'Use the provided reference number',
              'Keep the transaction receipt',
              'Payment verification may take 1-2 business days'
            ],
            details: {
              bankName: 'KCB Bank Kenya',
              accountName: 'Infinite Cargo Limited',
              accountNumber: '1234567890',
              branch: 'Westlands Branch',
              swiftCode: 'KCBLKENX',
              amount: finalPrice,
              reference: `IC-${req.user.id.slice(-8)}`
            }
          };
          break;
        case 'card':
          paymentInstructions = {
            method: 'Card Payment',
            instructions: [
              'Contact our support team for card payment processing',
              'Have your subscription details ready',
              'Our team will guide you through secure payment',
              'Processing typically takes 15-30 minutes during business hours'
            ],
            details: {
              supportPhone: '+254 700 000 000',
              supportEmail: 'payments@infinitecargo.co.ke',
              businessHours: 'Monday - Friday: 8:00 AM - 6:00 PM EAT',
              amount: finalPrice,
              subscriptionId: result.insertedId
            }
          };
          break;
      }
    }

    res.status(201).json({
      status: 'success',
      message: selectedPlan.price === 0 
        ? 'Free plan activated successfully'
        : 'Subscription request created successfully. Please complete payment and wait for admin confirmation.',
      data: {
        subscription: {
          id: createdSubscription._id,
          planId: createdSubscription.planId,
          planName: createdSubscription.planName,
          price: createdSubscription.price,
          currency: createdSubscription.currency,
          status: createdSubscription.status,
          paymentStatus: createdSubscription.paymentStatus,
          features: createdSubscription.features,
          createdAt: createdSubscription.createdAt,
          ...(createdSubscription.activatedAt && { activatedAt: createdSubscription.activatedAt }),
          ...(createdSubscription.expiresAt && { expiresAt: createdSubscription.expiresAt })
        },
        paymentInstructions,
        nextSteps: selectedPlan.price === 0 
          ? [
              'Your free plan is now active',
              'You can post up to 3 loads per month',
              'Upgrade anytime for unlimited postings'
            ]
          : [
              'Complete payment using the provided instructions',
              'Submit payment confirmation details',
              'Wait for admin verification (usually within 2-4 hours)',
              'Receive email confirmation once approved',
              'Start enjoying your premium features'
            ]
      }
    });

  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error creating subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/subscriptions/my-subscription
// @desc    Get current user's subscription with enhanced details
// @access  Private (Cargo owners only)
router.get('/my-subscription',  auth, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can view subscriptions'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');

    const subscription = await subscriptionsCollection.findOne(
      {
        userId: new mongoose.Types.ObjectId(req.user.id),
        status: { $in: ['active', 'pending'] }
      },
      { sort: { createdAt: -1 } } // Get most recent active/pending subscription
    );

    if (!subscription) {
      return res.json({
        status: 'success',
        data: {
          subscription: null,
          hasActiveSubscription: false,
          defaultPlan: {
            planId: 'basic',
            planName: 'Basic Plan',
            status: 'active',
            features: SUBSCRIPTION_PLANS.basic.features,
            price: 0,
            message: 'You are on the default Basic plan. Upgrade for more features!',
            
          }
        }
      });
    }

    // Check if subscription is expired
    let isExpired = false;
    if (subscription.expiresAt && new Date() > new Date(subscription.expiresAt)) {
      isExpired = true;
      // Auto-update expired subscriptions
      await subscriptionsCollection.updateOne(
        { _id: subscription._id },
        { 
          $set: { 
            status: 'expired',
            updatedAt: new Date()
          }
        }
      );
      subscription.status = 'expired';
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
    if (subscription.expiresAt) {
      const timeUntilExpiry = new Date(subscription.expiresAt) - new Date();
      daysUntilExpiry = Math.max(0, Math.ceil(timeUntilExpiry / (1000 * 60 * 60 * 24)));
    }

    // Get subscription history
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
        usage: {
          loadsThisMonth: monthlyUsage,
          maxLoads: subscription.features?.maxLoads || 3,
          remainingLoads: subscription.features?.maxLoads === -1 
            ? -1 
            : Math.max(0, (subscription.features?.maxLoads || 3) - monthlyUsage),
          usagePercentage: subscription.features?.maxLoads === -1 
            ? 0 
            : Math.min(100, (monthlyUsage / (subscription.features?.maxLoads || 1)) * 100)
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

// @route   GET /api/subscriptions/admin/pending
// @desc    Get pending subscription requests with enhanced details (Admin only)
// @access  Private (Admin only)
router.get('/admin/pending',  adminAuth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'active', 'expired', 'cancelled', 'rejected']),
  query('paymentMethod').optional().isIn(['mpesa', 'bank_transfer', 'card']),
  query('sortBy').optional().isIn(['createdAt', 'amount', 'planName']),
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

    // Build query
    let query = {};
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

    // Get summary statistics
    const summaryStats = await subscriptionsCollection.aggregate([
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
          // Extract key payment details for admin view
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

// @route   POST /api/subscriptions/admin/:id/approve
// @desc    Approve a subscription request with enhanced tracking (Admin only)
// @access  Private (Admin only)
router.post('/admin/:id/approve',  adminAuth, [
  body('notes').optional().isLength({ max: 500 }),
  body('paymentVerified').isBoolean(),
  body('verificationDetails').optional().isObject()
], async (req, res) => {
  try {
    // Check admin object
    if (!req.admin) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized. No admin info'
      });
    }

    // Check permission
    if (!req.admin.permissions?.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to approve subscriptions.'
      });
    }

    const { id } = req.params;
    const { notes, paymentVerified = true, verificationDetails = {} } = req.body;

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

    // DB
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
        message: 'Only pending subscriptions can be approved'
      });
    }

    const activatedAt = new Date();
    const expiresAt = new Date(
      activatedAt.getTime() + subscription.duration * 24 * 60 * 60 * 1000
    );

    // Make sure we have safe admin fields
    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';
    const adminEmail = req.admin.email || '';

    // Build approval data
    const approvalData = {
      status: 'active',
      paymentStatus: 'completed',
      paymentVerified,
      activatedAt,
      expiresAt,
      approvedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      approvedAt: new Date(),
      adminNotes: notes || '',
      verificationDetails: {
        ...verificationDetails,
        approvedByName: adminName,
        approvedByEmail: adminEmail,
        verificationTimestamp: new Date()
      },
      updatedAt: new Date()
    };

    await subscriptionsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: approvalData }
    );

    // Update user's subscription record
    await usersCollection.updateOne(
      { _id: subscription.userId },
      {
        $set: {
          currentSubscription: new mongoose.Types.ObjectId(id),
          subscriptionPlan: subscription.planId,
          subscriptionStatus: 'active',
          subscriptionExpiresAt: expiresAt,
          updatedAt: new Date()
        },
        $unset: { pendingSubscription: '' }
      }
    );

    // Deactivate any other active subscriptions
    await subscriptionsCollection.updateMany(
      {
        userId: subscription.userId,
        _id: { $ne: new mongoose.Types.ObjectId(id) },
        status: 'active'
      },
      {
        $set: {
          status: 'replaced',
          deactivatedAt: new Date(),
          replacedBy: new mongoose.Types.ObjectId(id),
          updatedAt: new Date()
        }
      }
    );

    // Notify user
    await notificationsCollection.insertOne({
      userId: subscription.userId,
      userType: 'cargo_owner',
      type: 'subscription_approved',
      title: 'Subscription Approved',
      message: `Your ${subscription.planName} subscription is now active.`,
      data: {
        subscriptionId: id,
        planId: subscription.planId,
        activatedAt,
        expiresAt
      },
      isRead: false,
      priority: 'high',
      createdAt: new Date()
    });

    // Insert audit log
    await auditLogsCollection.insertOne({
      action: 'subscription_approved',
      entityType: 'subscription',
      entityId: new mongoose.Types.ObjectId(id),
      adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      adminName,
      userId: subscription.userId,
      details: {
        planId: subscription.planId,
        planName: subscription.planName,
        amount: subscription.price,
        paymentMethod: subscription.paymentMethod,
        paymentVerified,
        notes,
        verificationDetails
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    return res.json({
      status: 'success',
      message: 'Subscription approved successfully',
      data: {
        subscriptionId: id,
        approvedAt: new Date(),
        expiresAt,
        approvedBy: adminName
      }
    });

  } catch (error) {
    console.error('Approve subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error approving subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// @route   POST /api/subscriptions/admin/:id/reject
// @desc    Reject a subscription request with detailed reasons (Admin only)
// @access  Private (Admin only)
router.post('/admin/:id/reject',  adminAuth, [
  body('reason').notEmpty().withMessage('Rejection reason is required'),
  body('reasonCategory').isIn([
    'payment_failed', 'invalid_details', 'fraud_suspected', 'other'
  ]).withMessage('Valid reason category is required'),
  body('notes').optional().isLength({ max: 500 }),
  body('refundRequired').optional().isBoolean()
], async (req, res) => {
  try {
    // Check admin object
    if (!req.admin) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized. No admin info'
      });
    }

    // Check permission
    if (!req.admin.permissions?.manageUsers) {
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

    // Safe admin fallback
    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';
    const adminEmail = req.admin.email || '';

    // Update subscription
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

    // Send notification
    const friendly = {
      payment_failed: 'Payment could not be verified',
      invalid_details: 'Payment details invalid',
      fraud_suspected: 'Fraud suspected',
      other: reason
    };

    await notificationsCollection.insertOne({
      userId: subscription.userId,
      userType: 'cargo_owner',
      type: 'subscription_rejected',
      title: 'Subscription Rejected',
      message: `Your ${subscription.planName} request was declined. Reason: ${friendly[reasonCategory]}.`,
      data: {
        subscriptionId: id,
        reason,
        reasonCategory,
        refundRequired
      },
      isRead: false,
      priority: 'high',
      createdAt: new Date()
    });

    // Save audit log
    await auditLogsCollection.insertOne({
      action: 'subscription_rejected',
      entityType: 'subscription',
      entityId: new mongoose.Types.ObjectId(id),
      adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      adminName,
      userId: subscription.userId,
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


// @route   GET /api/subscriptions/admin/analytics
// @desc    Get comprehensive subscription analytics (Admin only)
// @access  Private (Admin only)
router.get('/admin/analytics',  adminAuth, async (req, res) => {
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

    // Get comprehensive subscription statistics
    const stats = await subscriptionsCollection.aggregate([
      {
        $group: {
          _id: null,
          totalSubscriptions: { $sum: 1 },
          activeSubscriptions: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          pendingSubscriptions: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          rejectedSubscriptions: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'completed'] }, '$price', 0] }
          },
          pendingRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$price', 0] }
          },
          averagePrice: {
            $avg: { $cond: [{ $gt: ['$price', 0] }, '$price', null] }
          }
        }
      }
    ]).toArray();

    // Get plan distribution with revenue
    const planDistribution = await subscriptionsCollection.aggregate([
      {
        $group: {
          _id: '$planId',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          revenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'completed'] }, '$price', 0] }
          },
          averagePrice: { $avg: '$price' }
        }
      }
    ]).toArray();

    // Get payment method analytics
    const paymentMethodStats = await subscriptionsCollection.aggregate([
      { $match: { status: { $ne: 'rejected' } } },
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

    // Get monthly trends for the last 12 months
    const monthlyTrends = await subscriptionsCollection.aggregate([
      {
        $match: {
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

    // Get conversion funnel
    const conversionStats = await subscriptionsCollection.aggregate([
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
        activeSubscriptions: 0,
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
        successRate: (method.successRate * 100).to(1),
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

    // Calculate conversion rate
    const totalRequests = analytics.conversionFunnel.total;
    if (totalRequests > 0) {
      analytics.conversionFunnel.conversionRate = 
        ((analytics.conversionFunnel.active / totalRequests) * 100).to(1);
      analytics.conversionFunnel.rejectionRate = 
        ((analytics.conversionFunnel.rejected / totalRequests) * 100).to(1);
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

module.exports = router;