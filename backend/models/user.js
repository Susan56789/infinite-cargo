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
  },
  // Account status fields for better auth handling
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'pending'],
    default: 'active'
  },
  accountLocked: {
    type: Boolean,
    default: false
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
  try {
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
  } catch (error) {
    console.error('Error in createUserInCollection:', error);
    throw error;
  }
};

//  Static method to find user across collections with proper error handling
userSchema.statics.findUserByEmail = async function(email) {
  try {
    if (!email) {
      console.log('findUserByEmail: No email provided');
      return null;
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('findUserByEmail: Looking for user with email:', normalizedEmail);

    // Ensure database connection exists
    if (!this.db) {
      console.error('findUserByEmail: No database connection');
      throw new Error('Database connection not available');
    }

    const drivers = this.db.collection('drivers');
    const cargoOwners = this.db.collection('cargo-owners');
    
    // Search in drivers collection first
    let user = await drivers.findOne({ email: normalizedEmail });
    if (user) {
      console.log('findUserByEmail: User found in drivers collection');
      // Ensure userType is set correctly
      user.userType = 'driver';
      // Convert _id to string if it's an ObjectId for consistency
      if (user._id && typeof user._id === 'object') {
        user._id = user._id.toString();
      }
      return user;
    }
    
    // Search in cargo-owners collection
    user = await cargoOwners.findOne({ email: normalizedEmail });
    if (user) {
      console.log('findUserByEmail: User found in cargo-owners collection');
      // Ensure userType is set correctly
      user.userType = 'cargo_owner';
      // Convert _id to string if it's an ObjectId for consistency
      if (user._id && typeof user._id === 'object') {
        user._id = user._id.toString();
      }
      return user;
    }
    
    console.log('findUserByEmail: User not found in either collection');
    return null;

  } catch (error) {
    console.error('Error in findUserByEmail:', error);
    // Re-throw with more context
    throw new Error(`Database error while finding user: ${error.message}`);
  }
};

// Additional static method to find user by ID across collections
userSchema.statics.findUserById = async function(userId) {
  try {
    if (!userId) {
      console.log('findUserById: No userId provided');
      return null;
    }

    console.log('findUserById: Looking for user with ID:', userId);

    // Ensure database connection exists
    if (!this.db) {
      console.error('findUserById: No database connection');
      throw new Error('Database connection not available');
    }

    // Convert string ID to ObjectId if needed
    let objectId;
    try {
      objectId = mongoose.Types.ObjectId.isValid(userId) ? 
        new mongoose.Types.ObjectId(userId) : userId;
    } catch (e) {
      console.log('findUserById: Invalid ObjectId format');
      return null;
    }

    const drivers = this.db.collection('drivers');
    const cargoOwners = this.db.collection('cargo-owners');
    
    // Search in drivers collection first
    let user = await drivers.findOne({ _id: objectId });
    if (user) {
      console.log('findUserById: User found in drivers collection');
      user.userType = 'driver';
      if (user._id && typeof user._id === 'object') {
        user._id = user._id.toString();
      }
      return user;
    }
    
    // Search in cargo-owners collection
    user = await cargoOwners.findOne({ _id: objectId });
    if (user) {
      console.log('findUserById: User found in cargo-owners collection');
      user.userType = 'cargo_owner';
      if (user._id && typeof user._id === 'object') {
        user._id = user._id.toString();
      }
      return user;
    }
    
    console.log('findUserById: User not found in either collection');
    return null;

  } catch (error) {
    console.error('Error in findUserById:', error);
    throw new Error(`Database error while finding user by ID: ${error.message}`);
  }
};

// Method to update user across collections
userSchema.statics.updateUserByEmail = async function(email, updateData) {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find which collection the user is in
    const drivers = this.db.collection('drivers');
    const cargoOwners = this.db.collection('cargo-owners');
    
    let user = await drivers.findOne({ email: normalizedEmail });
    if (user) {
      await drivers.updateOne({ email: normalizedEmail }, { $set: updateData });
      return await drivers.findOne({ email: normalizedEmail });
    }
    
    user = await cargoOwners.findOne({ email: normalizedEmail });
    if (user) {
      await cargoOwners.updateOne({ email: normalizedEmail }, { $set: updateData });
      return await cargoOwners.findOne({ email: normalizedEmail });
    }
    
    return null;
  } catch (error) {
    console.error('Error in updateUserByEmail:', error);
    throw error;
  }
};

// Method to check if user exists by email
userSchema.statics.userExistsByEmail = async function(email) {
  try {
    const user = await this.findUserByEmail(email);
    return user !== null;
  } catch (error) {
    console.error('Error in userExistsByEmail:', error);
    return false;
  }
};

// Method to get user stats
userSchema.statics.getUserStats = async function() {
  try {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    const drivers = this.db.collection('drivers');
    const cargoOwners = this.db.collection('cargo-owners');
    
    const [driverCount, cargoOwnerCount] = await Promise.all([
      drivers.countDocuments(),
      cargoOwners.countDocuments()
    ]);
    
    return {
      totalUsers: driverCount + cargoOwnerCount,
      drivers: driverCount,
      cargoOwners: cargoOwnerCount
    };
  } catch (error) {
    console.error('Error in getUserStats:', error);
    throw error;
  }
};

// Create the base model
const User = mongoose.model('User', userSchema);

module.exports = User;