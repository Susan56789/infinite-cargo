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
      retryReads: true,
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 5000
      }
    };

    const conn = await mongoose.connect(mongoURI, connectionOptions);

    // Create collections and indexes
    try {
      const collections = await conn.connection.db.listCollections().toArray();
      await createCollectionsAndIndexes(conn.connection.db, collections);
    } catch (listError) {
      console.warn('Could not list existing collections, proceeding with creation:', listError.message);
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
    { 
      name: 'drivers', 
      validator: getDriverValidator(),
      indexes: getDriverIndexes()
    },
    { 
      name: 'cargo-owners', 
      validator: getCargoOwnerValidator(),
      indexes: getCargoOwnerIndexes()
    },
    { 
      name: 'admins', 
      validator: getAdminValidator(),
      indexes: getAdminIndexes()
    },
    { 
      name: 'bookings', 
      validator: getBookingValidator(),
      indexes: getBookingIndexes()
    },
    { 
      name: 'loads', 
      validator: getLoadValidator(),
      indexes: getLoadIndexes()
    },
    {
      name: 'subscriptions',
      validator: getSubscriptionValidator(),
      indexes: getSubscriptionIndexes()
    },
    {
      name: 'subscription_plans',
      validator: getSubscriptionPlanValidator(),
      indexes: getSubscriptionPlanIndexes()
    },
    {
      name: 'payment_methods',
      validator: getPaymentMethodValidator(),
      indexes: getPaymentMethodIndexes()
    },
    {
      name: 'system_settings',
      validator: getSystemSettingValidator(),
      indexes: getSystemSettingIndexes()
    },
    {
      name: 'audit_logs',
      validator: getAuditLogValidator(),
      indexes: getAuditLogIndexes()
    },
    {
      name: 'notifications',
      validator: getNotificationValidator(),
      indexes: getNotificationIndexes()
    }
  ];
  
  try {
    for (const collectionConfig of requiredCollections) {
      const exists = existingCollections.some(col => col.name === collectionConfig.name);
      
      if (!exists) {
        try {
          console.log(`Creating collection: ${collectionConfig.name}`);
          await db.createCollection(collectionConfig.name, {
            validator: collectionConfig.validator
          });
          console.log(`✅ Created collection: ${collectionConfig.name}`);
        } catch (createError) {
          if (createError.code === 121) {
            // Validator error, create without validator
            console.warn(`Validator error for ${collectionConfig.name}, creating without validator`);
            await db.createCollection(collectionConfig.name);
          } else {
            console.warn(`Error creating collection ${collectionConfig.name}:`, createError.message);
          }
        }
      }
      
      // Create indexes for the collection
      if (collectionConfig.indexes && collectionConfig.indexes.length > 0) {
        try {
          await createCollectionIndexes(db, collectionConfig.name, collectionConfig.indexes);
        } catch (indexError) {
          console.warn(`Error creating indexes for ${collectionConfig.name}:`, indexError.message);
        }
      }
    }
    
  } catch (error) {
    console.warn('Error in collection setup:', error.message);
  }
};

const createCollectionIndexes = async (db, collectionName, indexes) => {
  const collection = db.collection(collectionName);
  
  for (const indexDef of indexes) {
    try {
      await collection.createIndex(indexDef.key, indexDef.options || {});
      console.log(`✅ Created index for ${collectionName}: ${JSON.stringify(indexDef.key)}`);
    } catch (error) {
      if (error.code !== 85) { // Index already exists
        console.warn(`Index creation failed for ${collectionName}:`, error.message);
      }
    }
  }
};

// Collection validators
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
        location: { bsonType: "string", minLength: 2, maxLength: 100 },
        isActive: { bsonType: "bool" }
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
        location: { bsonType: "string", minLength: 2, maxLength: 100 },
        isActive: { bsonType: "bool" }
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
        role: { enum: ["admin", "moderator", "super_admin"] },
        isActive: { bsonType: "bool" }
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
        status: { enum: ["pending", "accepted", "rejected", "in_progress", "completed", "cancelled"] },
        driverId: { bsonType: "objectId" },
        cargoOwnerId: { bsonType: "objectId" },
        loadId: { bsonType: "objectId" }
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
        deliveryLocation: { bsonType: "string", minLength: 2 },
        cargoOwnerId: { bsonType: "objectId" }
      }
    }
  };
}

function getSubscriptionValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["cargoOwnerId", "planId", "status", "startDate", "endDate"],
      properties: {
        cargoOwnerId: { bsonType: "objectId" },
        planId: { bsonType: "string", minLength: 1 },
        status: { enum: ["active", "expired", "cancelled", "pending", "suspended"] },
        paymentStatus: { enum: ["pending", "completed", "failed", "refunded"] },
        startDate: { bsonType: "date" },
        endDate: { bsonType: "date" },
        amount: { bsonType: "number", minimum: 0 }
      }
    }
  };
}

function getSubscriptionPlanValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["planId", "name", "price", "currency", "duration", "features"],
      properties: {
        planId: { 
          bsonType: "string", 
          minLength: 1, 
          maxLength: 30,
          pattern: "^[a-z0-9_]+$"
        },
        name: { bsonType: "string", minLength: 1, maxLength: 100 },
        price: { bsonType: "number", minimum: 0 },
        currency: { enum: ["KES", "USD", "EUR", "GBP"] },
        duration: { bsonType: "int", minimum: 1 },
        isActive: { bsonType: "bool" }
      }
    }
  };
}

function getPaymentMethodValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["methodId", "displayName", "enabled"],
      properties: {
        methodId: { 
          bsonType: "string", 
          minLength: 1, 
          maxLength: 30,
          pattern: "^[a-z0-9_]+$"
        },
        displayName: { bsonType: "string", minLength: 1, maxLength: 50 },
        enabled: { bsonType: "bool" },
        minimumAmount: { bsonType: "number", minimum: 0 },
        maximumAmount: { bsonType: "number", minimum: 1 }
      }
    }
  };
}

function getSystemSettingValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["key", "value", "category", "dataType"],
      properties: {
        key: { 
          bsonType: "string", 
          minLength: 1, 
          maxLength: 50,
          pattern: "^[a-z0-9_]+$"
        },
        category: { enum: ["general", "subscription", "notification", "security", "payment", "email", "sms", "maintenance"] },
        dataType: { enum: ["string", "number", "boolean", "object", "array"] },
        isPublic: { bsonType: "bool" }
      }
    }
  };
}

function getAuditLogValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["action", "entityType", "adminId"],
      properties: {
        action: { bsonType: "string", minLength: 1 },
        entityType: { bsonType: "string", minLength: 1 },
        adminId: { bsonType: "objectId" },
        entityId: { bsonType: "objectId" },
        createdAt: { bsonType: "date" }
      }
    }
  };
}

function getNotificationValidator() {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "title", "message", "type"],
      properties: {
        userId: { bsonType: "objectId" },
        title: { bsonType: "string", minLength: 1, maxLength: 200 },
        message: { bsonType: "string", minLength: 1, maxLength: 1000 },
        type: { enum: ["info", "success", "warning", "error", "system"] },
        isRead: { bsonType: "bool" }
      }
    }
  };
}

// Index definitions
function getDriverIndexes() {
  return [
    { key: { email: 1 }, options: { unique: true, background: true } },
    { key: { phone: 1 }, options: { unique: true, background: true } },
    { key: { location: 1 }, options: { background: true } },
    { key: { 'driverProfile.verified': 1 }, options: { background: true } },
    { key: { createdAt: 1 }, options: { background: true } },
    { key: { 'driverProfile.isAvailable': 1 }, options: { background: true } },
    { key: { 'driverProfile.rating': -1 }, options: { background: true } },
    { key: { isActive: 1 }, options: { background: true } }
  ];
}

function getCargoOwnerIndexes() {
  return [
    { key: { email: 1 }, options: { unique: true, background: true } },
    { key: { phone: 1 }, options: { unique: true, background: true } },
    { key: { location: 1 }, options: { background: true } },
    { key: { 'cargoOwnerProfile.verified': 1 }, options: { background: true } },
    { key: { createdAt: 1 }, options: { background: true } },
    { key: { 'cargoOwnerProfile.rating': -1 }, options: { background: true } },
    { key: { isActive: 1 }, options: { background: true } }
  ];
}

function getAdminIndexes() {
  return [
    { key: { email: 1 }, options: { unique: true, background: true } },
    { key: { phone: 1 }, options: { background: true } },
    { key: { role: 1 }, options: { background: true } },
    { key: { isActive: 1 }, options: { background: true } },
    { key: { createdAt: 1 }, options: { background: true } }
  ];
}

function getBookingIndexes() {
  return [
    { key: { driverId: 1 }, options: { background: true } },
    { key: { cargoOwnerId: 1 }, options: { background: true } },
    { key: { loadId: 1 }, options: { background: true } },
    { key: { status: 1 }, options: { background: true } },
    { key: { createdAt: -1 }, options: { background: true } },
    { key: { driverId: 1, status: 1 }, options: { background: true } },
    { key: { cargoOwnerId: 1, status: 1 }, options: { background: true } },
    { key: { loadId: 1, status: 1 }, options: { background: true } }
  ];
}

function getLoadIndexes() {
  return [
    { key: { cargoOwnerId: 1 }, options: { background: true } },
    { key: { status: 1 }, options: { background: true } },
    { key: { pickupLocation: 1 }, options: { background: true } },
    { key: { deliveryLocation: 1 }, options: { background: true } },
    { key: { createdAt: -1 }, options: { background: true } },
    { key: { status: 1, createdAt: -1 }, options: { background: true } },
    { key: { cargoOwnerId: 1, status: 1 }, options: { background: true } },
    { 
      key: { 
        pickupLocation: 'text', 
        deliveryLocation: 'text', 
        description: 'text' 
      }, 
      options: { 
        background: true,
        name: 'load_text_search',
        weights: {
          pickupLocation: 10,
          deliveryLocation: 10,
          description: 5
        }
      } 
    }
  ];
}

function getSubscriptionIndexes() {
  return [
    { key: { cargoOwnerId: 1 }, options: { background: true } },
    { key: { planId: 1 }, options: { background: true } },
    { key: { status: 1 }, options: { background: true } },
    { key: { paymentStatus: 1 }, options: { background: true } },
    { key: { startDate: 1 }, options: { background: true } },
    { key: { endDate: 1 }, options: { background: true } },
    { key: { createdAt: -1 }, options: { background: true } },
    { key: { cargoOwnerId: 1, status: 1 }, options: { background: true } },
    { key: { status: 1, endDate: 1 }, options: { background: true } },
    { key: { paymentStatus: 1, createdAt: -1 }, options: { background: true } }
  ];
}

function getSubscriptionPlanIndexes() {
  return [
    { key: { planId: 1 }, options: { unique: true, background: true } },
    { key: { isActive: 1 }, options: { background: true } },
    { key: { isVisible: 1 }, options: { background: true } },
    { key: { displayOrder: 1 }, options: { background: true } },
    { key: { isActive: 1, isVisible: 1, displayOrder: 1 }, options: { background: true } },
    { key: { price: 1 }, options: { background: true } },
    { key: { targetAudience: 1 }, options: { background: true } },
    { key: { validFrom: 1, validUntil: 1 }, options: { background: true } },
    { key: { isPopular: 1 }, options: { background: true } },
    { key: { createdAt: -1 }, options: { background: true } }
  ];
}

function getPaymentMethodIndexes() {
  return [
    { key: { methodId: 1 }, options: { unique: true, background: true } },
    { key: { enabled: 1 }, options: { background: true } },
    { key: { displayOrder: 1 }, options: { background: true } },
    { key: { enabled: 1, displayOrder: 1 }, options: { background: true } },
    { key: { createdAt: -1 }, options: { background: true } }
  ];
}

function getSystemSettingIndexes() {
  return [
    { key: { key: 1 }, options: { unique: true, background: true } },
    { key: { category: 1 }, options: { background: true } },
    { key: { isPublic: 1 }, options: { background: true } },
    { key: { category: 1, isPublic: 1 }, options: { background: true } },
    { key: { updatedAt: -1 }, options: { background: true } }
  ];
}

function getAuditLogIndexes() {
  return [
    { key: { createdAt: -1 }, options: { background: true } },
    { key: { adminId: 1 }, options: { background: true } },
    { key: { action: 1 }, options: { background: true } },
    { key: { entityType: 1 }, options: { background: true } },
    { key: { entityId: 1 }, options: { background: true } },
    { key: { adminId: 1, createdAt: -1 }, options: { background: true } },
    { key: { entityType: 1, action: 1 }, options: { background: true } },
    { key: { createdAt: 1 }, options: { expireAfterSeconds: 31536000, background: true } } // Auto-delete after 1 year
  ];
}

function getNotificationIndexes() {
  return [
    { key: { userId: 1 }, options: { background: true } },
    { key: { createdAt: -1 }, options: { background: true } },
    { key: { isRead: 1 }, options: { background: true } },
    { key: { type: 1 }, options: { background: true } },
    { key: { userId: 1, isRead: 1, createdAt: -1 }, options: { background: true } },
    { key: { userId: 1, type: 1 }, options: { background: true } }
  ];
}

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('🚀 MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('📡 MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconnected');
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
  try {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    
    await mongoose.connection.close(false);
    console.log('✅ MongoDB connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
};

// Signal handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// MongoDB connection monitoring
setInterval(async () => {
  try {
    if (mongoose.connection.readyState === 1) { // Connected
      const serverStatus = await mongoose.connection.db.admin().serverStatus();
      const connections = serverStatus.connections;
      
      if (connections.current > connections.available * 0.8) {
        console.warn('⚠️  High connection usage:', {
          current: connections.current,
          available: connections.available,
          usage: Math.round((connections.current / connections.available) * 100) + '%'
        });
      }
    }
  } catch (error) {
    
  }
}, 60000); 

module.exports = connectDB;