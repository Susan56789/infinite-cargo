// routes/trucks.js - Truck/Vehicle Management Routes
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const corsHandler = require('../middleware/corsHandler');

// Rate limiting
const truckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  }
});



// Vehicle validation middleware
const vehicleValidation = [
  body('vehicleType')
    .isIn([
      'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck',
      'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
    ])
    .withMessage('Invalid vehicle type'),
    
  body('make')
    .trim()
    .notEmpty()
    .withMessage('Vehicle make is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Make must be between 2 and 50 characters'),
    
  body('model')
    .trim()
    .notEmpty()
    .withMessage('Vehicle model is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Model must be between 2 and 50 characters'),
    
  body('year')
    .isInt({ min: 1990, max: new Date().getFullYear() + 1 })
    .withMessage(`Year must be between 1990 and ${new Date().getFullYear() + 1}`),
    
  body('licensePlate')
    .trim()
    .notEmpty()
    .withMessage('License plate is required')
    .matches(/^[A-Z0-9\s-]+$/i)
    .withMessage('License plate format is invalid'),
    
  body('capacity')
    .isFloat({ min: 0.1 })
    .withMessage('Capacity must be at least 0.1 tonnes'),
    
  body('insuranceExpiryDate')
    .optional()
    .isISO8601()
    .withMessage('Insurance expiry date must be a valid date'),
    
  body('roadworthinessExpiryDate')
    .optional()
    .isISO8601()
    .withMessage('Roadworthiness expiry date must be a valid date')
];

// @route   POST /api/trucks
// @desc    Register a new vehicle
// @access  Private (Driver only)
router.post('/', corsHandler, auth, truckLimiter, vehicleValidation, async (req, res) => {
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
        message: 'Only drivers can register vehicles'
      });
    }

    const {
      vehicleType, make, model, year, licensePlate, capacity,
      color, engineNumber, chassisNumber, fuelType,
      insuranceProvider, insuranceExpiryDate, insurancePolicyNumber,
      roadworthinessExpiryDate, roadworthinessCertNumber,
      specialFeatures, description
    } = req.body;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Check if license plate already exists
    const trucksCollection = db.collection('trucks');
    const existingTruck = await trucksCollection.findOne({
      licensePlate: licensePlate.toUpperCase().trim(),
      isActive: true
    });

    if (existingTruck) {
      return res.status(409).json({
        status: 'error',
        message: 'A vehicle with this license plate is already registered'
      });
    }

    // Create vehicle data
    const vehicleData = {
      ownerId: new mongoose.Types.ObjectId(req.user.id),
      vehicleType,
      make: make.trim(),
      model: model.trim(),
      year,
      licensePlate: licensePlate.toUpperCase().trim(),
      capacity,
      color: color?.trim(),
      engineNumber: engineNumber?.trim(),
      chassisNumber: chassisNumber?.trim(),
      fuelType: fuelType || 'diesel',
      
      // Insurance details
      insurance: {
        provider: insuranceProvider?.trim(),
        policyNumber: insurancePolicyNumber?.trim(),
        expiryDate: insuranceExpiryDate ? new Date(insuranceExpiryDate) : null,
        isValid: insuranceExpiryDate ? new Date(insuranceExpiryDate) > new Date() : false
      },
      
      // Roadworthiness details
      roadworthiness: {
        certificateNumber: roadworthinessCertNumber?.trim(),
        expiryDate: roadworthinessExpiryDate ? new Date(roadworthinessExpiryDate) : null,
        isValid: roadworthinessExpiryDate ? new Date(roadworthinessExpiryDate) > new Date() : false
      },
      
      // Additional details
      specialFeatures: specialFeatures || [],
      description: description?.trim(),
      
      // Status and verification
      isActive: true,
      isVerified: false,
      verificationStatus: 'pending',
      
      // Operational status
      isAvailable: true,
      currentLocation: null,
      lastMaintenanceDate: null,
      nextMaintenanceDate: null,
      
      // Statistics
      totalTrips: 0,
      totalDistanceKm: 0,
      
      // System fields
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user.id
    };

    // Insert vehicle
    const result = await trucksCollection.insertOne(vehicleData);

    if (!result.insertedId) {
      throw new Error('Failed to register vehicle');
    }

    // Update driver's vehicle information
    const driversCollection = db.collection('drivers');
    await driversCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(req.user.id) },
      {
        $set: {
          vehicleType,
          vehicleCapacity: capacity,
          'driverProfile.hasVehicle': true,
          updatedAt: new Date()
        }
      }
    );

    // Get the created vehicle
    const createdVehicle = await trucksCollection.findOne({ _id: result.insertedId });

    res.status(201).json({
      status: 'success',
      message: 'Vehicle registered successfully',
      data: {
        vehicle: createdVehicle
      }
    });

  } catch (error) {
    console.error('Register vehicle error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error registering vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/trucks
// @desc    Get vehicles (driver gets own vehicles, public can search available)
// @access  Public/Private
router.get('/', corsHandler, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('vehicleType').optional().isIn([
    'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck',
    'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
  ]),
  query('minCapacity').optional().isFloat({ min: 0 }),
  query('maxCapacity').optional().isFloat({ min: 0 }),
  query('location').optional().trim(),
  query('isAvailable').optional().isBoolean()
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
      vehicleType,
      minCapacity,
      maxCapacity,
      location,
      isAvailable
    } = req.query;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const trucksCollection = db.collection('trucks');

    let query = { isActive: true };

    // If user is authenticated and is a driver, show only their vehicles
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
    let userId = null;
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.user.id;
        
        // If authenticated driver, show only their vehicles
        if (decoded.user.userType === 'driver') {
          query.ownerId = new mongoose.Types.ObjectId(userId);
        }
      } catch (error) {
        // Token invalid, continue as public search
      }
    }

    // If not authenticated or not a driver, show only available verified vehicles
    if (!userId || !token) {
      query.isAvailable = true;
      query.isVerified = true;
    }

    // Apply filters
    if (vehicleType) {
      query.vehicleType = vehicleType;
    }

    if (minCapacity || maxCapacity) {
      query.capacity = {};
      if (minCapacity) query.capacity.$gte = parseFloat(minCapacity);
      if (maxCapacity) query.capacity.$lte = parseFloat(maxCapacity);
    }

    if (location) {
      // Join with drivers collection to filter by location
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'drivers',
            localField: 'ownerId',
            foreignField: '_id',
            as: 'owner'
          }
        },
        {
          $match: {
            'owner.location': new RegExp(location, 'i')
          }
        },
        {
          $project: {
            'owner.password': 0,
            'owner.loginHistory': 0,
            'owner.registrationIp': 0
          }
        }
      ];

      // Add pagination to pipeline
      const skip = (parseInt(page) - 1) * parseInt(limit);
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: parseInt(limit) });

      const vehicles = await trucksCollection.aggregate(pipeline).toArray();
      const totalVehicles = await trucksCollection.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'drivers',
            localField: 'ownerId',
            foreignField: '_id',
            as: 'owner'
          }
        },
        {
          $match: {
            'owner.location': new RegExp(location, 'i')
          }
        },
        { $count: 'total' }
      ]).toArray();

      const total = totalVehicles[0]?.total || 0;
      const totalPages = Math.ceil(total / parseInt(limit));

      return res.json({
        status: 'success',
        data: {
          vehicles,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalVehicles: total,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1
          }
        }
      });
    }

    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    // Regular query without location filter
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const vehicles = await trucksCollection.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const totalVehicles = await trucksCollection.countDocuments(query);
    const totalPages = Math.ceil(totalVehicles / parseInt(limit));

    // Populate owner information for public searches
    if (!userId || !token) {
      const driversCollection = db.collection('drivers');
      for (let vehicle of vehicles) {
        const owner = await driversCollection.findOne(
          { _id: vehicle.ownerId },
          {
            projection: {
              name: 1,
              location: 1,
              phone: 1,
              email: 1,
              'driverProfile.rating': 1,
              'driverProfile.totalTrips': 1,
              'driverProfile.isVerified': 1
            }
          }
        );
        vehicle.owner = owner;
      }
    }

    res.json({
      status: 'success',
      data: {
        vehicles,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalVehicles,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        filters: {
          vehicleType,
          capacityRange: { min: minCapacity, max: maxCapacity },
          location,
          isAvailable
        }
      }
    });

  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching vehicles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/trucks/:id
// @desc    Get single vehicle by ID
// @access  Public/Private
router.get('/:id', corsHandler, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid vehicle ID'
      });
    }

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const trucksCollection = db.collection('trucks');

    const vehicle = await trucksCollection.findOne({ _id: new mongoose.Types.ObjectId(id) });

    if (!vehicle) {
      return res.status(404).json({
        status: 'error',
        message: 'Vehicle not found'
      });
    }

    // Get owner information
    const driversCollection = db.collection('drivers');
    const owner = await driversCollection.findOne(
      { _id: vehicle.ownerId },
      {
        projection: {
          name: 1,
          location: 1,
          phone: 1,
          email: 1,
          'driverProfile.rating': 1,
          'driverProfile.totalTrips': 1,
          'driverProfile.isVerified': 1,
          'driverProfile.experienceYears': 1
        }
      }
    );

    // Check if current user is the owner
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
    let isOwner = false;

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        isOwner = decoded.user.id === vehicle.ownerId.toString();
      } catch (error) {
        // Token invalid
      }
    }

    // Hide sensitive information if not owner
    if (!isOwner) {
      delete vehicle.engineNumber;
      delete vehicle.chassisNumber;
      delete vehicle.insurance?.policyNumber;
      delete vehicle.roadworthiness?.certificateNumber;
    }

    vehicle.owner = owner;

    res.json({
      status: 'success',
      data: {
        vehicle,
        isOwner
      }
    });

  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;