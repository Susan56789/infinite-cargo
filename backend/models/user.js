const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name must not exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^(\+254|0)[0-9]{9}$/, 'Please provide a valid Kenyan phone number']
  },
  userType: {
    type: String,
    required: [true, 'User type is required'],
    enum: {
      values: ['driver', 'cargo_owner'],
      message: 'User type must be either driver or cargo_owner'
    }
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
    maxlength: [100, 'Location must not exceed 100 characters']
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    pushNotifications: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false }
  },
  // Profile completion status
  profileCompleted: {
    type: Boolean,
    default: false
  },
  // Driver specific fields (only populated if userType is 'driver')
  driverProfile: {
    licenseNumber: { type: String, sparse: true },
    experienceYears: { type: Number, min: 0 },
    vehicleType: { type: String },
    verified: { type: Boolean, default: false }
  },
  // Cargo owner specific fields (only populated if userType is 'cargo_owner')
  cargoOwnerProfile: {
    companyName: { type: String, sparse: true },
    businessType: { type: String },
    verified: { type: Boolean, default: false }
  },
  // Keep role for admin functionality
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  }
}, {
  timestamps: true,
  // Transform JSON output to remove password
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  },
  // Define collection names based on userType
  discriminatorKey: 'userType'
});

// Create compound index to ensure email uniqueness across all user types
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ userType: 1 });
userSchema.index({ location: 1 });
userSchema.index({ 'driverProfile.verified': 1 });
userSchema.index({ 'cargoOwnerProfile.verified': 1 });

// Pre-save middleware to clean data
userSchema.pre('save', function(next) {
  if (this.email) {
    this.email = this.email.toLowerCase().trim();
  }
  if (this.phone) {
    this.phone = this.phone.trim();
  }
  if (this.name) {
    this.name = this.name.trim();
  }
  if (this.location) {
    this.location = this.location.trim();
  }
  next();
});

// Method to get collection name based on user type
userSchema.methods.getCollectionName = function() {
  return this.userType === 'driver' ? 'drivers' : 'cargo-owners';
};

// Static method to create user in appropriate collection
userSchema.statics.createUserInCollection = async function(userData) {
  const collectionName = userData.userType === 'driver' ? 'drivers' : 'cargo-owners';
  const collection = this.db.collection(collectionName);
  
  // Check for existing user by email in both collections
  const existingInDrivers = await this.db.collection('drivers').findOne({ email: userData.email });
  const existingInCargoOwners = await this.db.collection('cargo-owners').findOne({ email: userData.email });
  
  if (existingInDrivers || existingInCargoOwners) {
    const error = new Error('User with this email already exists');
    error.code = 11000;
    error.keyPattern = { email: 1 };
    throw error;
  }
  
  // Check for existing phone in both collections
  const existingPhoneDrivers = await this.db.collection('drivers').findOne({ phone: userData.phone });
  const existingPhoneCargoOwners = await this.db.collection('cargo-owners').findOne({ phone: userData.phone });
  
  if (existingPhoneDrivers || existingPhoneCargoOwners) {
    const error = new Error('User with this phone number already exists');
    error.code = 11000;
    error.keyPattern = { phone: 1 };
    throw error;
  }
  
  const result = await collection.insertOne({
    ...userData,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  return await collection.findOne({ _id: result.insertedId });
};

// Static method to find user across collections
userSchema.statics.findUserByEmail = async function(email) {
  const drivers = this.db.collection('drivers');
  const cargoOwners = this.db.collection('cargo-owners');
  
  let user = await drivers.findOne({ email: email.toLowerCase() });
  if (user) {
    user.userType = 'driver';
    return user;
  }
  
  user = await cargoOwners.findOne({ email: email.toLowerCase() });
  if (user) {
    user.userType = 'cargo_owner';
    return user;
  }
  
  return null;
};

// Create the base model
const User = mongoose.model('User', userSchema);

module.exports = User;