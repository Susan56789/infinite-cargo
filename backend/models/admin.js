// models/admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^(\+254|0)[0-9]{9}$/, 'Please provide a valid Kenyan phone number']
  },
  role: {
    type: String,
    enum: {
      values: ['super_admin', 'admin', 'moderator'],
      message: 'Role must be super_admin, admin, or moderator'
    },
    default: 'admin'
  },
  permissions: {
    manageUsers: {
      type: Boolean,
      default: true
    },
    manageCargo: {
      type: Boolean,
      default: true
    },
    manageDrivers: {
      type: Boolean,
      default: true
    },
    managePayments: {
      type: Boolean,
      default: false
    },
    viewAnalytics: {
      type: Boolean,
      default: true
    },
    systemSettings: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    ip: String,
    userAgent: String,
    success: {
      type: Boolean,
      default: true
    }
  }],
  failedLoginAttempts: {
    type: Number,
    default: 0,
    max: 5
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  lockUntil: {
    type: Date,
    default: null
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  profile: {
    avatar: {
      type: String,
      default: null
    },
    department: {
      type: String,
      trim: true,
      maxlength: 50
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  settings: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    dashboardLayout: {
      type: String,
      enum: ['default', 'compact', 'detailed'],
      default: 'default'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    }
  },
  auditLog: [{
    action: {
      type: String,
      required: true
    },
    target: {
      type: String, // user ID, load ID, etc.
      default: null
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ip: String,
    userAgent: String
  }]
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      return ret;
    }
  }
});

// Indexes for better performance
adminSchema.index({ email: 1 }, { unique: true });
adminSchema.index({ phone: 1 }, { unique: true });
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });
adminSchema.index({ lastLogin: -1 });

// Virtual for account lock status
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
adminSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to set permissions based on role
adminSchema.pre('save', function(next) {
  if (!this.isModified('role')) return next();

  // Set default permissions based on role
  switch (this.role) {
    case 'super_admin':
      this.permissions = {
        manageUsers: true,
        manageCargo: true,
        manageDrivers: true,
        managePayments: true,
        viewAnalytics: true,
        systemSettings: true
      };
      break;
    case 'admin':
      this.permissions = {
        manageUsers: true,
        manageCargo: true,
        manageDrivers: true,
        managePayments: false,
        viewAnalytics: true,
        systemSettings: false
      };
      break;
    case 'moderator':
      this.permissions = {
        manageUsers: false,
        manageCargo: true,
        manageDrivers: true,
        managePayments: false,
        viewAnalytics: true,
        systemSettings: false
      };
      break;
  }
  
  next();
});

// Method to check password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Method to handle failed login attempts
adminSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        lockUntil: 1
      },
      $set: {
        failedLoginAttempts: 1
      }
    });
  }

  const updates = { $inc: { failedLoginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.failedLoginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
      accountLocked: true
    };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
adminSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      failedLoginAttempts: 1,
      lockUntil: 1
    },
    $set: {
      accountLocked: false
    }
  });
};

// Method to add audit log entry
adminSchema.methods.addAuditLog = function(action, target = null, details = null, req = null) {
  const logEntry = {
    action,
    target,
    details,
    timestamp: new Date(),
    ...(req && {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })
  };

  this.auditLog.push(logEntry);
  
  // Keep only last 100 audit entries
  if (this.auditLog.length > 100) {
    this.auditLog = this.auditLog.slice(-100);
  }

  return this.save();
};

// Static method to find admin by email (including password)
adminSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

// Static method to create initial super admin
adminSchema.statics.createSuperAdmin = async function(adminData) {
  try {
    // Check if super admin already exists
    const existingSuperAdmin = await this.findOne({ role: 'super_admin' });
    if (existingSuperAdmin) {
      throw new Error('Super admin already exists');
    }

    // Create super admin with all permissions
    const superAdmin = new this({
      ...adminData,
      role: 'super_admin',
      isActive: true,
      permissions: {
        manageUsers: true,
        manageCargo: true,
        manageDrivers: true,
        managePayments: true,
        viewAnalytics: true,
        systemSettings: true
      }
    });

    await superAdmin.save();
    return superAdmin;
  } catch (error) {
    throw new Error(`Failed to create super admin: ${error.message}`);
  }
};

// Static method to get dashboard statistics
adminSchema.statics.getDashboardStats = async function() {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get counts from various collections
    const [
      totalAdmins,
      activeAdmins,
      totalDrivers,
      totalCargoOwners,
      newUsersThisMonth
    ] = await Promise.all([
      this.countDocuments(),
      this.countDocuments({ isActive: true }),
      db.collection('drivers').countDocuments(),
      db.collection('cargo-owners').countDocuments(),
      db.collection('drivers').countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      }) + db.collection('cargo-owners').countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      })
    ]);

    return {
      totalAdmins,
      activeAdmins,
      totalDrivers,
      totalCargoOwners,
      totalUsers: totalDrivers + totalCargoOwners,
      newUsersThisMonth,
      activeUsers: totalDrivers + totalCargoOwners // Simplified for now
    };
  } catch (error) {
    throw new Error(`Failed to get dashboard stats: ${error.message}`);
  }
};

module.exports = mongoose.model('Admin', adminSchema);