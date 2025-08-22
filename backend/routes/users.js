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
const nodemailer = require('nodemailer');
const crypto = require('crypto');

router.use(corsHandler);


// Gmail transporter configuration
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_EMAIL, // Your Gmail address
      pass: process.env.GMAIL_APP_PASSWORD // Your Gmail App Password (not regular password)
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Rate limiting for password reset requests
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 reset requests per windowMs
  message: {
    status: 'error',
    message: 'Too many password reset requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

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
    maxLoads: 1,
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
router.post('/register',  authLimiter, registrationValidation, async (req, res) => {
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
router.post('/login',  authLimiter, [
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
router.get('/me',  auth, async (req, res) => {
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

// Add these endpoints to your routes/users.js file after the existing forgot-password endpoint

// @route   POST /api/users/verify-reset-code
// @desc    Verify password reset code
// @access  Public
router.post('/verify-reset-code', corsHandler, [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('code')
    .trim()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Please provide a valid 6-digit verification code')
], async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('Reset code verification request received:', {
      email: req.body.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
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

    const { email, code } = req.body;
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Check both collections for user with valid reset code
    const [driverUser, cargoOwnerUser] = await Promise.all([
      db.collection('drivers').findOne({
        email: email.toLowerCase().trim(),
        passwordResetCode: code,
        passwordResetExpires: { $gt: new Date() }
      }),
      db.collection('cargo-owners').findOne({
        email: email.toLowerCase().trim(),
        passwordResetCode: code,
        passwordResetExpires: { $gt: new Date() }
      })
    ]);

    const user = driverUser || cargoOwnerUser;
    const userType = driverUser ? 'driver' : cargoOwnerUser ? 'cargo_owner' : null;

    if (!user) {
      console.log('Invalid reset code verification attempt:', {
        email,
        code,
        processingTime: `${Date.now() - startTime}ms`
      });
      
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired verification code'
      });
    }

    // Generate a secure reset token for password change
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Hash the token before storing
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Update user with reset token and mark code as verified
    const collection = db.collection(userType === 'driver' ? 'drivers' : 'cargo-owners');
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetToken: hashedResetToken,
          passwordResetExpires: resetTokenExpiry,
          resetCodeVerified: true,
          resetCodeVerifiedAt: new Date(),
          updatedAt: new Date()
        },
        $unset: {
          passwordResetCode: "", // Remove the code once verified
          passwordResetCodeExpires: ""
        }
      }
    );

    console.log('Reset code verified successfully:', {
      userId: user._id,
      email: user.email,
      userType,
      processingTime: `${Date.now() - startTime}ms`
    });

    res.json({
      status: 'success',
      message: 'Verification code confirmed successfully',
      resetToken: resetToken, // Send the unhashed token to the client
      email: user.email,
      expiresIn: '15 minutes'
    });

  } catch (error) {
    console.error('Verify reset code error:', {
      error: error.message,
      stack: error.stack,
      email: req.body.email,
      processingTime: `${Date.now() - startTime}ms`
    });

    res.status(500).json({
      status: 'error',
      message: 'Unable to verify reset code. Please try again later.'
    });
  }
});

// Enhanced forgot-password endpoint to send verification codes instead of links
router.post(
  '/forgot-password-code',
  corsHandler,
  resetPasswordLimiter,
  [
    body('email')
      .trim()
      .normalizeEmail()
      .isEmail()
      .withMessage('Please provide a valid email address')
  ],
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { email } = req.body;
      

      // Validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array().map(err => ({
            field: err.path || err.param,
            message: err.msg
          }))
        });
      }

      // Ensure DB is connected
      if (!mongoose.connection?.db) {
        console.error('MongoDB not connected at forgot-password-code route');
        return res.status(500).json({
          status: 'error',
          message: 'Database not available, please try again later.'
        });
      }

      const db = mongoose.connection.db;

      // Search in both collections
      const [driverUser, cargoOwnerUser] = await Promise.all([
        db.collection('drivers').findOne({ email: email.toLowerCase().trim() }),
        db.collection('cargo-owners').findOne({ email: email.toLowerCase().trim() })
      ]);

      const user = driverUser || cargoOwnerUser;
      const userType = driverUser ? 'driver' : cargoOwnerUser ? 'cargo_owner' : null;

      if (user) {
        // Generate code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

        // Update user record
        const collection = db.collection(userType === 'driver' ? 'drivers' : 'cargo-owners');
        await collection.updateOne(
          { _id: user._id },
          {
            $set: {
              passwordResetCode: resetCode,
              passwordResetCodeExpires: resetCodeExpiry,
              passwordResetRequestedAt: new Date(),
              resetCodeVerified: false,
              updatedAt: new Date()
            },
            $unset: {
              passwordResetToken: '',
              passwordResetExpires: '',
              resetCodeVerifiedAt: ''
            }
          }
        );

        // Send email (wrapped in try/catch so it doesn't crash whole route)
        try {
          await sendPasswordResetCodeEmail(user.email, user.name, resetCode, userType);
          
        } catch (mailErr) {
          console.error('Email sending failed:', mailErr);
          // Don’t expose email issues to client, still return success
        }
      } else {
        console.log('Password reset requested for non-existent email:', email);
      }

      // Always return success
      res.json({
        status: 'success',
        message:
          'If an account with that email exists, a 6-digit verification code has been sent.',
        expiresIn: '10 minutes'
      });
    } catch (error) {
      console.error('Forgot password code error:', {
        error: error.message,
        stack: error.stack,
        email: req.body.email,
        processingTime: `${Date.now() - startTime}ms`
      });

      res.status(500).json({
        status: 'error',
        message: 'Unable to process password reset request. Please try again later.'
      });
    }
  }
);



// Helper function to send password reset code email
async function sendPasswordResetCodeEmail(email, name, code, userType) {
  try {
    const transporter = createEmailTransporter();
    
    const mailOptions = {
      from: `"Infinite Cargo" <${process.env.GMAIL_EMAIL}>`,
      to: email,
      subject: '🔐 Your Infinite Cargo Password Reset Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Code</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255, 255, 255, 0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <div style="color: white; font-size: 36px; font-weight: bold;">🔐</div>
              </div>
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Password Reset Code</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0; font-size: 16px;">Secure your Infinite Cargo account</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 24px; font-weight: 600;">Hello ${name}!</h2>
              
              <p style="color: #64748b; line-height: 1.6; margin: 0 0 25px; font-size: 16px;">
                We received a request to reset your password for your Infinite Cargo ${userType === 'driver' ? 'Driver' : 'Cargo Owner'} account.
              </p>

              <p style="color: #64748b; line-height: 1.6; margin: 0 0 30px; font-size: 16px;">
                Use the verification code below to proceed with your password reset:
              </p>

              <!-- Verification Code -->
              <div style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; border: 2px dashed #cbd5e1;">
                <p style="color: #475569; margin: 0 0 15px; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; display: inline-block; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                  <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; color: #1e40af; letter-spacing: 8px;">${code}</span>
                </div>
                <p style="color: #64748b; margin: 15px 0 0; font-size: 12px;">This code expires in 10 minutes</p>
              </div>

              <!-- Instructions -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
                <h3 style="color: #92400e; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Next Steps:</h3>
                <ol style="color: #92400e; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                  <li>Go back to the password reset page</li>
                  <li>Enter this 6-digit verification code</li>
                  <li>Create your new secure password</li>
                  <li>Sign in with your new password</li>
                </ol>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="color: #dc2626; margin: 0 0 10px; font-size: 16px; font-weight: 600;">🛡️ Security Notice</h3>
                <p style="color: #dc2626; margin: 0; font-size: 14px; line-height: 1.5;">
                  If you did not request this password reset, please ignore this email and contact our support team immediately. 
                  Your account security is important to us.
                </p>
              </div>

              <!-- Support -->
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #64748b; margin: 0 0 15px; font-size: 14px;">
                  Need help? Contact our support team
                </p>
                <a href="mailto:support@infinitecargo.co.ke" style="color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 14px;">
                  support@infinitecargo.co.ke
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <div style="margin-bottom: 20px;">
                <h3 style="color: #1e293b; margin: 0 0 10px; font-size: 18px; font-weight: 700;">Infinite Cargo</h3>
                <p style="color: #64748b; margin: 0; font-size: 14px;">Connecting Kenya, One Load at a Time</p>
              </div>
              
              <div style="margin-bottom: 20px;">
                <a href="https://infinitecargo.co.ke" style="color: #3b82f6; text-decoration: none; margin: 0 15px; font-size: 14px;">Website</a>
                <a href="mailto:support@infinitecargo.co.ke" style="color: #3b82f6; text-decoration: none; margin: 0 15px; font-size: 14px;">Support</a>
                <a href="tel:+254700000000" style="color: #3b82f6; text-decoration: none; margin: 0 15px; font-size: 14px;">Call Us</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
                This is an automated message. Please do not reply to this email.<br>
                © 2024 Infinite Cargo. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Password reset code email sent successfully to:', email);
    
  } catch (error) {
    console.error('Failed to send password reset code email:', error);
    throw error;
  }
}
// @route   POST /api/users/reset-password
// @desc    Reset password with token
// @access  Public

router.post('/reset-password', corsHandler, [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
], async (req, res) => {
  const startTime = Date.now();

  try {
    console.log('Password reset submission received:', {
      email: req.body.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
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

    const { token, email, password } = req.body;
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Hash the provided token to match stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token and verified code
    const [driverUser, cargoOwnerUser] = await Promise.all([
      db.collection('drivers').findOne({
        email: email.toLowerCase().trim(),
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
        resetCodeVerified: true
      }),
      db.collection('cargo-owners').findOne({
        email: email.toLowerCase().trim(),
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
        resetCodeVerified: true
      })
    ]);

    const user = driverUser || cargoOwnerUser;
    const userType = driverUser ? 'driver' : cargoOwnerUser ? 'cargo_owner' : null;

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token, or verification code not confirmed'
      });
    }

    // Hash new password
    const saltRounds = process.env.NODE_ENV === 'production' ? 14 : 12;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user with new password and clear all reset-related fields
    const collection = db.collection(userType === 'driver' ? 'drivers' : 'cargo-owners');
    await collection.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
          passwordChangedAt: new Date()
        },
        $unset: {
          passwordResetToken: "",
          passwordResetExpires: "",
          passwordResetRequestedAt: "",
          resetCodeVerified: "",
          resetCodeVerifiedAt: "",
          passwordResetCode: "",
          passwordResetCodeExpires: ""
        }
      }
    );

    // Send password change confirmation email
    await sendPasswordChangeConfirmationEmail(user.email, user.name, userType);

    console.log('Password reset completed successfully:', {
      userId: user._id,
      email: user.email,
      userType,
      processingTime: `${Date.now() - startTime}ms`
    });

    res.json({
      status: 'success',
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', {
      error: error.message,
      stack: error.stack,
      email: req.body.email,
      processingTime: `${Date.now() - startTime}ms`
    });

    res.status(500).json({
      status: 'error',
      message: 'Unable to reset password. Please try again later.'
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