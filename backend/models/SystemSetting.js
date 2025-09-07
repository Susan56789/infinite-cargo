// models/systemSetting.js
const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9_]+$/,
    maxlength: 50
  },
  value: {
    type: mongoose.Schema.Types.Mixed, // Can store any type (string, number, boolean, object, array)
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['general', 'subscription', 'notification', 'security', 'payment', 'email', 'sms', 'maintenance'],
    default: 'general'
  },
  description: {
    type: String,
    required: true,
    maxlength: 200
  },
  dataType: {
    type: String,
    required: true,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    default: 'string'
  },
  isPublic: {
    type: Boolean,
    default: false,
    required: true
  },
  isRequired: {
    type: Boolean,
    default: false
  },
  validation: {
    min: Number,
    max: Number,
    minLength: Number,
    maxLength: Number,
    pattern: String,
    enum: [String]
  },
  defaultValue: mongoose.Schema.Types.Mixed,
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'system_settings'
});

// Indexes
systemSettingSchema.index({ key: 1 });
systemSettingSchema.index({ category: 1 });
systemSettingSchema.index({ isPublic: 1 });
systemSettingSchema.index({ category: 1, isPublic: 1 });

// Pre-save validation
systemSettingSchema.pre('save', function(next) {
  // Validate value type matches dataType
  if (this.dataType === 'string' && typeof this.value !== 'string') {
    return next(new Error(`Value must be a string for dataType 'string'`));
  }
  if (this.dataType === 'number' && typeof this.value !== 'number') {
    return next(new Error(`Value must be a number for dataType 'number'`));
  }
  if (this.dataType === 'boolean' && typeof this.value !== 'boolean') {
    return next(new Error(`Value must be a boolean for dataType 'boolean'`));
  }
  if (this.dataType === 'object' && (typeof this.value !== 'object' || Array.isArray(this.value))) {
    return next(new Error(`Value must be an object for dataType 'object'`));
  }
  if (this.dataType === 'array' && !Array.isArray(this.value)) {
    return next(new Error(`Value must be an array for dataType 'array'`));
  }

  // Apply validation rules
  if (this.validation) {
    if (this.dataType === 'string') {
      if (this.validation.minLength && this.value.length < this.validation.minLength) {
        return next(new Error(`Value must be at least ${this.validation.minLength} characters`));
      }
      if (this.validation.maxLength && this.value.length > this.validation.maxLength) {
        return next(new Error(`Value must be at most ${this.validation.maxLength} characters`));
      }
      if (this.validation.pattern && !new RegExp(this.validation.pattern).test(this.value)) {
        return next(new Error(`Value does not match required pattern`));
      }
      if (this.validation.enum && !this.validation.enum.includes(this.value)) {
        return next(new Error(`Value must be one of: ${this.validation.enum.join(', ')}`));
      }
    }
    
    if (this.dataType === 'number') {
      if (this.validation.min !== undefined && this.value < this.validation.min) {
        return next(new Error(`Value must be at least ${this.validation.min}`));
      }
      if (this.validation.max !== undefined && this.value > this.validation.max) {
        return next(new Error(`Value must be at most ${this.validation.max}`));
      }
    }
  }

  next();
});

// Static methods
systemSettingSchema.statics.getSetting = async function(key, defaultValue = null) {
  try {
    const setting = await this.findOne({ key: key.toLowerCase() });
    return setting ? setting.value : defaultValue;
  } catch (error) {
    console.error(`Error getting system setting ${key}:`, error);
    return defaultValue;
  }
};

systemSettingSchema.statics.setSetting = async function(key, value, adminId = null, description = null) {
  try {
    const updateData = {
      value,
      updatedAt: new Date()
    };
    
    if (adminId) {
      updateData.updatedBy = adminId;
    }
    
    if (description) {
      updateData.description = description;
    }
    
    const setting = await this.findOneAndUpdate(
      { key: key.toLowerCase() },
      updateData,
      { new: true, upsert: false }
    );
    
    return setting;
  } catch (error) {
    console.error(`Error setting system setting ${key}:`, error);
    throw error;
  }
};

systemSettingSchema.statics.getPublicSettings = async function() {
  try {
    const settings = await this.find({ isPublic: true }).select('key value category description');
    const publicSettings = {};
    settings.forEach(setting => {
      publicSettings[setting.key] = {
        value: setting.value,
        category: setting.category,
        description: setting.description
      };
    });
    return publicSettings;
  } catch (error) {
    console.error('Error getting public settings:', error);
    return {};
  }
};

systemSettingSchema.statics.getSettingsByCategory = async function(category) {
  try {
    const settings = await this.find({ category }).sort({ key: 1 });
    const categorySettings = {};
    settings.forEach(setting => {
      categorySettings[setting.key] = {
        value: setting.value,
        description: setting.description,
        dataType: setting.dataType,
        isPublic: setting.isPublic,
        validation: setting.validation,
        updatedAt: setting.updatedAt
      };
    });
    return categorySettings;
  } catch (error) {
    console.error(`Error getting settings for category ${category}:`, error);
    return {};
  }
};

// Instance methods
systemSettingSchema.methods.updateValue = async function(newValue, adminId = null) {
  this.value = newValue;
  this.updatedAt = new Date();
  if (adminId) {
    this.updatedBy = adminId;
  }
  return await this.save();
};

module.exports = mongoose.model('SystemSetting', systemSettingSchema);