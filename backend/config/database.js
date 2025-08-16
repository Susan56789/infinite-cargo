const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }
    
    mongoURI = mongoURI.trim();
    
    if (!mongoURI.startsWith('mongodb://') && !mongoURI.startsWith('mongodb+srv://')) {
      throw new Error('Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://');
    }
    
    const connectionOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      dbName: 'infinite-cargo',
      retryWrites: true,
      retryReads: true
    };

    const conn = await mongoose.connect(mongoURI, connectionOptions);

    // Create collections and indexes
    try {
      const collections = await conn.connection.db.listCollections().toArray();
      await createCollectionsAndIndexes(conn.connection.db, collections);
    } catch (listError) {
      await createCollectionsAndIndexes(conn.connection.db, []);
    }
    
    return conn;
    
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const createCollectionsAndIndexes = async (db, existingCollections) => {
  const requiredCollections = [
    { name: 'drivers', validator: getDriverValidator() },
    { name: 'cargo-owners', validator: getCargoOwnerValidator() },
    { name: 'admins', validator: getAdminValidator() },
    { name: 'bookings', validator: getBookingValidator() },
    { name: 'loads', validator: getLoadValidator() }
  ];
  
  try {
    for (const collectionConfig of requiredCollections) {
      const exists = existingCollections.some(col => col.name === collectionConfig.name);
      
      if (!exists) {
        try {
          await db.createCollection(collectionConfig.name, {
            validator: collectionConfig.validator
          });
        } catch (createError) {
          if (createError.code === 121) {
            await db.createCollection(collectionConfig.name);
          }
        }
      }
    }
    
    await createIndexes(db);
    
  } catch (error) {
    // Continue on setup errors
  }
};

const createIndexes = async (db) => {
  const indexOperations = [
    {
      collection: 'drivers',
      indexes: [
        { key: { email: 1 }, options: { unique: true, background: true } },
        { key: { phone: 1 }, options: { unique: true, background: true } },
        { key: { location: 1 }, options: { background: true } },
        { key: { 'driverProfile.verified': 1 }, options: { background: true } },
        { key: { createdAt: 1 }, options: { background: true } },
        { key: { 'driverProfile.isAvailable': 1 }, options: { background: true } },
        { key: { 'driverProfile.rating': -1 }, options: { background: true } }
      ]
    },
    {
      collection: 'cargo-owners',
      indexes: [
        { key: { email: 1 }, options: { unique: true, background: true } },
        { key: { phone: 1 }, options: { unique: true, background: true } },
        { key: { location: 1 }, options: { background: true } },
        { key: { 'cargoOwnerProfile.verified': 1 }, options: { background: true } },
        { key: { createdAt: 1 }, options: { background: true } },
        { key: { 'cargoOwnerProfile.rating': -1 }, options: { background: true } }
      ]
    },
    {
      collection: 'admins',
      indexes: [
        { key: { email: 1 }, options: { unique: true, background: true } },
        { key: { role: 1 }, options: { background: true } },
        { key: { createdAt: 1 }, options: { background: true } }
      ]
    },
    {
      collection: 'bookings',
      indexes: [
        { key: { driverId: 1 }, options: { background: true } },
        { key: { cargoOwnerId: 1 }, options: { background: true } },
        { key: { loadId: 1 }, options: { background: true } },
        { key: { status: 1 }, options: { background: true } },
        { key: { createdAt: 1 }, options: { background: true } },
        { key: { driverId: 1, status: 1 }, options: { background: true } },
        { key: { cargoOwnerId: 1, status: 1 }, options: { background: true } }
      ]
    },
    {
      collection: 'loads',
      indexes: [
        { key: { cargoOwnerId: 1 }, options: { background: true } },
        { key: { status: 1 }, options: { background: true } },
        { key: { pickupLocation: 1 }, options: { background: true } },
        { key: { deliveryLocation: 1 }, options: { background: true } },
        { key: { createdAt: 1 }, options: { background: true } },
        { key: { status: 1, createdAt: -1 }, options: { background: true } },
        { 
          key: { 
            pickupLocation: 'text', 
            deliveryLocation: 'text', 
            description: 'text' 
          }, 
          options: { 
            background: true,
            weights: {
              pickupLocation: 10,
              deliveryLocation: 10,
              description: 5
            }
          } 
        }
      ]
    }
  ];
  
  for (const operation of indexOperations) {
    const collection = db.collection(operation.collection);
    
    for (const indexDef of operation.indexes) {
      try {
        await collection.createIndex(indexDef.key, indexDef.options);
      } catch (error) {
        // Index might already exist
      }
    }
  }
};

function getDriverValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "password", "phone", "userType", "location"],
      properties: {
        name: { bsonType: "string", minLength: 2, maxLength: 50 },
        email: { bsonType: "string", pattern: "^\\S+@\\S+\\.\\S+$" },
        password: { bsonType: "string", minLength: 6 },
        phone: { bsonType: "string", pattern: "^(\\+254|0)[0-9]{9}$" },
        userType: { enum: ["driver"] },
        location: { bsonType: "string", minLength: 2, maxLength: 100 }
      }
    }
  };
}

function getCargoOwnerValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "password", "phone", "userType", "location"],
      properties: {
        name: { bsonType: "string", minLength: 2, maxLength: 50 },
        email: { bsonType: "string", pattern: "^\\S+@\\S+\\.\\S+$" },
        password: { bsonType: "string", minLength: 6 },
        phone: { bsonType: "string", pattern: "^(\\+254|0)[0-9]{9}$" },
        userType: { enum: ["cargo_owner"] },
        location: { bsonType: "string", minLength: 2, maxLength: 100 }
      }
    }
  };
}

function getAdminValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "password", "role"],
      properties: {
        name: { bsonType: "string", minLength: 2, maxLength: 50 },
        email: { bsonType: "string", pattern: "^\\S+@\\S+\\.\\S+$" },
        password: { bsonType: "string", minLength: 6 },
        role: { enum: ["admin", "super_admin"] }
      }
    }
  };
}

function getBookingValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["driverId", "cargoOwnerId", "loadId", "status"],
      properties: {
        status: { enum: ["pending", "accepted", "in_progress", "completed", "cancelled"] }
      }
    }
  };
}

function getLoadValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["cargoOwnerId", "pickupLocation", "deliveryLocation", "status"],
      properties: {
        status: { enum: ["available", "assigned", "in_transit", "delivered", "cancelled"] },
        pickupLocation: { bsonType: "string", minLength: 2 },
        deliveryLocation: { bsonType: "string", minLength: 2 }
      }
    }
  };
}

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
  try {
    await mongoose.connection.close(false);
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error.message);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = connectDB;