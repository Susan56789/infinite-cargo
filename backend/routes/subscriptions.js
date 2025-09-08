const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const {adminAuth} = require('../middleware/adminAuth');
const corsHandler = require('../middleware/corsHandler');
const SubscriptionPlan = require('../models/subscriptionPlan');
const PaymentMethod = require('../models/paymentMethod');

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
// Helper function to ensure basic subscription exists
const ensureBasicSubscription = async (userId, db) => {
  try {
    const subscriptionsCollection = db.collection('subscriptions');
    
    const activeBasic = await subscriptionsCollection.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      planId: 'basic',
      status: 'active'
    });

    if (activeBasic) {
      return activeBasic._id;
    }

    // Create basic subscription
    const subscriptionData = {
      userId: new mongoose.Types.ObjectId(userId),
      planId: 'basic',
      planName: 'Basic Plan',
      price: 0,
      currency: 'KES',
      billingCycle: 'monthly',
      features: {
        maxLoads: 3,
        prioritySupport: false,
        advancedAnalytics: false,
        bulkOperations: false,
        apiAccess: false,
        dedicatedManager: false
      },
      status: 'active',
      paymentMethod: 'free',
      paymentStatus: 'completed',
      activatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      autoRenew: true
    };

    const result = await subscriptionsCollection.insertOne(subscriptionData);
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
// @desc    Get current user's subscription status 
// @access  Private (Cargo owners only)
router.get('/status', auth, async (req, res) => {
  try {
    if (req.user.userType !== 'cargo_owner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only cargo owners can view subscription status'
      });
    }

    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');

    // Get current active subscription
    let subscription = await subscriptionsCollection.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: 'active'
    }, { sort: { createdAt: -1 } });

    // If no subscription, create basic one
    if (!subscription) {
      const basicId = await ensureBasicSubscription(req.user.id, db);
      subscription = await subscriptionsCollection.findOne({ _id: basicId });
    }

    // Check for pending subscriptions
    const pendingSubscription = await subscriptionsCollection.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: 'pending'
    }, { sort: { createdAt: -1 } });

    // Get usage data
    const usage = await getUsageData(req.user.id, db, subscription);

    res.json({
      status: 'success',
      data: {
        ...subscription,
        hasActiveSubscription: subscription.status === 'active',
        hasPendingUpgrade: !!pendingSubscription,
        pendingSubscription: pendingSubscription,
        usage: usage
      }
    });

  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching subscription status'
    });
  }
});

// Helper function to get usage data
const getUsageData = async (userId, db, subscription) => {
  const loadsCollection = db.collection('loads');
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const monthlyUsage = await loadsCollection.countDocuments({
    postedBy: new mongoose.Types.ObjectId(userId),
    createdAt: { $gte: currentMonthStart }
  });

  const maxLoads = subscription.features?.maxLoads || 1;
  const remainingLoads = maxLoads === -1 ? -1 : Math.max(0, maxLoads - monthlyUsage);

  return {
    loadsThisMonth: monthlyUsage,
    maxLoads: maxLoads,
    remainingLoads: remainingLoads,
    usagePercentage: maxLoads === -1 ? 0 : Math.min(100, (monthlyUsage / maxLoads) * 100)
  };
};

// @route   GET /api/subscriptions/plans
// @desc    Get available subscription plans
// @access  Private
router.get('/plans', auth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const plansCollection = db.collection('subscriptionplans');
    
    const plans = await plansCollection.find({ 
      isActive: true 
    }).sort({ displayOrder: 1 }).toArray();

    // Process plans to ensure consistent structure
    const plansData = {};
    
    plans.forEach(plan => {
      plansData[plan.planId] = {
        id: plan.planId,
        name: plan.name,
        price: plan.price || 0,
        currency: plan.currency || 'KES',
        interval: plan.billingCycle || 'monthly',
        maxLoads: plan.features?.maxLoads || -1,
        features: generateFeaturesList(plan.features || {}),
        recommended: plan.isPopular || false,
        description: plan.description || '',
        displayOrder: plan.displayOrder || 999,
        duration: plan.duration || 30,
        billingCycle: plan.billingCycle || 'monthly'
      };
    });

    // Helper function to generate features list
    function generateFeaturesList(featuresObj) {
      const features = [];
      
      if (featuresObj.maxLoads === -1) {
        features.push('Unlimited load postings');
      } else if (featuresObj.maxLoads && featuresObj.maxLoads > 0) {
        features.push(`Post up to ${featuresObj.maxLoads} loads per month`);
      }
      
      if (featuresObj.advancedAnalytics) {
        features.push('Advanced analytics & reporting');
      } else {
        features.push('Basic analytics');
      }
      
      if (featuresObj.prioritySupport) {
        features.push('Priority support');
      } else {
        features.push('Standard support');
      }
      
      if (featuresObj.bulkOperations) {
        features.push('Bulk operations');
      }
      
      if (featuresObj.apiAccess) {
        features.push('API access');
      }
      
      if (featuresObj.dedicatedManager) {
        features.push('Dedicated account manager');
      }
      
      return features.length > 0 ? features : ['Basic features included'];
    }

    res.json({
      status: 'success',
      data: { 
        plans: plansData,
        totalPlans: plans.length 
      }
    });

  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching subscription plans',
      data: { plans: {} }
    });
  }
});



// @route   GET /api/subscriptions/payment-methods
// @desc    Get available payment methods from database
// @access  Private
router.get('/payment-methods', auth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const paymentMethodsCollection = db.collection('paymentmethods');
    
    const paymentMethods = await paymentMethodsCollection.find({ 
      enabled: true 
    }).sort({ displayOrder: 1 }).toArray();

    const methodsData = paymentMethods.map(method => ({
      id: method.methodId,
      methodId: method.methodId, // Keep both for compatibility
      name: method.displayName,
      displayName: method.displayName, // Keep both for compatibility
      description: method.description || 'Payment method',
      instructions: method.instructions || '',
      minimumAmount: method.minimumAmount || 1,
      maximumAmount: method.maximumAmount || 999999999,
      processingFee: method.processingFee || 0,
      processingFeeType: method.processingFeeType || 'fixed',
      currency: method.currency || 'KES',
      processingTimeMinutes: method.processingTimeMinutes || 0,
      requiresVerification: method.requiresVerification || false,
      details: method.details || {},
      availableNow: isPaymentMethodAvailable(method),
      availableHours: method.availableHours || { start: '00:00', end: '23:59', timezone: 'Africa/Nairobi' },
      availableDays: method.availableDays || [],
      enabled: method.enabled,
      displayOrder: method.displayOrder || 999
    }));

    // Sort by display order and filter available methods
    const sortedMethods = methodsData
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .filter(method => method.enabled && method.availableNow);

    res.json({
      status: 'success',
      data: { 
        paymentMethods: sortedMethods,
        totalMethods: methodsData.length,
        availableMethods: sortedMethods.length
      }
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching payment methods',
      data: { paymentMethods: [] }
    });
  }
});

// Enhanced helper function to check if payment method is available now
const isPaymentMethodAvailable = (paymentMethod) => {
  try {
    // Base check - must be enabled
    if (!paymentMethod.enabled) {
      return false;
    }

    // Check time availability
    if (paymentMethod.availableHours) {
      const now = new Date();
      const timezone = paymentMethod.availableHours.timezone || 'Africa/Nairobi';
      
      let currentTime;
      try {
        currentTime = now.toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (timezoneError) {
        console.warn('Timezone error, using local time:', timezoneError);
        currentTime = now.toTimeString().slice(0, 5);
      }

      const current = parseInt(currentTime.replace(':', ''));
      const start = parseInt(paymentMethod.availableHours.start.replace(':', ''));
      const end = parseInt(paymentMethod.availableHours.end.replace(':', ''));

      // Handle overnight availability
      if (start > end) {
        if (!(current >= start || current <= end)) {
          return false;
        }
      } else if (!(current >= start && current <= end)) {
        return false;
      }
    }

    // Check day availability
    if (paymentMethod.availableDays && paymentMethod.availableDays.length > 0) {
      const today = new Date().getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayName = dayNames[today];
      
      if (!paymentMethod.availableDays.includes(currentDayName)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking payment method availability:', error);
    // Default to available if there's an error checking
    return paymentMethod.enabled || false;
  }
};

// @route   POST /api/subscriptions/subscribe
// @desc    Create a new subscription request 
// @access  Private (Cargo owners only)
router.post('/subscribe', auth, subscriptionLimiter, [
  body('planId').notEmpty().withMessage('Plan ID is required'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
  body('paymentDetails').optional().isObject().withMessage('Payment details must be an object'),
  body('billingCycle').optional().isIn(['monthly', 'quarterly', 'yearly']).withMessage('Invalid billing cycle')
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

    // Prevent basic plan subscription
    if (planId === 'basic') {
      return res.status(400).json({
        status: 'error',
        message: 'Basic plan is automatically assigned. Please choose a premium plan.'
      });
    }

    const db = mongoose.connection.db;
    const plansCollection = db.collection('subscriptionplans');
    const paymentMethodsCollection = db.collection('paymentmethods');
    const subscriptionsCollection = db.collection('subscriptions');

    // Get plan from database
    const selectedPlan = await plansCollection.findOne({ planId: planId, isActive: true });
    if (!selectedPlan) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or unavailable subscription plan'
      });
    }

    // Get payment method from database
    const paymentMethodObj = await paymentMethodsCollection.findOne({ 
      methodId: paymentMethod, 
      enabled: true 
    });
    
    if (!paymentMethodObj || !isPaymentMethodAvailable(paymentMethodObj)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or unavailable payment method'
      });
    }

    // Check for existing pending subscription
    const existingPending = await subscriptionsCollection.findOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: 'pending',
      planId: { $ne: 'basic' }
    });

    if (existingPending) {
      return res.status(409).json({
        status: 'error',
        message: 'You already have a pending subscription request.',
        existingRequest: {
          id: existingPending._id,
          planName: existingPending.planName,
          requestedAt: existingPending.createdAt
        }
      });
    }

    // Calculate pricing
    let finalPrice = selectedPlan.price;
    let duration = selectedPlan.duration || 30;

    if (billingCycle === 'quarterly') {
      finalPrice = selectedPlan.price * 3 * 0.95;
      duration = 90;
    } else if (billingCycle === 'yearly') {
      finalPrice = selectedPlan.price * 12 * 0.85;
      duration = 365;
    }

    // Validate M-Pesa payment details
    if (paymentMethodObj.methodId === 'mpesa') {
      if (!paymentDetails?.paymentCode || !paymentDetails?.phoneNumber) {
        return res.status(400).json({
          status: 'error',
          message: 'M-Pesa code and phone number are required'
        });
      }
      
      if (!/^[A-Z0-9]{8,12}$/i.test(paymentDetails.paymentCode)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid M-Pesa transaction code format'
        });
      }

      // Validate phone number
      const phone = paymentDetails.phoneNumber.replace(/\s/g, '');
      if (!/^(\+?254|0)?[17][0-9]{8}$/.test(phone)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid phone number format'
        });
      }
    }

    // Calculate fees
    const processingFee = paymentMethodObj.processingFee || 0;
    const totalAmount = finalPrice + processingFee;

    // Create subscription request
    const subscriptionData = {
      userId: new mongoose.Types.ObjectId(req.user.id),
      planId: selectedPlan.planId,
      planName: selectedPlan.name,
      price: finalPrice,
      currency: selectedPlan.currency,
      billingCycle,
      duration,
      features: selectedPlan.features,
      status: 'pending',
      paymentMethod: paymentMethodObj.methodId,
      paymentDetails: {
        ...paymentDetails,
        processingFee,
        totalAmount,
        paymentMethodName: paymentMethodObj.displayName,
        businessNumber: paymentMethodObj.details?.businessNumber,
        userInfo: {
          userId: req.user.id,
          userName: req.user.name,
          userEmail: req.user.email
        }
      },
      paymentStatus: 'pending',
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await subscriptionsCollection.insertOne(subscriptionData);

    // Create notifications
    const notificationsCollection = db.collection('notifications');
    
    // User notification
    await notificationsCollection.insertOne({
      userId: new mongoose.Types.ObjectId(req.user.id),
      userType: 'cargo_owner',
      type: 'subscription_requested',
      title: 'Subscription Request Submitted',
      message: `Your ${selectedPlan.name} subscription request has been submitted and is pending approval.`,
      data: { subscriptionId: result.insertedId },
      isRead: false,
      createdAt: new Date()
    });

    // Admin notification
    await notificationsCollection.insertOne({
      type: 'new_subscription_request',
      title: 'New Subscription Request',
      message: `${req.user.name} has requested a ${selectedPlan.name} subscription via ${paymentMethodObj.displayName}.`,
      data: {
        subscriptionId: result.insertedId,
        userId: req.user.id,
        userName: req.user.name,
        planName: selectedPlan.name,
        price: finalPrice,
        paymentMethod: paymentMethodObj.displayName,
        mpesaCode: paymentDetails?.paymentCode || null
      },
      userType: 'admin',
      isRead: false,
      priority: 'high',
      createdAt: new Date()
    });

    res.status(201).json({
      status: 'success',
      message: `${selectedPlan.name} subscription request submitted successfully.`,
      data: {
        subscriptionId: result.insertedId,
        planName: selectedPlan.name,
        price: finalPrice,
        processingFee,
        totalAmount,
        status: 'pending',
        paymentMethod: paymentMethodObj.displayName
      }
    });

  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error creating subscription request'
    });
  }
});



// @route   GET /api/subscriptions/admin/pending
// @desc    Get pending subscription requests 
// @access  Private (Admin only)
router.get('/admin/pending', adminAuth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'active', 'expired', 'cancelled', 'rejected']),
  query('paymentMethod').optional(),
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
            processingFee: sub.paymentDetails?.processingFee || 0,
            totalAmount: sub.paymentDetails?.totalAmount || sub.price,
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

    // Get all subscription plans from database for plan names
    const allPlans = await SubscriptionPlan.find({}, { planId: 1, name: 1 }).lean();
    const planNameMap = {};
    allPlans.forEach(plan => {
      planNameMap[plan.planId] = plan.name;
    });

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
        planName: planNameMap[plan._id] || plan._id,
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


// @route   GET /api/subscriptions/check-limits
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

    // Get maxLoads from subscription features, fall back to subscription plan from database
    let maxLoads = subscription.features?.maxLoads;
    
    if (maxLoads === undefined || maxLoads === null) {
      const plan = await SubscriptionPlan.getPlanById(subscription.planId);
      maxLoads = plan?.features?.maxLoads || 3; // Default fallback
    }

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
// @desc    Get current user's subscription with enhanced details 
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

// @route   POST /api/subscriptions/admin/:id/approve
// @desc    Approve a subscription request
// @access  Private (Admin only)
router.post('/admin/:id/approve', adminAuth, [
  body('activationDate').optional().isISO8601().withMessage('Invalid activation date'),
  body('notes').optional().isLength({ max: 500 }),
  body('customDuration').optional().isInt({ min: 1, max: 365 }).withMessage('Duration must be between 1-365 days')
], async (req, res) => {
  try {
    if (!req.admin || !req.admin.permissions?.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to approve subscriptions.'
      });
    }

    const { id } = req.params;
    const {
      activationDate,
      notes = '',
      customDuration
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
        message: 'Only pending subscriptions can be approved'
      });
    }

    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';
    const adminEmail = req.admin.email || '';

    // Calculate activation and expiry dates
    const activateAt = activationDate ? new Date(activationDate) : new Date();
    const duration = customDuration || subscription.duration || SUBSCRIPTION_PLANS[subscription.planId]?.duration || 30;
    const expiresAt = new Date(activateAt.getTime() + duration * 24 * 60 * 60 * 1000);

    // Deactivate any existing active subscriptions for this user (except basic)
    await subscriptionsCollection.updateMany(
      { 
        userId: subscription.userId,
        status: 'active',
        planId: { $ne: 'basic' }
      },
      { 
        $set: { 
          status: 'expired',
          updatedAt: new Date(),
          deactivatedReason: 'Replaced by new subscription'
        }
      }
    );

    // Update subscription to active
    const updateResult = await subscriptionsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          status: 'active',
          paymentStatus: 'completed',
          approvedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
          approvedAt: new Date(),
          activatedAt: activateAt,
          expiresAt: expiresAt,
          adminNotes: notes,
          approvalDetails: {
            approvedByName: adminName,
            approvedByEmail: adminEmail,
            approvalTimestamp: new Date(),
            customDuration: customDuration || null
          },
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      throw new Error('Failed to update subscription status');
    }

    // Update user record
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
        $unset: {
          pendingSubscription: ''
        }
      }
    );

    // Send notification to user
    await notificationsCollection.insertOne({
      userId: subscription.userId,
      userType: 'cargo_owner',
      type: 'subscription_approved',
      title: 'Subscription Approved!',
      message: `Your ${subscription.planName} subscription has been approved and is now active. You can now enjoy all premium features.`,
      data: {
        subscriptionId: id,
        planId: subscription.planId,
        planName: subscription.planName,
        price: subscription.price,
        expiresAt: expiresAt,
        activatedAt: activateAt
      },
      isRead: false,
      priority: 'high',
      createdAt: new Date()
    });

    // Create audit log
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
        duration: duration,
        customDuration: customDuration || null,
        notes
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    console.log('Subscription approved:', {
      subscriptionId: id,
      userId: subscription.userId.toString(),
      planId: subscription.planId,
      approvedBy: adminName
    });

    res.json({
      status: 'success',
      message: 'Subscription approved successfully',
      data: {
        subscriptionId: id,
        approvedAt: new Date(),
        activatedAt: activateAt,
        expiresAt: expiresAt,
        planName: subscription.planName
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
// @desc    Reject a subscription request 
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

// @route   POST /api/subscriptions/admin/:id/cancel
// @desc    Cancel an active subscription
// @access  Private (Admin only)
router.post('/admin/:id/cancel', adminAuth, [
  body('reason').notEmpty().withMessage('Cancellation reason is required'),
  body('reasonCategory').isIn([
    'user_request', 'payment_failed', 'policy_violation', 'technical_issue', 'other'
  ]).withMessage('Valid reason category is required'),
  body('refundAmount').optional().isNumeric().withMessage('Refund amount must be numeric'),
  body('effectiveDate').optional().isISO8601().withMessage('Invalid effective date'),
  body('notes').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    if (!req.admin || !req.admin.permissions?.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to cancel subscriptions.'
      });
    }

    const { id } = req.params;
    const {
      reason,
      reasonCategory,
      refundAmount = 0,
      effectiveDate,
      notes = ''
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

    if (!['active', 'pending'].includes(subscription.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Only active or pending subscriptions can be cancelled'
      });
    }

    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';
    const cancelDate = effectiveDate ? new Date(effectiveDate) : new Date();

    // Update subscription status
    await subscriptionsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          status: 'cancelled',
          cancelledBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
          cancelledAt: cancelDate,
          cancellationReason: reason,
          cancellationCategory: reasonCategory,
          refundAmount: refundAmount,
          adminNotes: notes,
          cancellationDetails: {
            cancelledByName: adminName,
            cancelledByEmail: req.admin.email || '',
            cancellationTimestamp: new Date(),
            effectiveDate: cancelDate
          },
          updatedAt: new Date()
        }
      }
    );

    // Update user record - downgrade to basic
    await usersCollection.updateOne(
      { _id: subscription.userId },
      {
        $set: {
          subscriptionPlan: 'basic',
          subscriptionStatus: 'active',
          updatedAt: new Date()
        },
        $unset: {
          currentSubscription: '',
          subscriptionExpiresAt: ''
        }
      }
    );

    // Ensure user has basic subscription
    await ensureBasicSubscription(subscription.userId, db);

    // Send notification to user
    await notificationsCollection.insertOne({
      userId: subscription.userId,
      userType: 'cargo_owner',
      type: 'subscription_cancelled',
      title: 'Subscription Cancelled',
      message: `Your ${subscription.planName} subscription has been cancelled. ${refundAmount > 0 ? `A refund of ${formatCurrency(refundAmount)} will be processed.` : ''} You have been moved to the Basic plan.`,
      data: {
        subscriptionId: id,
        planName: subscription.planName,
        reason,
        reasonCategory,
        refundAmount,
        cancelledAt: cancelDate
      },
      isRead: false,
      priority: 'high',
      createdAt: new Date()
    });

    // Create audit log
    await auditLogsCollection.insertOne({
      action: 'subscription_cancelled',
      entityType: 'subscription',
      entityId: new mongoose.Types.ObjectId(id),
      adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      adminName,
      userId: subscription.userId,
      details: {
        planId: subscription.planId,
        planName: subscription.planName,
        amount: subscription.price,
        reason,
        reasonCategory,
        refundAmount,
        effectiveDate: cancelDate,
        notes
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    res.json({
      status: 'success',
      message: 'Subscription cancelled successfully',
      data: {
        subscriptionId: id,
        cancelledAt: cancelDate,
        reason,
        refundAmount
      }
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error cancelling subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/subscriptions/admin/:id/adjust-duration
// @desc    Adjust subscription duration
// @access  Private (Admin only)
router.put('/admin/:id/adjust-duration', adminAuth, [
  body('additionalDays').isInt({ min: -365, max: 365 }).withMessage('Additional days must be between -365 and 365'),
  body('reason').notEmpty().withMessage('Reason for adjustment is required'),
  body('notes').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    if (!req.admin || !req.admin.permissions?.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to adjust subscriptions.'
      });
    }

    const { id } = req.params;
    const { additionalDays, reason, notes = '' } = req.body;

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

    if (subscription.status !== 'active') {
      return res.status(400).json({
        status: 'error',
        message: 'Only active subscriptions can be adjusted'
      });
    }

    if (subscription.planId === 'basic') {
      return res.status(400).json({
        status: 'error',
        message: 'Basic plan duration cannot be adjusted'
      });
    }

    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';

    // Calculate new expiry date
    const currentExpiry = subscription.expiresAt ? new Date(subscription.expiresAt) : new Date();
    const newExpiry = new Date(currentExpiry.getTime() + (additionalDays * 24 * 60 * 60 * 1000));

    // Create adjustment record
    const adjustment = {
      adjustedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      adjustedAt: new Date(),
      previousExpiry: currentExpiry,
      newExpiry: newExpiry,
      additionalDays: additionalDays,
      reason: reason,
      notes: notes,
      adminName: adminName
    };

    // Update subscription
    await subscriptionsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          expiresAt: newExpiry,
          updatedAt: new Date()
        },
        $push: {
          durationAdjustments: adjustment
        }
      }
    );

    // Update user record
    await usersCollection.updateOne(
      { _id: subscription.userId },
      {
        $set: {
          subscriptionExpiresAt: newExpiry,
          updatedAt: new Date()
        }
      }
    );

    // Send notification to user
    const adjustmentType = additionalDays > 0 ? 'extended' : 'reduced';
    const daysText = Math.abs(additionalDays) === 1 ? 'day' : 'days';
    
    await notificationsCollection.insertOne({
      userId: subscription.userId,
      userType: 'cargo_owner',
      type: 'subscription_adjusted',
      title: 'Subscription Duration Adjusted',
      message: `Your ${subscription.planName} subscription has been ${adjustmentType} by ${Math.abs(additionalDays)} ${daysText}. New expiry date: ${newExpiry.toLocaleDateString()}.`,
      data: {
        subscriptionId: id,
        planName: subscription.planName,
        additionalDays,
        previousExpiry: currentExpiry,
        newExpiry: newExpiry,
        reason,
        adjustedAt: new Date()
      },
      isRead: false,
      priority: 'medium',
      createdAt: new Date()
    });

    // Create audit log
    await auditLogsCollection.insertOne({
      action: 'subscription_duration_adjusted',
      entityType: 'subscription',
      entityId: new mongoose.Types.ObjectId(id),
      adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      adminName,
      userId: subscription.userId,
      details: {
        planId: subscription.planId,
        planName: subscription.planName,
        additionalDays,
        previousExpiry: currentExpiry,
        newExpiry: newExpiry,
        reason,
        notes
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    res.json({
      status: 'success',
      message: `Subscription duration ${adjustmentType} by ${Math.abs(additionalDays)} ${daysText}`,
      data: {
        subscriptionId: id,
        previousExpiry: currentExpiry,
        newExpiry: newExpiry,
        additionalDays,
        adjustedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Adjust subscription duration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error adjusting subscription duration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/subscriptions/admin/:id/update
// @desc    Update subscription details
// @access  Private (Admin only)
router.put('/admin/:id/update', adminAuth, [
  body('planId').optional().custom(async (value) => {
    if (value) {
      const plan = await SubscriptionPlan.getPlanById(value);
      if (!plan) {
        throw new Error('Invalid plan ID');
      }
    }
    return true;
  }),
  body('status').optional().isIn(['active', 'pending', 'cancelled', 'expired']).withMessage('Invalid status'),
  body('expiresAt').optional().isISO8601().withMessage('Invalid expiry date'),
  body('autoRenew').optional().isBoolean(),
  body('notes').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    if (!req.admin || !req.admin.permissions?.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to update subscriptions.'
      });
    }

    const { id } = req.params;
    const { planId, status, expiresAt, autoRenew, notes } = req.body;

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

    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';

    // Build update object
    const updateData = {
      updatedAt: new Date(),
      lastUpdatedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      lastUpdatedByName: adminName
    };

    const changes = [];

    if (planId && planId !== subscription.planId) {
      const newPlan = await SubscriptionPlan.getPlanById(planId);
      if (!newPlan) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid plan ID'
        });
      }
      updateData.planId = planId;
      updateData.planName = newPlan.name;
      updateData.features = newPlan.features;
      changes.push(`Plan changed from ${subscription.planName} to ${newPlan.name}`);
    }

    if (status && status !== subscription.status) {
      updateData.status = status;
      changes.push(`Status changed from ${subscription.status} to ${status}`);
    }

    if (expiresAt) {
      const newExpiryDate = new Date(expiresAt);
      updateData.expiresAt = newExpiryDate;
      changes.push(`Expiry date changed to ${newExpiryDate.toLocaleDateString()}`);
    }

    if (typeof autoRenew === 'boolean' && autoRenew !== subscription.autoRenew) {
      updateData.autoRenew = autoRenew;
      changes.push(`Auto-renewal ${autoRenew ? 'enabled' : 'disabled'}`);
    }

    if (notes) {
      updateData.adminNotes = notes;
    }

    if (changes.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No changes detected'
      });
    }

    // Update subscription
    await subscriptionsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: updateData }
    );

    // Update user record if plan or status changed
    if (updateData.planId || updateData.status || updateData.expiresAt) {
      const userUpdate = { updatedAt: new Date() };
      
      if (updateData.planId) {
        userUpdate.subscriptionPlan = updateData.planId;
      }
      if (updateData.status) {
        userUpdate.subscriptionStatus = updateData.status;
      }
      if (updateData.expiresAt) {
        userUpdate.subscriptionExpiresAt = updateData.expiresAt;
      }

      await usersCollection.updateOne(
        { _id: subscription.userId },
        { $set: userUpdate }
      );
    }

    // Create audit log
    await auditLogsCollection.insertOne({
      action: 'subscription_updated',
      entityType: 'subscription',
      entityId: new mongoose.Types.ObjectId(id),
      adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      adminName,
      userId: subscription.userId,
      details: {
        changes: changes,
        planId: updateData.planId || subscription.planId,
        planName: updateData.planName || subscription.planName,
        previousStatus: subscription.status,
        newStatus: updateData.status || subscription.status,
        notes
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    res.json({
      status: 'success',
      message: 'Subscription updated successfully',
      data: {
        subscriptionId: id,
        changes: changes,
        updatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error updating subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/subscriptions/admin/:id/details
// @desc    Get detailed subscription information
// @access  Private (Admin only)
router.get('/admin/:id/details', adminAuth, async (req, res) => {
  try {
    if (!req.admin || !req.admin.permissions?.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view subscription details.'
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid subscription ID'
      });
    }

    const db = mongoose.connection.db;
    const subscriptionsCollection = db.collection('subscriptions');

    const subscription = await subscriptionsCollection.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'cargo-owners',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $lookup: {
          from: 'loads',
          let: { userId: '$userId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$postedBy', '$$userId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 5 }
          ],
          as: 'recentLoads'
        }
      }
    ]).toArray();

    if (!subscription || subscription.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Subscription not found'
      });
    }

    const subscriptionData = subscription[0];
    const user = subscriptionData.user[0] || {};

    // Get usage statistics
    const loadsCollection = db.collection('loads');
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const monthlyUsage = await loadsCollection.countDocuments({
      postedBy: subscriptionData.userId,
      createdAt: { $gte: currentMonthStart }
    });

    const totalLoads = await loadsCollection.countDocuments({
      postedBy: subscriptionData.userId
    });

    // Calculate subscription metrics
    const daysActive = subscriptionData.activatedAt ? 
      Math.floor((new Date() - new Date(subscriptionData.activatedAt)) / (1000 * 60 * 60 * 24)) : 0;
    
    const daysRemaining = subscriptionData.expiresAt ? 
      Math.max(0, Math.floor((new Date(subscriptionData.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))) : null;

    res.json({
      status: 'success',
      data: {
        subscription: {
          ...subscriptionData,
          user: user,
          metrics: {
            daysActive,
            daysRemaining,
            monthlyUsage,
            totalLoads,
            utilizationRate: subscriptionData.features?.maxLoads ? 
              (monthlyUsage / subscriptionData.features.maxLoads * 100).toFixed(1) : 0
          },
          recentActivity: subscriptionData.recentLoads || []
        }
      }
    });

  } catch (error) {
    console.error('Get subscription details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching subscription details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/subscriptions/admin/:id/extend
// @desc    Extend subscription by specific duration
// @access  Private (Admin only)
router.post('/admin/:id/extend', adminAuth, [
  body('extensionDays').isInt({ min: 1, max: 365 }).withMessage('Extension days must be between 1 and 365'),
  body('reason').notEmpty().withMessage('Extension reason is required'),
  body('compensationType').isIn(['goodwill', 'service_issue', 'promotional', 'other']).withMessage('Invalid compensation type'),
  body('notes').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    if (!req.admin || !req.admin.permissions?.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to extend subscriptions.'
      });
    }

    const { id } = req.params;
    const { extensionDays, reason, compensationType, notes = '' } = req.body;

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

    if (!['active', 'expired'].includes(subscription.status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Only active or expired subscriptions can be extended'
      });
    }

    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';

    // Calculate new expiry date
    const currentExpiry = subscription.expiresAt ? new Date(subscription.expiresAt) : new Date();
    const baseDate = subscription.status === 'expired' ? new Date() : currentExpiry;
    const newExpiry = new Date(baseDate.getTime() + (extensionDays * 24 * 60 * 60 * 1000));

    // Create extension record
    const extension = {
      extendedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      extendedAt: new Date(),
      previousExpiry: currentExpiry,
      newExpiry: newExpiry,
      extensionDays: extensionDays,
      reason: reason,
      compensationType: compensationType,
      notes: notes,
      adminName: adminName
    };

    // Update subscription
    const updateData = {
      expiresAt: newExpiry,
      status: 'active', // Reactivate if expired
      updatedAt: new Date()
    };

    if (!subscription.extensions) {
      updateData.extensions = [extension];
    }

    await subscriptionsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: updateData,
        $push: subscription.extensions ? { extensions: extension } : {}
      }
    );

    // Update user record
    await usersCollection.updateOne(
      { _id: subscription.userId },
      {
        $set: {
          subscriptionStatus: 'active',
          subscriptionExpiresAt: newExpiry,
          currentSubscription: new mongoose.Types.ObjectId(id),
          updatedAt: new Date()
        }
      }
    );

    // Send notification to user
    await notificationsCollection.insertOne({
      userId: subscription.userId,
      userType: 'cargo_owner',
      type: 'subscription_extended',
      title: 'Subscription Extended',
      message: `Great news! Your ${subscription.planName} subscription has been extended by ${extensionDays} days as a ${compensationType}. New expiry: ${newExpiry.toLocaleDateString()}.`,
      data: {
        subscriptionId: id,
        planName: subscription.planName,
        extensionDays,
        newExpiry: newExpiry,
        compensationType,
        reason,
        extendedAt: new Date()
      },
      isRead: false,
      priority: 'medium',
      createdAt: new Date()
    });

    // Create audit log
    await auditLogsCollection.insertOne({
      action: 'subscription_extended',
      entityType: 'subscription',
      entityId: new mongoose.Types.ObjectId(id),
      adminId: adminId ? new mongoose.Types.ObjectId(adminId) : null,
      adminName,
      userId: subscription.userId,
      details: {
        planId: subscription.planId,
        planName: subscription.planName,
        extensionDays,
        previousExpiry: currentExpiry,
        newExpiry: newExpiry,
        compensationType,
        reason,
        notes
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    });

    res.json({
      status: 'success',
      message: `Subscription extended by ${extensionDays} days`,
      data: {
        subscriptionId: id,
        previousExpiry: currentExpiry,
        newExpiry: newExpiry,
        extensionDays,
        extendedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Extend subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error extending subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
