const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const Admin = require('../models/admin');
const Load = require('../models/load');
const { adminAuth } = require('../middleware/adminAuth');
const { Subscription } = require('../models/subscription');
const corsHandler = require('../middleware/corsHandler');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');


// Apply CORS middleware
router.use(corsHandler);

// Gmail transporter configuration
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_EMAIL, 
      pass: process.env.GMAIL_APP_PASSWORD 
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Helper function for default permissions
function getDefaultPermissions(role) {
  const permissions = {
    admin: {
      viewUsers: true,
      editUsers: true,
      viewLoads: true,
      editLoads: true,
      viewSubscriptions: true,
      approveSubscriptions: true,
      viewReports: true,
      systemSettings: false
    },
    moderator: {
      viewUsers: true,
      editUsers: false,
      viewLoads: true,
      editLoads: false,
      viewSubscriptions: true,
      approveSubscriptions: false,
      viewReports: false,
      systemSettings: false
    },
    super_admin: {
      viewUsers: true,
      editUsers: true,
      viewLoads: true,
      editLoads: true,
      viewSubscriptions: true,
      approveSubscriptions: true,
      viewReports: true,
      systemSettings: true,
      createAdmins: true,
      deleteAdmins: true
    }
  };

  return permissions[role] || permissions.admin;
}

// @route   POST /api/admin/register
// @desc    Register new admin (Super Admin only)
// @access  Private
router.post('/register',adminAuth, [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .normalizeEmail({ gmail_remove_dots: false })
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('phone')
    .trim()
    .matches(/^(\+254|0)[0-9]{9}$/)
    .withMessage('Please provide a valid Kenyan phone number'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('role')
    .isIn(['admin', 'moderator', 'super_admin'])
    .withMessage('Role must be admin, moderator, or super_admin')
], async (req, res) => {
  try {
    console.log('Admin registration request:', {
      email: req.body.email,
      role: req.body.role,
      requestedBy: req.admin.id
    });

    // Check if requesting admin is super_admin
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Only super admins can create new admins'
      });
    }

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

    const { name, email, phone, password, role } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { phone: phone.trim() }
      ]
    });

    if (existingAdmin) {
      return res.status(400).json({
        status: 'error',
        message: 'Admin with this email or phone already exists'
      });
    }

    // Create new admin with hashed password
    const newAdmin = new Admin({
  name: name.trim(),
  email: email.toLowerCase().trim(),
  phone: phone.trim(),
  password: password, 
  role,
  permissions: getDefaultPermissions(role),
  isActive: true,
  createdBy: req.admin.id
});

await newAdmin.save();

    // Log audit trail
    try {
      const db = require('mongoose').connection.db;
      const auditLogsCollection = db.collection('audit_logs');
      
      await auditLogsCollection.insertOne({
        action: 'admin_created',
        entityType: 'admin',
        entityId: new require('mongoose').Types.ObjectId(newAdmin._id),
        adminId: new require('mongoose').Types.ObjectId(req.admin.id),
        adminName: req.admin.name,
        adminEmail: req.admin.email,
        details: {
          newAdminEmail: newAdmin.email,
          newAdminRole: newAdmin.role,
          newAdminName: newAdmin.name
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        createdAt: new Date()
      });
    } catch (auditError) {
      console.warn('Audit log failed:', auditError);
    }

    console.log('Admin created successfully:', {
      id: newAdmin._id,
      email: newAdmin.email,
      role: newAdmin.role
    });

    res.status(201).json({
      status: 'success',
      message: 'Admin created successfully',
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        phone: newAdmin.phone,
        role: newAdmin.role,
        permissions: newAdmin.permissions,
        isActive: newAdmin.isActive,
        createdAt: newAdmin.createdAt
      }
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during admin creation',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});


// @route   POST /api/admin/login
// @desc    Admin login
// @access  Public
router.post('/login', [
  body('email')
  .trim()
  .normalizeEmail({ gmail_remove_dots: false })
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    console.log('Admin login request received:', { 
      email: req.body.email,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']
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

    // Check if admin exists
    const admin = await Admin.findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true 
    }).select('+password');

    console.log("ADMIN = ", admin);
    
    if (!admin) {
      console.log('Admin login failed: Admin not found or inactive for email:', email);
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid credentials or account is disabled' 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      console.log('Admin login failed: Invalid password for admin:', email);
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid credentials' 
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    console.log('Admin login successful:', { id: admin._id, email: admin.email, role: admin.role });
    try {
      const db = mongoose.connection.db;
      const auditLogsCollection = db.collection('audit_logs');

      await auditLogsCollection.insertOne({
        action: 'admin_login',   
        entityType: 'admin',         
        entityId: new mongoose.Types.ObjectId(admin._id),
        adminId: new mongoose.Types.ObjectId(admin._id),
        adminName: admin.name,
        adminEmail: admin.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        createdAt: new Date()
      });
    } catch (auditError) {
      console.warn('Audit log failed:', auditError);
      // Don't fail login if audit log fails
    }

    // Create JWT payload
    const payload = {
      admin: {
        id: admin._id,
        role: admin.role,
        permissions: admin.permissions
      }
    };

    // Sign JWT with admin secret (use different secret for admin)
    const token = jwt.sign(
      payload, 
      process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET, 
      { expiresIn: '8h' } // Shorter expiry for admin sessions
    );

    res.json({
      status: 'success',
      message: 'Admin login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        permissions: admin.permissions,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during admin login',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// @route   POST /api/admin/forgot-password
// @desc    Send password reset code to admin email
// @access  Public
router.post('/forgot-password', [
  body('email')
    .trim()
    .normalizeEmail({ gmail_remove_dots: false })
    .isEmail()
    .withMessage('Please provide a valid email address')
], async (req, res) => {
  const startTime = Date.now();

  try {
    console.log('Admin password reset request received:', {
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

    const { email } = req.body;

    // Find admin by email (only active admins)
    const admin = await Admin.findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true 
    });

    if (admin) {
      // Generate 6-digit code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const resetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Update admin record with reset code
      await Admin.updateOne(
        { _id: admin._id },
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

      console.log('Admin reset code stored:', {
        adminId: admin._id,
        code: resetCode,
        expiresAt: resetCodeExpiry,
        email: admin.email
      });

      // Send email
      try {
        await sendAdminPasswordResetCodeEmail(admin.email, admin.name, resetCode);
        console.log('Admin password reset email sent successfully');
      } catch (mailErr) {
        console.error('Failed to send admin password reset email:', mailErr);
        // Continue execution - don't fail the request if email fails
      }

      // Log audit trail
      try {
        const db = mongoose.connection.db;
        const auditLogsCollection = db.collection('audit_logs');

        await auditLogsCollection.insertOne({
          action: 'admin_password_reset_requested',
          entityType: 'admin',
          entityId: new mongoose.Types.ObjectId(admin._id),
          adminId: new mongoose.Types.ObjectId(admin._id),
          adminName: admin.name,
          adminEmail: admin.email,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          createdAt: new Date()
        });
      } catch (auditError) {
        console.warn('Audit log failed for admin password reset:', auditError);
      }

      res.json({
        status: 'success',
        message: 'A 6-digit verification code has been sent to your email address.',
        expiresIn: '10 minutes'
      });
    } else {
      console.log('Admin password reset requested for non-existent/inactive email:', email);
      
      // Return specific message for non-existent admin
      return res.status(404).json({
        status: 'error',
        message: 'No active admin account found with this email address.',
        suggestion: 'Please verify your email address or contact a super admin.'
      });
    }
  } catch (error) {
    console.error('Admin forgot password error:', {
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
});

// @route   POST /api/admin/verify-reset-code
// @desc    Verify admin password reset code
// @access  Public
router.post('/verify-reset-code', [
  body('email')
    .trim()
    .normalizeEmail({ gmail_remove_dots: false })
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
    console.log('Admin reset code verification request received:', {
      email: req.body.email,
      code: req.body.code,
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

    // Find admin with valid reset code
    const admin = await Admin.findOne({
      email: email.toLowerCase().trim(),
      passwordResetCode: code.toString(),
      passwordResetCodeExpires: { $gt: new Date() },
      isActive: true
    });

    console.log('Admin database query results:', {
      email: email.toLowerCase().trim(),
      code: code.toString(),
      adminFound: !!admin,
      currentTime: new Date()
    });

    // Debug logging for failed verification
    if (!admin) {
      const adminAny = await Admin.findOne({ email: email.toLowerCase().trim() });
      if (adminAny) {
        console.log('Admin found but code verification failed:', {
          storedCode: adminAny.passwordResetCode,
          submittedCode: code.toString(),
          codeMatch: adminAny.passwordResetCode === code.toString(),
          storedExpiry: adminAny.passwordResetCodeExpires,
          currentTime: new Date(),
          isExpired: adminAny.passwordResetCodeExpires ? new Date() > adminAny.passwordResetCodeExpires : 'no expiry set',
          isActive: adminAny.isActive
        });
      }
    }

    if (!admin) {
      console.log('Invalid admin reset code verification attempt:', {
        email,
        code,
        processingTime: `${Date.now() - startTime}ms`
      });
      
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired verification code'
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Update admin with reset token and mark code as verified
    await Admin.updateOne(
      { _id: admin._id },
      {
        $set: {
          passwordResetToken: hashedResetToken,
          passwordResetExpires: resetTokenExpiry,
          resetCodeVerified: true,
          resetCodeVerifiedAt: new Date(),
          updatedAt: new Date()
        },
        $unset: {
          passwordResetCode: "",
          passwordResetCodeExpires: ""
        }
      }
    );

    // Log audit trail
    try {
      const db = mongoose.connection.db;
      const auditLogsCollection = db.collection('audit_logs');

      await auditLogsCollection.insertOne({
        action: 'admin_reset_code_verified',
        entityType: 'admin',
        entityId: new mongoose.Types.ObjectId(admin._id),
        adminId: new mongoose.Types.ObjectId(admin._id),
        adminName: admin.name,
        adminEmail: admin.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        createdAt: new Date()
      });
    } catch (auditError) {
      console.warn('Audit log failed for admin code verification:', auditError);
    }

    console.log('Admin reset code verified successfully:', {
      adminId: admin._id,
      email: admin.email,
      processingTime: `${Date.now() - startTime}ms`
    });

    res.json({
      status: 'success',
      message: 'Verification code confirmed successfully',
      resetToken: resetToken, // Send unhashed token to client
      email: admin.email,
      expiresIn: '15 minutes'
    });

  } catch (error) {
    console.error('Admin verify reset code error:', {
      error: error.message,
      stack: error.stack,
      email: req.body.email,
      code: req.body.code,
      processingTime: `${Date.now() - startTime}ms`
    });

    res.status(500).json({
      status: 'error',
      message: 'Unable to verify reset code. Please try again later.'
    });
  }
});

// @route   POST /api/admin/reset-password
// @desc    Reset admin password with token
// @access  Public
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('email')
    .trim()
    .normalizeEmail({ gmail_remove_dots: false })
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
    console.log('Admin password reset submission received:', {
      email: req.body.email,
      hasToken: !!req.body.token,
      hasPassword: !!req.body.password,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors in admin reset-password:', errors.array());
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
    
    // Hash the provided token to match stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    console.log('Searching for admin with reset token:', {
      email: email.toLowerCase().trim(),
      hashedTokenLength: hashedToken.length,
      currentTime: new Date()
    });

    // Find admin with valid reset token and verified code
    const admin = await Admin.findOne({
      email: email.toLowerCase().trim(),
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
      resetCodeVerified: true,
      isActive: true
    });

    console.log('Admin search results:', {
      adminFound: !!admin
    });

    // Debug logging for failed reset
    if (!admin) {
      const adminAny = await Admin.findOne({ email: email.toLowerCase().trim() });
      if (adminAny) {
        console.log('Admin exists but reset conditions not met:', {
          hasResetToken: !!adminAny.passwordResetToken,
          storedToken: adminAny.passwordResetToken?.substring(0, 10) + '...',
          submittedHashedToken: hashedToken.substring(0, 10) + '...',
          tokenMatch: adminAny.passwordResetToken === hashedToken,
          resetExpires: adminAny.passwordResetExpires,
          currentTime: new Date(),
          isExpired: adminAny.passwordResetExpires ? new Date() > adminAny.passwordResetExpires : 'no expiry set',
          resetCodeVerified: adminAny.resetCodeVerified,
          isActive: adminAny.isActive
        });
      }
    }

    if (!admin) {
      console.log('No admin found matching reset criteria:', {
        email: email.toLowerCase().trim(),
        processingTime: `${Date.now() - startTime}ms`
      });
      
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token, or verification code not confirmed'
      });
    }

    // Hash new password with higher salt rounds for admin
    console.log('Hashing new admin password...');
    const saltRounds = process.env.NODE_ENV === 'production' ? 14 : 12;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log('Updating admin password in database...');
    
    // Update admin with new password and clear all reset-related fields
    const updateResult = await Admin.updateOne(
      { _id: admin._id },
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

    console.log('Admin password update result:', {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      acknowledged: updateResult.acknowledged
    });

    if (updateResult.matchedCount === 0) {
      throw new Error('Failed to update admin password - admin not found during update');
    }

    // Log audit trail
    try {
      const db = mongoose.connection.db;
      const auditLogsCollection = db.collection('audit_logs');

      await auditLogsCollection.insertOne({
        action: 'admin_password_reset_completed',
        entityType: 'admin',
        entityId: new mongoose.Types.ObjectId(admin._id),
        adminId: new mongoose.Types.ObjectId(admin._id),
        adminName: admin.name,
        adminEmail: admin.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        createdAt: new Date()
      });
    } catch (auditError) {
      console.warn('Audit log failed for admin password reset completion:', auditError);
    }

    // Send password change confirmation email
    try {
      await sendAdminPasswordChangeConfirmationEmail(admin.email, admin.name);
    } catch (emailError) {
      console.error('Failed to send admin confirmation email:', emailError);
      // Continue - don't fail the request for email issues
    }

    console.log('Admin password reset completed successfully:', {
      adminId: admin._id,
      email: admin.email,
      processingTime: `${Date.now() - startTime}ms`
    });

    res.json({
      status: 'success',
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });

  } catch (error) {
    console.error('Admin reset password error:', {
      error: error.message,
      stack: error.stack,
      email: req.body?.email,
      processingTime: `${Date.now() - startTime}ms`
    });

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: 'error',
        message: 'Password validation failed',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    if (error.message.includes('Database')) {
      return res.status(503).json({
        status: 'error',
        message: 'Database service temporarily unavailable. Please try again later.'
      });
    }

    if (error.message.includes('Failed to update admin password')) {
      return res.status(400).json({
        status: 'error',
        message: 'Failed to update password. Please try the reset process again.'
      });
    }

    // Generic server error
    const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    res.status(500).json({
      status: 'error',
      message: 'Unable to reset password. Please try again later.',
      errorId,
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        stack: error.stack 
      })
    });
  }
});

// Helper function to send admin password reset code email
async function sendAdminPasswordResetCodeEmail(email, name, code) {
  try {
    const transporter = createEmailTransporter();
    
    const mailOptions = {
      from: `"Infinite Cargo Admin" <${process.env.GMAIL_EMAIL}>`,
      to: email,
      subject: '🔐 Admin Password Reset Code - Infinite Cargo',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Admin Password Reset</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255, 255, 255, 0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <div style="color: white; font-size: 36px; font-weight: bold;">🛡️</div>
              </div>
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Admin Password Reset</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0; font-size: 16px;">Secure Admin Portal Access</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 24px; font-weight: 600;">Hello ${name}!</h2>
              
              <p style="color: #64748b; line-height: 1.6; margin: 0 0 25px; font-size: 16px;">
                A password reset has been requested for your Infinite Cargo Admin account.
              </p>

              <p style="color: #64748b; line-height: 1.6; margin: 0 0 30px; font-size: 16px;">
                Use the verification code below to proceed with your password reset:
              </p>

              <!-- Verification Code -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; border: 2px dashed #f59e0b;">
                <p style="color: #92400e; margin: 0 0 15px; font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Admin Verification Code</p>
                <div style="background-color: #ffffff; border-radius: 8px; padding: 20px; display: inline-block; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                  <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; color: #dc2626; letter-spacing: 8px;">${code}</span>
                </div>
                <p style="color: #92400e; margin: 15px 0 0; font-size: 12px;">This code expires in 10 minutes</p>
              </div>

              <!-- Instructions -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
                <h3 style="color: #92400e; margin: 0 0 10px; font-size: 16px; font-weight: 600;">Next Steps:</h3>
                <ol style="color: #92400e; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                  <li>Go back to the admin password reset page</li>
                  <li>Enter this 6-digit verification code</li>
                  <li>Create your new secure password</li>
                  <li>Sign in to the admin portal</li>
                </ol>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="color: #dc2626; margin: 0 0 10px; font-size: 16px; font-weight: 600;">🚨 Security Alert</h3>
                <p style="color: #dc2626; margin: 0; font-size: 14px; line-height: 1.5;">
                  This is an admin account password reset. If you did not request this, please contact the super admin immediately. 
                  All admin activities are logged and monitored.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <h3 style="color: #1e293b; margin: 0 0 10px; font-size: 18px; font-weight: 700;">Infinite Cargo - Admin Portal</h3>
              <p style="color: #64748b; margin: 0; font-size: 14px;">Secure Administrative Access</p>
              <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0; line-height: 1.5;">
                This is an automated security message. Do not reply to this email.<br>
                © 2024 Infinite Cargo. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Admin password reset code email sent successfully to:', email);
    
  } catch (error) {
    console.error('Failed to send admin password reset code email:', error);
    throw error;
  }
}

// Helper function to send admin password change confirmation email
async function sendAdminPasswordChangeConfirmationEmail(email, name) {
  try {
    const transporter = createEmailTransporter();
    
    const mailOptions = {
      from: `"Infinite Cargo Admin" <${process.env.GMAIL_EMAIL}>`,
      to: email,
      subject: '✅ Admin Password Successfully Changed - Infinite Cargo',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Admin Password Changed</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255, 255, 255, 0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <div style="color: white; font-size: 36px; font-weight: bold;">🛡️</div>
              </div>
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Admin Password Changed</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0; font-size: 16px;">Your admin account is now secure</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 24px; font-weight: 600;">Hello ${name}!</h2>
              
              <p style="color: #64748b; line-height: 1.6; margin: 0 0 25px; font-size: 16px;">
                Your admin password has been successfully changed for your Infinite Cargo Admin Portal account.
              </p>

              <p style="color: #64748b; line-height: 1.6; margin: 0 0 30px; font-size: 16px;">
                You can now sign in to the admin portal with your new password.
              </p>

              <!-- Security Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 0 8px 8px 0; margin: 30px 0;">
                <h3 style="color: #92400e; margin: 0 0 10px; font-size: 16px; font-weight: 600;">🔒 Security Notice</h3>
                <p style="color: #92400e; margin: 0; font-size: 14px; line-height: 1.5;">
                  If you did not make this change, please contact the super admin immediately. This action has been logged for security purposes.
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://infinitecargo.co.ke/admin/login" style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Access Admin Portal
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <h3 style="color: #1e293b; margin: 0 0 10px; font-size: 18px; font-weight: 700;">Infinite Cargo - Admin Portal</h3>
              <p style="color: #64748b; margin: 0; font-size: 14px;">Secure Administrative Access</p>
              <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0; line-height: 1.5;">
                © 2024 Infinite Cargo. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Admin password change confirmation email sent successfully to:', email);
    
  } catch (error) {
    console.error('Failed to send admin password change confirmation email:', error);
    // Don't throw error - email failure shouldn't fail password reset
  }
}

// @route   GET /api/admin/analytics/activity-summary
// @desc    Get activity summary for today
// @access  Private
router.get('/analytics/activity-summary',adminAuth, async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    // Today's logins (you might need to track login events)
    const todayLogins = await require('mongoose').connection.db.collection('audit_logs').countDocuments({
      action: 'admin_login',
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    });

    // New registrations today
    const [newDrivers, newCargoOwners] = await Promise.all([
      require('mongoose').connection.db.collection('drivers').countDocuments({
        createdAt: { $gte: startOfToday, $lte: endOfToday }
      }),
      require('mongoose').connection.db.collection('cargo-owners').countDocuments({
        createdAt: { $gte: startOfToday, $lte: endOfToday }
      })
    ]);

    // Active subscriptions
    const activeSubscriptions = await require('../models/subscription').Subscription.countDocuments({
      status: 'active',
      expiresAt: { $gt: new Date() }
    });

    // System health calculation (simplified)
    const totalUsers = await Promise.all([
      require('mongoose').connection.db.collection('drivers').countDocuments(),
      require('mongoose').connection.db.collection('cargo-owners').countDocuments()
    ]);

    const userCount = totalUsers[0] + totalUsers[1];
    let systemHealth = 'good';
    
    if (userCount < 100) systemHealth = 'warning';
    if (activeSubscriptions / userCount < 0.1) systemHealth = 'critical';

    res.json({
      status: 'success',
      data: {
        todayLogins,
        newRegistrations: newDrivers + newCargoOwners,
        activeSubscriptions,
        systemHealth
      }
    });

  } catch (error) {
    console.error('Activity summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch activity summary'
    });
  }
});

// @route   GET /api/admin/audit-logs
// @desc    Fetch audit logs
router.get('/audit-logs', adminAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const auditLogsCollection = db.collection('audit_logs');

    const { limit = 10 } = req.query;
    const logs = await auditLogsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.json({
      status: 'success',
      data: logs
    });
  } catch (error) {
    console.error('Audit logs fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch audit logs'
    });
  }
});


// @route   GET /api/admin/analytics/charts
// @desc    Get chart data for dashboard
// @access  Private
router.get('/analytics/charts',adminAuth, async (req, res) => {
  try {
    const { timeRange = '6months' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '3months':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 6);
    }

    // Get revenue trends (monthly aggregation)
    const revenueData = await require('../models/subscription').Subscription.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$price' },
          subscriptions: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get subscription distribution
    const subscriptionDistribution = await require('../models/subscription').Subscription.aggregate([
      {
        $match: {
          status: 'active',
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: '$planId',
          count: { $sum: 1 },
          revenue: { $sum: '$price' },
          planName: { $first: '$planName' }
        }
      }
    ]);

    // Get user activity (last 7 days)
    const userActivityData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const [drivers, cargoOwners, loads] = await Promise.all([
        require('mongoose').connection.db.collection('drivers').countDocuments({
          lastLogin: { $gte: startOfDay, $lte: endOfDay }
        }),
        require('mongoose').connection.db.collection('cargo-owners').countDocuments({
          lastLogin: { $gte: startOfDay, $lte: endOfDay }
        }),
        require('../models/load').countDocuments({
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        })
      ]);

      userActivityData.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        drivers: drivers || 0,
        cargoOwners: cargoOwners || 0,
        loads: loads || 0,
        date: startOfDay
      });
    }

    // Get load status distribution
    const loadStatusData = await require('../models/load').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format revenue data with month names
    const formattedRevenueData = revenueData.map(item => ({
      month: new Date(item._id.year, item._id.month - 1).toLocaleDateString('en-US', { month: 'short' }),
      revenue: item.revenue,
      subscriptions: item.subscriptions,
      year: item._id.year
    }));

    // Calculate total values for distribution percentages
    const totalSubscriptions = subscriptionDistribution.reduce((sum, item) => sum + item.count, 0);
    const totalRevenue = subscriptionDistribution.reduce((sum, item) => sum + item.revenue, 0);

    const formattedSubscriptionDistribution = subscriptionDistribution.map(item => ({
      name: item.planName || item._id,
      value: ((item.count / totalSubscriptions) * 100).toFixed(1),
      count: item.count,
      revenue: item.revenue,
      percentage: ((item.revenue / totalRevenue) * 100).toFixed(1)
    }));

    const totalLoadCount = loadStatusData.reduce((sum, item) => sum + item.count, 0);
    const formattedLoadStatusData = loadStatusData.map(item => ({
      status: item._id,
      count: item.count,
      percentage: ((item.count / totalLoadCount) * 100).toFixed(1)
    }));

    res.json({
      status: 'success',
      data: {
        revenueData: formattedRevenueData,
        subscriptionDistribution: formattedSubscriptionDistribution,
        userActivityData,
        loadStatusData: formattedLoadStatusData,
        summary: {
          totalRevenue: totalRevenue,
          totalSubscriptions: totalSubscriptions,
          totalLoads: totalLoadCount,
          timeRange
        }
      }
    });

  } catch (error) {
    console.error('Chart data fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch chart data',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// @route   GET /api/admin/cargo-owners
// @desc    List cargo owners with pagination and search

router.get('/cargo-owners', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const db = mongoose.connection.db;
    const cargoOwnersCollection = db.collection('cargo-owners');

    const total = await cargoOwnersCollection.countDocuments({});
    const owners = await cargoOwnersCollection
      .find({})
      .skip(skip)
      .limit(limit)
      .project({ password: 0 }) // hide password
      .toArray();

    res.json({
      status: 'success',
      data: {
        cargoOwners: owners,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCargoOwners: total,
        },
      },
    });
  } catch (err) {
    console.error('Error listing cargo owners', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// @route   GET /api/admin/me
// @desc    Get current admin
// @access  Private
router.get('/me', adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    if (!admin) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }
    
    res.json({
      status: 'success',
      admin
    });
  } catch (error) {
    console.error('Get current admin error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/loads
// @desc    Get loads with pagination (Admin only)
// @access  Private
router.get('/loads', adminAuth, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isString(),
  query('search').optional().trim().isLength({ max: 100 })
], async (req, res) => {
  try {
    // Check admin permissions
    if (!req.admin.permissions?.manageCargo) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage cargo.'
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

    const { page = 1, limit = 20, status, search } = req.query;

    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        status: 'error',
        message: 'Database not connected'
      });
    }

    // Build query
    const queryFilter = {};

    // Admin should see *all* statuses unless filtered
    if (status && status !== 'all') {
      queryFilter.status = status;
    }

    // Apply text search
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      queryFilter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { pickupLocation: searchRegex },
        { deliveryLocation: searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch data
    const loads = await Load.find(queryFilter)
      .populate('createdBy', 'name email phone location isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalLoads = await Load.countDocuments(queryFilter);
    const totalPages = Math.ceil(totalLoads / parseInt(limit));

    // Transform result to admin-friendly JSON
    const transformedLoads = loads.map(load => ({
      _id: load._id,
      title: load.title || 'Untitled Load',
      description: load.description || '',
      pickupLocation: load.pickupLocation || '',
      deliveryLocation: load.deliveryLocation || '',
      origin: load.pickupLocation || '',
      destination: load.deliveryLocation || '',
      weight: load.weight || 0,
      cargoType: load.cargoType || 'other',
      vehicleType: load.vehicleType || '',
      budget: load.budget || 0,
      pickupDate: load.pickupDate,
      deliveryDate: load.deliveryDate,
      status: load.status,
      isActive: load.isActive,
      isUrgent: load.isUrgent || false,
      createdAt: load.createdAt,
      updatedAt: load.updatedAt,
      daysSincePosted: Math.floor((Date.now() - new Date(load.createdAt)) / (1000 * 60 * 60 * 24)),
      cargoOwnerName: load.contactPerson.name,
      cargoOwnerEmail: load.contactPerson.email,
      cargoOwnerPhone: load.contactPerson.phone,
      canEdit: true,
      canDelete: !['in_transit', 'delivered'].includes(load.status)
    }));

    // Return response
    res.status(200).json({
      status: 'success',
      data: {
        loads: transformedLoads,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLoads,
          limit: parseInt(limit),
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      },
      filters: {
        status: status || 'all',
        search: search || ''
      }
    });
  } catch (err) {
    console.error('Admin loads fetch error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching loads',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


// @route   GET /api/admin/dashboard-stats
// @desc    Get dashboard statistics with revenue
// @access  Private
router.get('/dashboard-stats', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions?.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    const db = mongoose.connection.db;

    // Define time periods
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Parallel execution of all statistics queries
    const [
      // Load statistics
      loadStats,
      // User statistics  
      userStats,
      // Subscription statistics
      subscriptionStats,
      // Revenue statistics
      revenueStats,
      // Growth statistics
      growthStats
    ] = await Promise.allSettled([
      // Load Statistics
      Promise.all([
        Load.countDocuments().catch(() => 0),
        Load.countDocuments({ 
          status: { $in: ['posted', 'available', 'receiving_bids', 'assigned', 'in_transit'] } 
        }).catch(() => 0),
        Load.countDocuments({ createdAt: { $gte: startOfMonth } }).catch(() => 0),
        Load.countDocuments({ createdAt: { $gte: startOfWeek } }).catch(() => 0),
        Load.countDocuments({ createdAt: { $gte: startOfToday } }).catch(() => 0),
        Load.countDocuments({ status: 'delivered' }).catch(() => 0),
        Load.countDocuments({ status: 'cancelled' }).catch(() => 0),
        Load.countDocuments({ isUrgent: true, isActive: true }).catch(() => 0)
      ]),

      // User Statistics
      Promise.all([
        db.collection('drivers').countDocuments(),
        db.collection('cargo-owners').countDocuments(),
        db.collection('drivers').countDocuments({ 
          $and: [
            { $or: [{ isActive: true }, { accountStatus: 'active' }] },
            { $or: [{ isActive: { $ne: false } }, { accountStatus: { $ne: 'suspended' } }] }
          ]
        }),
        db.collection('cargo-owners').countDocuments({ 
          $and: [
            { $or: [{ isActive: true }, { accountStatus: 'active' }] },
            { $or: [{ isActive: { $ne: false } }, { accountStatus: { $ne: 'suspended' } }] }
          ]
        }),
        db.collection('drivers').countDocuments({ createdAt: { $gte: startOfMonth } }),
        db.collection('cargo-owners').countDocuments({ createdAt: { $gte: startOfMonth } }),
        db.collection('drivers').countDocuments({ createdAt: { $gte: startOfWeek } }),
        db.collection('cargo-owners').countDocuments({ createdAt: { $gte: startOfWeek } }),
        db.collection('drivers').countDocuments({ createdAt: { $gte: startOfToday } }),
        db.collection('cargo-owners').countDocuments({ createdAt: { $gte: startOfToday } }),
        db.collection('drivers').countDocuments({ isVerified: true }),
        db.collection('cargo-owners').countDocuments({ isVerified: true })
      ]),

      // Subscription Statistics
      Promise.all([
        Subscription.countDocuments().catch(() => 0),
        Subscription.countDocuments({ 
          status: 'active',
          $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }]
        }).catch(() => 0),
        Subscription.countDocuments({ status: 'pending' }).catch(() => 0),
        Subscription.countDocuments({ 
          status: 'active', 
          expiresAt: { $lte: now } 
        }).catch(() => 0),
        Subscription.countDocuments({ createdAt: { $gte: startOfMonth } }).catch(() => 0),
        Subscription.countDocuments({ status: 'rejected' }).catch(() => 0)
      ]),

      // Revenue Statistics
      Promise.all([
        Subscription.aggregate([
          {
            $match: {
              status: 'active',
              paymentStatus: 'completed',
              createdAt: { $gte: startOfMonth }
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: { $ifNull: ['$price', '$amount'] } },
              count: { $sum: 1 }
            }
          }
        ]).catch(() => []),
        
        Subscription.aggregate([
          {
            $match: {
              status: 'active',
              paymentStatus: 'completed'
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: { $ifNull: ['$price', '$amount'] } },
              count: { $sum: 1 }
            }
          }
        ]).catch(() => []),

        // Revenue by plan
        Subscription.aggregate([
          {
            $match: {
              status: 'active',
              paymentStatus: 'completed'
            }
          },
          {
            $group: {
              _id: '$planId',
              revenue: { $sum: { $ifNull: ['$price', '$amount'] } },
              count: { $sum: 1 }
            }
          }
        ]).catch(() => [])
      ]),

      // Growth Statistics (comparing this month vs last month)
      Promise.all([
        db.collection('drivers').countDocuments({ 
          createdAt: { 
            $gte: startOfLastMonth, 
            $lt: startOfMonth 
          } 
        }),
        db.collection('cargo-owners').countDocuments({ 
          createdAt: { 
            $gte: startOfLastMonth, 
            $lt: startOfMonth 
          } 
        }),
        Load.countDocuments({ 
          createdAt: { 
            $gte: startOfLastMonth, 
            $lt: startOfMonth 
          } 
        }).catch(() => 0),
        Subscription.countDocuments({ 
          createdAt: { 
            $gte: startOfLastMonth, 
            $lt: startOfMonth 
          } 
        }).catch(() => 0)
      ])
    ]);

    // Process results with error handling
    const [
      totalLoads, activeLoads, newLoadsThisMonth, newLoadsThisWeek, 
      newLoadsToday, completedLoads, cancelledLoads, urgentLoads
    ] = loadStats.status === 'fulfilled' ? loadStats.value : Array(8).fill(0);

    const [
      totalDrivers, totalCargoOwners, activeDrivers, activeCargoOwners,
      newDriversThisMonth, newCargoOwnersThisMonth, newDriversThisWeek, 
      newCargoOwnersThisWeek, newDriversToday, newCargoOwnersToday,
      verifiedDrivers, verifiedCargoOwners
    ] = userStats.status === 'fulfilled' ? userStats.value : Array(12).fill(0);

    const [
      totalSubscriptions, activeSubscriptions, pendingSubscriptions,
      expiredSubscriptions, newSubscriptionsThisMonth, rejectedSubscriptions
    ] = subscriptionStats.status === 'fulfilled' ? subscriptionStats.value : Array(6).fill(0);

    const [monthlyRevenueData, totalRevenueData, revenueByPlan] = 
      revenueStats.status === 'fulfilled' ? revenueStats.value : [[], [], []];

    const [
      driversLastMonth, cargoOwnersLastMonth, loadsLastMonth, subscriptionsLastMonth
    ] = growthStats.status === 'fulfilled' ? growthStats.value : Array(4).fill(0);

    // Calculate derived metrics
    const totalUsers = totalDrivers + totalCargoOwners;
    const activeUsers = activeDrivers + activeCargoOwners;
    const newUsersToday = newDriversToday + newCargoOwnersToday;
    const newUsersThisWeek = newDriversThisWeek + newCargoOwnersThisWeek;
    const newUsersThisMonth = newDriversThisMonth + newCargoOwnersThisMonth;
    const usersLastMonth = driversLastMonth + cargoOwnersLastMonth;

    const monthlyRevenue = monthlyRevenueData[0]?.totalRevenue || 0;
    const totalRevenue = totalRevenueData[0]?.totalRevenue || 0;

    // Calculate growth rates
    const userGrowthRate = usersLastMonth > 0 ? 
      parseFloat(((newUsersThisMonth - usersLastMonth) / usersLastMonth * 100).toFixed(2)) : 
      (newUsersThisMonth > 0 ? 100 : 0);

    const loadGrowthRate = loadsLastMonth > 0 ? 
      parseFloat(((newLoadsThisMonth - loadsLastMonth) / loadsLastMonth * 100).toFixed(2)) : 
      (newLoadsThisMonth > 0 ? 100 : 0);

    const subscriptionGrowthRate = subscriptionsLastMonth > 0 ? 
      parseFloat(((newSubscriptionsThisMonth - subscriptionsLastMonth) / subscriptionsLastMonth * 100).toFixed(2)) : 
      (newSubscriptionsThisMonth > 0 ? 100 : 0);

    // Calculate rates and percentages
    const subscriptionRate = totalUsers > 0 ? 
      parseFloat((activeSubscriptions / totalUsers * 100).toFixed(2)) : 0;
    
    const loadCompletionRate = totalLoads > 0 ? 
      parseFloat((completedLoads / totalLoads * 100).toFixed(2)) : 0;

    const loadCancellationRate = totalLoads > 0 ? 
      parseFloat((cancelledLoads / totalLoads * 100).toFixed(2)) : 0;

    const driverVerificationRate = totalDrivers > 0 ? 
      parseFloat((verifiedDrivers / totalDrivers * 100).toFixed(2)) : 0;

    const cargoOwnerVerificationRate = totalCargoOwners > 0 ? 
      parseFloat((verifiedCargoOwners / totalCargoOwners * 100).toFixed(2)) : 0;

    const averageRevenuePerSubscription = activeSubscriptions > 0 ? 
      parseFloat((totalRevenue / activeSubscriptions).toFixed(2)) : 0;

    // Build comprehensive stats object
    const stats = {
      // Load metrics
      loads: {
        total: totalLoads,
        active: activeLoads,
        newToday: newLoadsToday,
        newThisWeek: newLoadsThisWeek,
        newThisMonth: newLoadsThisMonth,
        completed: completedLoads,
        cancelled: cancelledLoads,
        urgent: urgentLoads,
        completionRate: loadCompletionRate,
        cancellationRate: loadCancellationRate,
        growthRate: loadGrowthRate
      },

      // User metrics
      users: {
        total: totalUsers,
        active: activeUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
        growthRate: userGrowthRate,
        drivers: {
          total: totalDrivers,
          active: activeDrivers,
          newToday: newDriversToday,
          newThisWeek: newDriversThisWeek,
          newThisMonth: newDriversThisMonth,
          verified: verifiedDrivers,
          verificationRate: driverVerificationRate
        },
        cargoOwners: {
          total: totalCargoOwners,
          active: activeCargoOwners,
          newToday: newCargoOwnersToday,
          newThisWeek: newCargoOwnersThisWeek,
          newThisMonth: newCargoOwnersThisMonth,
          verified: verifiedCargoOwners,
          verificationRate: cargoOwnerVerificationRate
        }
      },

      // Subscription metrics
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        pending: pendingSubscriptions,
        expired: expiredSubscriptions,
        rejected: rejectedSubscriptions,
        newThisMonth: newSubscriptionsThisMonth,
        rate: subscriptionRate,
        growthRate: subscriptionGrowthRate,
        byPlan: revenueByPlan.reduce((acc, plan) => {
          acc[plan._id] = {
            count: plan.count,
            revenue: plan.revenue
          };
          return acc;
        }, {})
      },

      // Revenue metrics
      revenue: {
        monthly: monthlyRevenue,
        total: totalRevenue,
        averagePerSubscription: averageRevenuePerSubscription,
        byPlan: revenueByPlan
      },

      // Performance indicators
      kpis: {
        userGrowthRate,
        loadGrowthRate,
        subscriptionGrowthRate,
        subscriptionRate,
        loadCompletionRate,
        loadCancellationRate,
        driverVerificationRate,
        cargoOwnerVerificationRate,
        averageLoadsPerUser: totalUsers > 0 ? parseFloat((totalLoads / totalUsers).toFixed(2)) : 0,
        dailyActiveUsers: activeUsers,
        monthlyActiveRevenue: monthlyRevenue
      },

      // System metadata
      metadata: {
        lastUpdated: new Date(),
        generatedBy: req.admin.name || 'System',
        dataSource: 'mongodb',
        queryExecutionTime: Date.now() - (req.startTime || Date.now())
      }
    };

    res.json({
      status: 'success',
      data: stats,
      message: 'Dashboard statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    // Return fallback stats structure
    const fallbackStats = {
      loads: { total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0, completed: 0, cancelled: 0, urgent: 0, completionRate: 0, cancellationRate: 0, growthRate: 0 },
      users: { 
        total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0, growthRate: 0,
        drivers: { total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0, verified: 0, verificationRate: 0 },
        cargoOwners: { total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0, verified: 0, verificationRate: 0 }
      },
      subscriptions: { total: 0, active: 0, pending: 0, expired: 0, rejected: 0, newThisMonth: 0, rate: 0, growthRate: 0, byPlan: {} },
      revenue: { monthly: 0, total: 0, averagePerSubscription: 0, byPlan: [] },
      kpis: { userGrowthRate: 0, loadGrowthRate: 0, subscriptionGrowthRate: 0, subscriptionRate: 0, loadCompletionRate: 0, loadCancellationRate: 0, driverVerificationRate: 0, cargoOwnerVerificationRate: 0, averageLoadsPerUser: 0, dailyActiveUsers: 0, monthlyActiveRevenue: 0 },
      metadata: { lastUpdated: new Date(), error: true, errorMessage: 'Error fetching statistics' }
    };

    res.status(500).json({
      status: 'error',
      message: 'Error fetching dashboard statistics',
      data: fallbackStats,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/dashboard-stats/refresh
// @desc    Force refresh dashboard statistics
// @access  Private
router.post('/dashboard-stats/refresh', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    // Mark start time for performance tracking
    req.startTime = Date.now();

    // Clear any cached stats if you implement caching later
    // await clearDashboardStatsCache();

    // Call the same logic as the GET endpoint by forwarding the request
    const originalMethod = req.method;
    req.method = 'GET';
    
    // Re-run the dashboard stats logic
    return router.handle(req, res);

  } catch (error) {
    console.error('Dashboard stats refresh error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error refreshing dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/analytics/detailed
// @desc    Get detailed analytics with historical data
// @access  Private
router.get('/analytics/detailed', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions?.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    const { 
      timeframe = '30d',
      groupBy = 'day',
      includeGeography = 'false',
      includeUserBehavior = 'false'
    } = req.query;

    // Calculate date ranges
    let startDate, endDate = new Date();
    const days = parseInt(timeframe.replace('d', '')) || 30;
    startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const db = mongoose.connection.db;

    // Build aggregation pipeline for time grouping
    let dateGrouping = {};
    switch (groupBy) {
      case 'hour':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        break;
      case 'day':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'week':
        dateGrouping = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      case 'month':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default:
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const analyticsQueries = [];

    // User registration trends
    analyticsQueries.push(
      db.collection('drivers').aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: dateGrouping,
            drivers: { $sum: 1 },
            verifiedDrivers: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ]).toArray().catch(() => [])
    );

    analyticsQueries.push(
      db.collection('cargo-owners').aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: dateGrouping,
            cargoOwners: { $sum: 1 },
            verifiedCargoOwners: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ]).toArray().catch(() => [])
    );

    // Load posting trends
    analyticsQueries.push(
      Load.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: dateGrouping,
            totalLoads: { $sum: 1 },
            urgentLoads: { $sum: { $cond: [{ $eq: ['$isUrgent', true] }, 1, 0] } },
            averageBudget: { $avg: '$budget' },
            totalBudget: { $sum: '$budget' },
            completedLoads: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ]).catch(() => [])
    );

    // Subscription trends
    analyticsQueries.push(
      Subscription.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: dateGrouping,
            totalSubscriptions: { $sum: 1 },
            approvedSubscriptions: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            revenue: { $sum: { $ifNull: ['$price', '$amount'] } },
            basicPlan: { $sum: { $cond: [{ $eq: ['$planId', 'basic'] }, 1, 0] } },
            proPlan: { $sum: { $cond: [{ $eq: ['$planId', 'pro'] }, 1, 0] } },
            businessPlan: { $sum: { $cond: [{ $eq: ['$planId', 'business'] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
      ]).catch(() => [])
    );

    // Geographic analysis (if requested)
    if (includeGeography === 'true') {
      analyticsQueries.push(
        db.collection('drivers').aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$location',
              driverCount: { $sum: 1 },
              activeDrivers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
              verifiedDrivers: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } }
            }
          },
          { $sort: { driverCount: -1 } },
          { $limit: 20 }
        ]).toArray().catch(() => [])
      );

      analyticsQueries.push(
        db.collection('cargo-owners').aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$location',
              cargoOwnerCount: { $sum: 1 },
              activeCargoOwners: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
              verifiedCargoOwners: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } }
            }
          },
          { $sort: { cargoOwnerCount: -1 } },
          { $limit: 20 }
        ]).toArray().catch(() => [])
      );

      analyticsQueries.push(
        Load.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$pickupLocation',
              loadCount: { $sum: 1 },
              totalBudget: { $sum: '$budget' },
              averageBudget: { $avg: '$budget' },
              completedLoads: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
            }
          },
          { $sort: { loadCount: -1 } },
          { $limit: 20 }
        ]).catch(() => [])
      );
    }

    // User behavior analysis (if requested)
    if (includeUserBehavior === 'true') {
      analyticsQueries.push(
        Load.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$cargoType',
              count: { $sum: 1 },
              totalBudget: { $sum: '$budget' },
              averageBudget: { $avg: '$budget' },
              averageWeight: { $avg: '$weight' }
            }
          },
          { $sort: { count: -1 } }
        ]).catch(() => [])
      );

      analyticsQueries.push(
        Load.aggregate([
          { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$vehicleType',
              count: { $sum: 1 },
              totalBudget: { $sum: '$budget' },
              averageBudget: { $avg: '$budget' }
            }
          },
          { $sort: { count: -1 } }
        ]).catch(() => [])
      );
    }

    // Execute all queries
    const results = await Promise.allSettled(analyticsQueries);

    // Process results
    const [
      driverTrends,
      cargoOwnerTrends,
      loadTrends,
      subscriptionTrends,
      ...additionalResults
    ] = results.map(result => result.status === 'fulfilled' ? result.value : []);

    let geographicData = {};
    let behaviorData = {};

    if (includeGeography === 'true') {
      const [driversByLocation, cargoOwnersByLocation, loadsByLocation] = additionalResults.slice(0, 3);
      geographicData = {
        driversByLocation,
        cargoOwnersByLocation,
        loadsByLocation
      };
    }

    if (includeUserBehavior === 'true') {
      const startIndex = includeGeography === 'true' ? 3 : 0;
      const [cargoTypeAnalysis, vehicleTypeAnalysis] = additionalResults.slice(startIndex, startIndex + 2);
      behaviorData = {
        cargoTypeAnalysis,
        vehicleTypeAnalysis
      };
    }

    const analytics = {
      timeframe,
      groupBy,
      period: {
        start: startDate,
        end: endDate,
        days: days
      },
      trends: {
        userRegistrations: {
          drivers: driverTrends,
          cargoOwners: cargoOwnerTrends
        },
        loads: loadTrends,
        subscriptions: subscriptionTrends
      },
      geography: geographicData,
      behavior: behaviorData,
      summary: {
        totalDataPoints: driverTrends.length + cargoOwnerTrends.length + loadTrends.length + subscriptionTrends.length,
        queryExecutionTime: Date.now() - (req.startTime || Date.now()),
        generatedAt: new Date()
      }
    };

    res.json({
      status: 'success',
      data: analytics,
      message: 'Detailed analytics retrieved successfully'
    });

  } catch (error) {
    console.error('Detailed analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching detailed analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// @route   GET /api/admin/analytics/summary
// @desc    Get quick summary stats for dashboard cards
// @access  Private
router.get('/analytics/summary', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions?.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    const db = mongoose.connection.db;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Quick essential stats only
    const [
      userCounts,
      loadCounts, 
      subscriptionCounts,
      revenueData
    ] = await Promise.allSettled([
      // User counts
      Promise.all([
        db.collection('drivers').countDocuments(),
        db.collection('cargo-owners').countDocuments(),
        db.collection('drivers').countDocuments({ createdAt: { $gte: startOfToday } }),
        db.collection('cargo-owners').countDocuments({ createdAt: { $gte: startOfToday } }),
        db.collection('drivers').countDocuments({ createdAt: { $gte: startOfWeek } }),
        db.collection('cargo-owners').countDocuments({ createdAt: { $gte: startOfWeek } })
      ]),
      
      // Load counts
      Promise.all([
        Load.countDocuments().catch(() => 0),
        Load.countDocuments({ 
          status: { $in: ['posted', 'available', 'receiving_bids', 'assigned', 'in_transit'] } 
        }).catch(() => 0),
        Load.countDocuments({ createdAt: { $gte: startOfToday } }).catch(() => 0)
      ]),
      
      // Subscription counts
      Promise.all([
        Subscription.countDocuments().catch(() => 0),
        Subscription.countDocuments({ status: 'pending' }).catch(() => 0),
        Subscription.countDocuments({ 
          status: 'active',
          $or: [{ expiresAt: { $gt: now } }, { expiresAt: null }]
        }).catch(() => 0)
      ]),
      
      // Revenue
      Subscription.aggregate([
        {
          $match: {
            status: 'active',
            paymentStatus: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$price', '$amount'] } },
            count: { $sum: 1 }
          }
        }
      ]).catch(() => [])
    ]);

    // Process results
    const [drivers, cargoOwners, newDriversToday, newCargoOwnersToday, newDriversWeek, newCargoOwnersWeek] = 
      userCounts.status === 'fulfilled' ? userCounts.value : [0, 0, 0, 0, 0, 0];

    const [totalLoads, activeLoads, newLoadsToday] = 
      loadCounts.status === 'fulfilled' ? loadCounts.value : [0, 0, 0];

    const [totalSubscriptions, pendingSubscriptions, activeSubscriptions] = 
      subscriptionCounts.status === 'fulfilled' ? subscriptionCounts.value : [0, 0, 0];

    const revenue = revenueData.status === 'fulfilled' ? 
      (revenueData.value[0]?.totalRevenue || 0) : 0;

    const summary = {
      users: {
        total: drivers + cargoOwners,
        newToday: newDriversToday + newCargoOwnersToday,
        newThisWeek: newDriversWeek + newCargoOwnersWeek,
        breakdown: {
          drivers,
          cargoOwners
        }
      },
      loads: {
        total: totalLoads,
        active: activeLoads,
        newToday: newLoadsToday
      },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        pending: pendingSubscriptions
      },
      revenue: {
        total: revenue
      },
      lastUpdated: new Date()
    };

    res.json({
      status: 'success',
      data: summary
    });

  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching analytics summary'
    });
  }
});

// @route   GET /api/admin/analytics/performance
// @desc    Get performance metrics and KPIs
// @access  Private
router.get('/analytics/performance', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions?.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to view analytics.'
      });
    }

    const { period = '30d' } = req.query;
    const days = parseInt(period.replace('d', '')) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    // Parallel execution of performance queries
    const [
      loadPerformance,
      userEngagement,
      revenueMetrics,
      systemHealth
    ] = await Promise.allSettled([
      // Load performance metrics
      Promise.all([
        Load.countDocuments({ 
          createdAt: { $gte: startDate },
          status: 'delivered' 
        }).catch(() => 0),
        Load.countDocuments({ 
          createdAt: { $gte: startDate } 
        }).catch(() => 0),
        Load.aggregate([
          {
            $match: { 
              createdAt: { $gte: startDate },
              status: 'delivered',
              deliveredAt: { $exists: true }
            }
          },
          {
            $project: {
              deliveryTime: {
                $divide: [
                  { $subtract: ['$deliveredAt', '$createdAt'] },
                  1000 * 60 * 60 * 24 // Convert to days
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              avgDeliveryTime: { $avg: '$deliveryTime' },
              minDeliveryTime: { $min: '$deliveryTime' },
              maxDeliveryTime: { $max: '$deliveryTime' }
            }
          }
        ]).catch(() => [])
      ]),

      // User engagement metrics
      Promise.all([
        mongoose.connection.db.collection('drivers').countDocuments({
          createdAt: { $gte: startDate },
          isActive: true
        }),
        mongoose.connection.db.collection('cargo-owners').countDocuments({
          createdAt: { $gte: startDate },
          isActive: true
        }),
        mongoose.connection.db.collection('drivers').countDocuments({
          createdAt: { $gte: startDate },
          isVerified: true
        }),
        mongoose.connection.db.collection('cargo-owners').countDocuments({
          createdAt: { $gte: startDate },
          isVerified: true
        })
      ]),

      // Revenue performance
      Subscription.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            status: 'active',
            paymentStatus: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ['$price', '$amount'] } },
            avgRevenue: { $avg: { $ifNull: ['$price', '$amount'] } },
            count: { $sum: 1 }
          }
        }
      ]).catch(() => []),

      // System health indicators
      Promise.all([
        Load.countDocuments({ 
          createdAt: { $gte: startDate },
          status: 'cancelled' 
        }).catch(() => 0),
        Subscription.countDocuments({ 
          createdAt: { $gte: startDate },
          status: 'rejected' 
        }).catch(() => 0),
        mongoose.connection.db.collection('drivers').countDocuments({
          createdAt: { $gte: startDate },
          accountStatus: 'suspended'
        }),
        mongoose.connection.db.collection('cargo-owners').countDocuments({
          createdAt: { $gte: startDate },
          accountStatus: 'suspended'
        })
      ])
    ]);

    // Process results
    const [completedLoads, totalLoads, deliveryTimeData] = 
      loadPerformance.status === 'fulfilled' ? loadPerformance.value : [0, 0, []];

    const [activeDrivers, activeCargoOwners, verifiedDrivers, verifiedCargoOwners] = 
      userEngagement.status === 'fulfilled' ? userEngagement.value : [0, 0, 0, 0];

    const revenueData = revenueMetrics.status === 'fulfilled' ? 
      (revenueMetrics.value[0] || { totalRevenue: 0, avgRevenue: 0, count: 0 }) : 
      { totalRevenue: 0, avgRevenue: 0, count: 0 };

    const [cancelledLoads, rejectedSubscriptions, suspendedDrivers, suspendedCargoOwners] = 
      systemHealth.status === 'fulfilled' ? systemHealth.value : [0, 0, 0, 0];

    const avgDeliveryTime = deliveryTimeData.length > 0 ? 
      deliveryTimeData[0].avgDeliveryTime : null;

    // Calculate KPIs
    const completionRate = totalLoads > 0 ? (completedLoads / totalLoads * 100) : 0;
    const cancellationRate = totalLoads > 0 ? (cancelledLoads / totalLoads * 100) : 0;
    const userActivationRate = (activeDrivers + activeCargoOwners) > 0 ? 
      ((verifiedDrivers + verifiedCargoOwners) / (activeDrivers + activeCargoOwners) * 100) : 0;
    const revenuePerUser = (activeDrivers + activeCargoOwners) > 0 ? 
      (revenueData.totalRevenue / (activeDrivers + activeCargoOwners)) : 0;

    const performance = {
      period: {
        days,
        start: startDate,
        end: endDate
      },
      kpis: {
        loadCompletionRate: parseFloat(completionRate.toFixed(2)),
        loadCancellationRate: parseFloat(cancellationRate.toFixed(2)),
        userActivationRate: parseFloat(userActivationRate.toFixed(2)),
        averageDeliveryTime: avgDeliveryTime ? parseFloat(avgDeliveryTime.toFixed(2)) : null,
        revenuePerUser: parseFloat(revenuePerUser.toFixed(2)),
        subscriptionConversionRate: (activeDrivers + activeCargoOwners) > 0 ? 
          parseFloat((revenueData.count / (activeDrivers + activeCargoOwners) * 100).toFixed(2)) : 0
      },
      metrics: {
        loads: {
          total: totalLoads,
          completed: completedLoads,
          cancelled: cancelledLoads,
          completionRate: parseFloat(completionRate.toFixed(2)),
          cancellationRate: parseFloat(cancellationRate.toFixed(2)),
          avgDeliveryDays: avgDeliveryTime ? parseFloat(avgDeliveryTime.toFixed(2)) : null
        },
        users: {
          activeDrivers,
          activeCargoOwners,
          verifiedDrivers,
          verifiedCargoOwners,
          suspendedDrivers,
          suspendedCargoOwners,
          totalActive: activeDrivers + activeCargoOwners,
          verificationRate: (activeDrivers + activeCargoOwners) > 0 ? 
            parseFloat(((verifiedDrivers + verifiedCargoOwners) / (activeDrivers + activeCargoOwners) * 100).toFixed(2)) : 0
        },
        revenue: {
          total: revenueData.totalRevenue,
          average: parseFloat((revenueData.avgRevenue || 0).toFixed(2)),
          subscriptions: revenueData.count,
          revenuePerUser: parseFloat(revenuePerUser.toFixed(2))
        },
        system: {
          rejectedSubscriptions,
          suspendedUsers: suspendedDrivers + suspendedCargoOwners,
          healthScore: parseFloat((100 - cancellationRate - (rejectedSubscriptions / Math.max(revenueData.count, 1) * 100)).toFixed(2))
        }
      },
      generatedAt: new Date()
    };

    res.json({
      status: 'success',
      data: performance,
      message: 'Performance metrics retrieved successfully'
    });

  } catch (error) {
    console.error('Performance analytics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching performance metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/analytics/top-routes
// @desc    Get top performing routes
// @access  Private
router.get('/analytics/top-routes',adminAuth, async (req, res) => {
  try {
    const Load = require('../models/load');
    
    const topRoutes = await Load.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'active'] },
          price: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: {
            origin: '$origin',
            destination: '$destination'
          },
          loads: { $sum: 1 },
          totalRevenue: { $sum: '$price' },
          averagePrice: { $avg: '$price' }
        }
      },
      {
        $project: {
          origin: '$_id.origin',
          destination: '$_id.destination',
          loads: 1,
          totalRevenue: 1,
          averagePrice: { $round: ['$averagePrice', 2] }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      status: 'success',
      data: topRoutes
    });

  } catch (error) {
    console.error('Top routes error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch top routes data'
    });
  }
});

// @route   GET /api/admin/analytics/export
// @desc    Export analytics data in various formats
// @access  Private
router.get('/analytics/export', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions?.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to export analytics.'
      });
    }

    const { 
      format = 'json',
      type = 'summary',
      period = '30d',
      include = 'all'
    } = req.query;

    const days = parseInt(period.replace('d', '')) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    let exportData = {};

    // Get data based on type
    switch (type) {
      case 'users':
        const userExportData = await Promise.allSettled([
          mongoose.connection.db.collection('drivers').find({
            createdAt: { $gte: startDate }
          }).project({
            _id: 1, name: 1, email: 1, location: 1, isVerified: 1, 
            isActive: 1, createdAt: 1
          }).toArray(),
          mongoose.connection.db.collection('cargo-owners').find({
            createdAt: { $gte: startDate }
          }).project({
            _id: 1, name: 1, email: 1, location: 1, isVerified: 1, 
            isActive: 1, createdAt: 1
          }).toArray()
        ]);
        
        exportData = {
          drivers: userExportData[0].status === 'fulfilled' ? userExportData[0].value : [],
          cargoOwners: userExportData[1].status === 'fulfilled' ? userExportData[1].value : []
        };
        break;

      case 'loads':
        exportDatas = await Load.find({
          createdAt: { $gte: startDate }
        }).select({
          title: 1, pickupLocation: 1, deliveryLocation: 1, weight: 1, 
          budget: 1, status: 1, isUrgent: 1, createdAt: 1, deliveredAt: 1
        }).lean().catch(() => []);
        break;

      case 'subscriptions':
        exportData.subscriptions = await Subscription.find({
          createdAt: { $gte: startDate }
        }).select({
          userId: 1, planId: 1, planName: 1, price: 1, status: 1, 
          paymentStatus: 1, createdAt: 1, activatedAt: 1, expiresAt: 1
        }).lean().catch(() => []);
        break;

      default: // summary
        const summaryData = await Promise.allSettled([
          mongoose.connection.db.collection('drivers').countDocuments({
            createdAt: { $gte: startDate }
          }),
          mongoose.connection.db.collection('cargo-owners').countDocuments({
            createdAt: { $gte: startDate }
          }),
          Load.countDocuments({ createdAt: { $gte: startDate } }).catch(() => 0),
          Subscription.countDocuments({ createdAt: { $gte: startDate } }).catch(() => 0)
        ]);

        exportData = {
          summary: {
            period: { start: startDate, end: endDate, days },
            drivers: summaryData[0].status === 'fulfilled' ? summaryData[0].value : 0,
            cargoOwners: summaryData[1].status === 'fulfilled' ? summaryData[1].value : 0,
            loads: summaryData[2].status === 'fulfilled' ? summaryData[2].value : 0,
            subscriptions: summaryData[3].status === 'fulfilled' ? summaryData[3].value : 0
          },
          exportedAt: new Date(),
          exportedBy: req.admin.name || 'Admin'
        };
    }

    // Handle different export formats
    switch (format.toLowerCase()) {
      case 'csv':
        // For CSV, we'll need to flatten the data structure
        let csvContent = '';
        if (type === 'users') {
          csvContent = 'Type,ID,Name,Email,Location,Verified,Active,Created\n';
          exportData.drivers?.forEach(driver => {
            csvContent += `Driver,${driver._id},${driver.name},${driver.email},${driver.location},${driver.isVerified},${driver.isActive},${driver.createdAt}\n`;
          });
          exportData.cargoOwners?.forEach(owner => {
            csvContent += `CargoOwner,${owner._id},${owner.name},${owner.email},${owner.location},${owner.isVerified},${owner.isActive},${owner.createdAt}\n`;
          });
        }
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-${type}-${period}.csv`);
        return res.send(csvContent);

      case 'xlsx':
        // For production, you'd want to use a library like xlsx or exceljs
        return res.status(501).json({
          status: 'error',
          message: 'XLSX export not implemented. Please use JSON or CSV format.'
        });

      default: // json
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-${type}-${period}.json`);
        return res.json({
          status: 'success',
          data: exportData,
          metadata: {
            exportType: type,
            format: format,
            period: period,
            exportedAt: new Date(),
            exportedBy: req.admin.name || 'Admin'
          }
        });
    }

  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error exporting analytics data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Optional: Add a stats refresh endpoint
router.post('/dashboard-stats/refresh', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.viewAnalytics) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied.'
      });
    }

    // Force refresh by making the same call as GET
    // This could be used to clear any caching if implemented later
    
    res.json({
      status: 'success',
      message: 'Dashboard statistics refresh initiated',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Dashboard stats refresh error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error refreshing dashboard statistics'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get users with pagination and search
// @access  Private
router.get('/users', 
  adminAuth, 
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isLength({ max: 100 }).withMessage('Search term too long'),
    query('userType').optional().isIn(['driver', 'cargo_owner']).withMessage('Invalid user type')
  ], 
  async (req, res) => {
    try {
      if (!req.admin.permissions.manageUsers) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You do not have permission to manage users.'
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

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const userType = req.query.userType;
      const skip = (page - 1) * limit;

      const db = mongoose.connection.db;

      // Build search query
      let searchQuery = {};
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        searchQuery = {
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { phone: searchRegex }
          ]
        };
      }

      // Get users from collections based on userType filter
      let allUsers = [];
      
      if (!userType || userType === 'driver') {
        const drivers = await db.collection('drivers').find(searchQuery)
          .project({ password: 0, loginHistory: 0, registrationIp: 0 })
          .toArray();
        allUsers.push(...drivers.map(user => ({ ...user, userType: 'driver' })));
      }
      
      if (!userType || userType === 'cargo_owner') {
        const cargoOwners = await db.collection('cargo-owners').find(searchQuery)
          .project({ password: 0, loginHistory: 0, registrationIp: 0 })
          .toArray();
        allUsers.push(...cargoOwners.map(user => ({ ...user, userType: 'cargo_owner' })));
      }

      // Get subscription info for each user
      const userIds = allUsers.map(user => user._id);
      const subscriptions = await Subscription.find({
        userId: { $in: userIds },
        status: 'active'
      }).select('userId planName status expiresAt');

      // Create subscription map
      const subscriptionMap = {};
      subscriptions.forEach(sub => {
        subscriptionMap[sub.userId.toString()] = {
          planName: sub.planName,
          status: sub.status,
          expiresAt: sub.expiresAt,
          isExpired: sub.expiresAt && new Date() > sub.expiresAt
        };
      });

      // Add subscription info to users
      allUsers = allUsers.map(user => ({
        ...user,
        subscription: subscriptionMap[user._id.toString()] || null
      }));

      // Sort by creation date (newest first)
      allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Apply pagination
      const total = allUsers.length;
      const users = allUsers.slice(skip, skip + limit);
      const totalPages = Math.ceil(total / limit);

      res.json({
        status: 'success',
        data: {
          users,
          total,
          totalPages,
          currentPage: page,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Server error fetching users'
      });
    }
  }
);

// @route   GET /api/admin/notifications
// @desc    Get all notifications for admin view
// @access  Private (Admin only)
router.get('/notifications', adminAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('unread').optional().isBoolean().withMessage('Unread must be boolean'),
  query('type').optional().isString().withMessage('Type must be a string'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high')
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
      unread,
      type,
      search,
      priority
    } = req.query;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    // Build query filter - Only notifications meant for admins
    const matchQuery = {
      $or: [
        // Notifications specifically for this admin
        { 
          userId: new mongoose.Types.ObjectId(req.admin.id),
          userType: 'admin' 
        },
        // System-wide notifications for all admins
        { 
          userType: 'admin',
          $or: [
            { userId: null },
            { userId: { $exists: false } }
          ]
        },
        // Admin-relevant notifications (subscription requests, user reports, etc.)
        {
          userType: 'admin',
          type: { 
            $in: [
              'subscription_request', 
              'user_registration', 
              'load_flagged',
              'payment_issue',
              'system_alert',
              'security_alert',
              'user_report',
              'document_verification_required',
              'high_value_transaction',
              'suspicious_activity'
            ] 
          }
        }
      ]
    };

    // Add additional filters
    if (unread !== undefined) {
      matchQuery.isRead = unread === 'true' ? false : true;
    }

    if (type && type !== 'all') {
      matchQuery.type = type;
    }

    if (priority) {
      matchQuery.priority = priority;
    }

    if (search) {
      matchQuery.$and = matchQuery.$and || [];
      matchQuery.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Get total count for pagination
    const totalNotifications = await notificationsCollection.countDocuments(matchQuery);

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalPages = Math.ceil(totalNotifications / parseInt(limit));

    // Fetch notifications with pagination and sorting
    const notifications = await notificationsCollection
      .find(matchQuery)
      .sort({ 
        priority: -1, // High priority first
        createdAt: -1  // Most recent first
      })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    // Get summary statistics for admin
    const summaryPipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          read: {
            $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] }
          },
          highPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          },
          pendingActions: {
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $eq: ['$isRead', false] },
                    { $in: ['$type', ['subscription_request', 'user_report', 'document_verification_required']] }
                  ]
                }, 
                1, 
                0
              ] 
            }
          }
        }
      }
    ];

    const summaryResult = await notificationsCollection.aggregate(summaryPipeline).toArray();
    const summary = summaryResult[0] || { 
      total: 0, 
      unread: 0, 
      read: 0, 
      highPriority: 0,
      pendingActions: 0 
    };

    // Enrich notifications with user information
    const enrichedNotifications = await Promise.all(
      notifications.map(async (notif) => {
        let userInfo = {};
        
        // Extract user info from notification data or fetch from database
        if (notif.data && notif.data.userId) {
          try {
            const userId = notif.data.userId;
            const userType = notif.data.userType || 
                           (notif.type === 'subscription_request' ? 'cargo_owner' : 'driver');
            
            const userCollection = userType === 'driver' ? 'drivers' : 
                                 userType === 'cargo_owner' ? 'cargo-owners' : 
                                 userType === 'admin' ? 'admins' : null;
            
            if (userCollection) {
              const user = await db.collection(userCollection).findOne(
                { _id: new mongoose.Types.ObjectId(userId) },
                { projection: { name: 1, email: 1, phone: 1, isVerified: 1, accountStatus: 1 } }
              );
              
              if (user) {
                userInfo = {
                  userName: user.name,
                  userEmail: user.email,
                  userPhone: user.phone,
                  userVerified: user.isVerified,
                  userStatus: user.accountStatus
                };
              } else {
                // Fallback to data in notification
                userInfo = {
                  userName: notif.data.userName || 'Unknown User',
                  userEmail: notif.data.userEmail || '',
                  userPhone: notif.data.userPhone || '',
                  userVerified: notif.data.userVerified || false,
                  userStatus: 'unknown'
                };
              }
            }
          } catch (userError) {
            console.error('Error fetching user info for notification:', userError);
            userInfo = {
              userName: notif.data.userName || 'Unknown User',
              userEmail: notif.data.userEmail || '',
              userPhone: notif.data.userPhone || ''
            };
          }
        }

        return {
          ...notif,
          ...userInfo,
          // Add action buttons based on notification type
          availableActions: getAvailableActions(notif.type, notif.data),
          // Add urgency indicator
          isUrgent: notif.priority === 'high' && !notif.isRead,
          // Add time indicators
          isRecent: (Date.now() - new Date(notif.createdAt).getTime()) < 24 * 60 * 60 * 1000,
          ageInHours: Math.floor((Date.now() - new Date(notif.createdAt).getTime()) / (1000 * 60 * 60))
        };
      })
    );

    res.json({
      status: 'success',
      data: {
        notifications: enrichedNotifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalNotifications,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        summary,
        filters: {
          unread: unread,
          type: type,
          search: search,
          priority: priority
        }
      }
    });

  } catch (error) {
    console.error('Admin get notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/notifications
// @desc    Create notification for admins (from drivers/users)
// @access  Private
router.post('/notifications', auth, [
  body('type').notEmpty().withMessage('Notification type is required'),
  body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required and cannot exceed 200 characters'),
  body('message').notEmpty().isLength({ max: 1000 }).withMessage('Message is required and cannot exceed 1000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('data').optional().isObject().withMessage('Data must be an object')
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
      type,
      title,
      message,
      priority = 'medium',
      data = {},
      icon,
      actionUrl,
      expiresAt
    } = req.body;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    // Create notification for all admins
    const notification = {
      userType: 'admin',
      type,
      title,
      message,
      priority,
      data,
      icon: icon || 'alert-triangle',
      actionUrl,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      sentBy: new mongoose.Types.ObjectId(req.user.id),
      sentByType: req.user.userType,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await notificationsCollection.insertOne(notification);

    res.status(201).json({
      status: 'success',
      message: 'Admin notification created successfully',
      data: {
        notificationId: result.insertedId
      }
    });

  } catch (error) {
    console.error('Create admin notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error creating admin notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to determine available actions for each notification type
function getAvailableActions(notificationType, notificationData) {
  switch (notificationType) {
    case 'subscription_request':
      return ['approve', 'reject', 'view_details'];
    case 'user_report':
      return ['investigate', 'dismiss', 'suspend_user'];
    case 'document_verification_required':
      return ['verify', 'reject_verification', 'request_resubmission'];
    case 'system_alert':
      return ['acknowledge', 'investigate'];
    case 'security_alert':
      return ['investigate', 'escalate', 'acknowledge'];
    default:
      return ['mark_read', 'delete'];
  }
}


// @route   GET /api/admin/notifications/summary
// @desc    Get notification summary for admin
// @access  Private (Admin only)
router.get('/notifications/summary', adminAuth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    // Admin-specific notification filter
    const adminNotificationFilter = {
      $or: [
        { 
          userId: new mongoose.Types.ObjectId(req.admin.id),
          userType: 'admin' 
        },
        { 
          userType: 'admin',
          $or: [
            { userId: null },
            { userId: { $exists: false } }
          ]
        },
        {
          userType: 'admin',
          type: { 
            $in: [
              'subscription_request', 
              'user_registration', 
              'load_flagged',
              'payment_issue',
              'system_alert',
              'security_alert',
              'user_report',
              'document_verification_required'
            ] 
          }
        }
      ]
    };

    // Get comprehensive summary for admin
    const summary = await notificationsCollection.aggregate([
      { $match: adminNotificationFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          read: {
            $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] }
          },
          highPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          },
          mediumPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] }
          },
          lowPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] }
          },
          subscriptionRequests: {
            $sum: { $cond: [{ $eq: ['$type', 'subscription_request'] }, 1, 0] }
          },
          userReports: {
            $sum: { $cond: [{ $eq: ['$type', 'user_report'] }, 1, 0] }
          },
          systemAlerts: {
            $sum: { $cond: [{ $eq: ['$type', 'system_alert'] }, 1, 0] }
          },
          securityAlerts: {
            $sum: { $cond: [{ $eq: ['$type', 'security_alert'] }, 1, 0] }
          },
          pendingActions: {
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $eq: ['$isRead', false] },
                    { $in: ['$type', ['subscription_request', 'user_report', 'document_verification_required']] }
                  ]
                }, 
                1, 
                0
              ] 
            }
          }
        }
      }
    ]).toArray();

    // Get type breakdown
    const typeBreakdown = await notificationsCollection.aggregate([
      { $match: adminNotificationFilter },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          highPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          }
        }
      },
      { $sort: { total: -1 } }
    ]).toArray();

    // Get recent notifications (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await notificationsCollection.countDocuments({
      ...adminNotificationFilter,
      createdAt: { $gte: yesterday }
    });

    // Get most urgent unread notifications
    const urgentNotifications = await notificationsCollection
      .find({
        ...adminNotificationFilter,
        isRead: false,
        priority: 'high'
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    const summaryData = summary[0] || { 
      total: 0, 
      unread: 0, 
      read: 0, 
      highPriority: 0, 
      mediumPriority: 0, 
      lowPriority: 0,
      subscriptionRequests: 0,
      userReports: 0,
      systemAlerts: 0,
      securityAlerts: 0,
      pendingActions: 0
    };

    res.json({
      status: 'success',
      data: {
        summary: summaryData,
        typeBreakdown: typeBreakdown.reduce((acc, item) => {
          acc[item._id] = { 
            total: item.total, 
            unread: item.unread,
            highPriority: item.highPriority 
          };
          return acc;
        }, {}),
        recentCount,
        urgentNotifications: urgentNotifications.map(notif => ({
          id: notif._id,
          type: notif.type,
          title: notif.title,
          createdAt: notif.createdAt,
          priority: notif.priority
        })),
        actionableCount: summaryData.pendingActions
      }
    });

  } catch (error) {
    console.error('Admin notification summary error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching notification summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/admin/notifications/read-all
// @desc    Mark all notifications as read (admin)
// @access  Private (Admin only)
router.put('/notifications/read-all', adminAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const result = await notificationsCollection.updateMany(
      { isRead: false },
      { 
        $set: { 
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    res.json({
      status: 'success',
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        updatedCount: result.modifiedCount,
        readAt: new Date()
      }
    });

  } catch (error) {
    console.error('Admin mark all notifications read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking all notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/admin/notifications/bulk-read
// @desc    Mark multiple notifications as read (admin)
// @access  Private (Admin only)
router.put('/notifications/bulk-read', adminAuth, [
  body('notificationIds')
    .isArray({ min: 1 })
    .withMessage('Notification IDs array is required')
    .custom((ids) => {
      return ids.every(id => mongoose.Types.ObjectId.isValid(id));
    })
    .withMessage('All notification IDs must be valid')
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

    const { notificationIds } = req.body;
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const objectIds = notificationIds.map(id => new mongoose.Types.ObjectId(id));

    const result = await notificationsCollection.updateMany(
      { 
        _id: { $in: objectIds },
        isRead: false
      },
      { 
        $set: { 
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    res.json({
      status: 'success',
      message: `${result.modifiedCount} notifications marked as read`,
      data: {
        requestedCount: notificationIds.length,
        updatedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Admin bulk read notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/admin/notifications/bulk-delete
// @desc    Delete multiple notifications (admin)
// @access  Private (Admin only)
router.delete('/notifications/bulk-delete', adminAuth, [
  body('notificationIds')
    .isArray({ min: 1 })
    .withMessage('Notification IDs array is required')
    .custom((ids) => {
      return ids.every(id => mongoose.Types.ObjectId.isValid(id));
    })
    .withMessage('All notification IDs must be valid')
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

    const { notificationIds } = req.body;
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const objectIds = notificationIds.map(id => new mongoose.Types.ObjectId(id));

    const result = await notificationsCollection.deleteMany({
      _id: { $in: objectIds }
    });

    res.json({
      status: 'success',
      message: `${result.deletedCount} notifications deleted`,
      data: {
        requestedCount: notificationIds.length,
        deletedCount: result.deletedCount
      }
    });

  } catch (error) {
    console.error('Admin bulk delete notifications error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/notifications/broadcast
// @desc    Send broadcast notification to selected users or all users
// @access  Private (Admin only)
router.post('/notifications/broadcast', adminAuth, [
  body('recipients').notEmpty().withMessage('Recipients configuration is required'),
  body('recipients.type').isIn(['all', 'selected', 'user_type', 'verified_only', 'active_only'])
    .withMessage('Recipients type must be: all, selected, user_type, verified_only, or active_only'),
  body('recipients.userType').optional().isIn(['driver', 'cargo_owner', 'admin'])
    .withMessage('User type must be driver, cargo_owner, or admin'),
  body('recipients.userIds').optional().isArray().withMessage('User IDs must be an array'),
  body('recipients.userIds.*').optional().isMongoId().withMessage('Each user ID must be valid'),
  body('notification.type').notEmpty().withMessage('Notification type is required'),
  body('notification.title').notEmpty().isLength({ max: 200 })
    .withMessage('Title is required and cannot exceed 200 characters'),
  body('notification.message').notEmpty().isLength({ max: 1000 })
    .withMessage('Message is required and cannot exceed 1000 characters'),
  body('notification.priority').optional().isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  body('scheduling.sendNow').optional().isBoolean().withMessage('Send now must be boolean'),
  body('scheduling.scheduledFor').optional().isISO8601().withMessage('Scheduled date must be valid ISO 8601 format')
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
      recipients,
      notification,
      scheduling = { sendNow: true }
    } = req.body;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Determine target users based on recipients configuration
    let targetUsers = [];
    let recipientCount = 0;

    switch (recipients.type) {
      case 'selected':
        if (!recipients.userIds || recipients.userIds.length === 0) {
          return res.status(400).json({
            status: 'error',
            message: 'User IDs are required for selected recipients'
          });
        }
        
        // Validate and get selected users
        for (const userId of recipients.userIds) {
          // Try to find user in drivers collection
          let user = await db.collection('drivers').findOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            { projection: { _id: 1, name: 1, email: 1, isActive: 1 } }
          );
          
          if (user) {
            targetUsers.push({
              userId: user._id,
              userType: 'driver',
              userName: user.name,
              userEmail: user.email,
              isActive: user.isActive
            });
          } else {
            // Try cargo-owners collection
            user = await db.collection('cargo-owners').findOne(
              { _id: new mongoose.Types.ObjectId(userId) },
              { projection: { _id: 1, name: 1, email: 1, isActive: 1 } }
            );
            
            if (user) {
              targetUsers.push({
                userId: user._id,
                userType: 'cargo_owner',
                userName: user.name,
                userEmail: user.email,
                isActive: user.isActive
              });
            }
          }
        }
        break;

      case 'user_type':
        if (!recipients.userType) {
          return res.status(400).json({
            status: 'error',
            message: 'User type is required for user_type recipients'
          });
        }
        
        const collection = recipients.userType === 'driver' ? 'drivers' : 
                          recipients.userType === 'cargo_owner' ? 'cargo-owners' : 
                          recipients.userType === 'admin' ? 'admins' : null;
        
        if (!collection) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid user type specified'
          });
        }
        
        const users = await db.collection(collection).find(
          { 
            $and: [
              { $or: [{ isActive: true }, { accountStatus: 'active' }] },
              { $or: [{ isActive: { $ne: false } }, { accountStatus: { $ne: 'suspended' } }] }
            ]
          },
          { projection: { _id: 1, name: 1, email: 1 } }
        ).toArray();
        
        targetUsers = users.map(user => ({
          userId: user._id,
          userType: recipients.userType,
          userName: user.name,
          userEmail: user.email
        }));
        break;

      case 'verified_only':
        const verificationFilter = { isVerified: true, isActive: true };
        
        const [verifiedDrivers, verifiedCargoOwners] = await Promise.all([
          db.collection('drivers').find(verificationFilter, 
            { projection: { _id: 1, name: 1, email: 1 } }).toArray(),
          db.collection('cargo-owners').find(verificationFilter, 
            { projection: { _id: 1, name: 1, email: 1 } }).toArray()
        ]);
        
        targetUsers = [
          ...verifiedDrivers.map(user => ({ 
            userId: user._id, userType: 'driver', userName: user.name, userEmail: user.email 
          })),
          ...verifiedCargoOwners.map(user => ({ 
            userId: user._id, userType: 'cargo_owner', userName: user.name, userEmail: user.email 
          }))
        ];
        break;

      case 'active_only':
        const activeFilter = { 
          $and: [
            { $or: [{ isActive: true }, { accountStatus: 'active' }] },
            { $or: [{ isActive: { $ne: false } }, { accountStatus: { $ne: 'suspended' } }] }
          ]
        };
        
        const [activeDrivers, activeCargoOwners] = await Promise.all([
          db.collection('drivers').find(activeFilter, 
            { projection: { _id: 1, name: 1, email: 1 } }).toArray(),
          db.collection('cargo-owners').find(activeFilter, 
            { projection: { _id: 1, name: 1, email: 1 } }).toArray()
        ]);
        
        targetUsers = [
          ...activeDrivers.map(user => ({ 
            userId: user._id, userType: 'driver', userName: user.name, userEmail: user.email 
          })),
          ...activeCargoOwners.map(user => ({ 
            userId: user._id, userType: 'cargo_owner', userName: user.name, userEmail: user.email 
          }))
        ];
        break;

      case 'all':
      default:
        // Send to all active users
        const [allDrivers, allCargoOwners] = await Promise.all([
          db.collection('drivers').find(
            { $or: [{ isActive: true }, { accountStatus: { $ne: 'suspended' } }] },
            { projection: { _id: 1, name: 1, email: 1 } }
          ).toArray(),
          db.collection('cargo-owners').find(
            { $or: [{ isActive: true }, { accountStatus: { $ne: 'suspended' } }] },
            { projection: { _id: 1, name: 1, email: 1 } }
          ).toArray()
        ]);
        
        targetUsers = [
          ...allDrivers.map(user => ({ 
            userId: user._id, userType: 'driver', userName: user.name, userEmail: user.email 
          })),
          ...allCargoOwners.map(user => ({ 
            userId: user._id, userType: 'cargo_owner', userName: user.name, userEmail: user.email 
          }))
        ];
        break;
    }

    if (targetUsers.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No eligible users found for the specified recipient criteria'
      });
    }

    recipientCount = targetUsers.length;

    // If scheduled for later, save as draft
    if (scheduling.scheduledFor && !scheduling.sendNow) {
      const scheduledNotification = {
        type: 'scheduled_broadcast',
        recipients,
        notification,
        scheduling,
        targetUserCount: recipientCount,
        createdBy: new mongoose.Types.ObjectId(req.admin.id),
        createdByName: req.admin.name,
        status: 'scheduled',
        createdAt: new Date(),
        scheduledFor: new Date(scheduling.scheduledFor)
      };

      const result = await db.collection('scheduled-notifications').insertOne(scheduledNotification);

      return res.status(201).json({
        status: 'success',
        message: 'Notification scheduled successfully',
        data: {
          scheduledNotificationId: result.insertedId,
          scheduledFor: scheduling.scheduledFor,
          targetUserCount: recipientCount,
          status: 'scheduled'
        }
      });
    }

    // Send notifications immediately
    const notificationsCollection = db.collection('notifications');
    const notifications = targetUsers.map(user => ({
      userId: user.userId,
      userType: user.userType,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority || 'medium',
      data: {
        ...notification.data,
        broadcastId: new mongoose.Types.ObjectId(),
        sentByAdmin: true,
        adminName: req.admin.name,
        adminEmail: req.admin.email
      },
      icon: notification.icon || getBroadcastIcon(notification.type),
      actionUrl: notification.actionUrl,
      expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : null,
      sentBy: new mongoose.Types.ObjectId(req.admin.id),
      sentByType: 'admin',
      sentByName: req.admin.name,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const result = await notificationsCollection.insertMany(notifications);

    // Log the broadcast action in audit logs
    const auditLog = {
      action: 'broadcast_notification',
      entityType: 'notification',
      adminId: new mongoose.Types.ObjectId(req.admin.id),
      adminName: req.admin.name,
      adminEmail: req.admin.email,
      details: {
        notificationType: notification.type,
        title: notification.title,
        recipientsType: recipients.type,
        targetUserType: recipients.userType,
        targetUserCount: recipientCount,
        sentCount: result.insertedCount,
        priority: notification.priority || 'medium'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      createdAt: new Date()
    };

    try {
      await db.collection('audit_logs').insertOne(auditLog);
    } catch (logError) {
      console.error('Failed to log broadcast action:', logError);
    }

    console.log('Broadcast notification sent:', {
      adminId: req.admin.id,
      notificationType: notification.type,
      recipientCount,
      sentCount: result.insertedCount
    });

    res.status(201).json({
      status: 'success',
      message: `Notification sent successfully to ${result.insertedCount} users`,
      data: {
        sentCount: result.insertedCount,
        targetUserCount: recipientCount,
        recipients: recipients.type,
        notificationIds: result.insertedIds,
        broadcastId: notifications[0]?.data?.broadcastId,
        sentAt: new Date()
      }
    });

  } catch (error) {
    console.error('Admin broadcast notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error broadcasting notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to get appropriate icon for broadcast notifications
function getBroadcastIcon(notificationType) {
  const iconMap = {
    'system_announcement': 'megaphone',
    'maintenance_notice': 'settings',
    'security_alert': 'shield-alert',
    'policy_update': 'file-text',
    'feature_announcement': 'star',
    'promotion': 'gift',
    'reminder': 'clock',
    'warning': 'alert-triangle',
    'celebration': 'party-popper'
  };
  
  return iconMap[notificationType] || 'bell';
}

// @route   GET /api/admin/notifications/stats
// @desc    Get detailed notification statistics (admin)
// @access  Private (Admin only)
router.get('/notifications/stats', adminAuth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    // Get comprehensive stats
    const stats = await notificationsCollection.aggregate([
      {
        $facet: {
          // Overall summary
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
                read: { $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] } }
              }
            }
          ],
          
          // By priority
          byPriority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } }
              }
            }
          ],
          
          // By type
          byType: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } }
              }
            },
            { $sort: { count: -1 } }
          ],
          
          // By user type
          byUserType: [
            {
              $group: {
                _id: '$userType',
                count: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } }
              }
            }
          ],
          
          // Recent trends (last 7 days)
          recentTrends: [
            {
              $match: {
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
              }
            },
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.date': 1 } }
          ]
        }
      }
    ]).toArray();

    const result = stats[0];

    res.json({
      status: 'success',
      data: {
        summary: result.summary[0] || { total: 0, unread: 0, read: 0 },
        byPriority: result.byPriority.reduce((acc, item) => {
          acc[item._id] = { count: item.count, unread: item.unread };
          return acc;
        }, {}),
        byType: result.byType.reduce((acc, item) => {
          acc[item._id] = { count: item.count, unread: item.unread };
          return acc;
        }, {}),
        byUserType: result.byUserType.reduce((acc, item) => {
          acc[item._id] = { count: item.count, unread: item.unread };
          return acc;
        }, {}),
        recentTrends: result.recentTrends.map(item => ({
          date: item._id.date,
          count: item.count
        }))
      }
    });

  } catch (error) {
    console.error('Admin notification stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching notification statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/admin/notifications/cleanup
// @desc    Clean up old notifications (admin only)
// @access  Private (Admin only)
router.delete('/notifications/cleanup', adminAuth, [
  body('olderThanDays').optional().isInt({ min: 1 }).withMessage('Days must be a positive integer'),
  body('deleteRead').optional().isBoolean().withMessage('Delete read must be boolean')
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

    const { olderThanDays = 30, deleteRead = true } = req.body;
    
    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    // Calculate cutoff date
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    // Build cleanup query
    const cleanupQuery = {
      createdAt: { $lt: cutoffDate }
    };

    if (deleteRead) {
      cleanupQuery.isRead = true;
    }

    const result = await notificationsCollection.deleteMany(cleanupQuery);

    // Log the cleanup action
    const auditLog = {
      adminId: new mongoose.Types.ObjectId(req.admin.id),
      adminName: req.admin.name,
      action: 'cleanup_notifications',
      details: `Deleted ${result.deletedCount} notifications older than ${olderThanDays} days`,
      deletedCount: result.deletedCount,
      criteria: { olderThanDays, deleteRead },
      timestamp: new Date(),
      ipAddress: req.ip
    };

    try {
      await db.collection('audit-logs').insertOne(auditLog);
    } catch (logError) {
      console.error('Failed to log cleanup action:', logError);
    }

    res.json({
      status: 'success',
      message: `${result.deletedCount} notifications deleted`,
      data: {
        deletedCount: result.deletedCount,
        criteria: { olderThanDays, deleteRead }
      }
    });

  } catch (error) {
    console.error('Admin notification cleanup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error cleaning up notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/notifications/system
// @desc    Create system notification (admin only)
// @access  Private (Admin only)
router.post('/notifications/system', adminAuth, [
  body('type').isIn(['system_maintenance', 'security_alert', 'policy_update', 'system_announcement'])
    .withMessage('Invalid system notification type'),
  body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required and cannot exceed 200 characters'),
  body('message').notEmpty().isLength({ max: 1000 }).withMessage('Message is required and cannot exceed 1000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('scheduledFor').optional().isISO8601().withMessage('Scheduled date must be valid ISO 8601 format')
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
      type,
      title,
      message,
      priority = 'medium',
      data = {},
      scheduledFor,
      userType = 'all'
    } = req.body;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Create system notification record
    const systemNotification = {
      type,
      title,
      message,
      priority,
      data,
      createdBy: new mongoose.Types.ObjectId(req.admin.id),
      createdByName: req.admin.name,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
      userType,
      status: scheduledFor ? 'scheduled' : 'sent',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // If not scheduled, send immediately
    if (!scheduledFor) {
      // Get target users
      let targetUsers = [];
      
      if (userType === 'all') {
        const [drivers, cargoOwners] = await Promise.all([
          db.collection('drivers').find({ status: { $ne: 'deleted' } }, { projection: { _id: 1 } }).toArray(),
          db.collection('cargo-owners').find({ status: { $ne: 'deleted' } }, { projection: { _id: 1 } }).toArray()
        ]);
        
        targetUsers = [
          ...drivers.map(user => ({ userId: user._id, userType: 'driver' })),
          ...cargoOwners.map(user => ({ userId: user._id, userType: 'cargo_owner' }))
        ];
      } else {
        const collection = userType === 'driver' ? 'drivers' : 'cargo-owners';
        const users = await db.collection(collection).find(
          { status: { $ne: 'deleted' } },
          { projection: { _id: 1 } }
        ).toArray();
        
        targetUsers = users.map(user => ({ userId: user._id, userType }));
      }

      // Create individual notifications
      const notifications = targetUsers.map(user => ({
        userId: user.userId,
        userType: user.userType,
        type,
        title,
        message,
        priority,
        data,
        icon: type === 'security_alert' ? 'alert-triangle' : 
              type === 'system_maintenance' ? 'settings' : 'info',
        sentBy: new mongoose.Types.ObjectId(req.admin.id),
        sentByType: 'admin',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      if (notifications.length > 0) {
        await db.collection('notifications').insertMany(notifications);
        systemNotification.sentCount = notifications.length;
      }
    }

    // Save system notification record
    const result = await db.collection('system-notifications').insertOne(systemNotification);

    // Log the action
    const auditLog = {
      adminId: new mongoose.Types.ObjectId(req.admin.id),
      adminName: req.admin.name,
      action: 'create_system_notification',
      details: `Created ${type} notification: "${title}"`,
      notificationId: result.insertedId,
      scheduledFor: systemNotification.scheduledFor,
      timestamp: new Date(),
      ipAddress: req.ip
    };

    try {
      await db.collection('audit-logs').insertOne(auditLog);
    } catch (logError) {
      console.error('Failed to log system notification creation:', logError);
    }

    res.status(201).json({
      status: 'success',
      message: scheduledFor ? 'System notification scheduled successfully' : 'System notification sent successfully',
      data: {
        notificationId: result.insertedId,
        sentCount: systemNotification.sentCount || 0,
        scheduledFor: systemNotification.scheduledFor,
        status: systemNotification.status
      }
    });

  } catch (error) {
    console.error('Create system notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error creating system notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/subscriptions
// @desc    Get subscriptions with optional status filter
// @access  Private
router.get('/subscriptions', 
  adminAuth, 
  [
    query('status').optional().isIn(['pending', 'active', 'expired', 'cancelled', 'rejected']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ], 
  async (req, res) => {
    try {
      if (!req.admin.permissions.managePayments) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. You do not have permission to manage subscriptions.'
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

      const status = req.query.status;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      // Build query
      let query = {};
      if (status === 'expired') {
        query = {
          status: 'active',
          expiresAt: { $lte: new Date() }
        };
      } else if (status) {
        query.status = status;
      }

      // Get subscriptions with user data
      const subscriptions = await Subscription.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'drivers',
            localField: 'userId',
            foreignField: '_id',
            as: 'driverUser'
          }
        },
        {
          $lookup: {
            from: 'cargo-owners',
            localField: 'userId',
            foreignField: '_id',
            as: 'cargoUser'
          }
        },
        {
          $addFields: {
            user: {
              $cond: {
                if: { $gt: [{ $size: '$driverUser' }, 0] },
                then: { $arrayElemAt: ['$driverUser', 0] },
                else: { $arrayElemAt: ['$cargoUser', 0] }
              }
            },
            userType: {
              $cond: {
                if: { $gt: [{ $size: '$driverUser' }, 0] },
                then: 'driver',
                else: 'cargo_owner'
              }
            }
          }
        },
        {
          $project: {
            driverUser: 0,
            cargoUser: 0,
            'user.password': 0,
            'user.loginHistory': 0
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      ]);

      const total = await Subscription.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      res.json({
        status: 'success',
        data: {
          subscriptions,
          total,
          totalPages,
          currentPage: page,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error('Get subscriptions error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Server error fetching subscriptions'
      });
    }
  }
);

// @route   GET /api/admin/analytics/kpi/:type
// @desc    Get specific KPI data
// @access  Private
router.get('/analytics/kpi/:type',adminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    let data = { value: 0, change: 0, trend: 'neutral' };

    switch (type) {
      case 'revenue':
        // Current month revenue
        const currentRevenue = await require('../models/subscription').Subscription.aggregate([
          {
            $match: {
              createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) },
              paymentStatus: 'completed'
            }
          },
          { $group: { _id: null, total: { $sum: '$price' } } }
        ]);

        // Previous month revenue
        const previousRevenue = await require('../models/subscription').Subscription.aggregate([
          {
            $match: {
              createdAt: { 
                $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                $lt: new Date(now.getFullYear(), now.getMonth(), 1)
              },
              paymentStatus: 'completed'
            }
          },
          { $group: { _id: null, total: { $sum: '$price' } } }
        ]);

        const currentRev = currentRevenue[0]?.total || 0;
        const previousRev = previousRevenue[0]?.total || 0;
        
        data = {
          value: currentRev,
          change: previousRev > 0 ? ((currentRev - previousRev) / previousRev * 100).toFixed(1) : 0,
          trend: currentRev > previousRev ? 'up' : currentRev < previousRev ? 'down' : 'neutral'
        };
        break;

      case 'users':
        // Current month new users
        const currentUsers = await Promise.all([
          require('mongoose').connection.db.collection('drivers').countDocuments({
            createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) }
          }),
          require('mongoose').connection.db.collection('cargo-owners').countDocuments({
            createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) }
          })
        ]);

        // Previous month new users
        const previousUsers = await Promise.all([
          require('mongoose').connection.db.collection('drivers').countDocuments({
            createdAt: { 
              $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
              $lt: new Date(now.getFullYear(), now.getMonth(), 1)
            }
          }),
          require('mongoose').connection.db.collection('cargo-owners').countDocuments({
            createdAt: { 
              $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
              $lt: new Date(now.getFullYear(), now.getMonth(), 1)
            }
          })
        ]);

        const currentUserCount = currentUsers[0] + currentUsers[1];
        const previousUserCount = previousUsers[0] + previousUsers[1];
        
        data = {
          value: currentUserCount,
          change: previousUserCount > 0 ? ((currentUserCount - previousUserCount) / previousUserCount * 100).toFixed(1) : 0,
          trend: currentUserCount > previousUserCount ? 'up' : currentUserCount < previousUserCount ? 'down' : 'neutral'
        };
        break;

      case 'subscriptions':
        // Current month subscription rate
        const totalUsersThisMonth = await Promise.all([
          require('mongoose').connection.db.collection('drivers').countDocuments(),
          require('mongoose').connection.db.collection('cargo-owners').countDocuments()
        ]);

        const activeSubscriptions = await require('../models/subscription').Subscription.countDocuments({
          status: 'active',
          expiresAt: { $gt: now }
        });

        const totalUsers = totalUsersThisMonth[0] + totalUsersThisMonth[1];
        const subscriptionRate = totalUsers > 0 ? ((activeSubscriptions / totalUsers) * 100) : 0;
        
        // Compare with last month's rate (simplified)
        const lastMonthRate = subscriptionRate - 2; // Placeholder calculation
        
        data = {
          value: `${subscriptionRate.toFixed(1)}%`,
          change: (subscriptionRate - lastMonthRate).toFixed(1),
          trend: subscriptionRate > lastMonthRate ? 'up' : subscriptionRate < lastMonthRate ? 'down' : 'neutral'
        };
        break;

      case 'loads':
        // Load completion rate
        const completedLoads = await require('../models/load').countDocuments({ status: 'completed' });
        const totalLoads = await require('../models/load').countDocuments();
        
        const completionRate = totalLoads > 0 ? ((completedLoads / totalLoads) * 100) : 0;
        
        data = {
          value: `${completionRate.toFixed(1)}%`,
          change: 2.3, // Placeholder - calculate actual change
          trend: 'up'
        };
        break;

      default:
        return res.status(400).json({
          status: 'error',
          message: 'Invalid KPI type'
        });
    }

    res.json({
      status: 'success',
      data
    });

  } catch (error) {
    console.error(`KPI ${req.params.type} error:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch KPI data'
    });
  }
});

// @route   POST /api/admin/users/:id/status
// @desc    Update user status (active/suspended)
router.post('/users/:id/status', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body;

  try {
    const db = mongoose.connection.db;
    const collections = ['drivers', 'cargo-owners'];
    let updated = null;
    let userType = null;

    for (const collectionName of collections) {
      const result = await db.collection(collectionName).findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { accountStatus: newStatus, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (result.value) {
        updated = result;
        userType = collectionName === 'drivers' ? 'driver' : 'cargo_owner';
        break;
      }
    }

    if (!updated.value) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    //  Correct audit log
    try {
      const auditLogsCollection = db.collection('audit_logs');
      await auditLogsCollection.insertOne({
        action: 'user_status_update',   
        entityType: 'user',         
        entityId: new mongoose.Types.ObjectId(id),
        adminId: new mongoose.Types.ObjectId(req.admin.id),
        adminName: req.admin.name,
        userId: id,    
        userType: userType,
        newStatus: newStatus,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        createdAt: new Date()
      });
    } catch (auditError) {
      console.warn('Audit log failed:', auditError);
    }

    res.json({
      status: 'success',
      message: 'Status updated',
      data: { user: updated.value }
    });

  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ status: 'error', message: 'Server error updating status' });
  }
});


// @route   POST /api/admin/users/:id/suspend
// @desc    Suspend a user
// @access  Private
router.post('/users/:id/suspend', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage users.'
      });
    }

    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    const db = mongoose.connection.db;
    const objectId = new mongoose.Types.ObjectId(userId);

    // Try to find and update in both collections
    const [driverResult, cargoOwnerResult] = await Promise.all([
      db.collection('drivers').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isActive: false,
            accountStatus: 'suspended',
            suspendedAt: new Date(),
            suspendedBy: req.admin.id,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      ),
      db.collection('cargo-owners').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isActive: false,
            accountStatus: 'suspended',
            suspendedAt: new Date(),
            suspendedBy: req.admin.id,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      )
    ]);

    const updatedUser = driverResult.value || cargoOwnerResult.value;
    const userType = driverResult.value ? 'driver' : 'cargo_owner';

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
try {
  const auditLogsCollection = db.collection('audit_logs');
  await auditLogsCollection.insertOne({
    action: 'user_suspend',   
    entityType: 'user',         
    entityId: new mongoose.Types.ObjectId(userId),
    adminId: new mongoose.Types.ObjectId(req.admin.id),
    adminName: req.admin.name,
    userId: userId,    
    userType: userType,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    createdAt: new Date()
  });
} catch (auditError) {
  console.warn('Audit log failed:', auditError);
}
  console.log('User suspended:', { id: userId, email: updatedUser.email, userType, admin: req.admin.id });

    res.json({
      status: 'success',
      message: 'User suspended successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        userType,
        isActive: updatedUser.isActive,
        accountStatus: updatedUser.accountStatus
      }
    });

  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error suspending user'
    });
  }
});

// @route   POST /api/admin/users/:id/activate
// @desc    Activate a user
// @access  Private
router.post('/users/:id/activate', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage users.'
      });
    }

    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    const db = mongoose.connection.db;
    const objectId = new mongoose.Types.ObjectId(userId);

    // Try to find and update in both collections
    const [driverResult, cargoOwnerResult] = await Promise.all([
      db.collection('drivers').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isActive: true,
            accountStatus: 'active',
            reactivatedAt: new Date(),
            reactivatedBy: req.admin.id,
            updatedAt: new Date()
          },
          $unset: {
            suspendedAt: 1,
            suspendedBy: 1
          }
        },
        { returnDocument: 'after' }
      ),
      db.collection('cargo-owners').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isActive: true,
            accountStatus: 'active',
            reactivatedAt: new Date(),
            reactivatedBy: req.admin.id,
            updatedAt: new Date()
          },
          $unset: {
            suspendedAt: 1,
            suspendedBy: 1
          }
        },
        { returnDocument: 'after' }
      )
    ]);

    const updatedUser = driverResult.value || cargoOwnerResult.value;
    const userType = driverResult.value ? 'driver' : 'cargo_owner';

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    try {
  const auditLogsCollection = db.collection('audit_logs');
  await auditLogsCollection.insertOne({
    action: 'user_activate',   
    entityType: 'user',         
    entityId: new mongoose.Types.ObjectId(userId),
    adminId: new mongoose.Types.ObjectId(req.admin.id),
    adminName: req.admin.name,
    userId: userId,    
    userType: userType,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    createdAt: new Date()
  });
} catch (auditError) {
  console.warn('Audit log failed:', auditError);
}
console.log('User activated:', { id: userId, email: updatedUser.email, userType, admin: req.admin.id });

    res.json({
      status: 'success',
      message: 'User activated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        userType,
        isActive: updatedUser.isActive,
        accountStatus: updatedUser.accountStatus
      }
    });

  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error activating user'
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user
// @access  Private
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.manageUsers || req.admin.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Only super admins can delete users.'
      });
    }

    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    const db = mongoose.connection.db;
    const objectId = new mongoose.Types.ObjectId(userId);

    // Try to delete from both collections
    const [driverResult, cargoOwnerResult] = await Promise.all([
      db.collection('drivers').findOneAndDelete({ _id: objectId }),
      db.collection('cargo-owners').findOneAndDelete({ _id: objectId })
    ]);

    const deletedUser = driverResult.value || cargoOwnerResult.value;
    const userType = driverResult.value ? 'driver' : 'cargo_owner';

    if (!deletedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    console.log('User deleted:', { id: userId, email: deletedUser.email, userType, admin: req.admin.id });

    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting user'
    });
  }
});

// @route   POST /api/admin/users/:id/verify
// @desc    Verify a user
// @access  Private
router.post('/users/:id/verify', adminAuth, async (req, res) => {
  try {
    if (!req.admin.permissions.manageUsers) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage users.'
      });
    }

    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    const db = mongoose.connection.db;
    const objectId = new mongoose.Types.ObjectId(userId);

    // Try to find and update in both collections
    const [driverResult, cargoOwnerResult] = await Promise.all([
      db.collection('drivers').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isVerified: true,
            verifiedAt: new Date(),
            verifiedBy: req.admin.id,
            updatedAt: new Date(),
            'driverProfile.verified': true,
            'driverProfile.verificationStatus': 'verified'
          }
        },
        { returnDocument: 'after' }
      ),
      db.collection('cargo-owners').findOneAndUpdate(
        { _id: objectId },
        { 
          $set: { 
            isVerified: true,
            verifiedAt: new Date(),
            verifiedBy: req.admin.id,
            updatedAt: new Date(),
            'cargoOwnerProfile.verified': true,
            'cargoOwnerProfile.verificationStatus': 'verified'
          }
        },
        { returnDocument: 'after' }
      )
    ]);

    const updatedUser = driverResult.value || cargoOwnerResult.value;
    const userType = driverResult.value ? 'driver' : 'cargo_owner';

    if (!updatedUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
try {
  const auditLogsCollection = db.collection('audit_logs');
  await auditLogsCollection.insertOne({
    action: 'user_verify',   
    entityType: 'user',         
    entityId: new mongoose.Types.ObjectId(userId),
    adminId: new mongoose.Types.ObjectId(req.admin.id),
    adminName: req.admin.name,
    userId: userId,    
    userType: userType,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    createdAt: new Date()
  });
} catch (auditError) {
  console.warn('Audit log failed:', auditError);
}
    console.log('User verified:', { id: userId, email: updatedUser.email, userType, admin: req.admin.id });

    res.json({
      status: 'success',
      message: 'User verified successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        userType,
        isVerified: updatedUser.isVerified
      }
    });

  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error verifying user'
    });
  }
});


// @route   PUT /api/admin/notifications/:id/read
// @desc    Mark notification as read (admin)
// @access  Private (Admin only)
router.put('/notifications/:id/read', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification ID'
      });
    }

    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const result = await notificationsCollection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { 
        $set: { 
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date()
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
      message: 'Notification marked as read',
      data: {
        notificationId: id,
        isRead: true,
        readAt: new Date()
      }
    });

  } catch (error) {
    console.error('Admin mark notification read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error marking notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/admin/notifications/:id
// @desc    Delete notification (admin)
// @access  Private (Admin only)
router.delete('/notifications/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification ID'
      });
    }

    const db = mongoose.connection.db;
    const notificationsCollection = db.collection('notifications');

    const result = await notificationsCollection.deleteOne({
      _id: new mongoose.Types.ObjectId(id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Admin delete notification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error deleting notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/subscriptions/:id/approve
// @desc    Approve a subscription
// @access  Private
router.post('/subscriptions/:id/approve', adminAuth, [
  body('paymentVerified').optional().isBoolean(),
  body('notes').optional().isLength({ max: 500 }),
  body('verificationDetails').optional().isObject()
], async (req, res) => {
  try {
    if (!req.admin.permissions.managePayments) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage subscriptions.'
      });
    }

    const subscriptionId = req.params.id;
    const { 
      paymentVerified = true, 
      notes = '', 
      verificationDetails = {} 
    } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
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

    //Find subscription by ID
    const subscription = await subscriptionsCollection.findOne({
      _id: new mongoose.Types.ObjectId(subscriptionId)
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

    // Calculate expiry from approval time, not original request time
    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + subscription.duration * 24 * 60 * 60 * 1000);

    const adminId = req.admin.id || req.admin._id || null;
    const adminName = req.admin.name || 'Admin';
    const adminEmail = req.admin.email || '';

    // Use transaction to ensure data consistency
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Update the subscription to active
        await subscriptionsCollection.updateOne(
          { _id: new mongoose.Types.ObjectId(subscriptionId) },
          {
            $set: {
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
            }
          },
          { session }
        );

        // Deactivate any other active premium subscriptions (keep basic as fallback)
        await subscriptionsCollection.updateMany(
          {
            userId: subscription.userId,
            _id: { $ne: new mongoose.Types.ObjectId(subscriptionId) },
            status: 'active',
            planId: { $ne: 'basic' } // Don't deactivate basic plan
          },
          {
            $set: {
              status: 'replaced',
              deactivatedAt: new Date(),
              replacedBy: new mongoose.Types.ObjectId(subscriptionId),
              updatedAt: new Date()
            }
          },
          { session }
        );

        // Update user's subscription record
        await usersCollection.updateOne(
          { _id: subscription.userId },
          {
            $set: {
              currentSubscription: new mongoose.Types.ObjectId(subscriptionId),
              subscriptionPlan: subscription.planId,
              subscriptionStatus: 'active',
              subscriptionExpiresAt: expiresAt,
              updatedAt: new Date()
            },
            $unset: { pendingSubscription: '' }
          },
          { session }
        );

        // Create user notification
        await notificationsCollection.insertOne({
          userId: subscription.userId,
          userType: 'cargo_owner',
          type: 'subscription_approved',
          title: 'Subscription Approved',
          message: `Your ${subscription.planName} subscription is now active until ${expiresAt.toLocaleDateString()}.`,
          data: {
            subscriptionId,
            planId: subscription.planId,
            planName: subscription.planName,
            activatedAt,
            expiresAt
          },
          isRead: false,
          priority: 'high',
          createdAt: new Date()
        }, { session });

        // Create audit log
        await auditLogsCollection.insertOne({
          action: 'subscription_approved',
          entityType: 'subscription',
          entityId: new mongoose.Types.ObjectId(subscriptionId),
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
            activatedAt,
            expiresAt,
            verificationDetails
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          createdAt: new Date()
        }, { session });
      });

      console.log('Subscription approved successfully:', { 
        subscriptionId, 
        userId: subscription.userId,
        planId: subscription.planId,
        adminId,
        activatedAt,
        expiresAt
      });

      res.json({
        status: 'success',
        message: 'Subscription approved successfully',
        data: {
          subscriptionId,
          approvedAt: activatedAt,
          expiresAt,
          approvedBy: adminName,
          planName: subscription.planName
        }
      });

    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error('Approve subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error approving subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// @route   POST /api/admin/subscriptions/:id/reject
// @desc    Reject a subscription
// @access  Private
router.post('/subscriptions/:id/reject', adminAuth, [
  body('reason').notEmpty().withMessage('Rejection reason is required'),
  body('reasonCategory').optional().isIn([
    'payment_failed', 'invalid_details', 'fraud_suspected', 'other'
  ]).withMessage('Valid reason category is required'),
  body('notes').optional().isLength({ max: 500 }),
  body('refundRequired').optional().isBoolean()
], async (req, res) => {
  try {
    if (!req.admin.permissions.managePayments) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. You do not have permission to manage subscriptions.'
      });
    }

    const subscriptionId = req.params.id;
    const {
      reason,
      reasonCategory = 'other',
      notes = '',
      refundRequired = false
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
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
      _id: new mongoose.Types.ObjectId(subscriptionId)
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
      { _id: new mongoose.Types.ObjectId(subscriptionId) },
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
        subscriptionId,
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

    console.log('Subscription rejected successfully:', { 
      subscriptionId, 
      userId: subscription.userId,
      reason,
      adminId 
    });

    res.json({
      status: 'success',
      message: 'Subscription rejected successfully',
      data: {
        subscriptionId,
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


// @route   PUT /api/admin/:id/toggle-status
// @desc    Toggle admin active status
// @access  Private (super_admin only)
router.put('/:id/toggle-status', adminAuth, async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. Only super admins can toggle admin status.'
      });
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({
        status: 'error',
        message: 'Admin not found'
      });
    }

    // Prevent super_admin from deactivating themselves
    if (admin._id.toString() === req.admin.id && req.admin.role === 'super_admin') {
      return res.status(400).json({
        status: 'error',
        message: 'Super admins cannot deactivate themselves'
      });
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    res.json({
      status: 'success',
      message: `Admin ${admin.isActive ? 'activated' : 'deactivated'} successfully`,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive
      }
    });

  } catch (error) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error toggling admin status'
    });
  }
});

module.exports = router;