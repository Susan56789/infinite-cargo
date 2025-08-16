// middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: extractedErrors
    });
  }
  
  next();
};

// User validation rules
const validateUserRegistration = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('phone')
    .matches(/^(\+254|0)[17]\d{8}$/)
    .withMessage('Please provide a valid Kenyan phone number'),
  
  body('role')
    .isIn(['shipper', 'carrier'])
    .withMessage('Role must be either shipper or carrier'),
  
  handleValidationErrors
];

const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

const validatePasswordReset = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  handleValidationErrors
];

const validateNewPassword = [
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  handleValidationErrors
];

// Truck validation rules
const validateTruck = [
  body('make')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Make must be between 2 and 50 characters'),
  
  body('model')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Model must be between 2 and 50 characters'),
  
  body('year')
    .isInt({ min: 1990, max: new Date().getFullYear() + 1 })
    .withMessage(`Year must be between 1990 and ${new Date().getFullYear() + 1}`),
  
  body('licensePlate')
    .matches(/^K[A-Z]{2}\s?\d{3}[A-Z]$/)
    .withMessage('Please provide a valid Kenyan license plate (e.g., KAA 123A)'),
  
  body('type')
    .isIn(['flatbed', 'box', 'refrigerated', 'tanker', 'lowboy', 'container', 'tipper'])
    .withMessage('Invalid truck type'),
  
  body('capacity.weight')
    .isFloat({ min: 1 })
    .withMessage('Weight capacity must be at least 1 ton'),
  
  body('capacity.volume')
    .isFloat({ min: 1 })
    .withMessage('Volume capacity must be at least 1 cubic meter'),
  
  body('dimensions.length')
    .isFloat({ min: 1 })
    .withMessage('Length must be at least 1 meter'),
  
  body('dimensions.width')
    .isFloat({ min: 1 })
    .withMessage('Width must be at least 1 meter'),
  
  body('dimensions.height')
    .isFloat({ min: 1 })
    .withMessage('Height must be at least 1 meter'),
  
  handleValidationErrors
];

// Load validation rules
const validateLoad = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  
  body('cargo.type')
    .isIn(['general', 'food', 'electronics', 'automotive', 'construction', 'chemicals', 'textiles', 'machinery', 'medical', 'hazardous'])
    .withMessage('Invalid cargo type'),
  
  body('cargo.weight')
    .isFloat({ min: 0.1 })
    .withMessage('Weight must be at least 0.1 tons'),
  
  body('cargo.volume')
    .isFloat({ min: 0.1 })
    .withMessage('Volume must be at least 0.1 cubic meters'),
  
  body('cargo.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  
  body('cargo.unit')
    .isIn(['pieces', 'boxes', 'pallets', 'containers', 'bags', 'tons', 'liters'])
    .withMessage('Invalid unit'),
  
  body('pickup.address')
    .trim()
    .isLength({ min: 5 })
    .withMessage('Pickup address is required'),
  
  body('pickup.city')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Pickup city is required'),
  
  body('pickup.contactPerson.name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Pickup contact name is required'),
  
  body('pickup.contactPerson.phone')
    .matches(/^(\+254|0)[17]\d{8}$/)
    .withMessage('Please provide a valid Kenyan phone number for pickup contact'),
  
  body('pickup.dateTime.preferred')
    .isISO8601()
    .withMessage('Please provide a valid pickup date'),
  
  body('delivery.address')
    .trim()
    .isLength({ min: 5 })
    .withMessage('Delivery address is required'),
  
  body('delivery.city')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Delivery city is required'),
  
  body('delivery.contactPerson.name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Delivery contact name is required'),
  
  body('delivery.contactPerson.phone')
    .matches(/^(\+254|0)[17]\d{8}$/)
    .withMessage('Please provide a valid Kenyan phone number for delivery contact'),
  
  body('delivery.dateTime.preferred')
    .isISO8601()
    .withMessage('Please provide a valid delivery date'),
  
  body('budget.amount')
    .isFloat({ min: 1000 })
    .withMessage('Budget must be at least KES 1,000'),
  
  body('timeline.biddingDeadline')
    .isISO8601()
    .withMessage('Please provide a valid bidding deadline'),
  
  handleValidationErrors
];

// Bid validation rules
const validateBid = [
  body('amount')
    .isFloat({ min: 500 })
    .withMessage('Bid amount must be at least KES 500'),
  
  body('proposal.message')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Proposal message must be between 10 and 1000 characters'),
  
  body('proposal.estimatedPickupTime')
    .isISO8601()
    .withMessage('Please provide a valid estimated pickup time'),
  
  body('proposal.estimatedDeliveryTime')
    .isISO8601()
    .withMessage('Please provide a valid estimated delivery time'),
  
  body('proposal.route')
    .trim()
    .isLength({ min: 5 })
    .withMessage('Route description is required'),
  
  body('validUntil')
    .isISO8601()
    .withMessage('Please provide a valid bid expiry date'),
  
  handleValidationErrors
];

// Parameter validation
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  
  handleValidationErrors
];

// Query validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  query('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),
  
  query('type')
    .optional()
    .isIn(['flatbed', 'box', 'refrigerated', 'tanker', 'lowboy', 'container', 'tipper'])
    .withMessage('Invalid truck type'),
  
  handleValidationErrors
];

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      status: 'error',
      message: 'No file uploaded'
    });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  const files = req.files || [req.file];
  
  for (const file of files) {
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid file type. Only JPEG, PNG, and PDF files are allowed.'
      });
    }

    if (file.size > maxSize) {
      return res.status(400).json({
        status: 'error',
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
  }

  next();
};

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validatePasswordReset,
  validateNewPassword,
  validateTruck,
  validateLoad,
  validateBid,
  validateObjectId,
  validatePagination,
  validateSearch,
  validateFileUpload,
  handleValidationErrors
};