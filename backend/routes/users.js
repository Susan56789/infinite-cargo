// routes/users.js 
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const corsHandler = require('../middleware/corsHandler');

// Rate limiting for registration and login
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});



// Basic subscription plan configuration
const BASIC_PLAN = {
  id: 'basic',
  name: 'Basic Plan',
  price: 0,
  currency: 'KES',
  duration: 30,
  features: {
    maxLoads: 3,
    prioritySupport: false,
    advancedAnalytics: false,
    bulkOperations: false,
    apiAccess: false,
    dedicatedManager: false
  }
};

// Function to create basic subscription for cargo owners
const createBasicSubscription = async (userId, db) => {
  try {
    const subscriptionsCollection = db.collection('subscriptions');
    
    const subscriptionData = {
      userId: new mongoose.Types.ObjectId(userId),
      planId: BASIC_PLAN.id,
      planName: BASIC_PLAN.name,
      price: BASIC_PLAN.price,
      currency: BASIC_PLAN.currency,
      billingCycle: 'monthly',
      duration: BASIC_PLAN.duration,
      features: BASIC_PLAN.features,
      status: 'active', // Basic plan is immediately active
      paymentMethod: 'free',
      paymentDetails: { type: 'free_plan' },
      paymentStatus: 'completed',
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + BASIC_PLAN.duration * 24 * 60 * 60 * 1000),
      requestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      autoRenew: true, // Basic plan auto-renews
      notes: 'Automatically enrolled in Basic plan upon registration'
    };

    const result = await subscriptionsCollection.insertOne(subscriptionData);
    return result.insertedId;
  } catch (error) {
    console.error('Failed to create basic subscription:', error);
    throw error;
  }
};

// Enhanced validation middleware
const registrationValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
    
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
    
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^(\+254|0)[0-9]{9}$/)
    .withMessage('Please provide a valid Kenyan phone number (e.g., +254712345678 or 0712345678)'),
    
  body('userType')
    .isIn(['driver', 'cargo_owner'])
    .withMessage('User type must be either driver or cargo_owner'),
    
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Location must be between 2 and 100 characters')
    .isIn([
      'Nairobi', 'Mombasa', 'Kiambu', 'Nakuru', 'Machakos', 'Meru', 'Kisumu',
      'Uasin Gishu', 'Kajiado', 'Nyandarua', 'Murang\'a', 'Nyeri', 'Kirinyaga',
      'Embu', 'Tharaka Nithi', 'Kitui', 'Makueni', 'Nzoia', 'Vihiga', 'Bungoma',
      'Busia', 'Siaya', 'Kisii', 'Homa Bay', 'Migori', 'Nyamira', 'Narok',
      'Bomet', 'Kericho', 'Nandi', 'Baringo', 'Laikipia', 'Samburu', 'Trans Nzoia',
      'Elgeyo Marakwet', 'West Pokot', 'Turkana', 'Marsabit', 'Isiolo',
      'Tana River', 'Lamu', 'Taita Taveta', 'Garissa', 'Wajir', 'Mandera'
    ])
    .withMessage('Please select a valid Kenyan county')
];

// Utility function to sanitize user data for logging
const sanitizeForLog = (data) => {
  const sanitized = { ...data };
  delete sanitized.password;
  delete sanitized.confirmPassword;
  return sanitized;
};

// @route   POST /api/users/register
// @desc    Register a new user with enhanced validation and auto Basic subscription for cargo owners
// @access  Public
router.post('/register', corsHandler, authLimiter, registrationValidation, async (req, res) => {
  const startTime = Date.now();
  let session = null;
  
  try {
    console.log('Registration request received:', { 
      body: sanitizeForLog(req.body),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      origin: req.headers.origin 
    });

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        status: 'error',
        message: 'Validation failed',
        errors: errors.array().map(error => ({
          field: error.path || error.param,
          message: error.msg,
          value: error.value
        }))
      });
    }

    const { name, email, password, phone, userType, location } = req.body;

    // Additional security: Check if request is from allowed origin
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://infinitecargo.co.ke',
      'https://www.infinitecargo.co.ke'
    ];
    
    if (origin && !allowedOrigins.includes(origin)) {
      console.warn('Registration attempt from unauthorized origin:', origin);
      return res.status(403).json({
        status: 'error',
        message: 'Unauthorized origin'
      });
    }

    // Get database connection with error handling
    const mongoose = require('mongoose');
    if (!mongoose.connection.db) {
      throw new Error('Database connection not available');
    }
    const db = mongoose.connection.db;

    // Check for existing users with parallel queries for better performance
    const [existingInDrivers, existingInCargoOwners] = await Promise.all([
      db.collection('drivers').findOne({ 
        $or: [
          { email: email.toLowerCase().trim() },
          { phone: phone.trim() }
        ]
      }),
      db.collection('cargo-owners').findOne({ 
        $or: [
          { email: email.toLowerCase().trim() },
          { phone: phone.trim() }
        ]
      })
    ]);

    if (existingInDrivers || existingInCargoOwners) {
      const existingUser = existingInDrivers || existingInCargoOwners;
      const field = existingUser.email === email.toLowerCase().trim() ? 'email' : 'phone';
      const existingType = existingInDrivers ? 'driver' : 'cargo_owner';
      
      console.log('Registration failed: Duplicate user found:', {
        field,
        existingType,
        email: email.toLowerCase().trim()
      });
      
      return res.status(409).json({ 
        status: 'error',
        message: `This ${field} is already registered as a ${existingType === 'driver' ? 'Driver' : 'Cargo Owner'}. Each email and phone can only be used once across the platform.`,
        field,
        existingUserType: existingType
      });
    }

    // Hash password with enhanced security
    const saltRounds = process.env.NODE_ENV === 'production' ? 14 : 12;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create comprehensive user data with better defaults
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      userType,
      location: location.trim(),
      isVerified: false,
      profileCompleted: false,
      preferences: {
        emailNotifications: true,
        smsNotifications: true,
        pushNotifications: true,
        marketingEmails: false
      },
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
      loginHistory: [],
      // Security fields
      accountStatus: 'active',
      failedLoginAttempts: 0,
      accountLocked: false,
      // Analytics
      registrationSource: req.headers.origin || 'direct',
      registrationIp: req.ip,
      // Subscription fields for cargo owners
      ...(userType === 'cargo_owner' && {
        subscriptionPlan: BASIC_PLAN.id,
        subscriptionStatus: 'active',
        subscriptionExpiresAt: new Date(Date.now() + BASIC_PLAN.duration * 24 * 60 * 60 * 1000)
      })
    };

    // Add user type specific profiles with better defaults
    if (userType === 'driver') {
      userData.driverProfile = {
        verified: false,
        verificationStatus: 'pending',
        documentsUploaded: false,
        rating: 0,
        totalRatings: 0,
        completedJobs: 0,
        isAvailable: true,
        joinedDate: new Date()
      };
    } else {
      userData.cargoOwnerProfile = {
        verified: false,
        verificationStatus: 'pending',
        documentsUploaded: false,
        rating: 0,
        totalRatings: 0,
        totalShipments: 0,
        joinedDate: new Date(),
        // Basic plan details
        currentSubscription: null, // Will be set after creating subscription
        subscriptionFeatures: BASIC_PLAN.features
      };
    }

    console.log('Creating user:', {
      ...sanitizeForLog(userData),
      processingTime: `${Date.now() - startTime}ms`
    });

    // Use session for transaction if available
    try {
      session = await mongoose.startSession();
    } catch (sessionError) {
      console.warn('Session not available, continuing without transaction');
    }

    let result;
    let subscriptionId = null;

    if (session) {
      // Use transaction for data consistency
      await session.withTransaction(async () => {
        // Insert user
        const collectionName = userType === 'driver' ? 'drivers' : 'cargo-owners';
        const collection = db.collection(collectionName);
        result = await collection.insertOne(userData, { session });
        
        if (!result.insertedId) {
          throw new Error('Failed to create user in database');
        }

        // Create basic subscription for cargo owners
        if (userType === 'cargo_owner') {
          subscriptionId = await createBasicSubscription(result.insertedId, db);
          
          // Update user with subscription reference
          await collection.updateOne(
            { _id: result.insertedId },
            {
              $set: {
                'cargoOwnerProfile.currentSubscription': subscriptionId,
                currentSubscription: subscriptionId,
                updatedAt: new Date()
              }
            },
            { session }
          );

          console.log('Basic subscription created for cargo owner:', {
            userId: result.insertedId,
            subscriptionId,
            planId: BASIC_PLAN.id
          });
        }
      });
    } else {
      // Fallback without transaction
      const collectionName = userType === 'driver' ? 'drivers' : 'cargo-owners';
      const collection = db.collection(collectionName);
      result = await collection.insertOne(userData);
      
      if (!result.insertedId) {
        throw new Error('Failed to create user in database');
      }

      // Create basic subscription for cargo owners
      if (userType === 'cargo_owner') {
        try {
          subscriptionId = await createBasicSubscription(result.insertedId, db);
          
          // Update user with subscription reference
          await collection.updateOne(
            { _id: result.insertedId },
            {
              $set: {
                'cargoOwnerProfile.currentSubscription': subscriptionId,
                currentSubscription: subscriptionId,
                updatedAt: new Date()
              }
            }
          );

          console.log('Basic subscription created for cargo owner:', {
            userId: result.insertedId,
            subscriptionId,
            planId: BASIC_PLAN.id
          });
        } catch (subscriptionError) {
          console.error('Failed to create basic subscription:', subscriptionError);
          // Don't fail the registration, user can be enrolled later
        }
      }
    }
    
    // Retrieve the created user
    const collectionName = userType === 'driver' ? 'drivers' : 'cargo-owners';
    const collection = db.collection(collectionName);
    const createdUser = await collection.findOne({ _id: result.insertedId });
    
    console.log('User created successfully:', { 
      id: createdUser._id, 
      email: createdUser.email,
      userType: createdUser.userType,
      collection: collectionName,
      subscriptionId: subscriptionId,
      processingTime: `${Date.now() - startTime}ms`
    });

    // Create JWT payload with enhanced security
    const payload = {
      user: {
        id: createdUser._id,
        userType: createdUser.userType,
        email: createdUser.email,
        isVerified: createdUser.isVerified
      }
    };

    // Sign JWT with shorter expiration for better security
    const tokenExpiry = process.env.NODE_ENV === 'production' ? '24h' : '7d';
    const token = jwt.sign(
      payload, 
      process.env.JWT_SECRET, 
      { 
        expiresIn: tokenExpiry,
        issuer: 'infinite-cargo',
        audience: 'infinite-cargo-users'
      }
    );

    // Update user with last login
    await collection.updateOne(
      { _id: result.insertedId },
      { 
        $set: { 
          lastLogin: new Date(),
          updatedAt: new Date()
        },
        $push: {
          loginHistory: {
            date: new Date(),
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            type: 'registration'
          }
        }
      }
    );

    // Prepare response (remove sensitive data)
    const { password: _, loginHistory, registrationIp, ...userResponse } = createdUser;

    // Send welcome email (implement this function separately)
    // await sendWelcomeEmail(createdUser.email, createdUser.name, userType);

    // Create notification for admins about new registration
    try {
      const notificationsCollection = db.collection('notifications');
      await notificationsCollection.insertOne({
        type: 'new_registration',
        title: `New ${userType === 'driver' ? 'Driver' : 'Cargo Owner'} Registration`,
        message: `${createdUser.name} has registered as a ${userType === 'driver' ? 'Driver' : 'Cargo Owner'}`,
        data: {
          userId: createdUser._id,
          userType,
          email: createdUser.email,
          name: createdUser.name,
          ...(subscriptionId && { subscriptionId, planId: BASIC_PLAN.id })
        },
        userType: 'admin',
        isRead: false,
        createdAt: new Date()
      });
    } catch (notificationError) {
      console.error('Failed to create admin notification:', notificationError);
      // Don't fail registration for notification error
    }

    // Prepare success message based on user type
    let successMessage = `Registration successful! Welcome to Infinite Cargo, ${createdUser.name}.`;
    let nextSteps = [];

    if (userType === 'cargo_owner') {
      successMessage += ' You have been automatically enrolled in our Basic plan with 3 free load postings per month.';
      nextSteps = [
        'Complete your business profile', 
        'Post your first cargo load', 
        'Browse our verified drivers',
        'Upgrade to Pro for unlimited postings'
      ];
    } else {
      nextSteps = [
        'Complete your driver profile', 
        'Upload required documents', 
        'Get verified',
        'Start browsing available loads'
      ];
    }

    res.status(201).json({
      status: 'success',
      message: successMessage,
      token,
      user: userResponse,
      nextSteps,
      ...(userType === 'cargo_owner' && subscriptionId && {
        subscription: {
          id: subscriptionId,
          plan: BASIC_PLAN.name,
          status: 'active',
          features: BASIC_PLAN.features,
          expiresAt: new Date(Date.now() + BASIC_PLAN.duration * 24 * 60 * 60 * 1000),
          autoRenew: true
        }
      })
    });

  } catch (error) {
    // Cleanup session if it exists
    if (session) {
      await session.endSession();
    }

    console.error('Registration error:', {
      error: error.message,
      stack: error.stack,
      processingTime: `${Date.now() - startTime}ms`,
      body: sanitizeForLog(req.body)
    });
    
    // Handle specific error types
    if (error.code === 11000) {
      const field = error.message.includes('email') ? 'email' : 'phone';
      return res.status(409).json({
        status: 'error',
        message: `User with this ${field} already exists`,
        field
      });
    }

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      
      return res.status(400).json({
        status: 'error',
        message: 'Database validation failed',
        errors: validationErrors
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(500).json({
        status: 'error',
        message: 'Authentication system error'
      });
    }

    if (error.message.includes('Database connection')) {
      return res.status(503).json({
        status: 'error',
        message: 'Service temporarily unavailable. Please try again later.'
      });
    }

    // Generic server error with request ID for tracking
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during registration',
      errorId,
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        stack: error.stack 
      })
    });
  } finally {
    // Ensure session is closed
    if (session) {
      await session.endSession();
    }
  }
});

// Enhanced login endpoint with better security
router.post('/login', corsHandler, authLimiter, [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('Login request received:', { 
      email: req.body.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      origin: req.headers.origin
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Validation failed',
        errors: errors.array().map(error => ({
          field: error.path || error.param,
          message: error.msg
        }))
      });
    }

    
    const { email, password } = req.body;
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Check both collections for user with parallel queries
    const [driverUser, cargoOwnerUser] = await Promise.all([
      db.collection('drivers').findOne({ email: email.toLowerCase().trim() }),
      db.collection('cargo-owners').findOne({ email: email.toLowerCase().trim() })
    ]);

    const user = driverUser || cargoOwnerUser;
    const userType = driverUser ? 'driver' : cargoOwnerUser ? 'cargo_owner' : null;

    if (!user) {
      console.log('Login failed: User not found for email:', email);
      // Generic error message to prevent email enumeration
      return res.status(401).json({ 
        status: 'error',
        message: 'Invalid credentials' 
      });
    }

    // Check if account is locked
    if (user.accountLocked) {
      console.log('Login failed: Account locked for user:', email);
      return res.status(423).json({
        status: 'error',
        message: 'Account is temporarily locked. Please contact support.'
      });
    }

    // Check password with timing attack protection
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      console.log('Login failed: Invalid password for user:', email);
      
      // Increment failed login attempts
      const collection = db.collection(userType === 'driver' ? 'drivers' : 'cargo-owners');
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      
      await collection.updateOne(
        { _id: user._id },
        { 
          $set: { 
            failedLoginAttempts: failedAttempts,
            accountLocked: failedAttempts >= 5,
            updatedAt: new Date()
          }
        }
      );
      
      return res.status(401).json({ 
        status: 'error',
        message: 'Invalid credentials',
        ...(failedAttempts >= 3 && {
          warning: `${5 - failedAttempts} attempts remaining before account lock`
        })
      });
    }

    // For cargo owners without subscription, create basic subscription
    if (userType === 'cargo_owner' && !user.currentSubscription) {
      try {
        const subscriptionId = await createBasicSubscription(user._id, db);
        
        // Update user with subscription reference
        const collection = db.collection('cargo-owners');
        await collection.updateOne(
          { _id: user._id },
          {
            $set: {
              'cargoOwnerProfile.currentSubscription': subscriptionId,
              currentSubscription: subscriptionId,
              subscriptionPlan: BASIC_PLAN.id,
              subscriptionStatus: 'active',
              subscriptionExpiresAt: new Date(Date.now() + BASIC_PLAN.duration * 24 * 60 * 60 * 1000),
              updatedAt: new Date()
            }
          }
        );

        console.log('Created missing basic subscription for existing cargo owner:', {
          userId: user._id,
          subscriptionId,
          email: user.email
        });
      } catch (subscriptionError) {
        console.error('Failed to create basic subscription for existing user:', subscriptionError);
        // Don't fail login for subscription error
      }
    }

    // Reset failed login attempts on successful login
    const collection = db.collection(userType === 'driver' ? 'drivers' : 'cargo-owners');
    await collection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          failedLoginAttempts: 0,
          accountLocked: false,
          lastLogin: new Date(),
          updatedAt: new Date()
        },
        $push: {
          loginHistory: {
            $each: [{
              date: new Date(),
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              type: 'login'
            }],
            $slice: -10 // Keep only last 10 login records
          }
        }
      }
    );

    console.log('User login successful:', { 
      id: user._id, 
      email: user.email,
      userType,
      collection: userType === 'driver' ? 'drivers' : 'cargo-owners',
      processingTime: `${Date.now() - startTime}ms`
    });

    // Create JWT payload
    const payload = {
      user: {
        id: user._id,
        userType: userType,
        email: user.email,
        isVerified: user.isVerified
      }
    };

    // Sign JWT
    const tokenExpiry = process.env.NODE_ENV === 'production' ? '24h' : '7d';
    const token = jwt.sign(
      payload, 
      process.env.JWT_SECRET, 
      { 
        expiresIn: tokenExpiry,
        issuer: 'infinite-cargo',
        audience: 'infinite-cargo-users'
      }
    );

    // Remove sensitive data from response
    const { password: _, loginHistory, registrationIp, failedLoginAttempts, ...userResponse } = user;
    userResponse.userType = userType;

    res.json({
      status: 'success',
      message: `Welcome back, ${user.name}!`,
      token,
      user: userResponse,
      sessionExpiry: new Date(Date.now() + (process.env.NODE_ENV === 'production' ? 24*60*60*1000 : 7*24*60*60*1000))
    });

  } catch (error) {
    console.error('Login error:', {
      error: error.message,
      stack: error.stack,
      processingTime: `${Date.now() - startTime}ms`,
      email: req.body.email
    });
    
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during login',
      errorId,
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// Enhanced current user endpoint with subscription check
router.get('/me', corsHandler, auth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    const [driverUser, cargoOwnerUser] = await Promise.all([
      db.collection('drivers').findOne({ _id: new mongoose.Types.ObjectId(req.user.id) }),
      db.collection('cargo-owners').findOne({ _id: new mongoose.Types.ObjectId(req.user.id) })
    ]);
    
    const user = driverUser || cargoOwnerUser;
    const userType = driverUser ? 'driver' : cargoOwnerUser ? 'cargo_owner' : null;
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // For cargo owners, ensure they have a basic subscription
    if (userType === 'cargo_owner' && !user.currentSubscription) {
      try {
        const subscriptionId = await createBasicSubscription(user._id, db);
        
        // Update user with subscription reference
        const collection = db.collection('cargo-owners');
        await collection.updateOne(
          { _id: user._id },
          {
            $set: {
              'cargoOwnerProfile.currentSubscription': subscriptionId,
              currentSubscription: subscriptionId,
              subscriptionPlan: BASIC_PLAN.id,
              subscriptionStatus: 'active',
              subscriptionExpiresAt: new Date(Date.now() + BASIC_PLAN.duration * 24 * 60 * 60 * 1000),
              updatedAt: new Date()
            }
          }
        );

        // Update user object for response
        user.currentSubscription = subscriptionId;
        user.subscriptionPlan = BASIC_PLAN.id;
        user.subscriptionStatus = 'active';

        console.log('Created missing basic subscription for user:', {
          userId: user._id,
          subscriptionId
        });
      } catch (subscriptionError) {
        console.error('Failed to create basic subscription:', subscriptionError);
      }
    }
    
    // Remove sensitive data and add computed fields
    const { password, loginHistory, registrationIp, failedLoginAttempts, ...userResponse } = user;
    userResponse.userType = userType;
    userResponse.memberSince = user.createdAt;
    userResponse.profileCompleteness = calculateProfileCompleteness(user, userType);
    
    res.json({
      status: 'success',
      user: userResponse
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// Helper function to calculate profile completeness
function calculateProfileCompleteness(user, userType) {
  let completeness = 0;
  const fields = ['name', 'email', 'phone', 'location'];
  
  fields.forEach(field => {
    if (user[field]) completeness += 20;
  });
  
  if (user.isVerified) completeness += 20;
  
  return Math.min(completeness, 100);
}

module.exports = router;