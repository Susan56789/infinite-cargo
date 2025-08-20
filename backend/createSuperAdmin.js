const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Simple Super Admin Creator
 * This version bypasses potential schema issues by using direct MongoDB operations
 */
const createSuperAdminDirect = async () => {
  let connection;
  
  try {
    console.log('🚀 Creating Super Admin (Direct Method)...');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    connection = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true
    });
    
    console.log('✅ Connected successfully');
    console.log(`   Database: ${connection.connection.name}`);
    
    const db = connection.connection.db;
    const adminCollection = db.collection('admins');
    
    // Check if admin already exists
    const existingAdmin = await adminCollection.findOne({
      $or: [
        { email: 'infinitecargo254@gmail.com' },
        { phone: '0722483468' }
      ]
    });
    
    if (existingAdmin && !process.argv.includes('--force')) {
      console.log('⚠️  Admin already exists:');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log('\n💡 Use --force flag to override');
      return;
    }
    
    // Hash password
    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Admin@254Cargo!', salt);
    
    // Prepare admin document
    const adminDoc = {
      name: 'Dayib Gedi',
      email: 'infinitecargo254@gmail.com',
      password: hashedPassword,
      phone: '0722483468',
      role: 'super_admin',
      permissions: {
        manageUsers: true,
        manageCargo: true,
        manageDrivers: true,
        managePayments: true,
        viewAnalytics: true,
        systemSettings: true
      },
      isActive: true,
      createdBy: null,
      lastLogin: null,
      loginHistory: [],
      failedLoginAttempts: 0,
      accountLocked: false,
      lockUntil: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      profile: {
        avatar: null,
        department: 'Administration',
        bio: 'System Super Administrator'
      },
      settings: {
        emailNotifications: true,
        dashboardLayout: 'default',
        theme: 'light'
      },
      auditLog: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('👤 Creating super admin document...');
    
    let result;
    if (existingAdmin && process.argv.includes('--force')) {
      // Update existing
      console.log('🔄 Updating existing admin...');
      result = await adminCollection.replaceOne(
        { _id: existingAdmin._id },
        adminDoc
      );
      console.log(`   Modified: ${result.modifiedCount} document(s)`);
    } else {
      // Insert new
      console.log('➕ Inserting new admin...');
      result = await adminCollection.insertOne(adminDoc);
      console.log(`   Inserted ID: ${result.insertedId}`);
    }
    
    // Verify the creation
    console.log('🔍 Verifying admin creation...');
    const createdAdmin = await adminCollection.findOne({
      email: 'infinitecargo254@gmail.com'
    });
    
    if (createdAdmin) {
      console.log('✅ Super Admin created successfully!');
      console.log('\n📋 Admin Details:');
      console.log(`   ID: ${createdAdmin._id}`);
      console.log(`   Name: ${createdAdmin.name}`);
      console.log(`   Email: ${createdAdmin.email}`);
      console.log(`   Phone: ${createdAdmin.phone}`);
      console.log(`   Role: ${createdAdmin.role}`);
      console.log(`   Active: ${createdAdmin.isActive}`);
      console.log(`   Created: ${createdAdmin.createdAt}`);
      
      console.log('\n🛡️  Permissions:');
      Object.entries(createdAdmin.permissions).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
      
      console.log('\n🔑 Login Credentials:');
      console.log('   Email: infinitecargo254@gmail.com');
      console.log('   Password: Admin@254Cargo!');
      
    } else {
      console.log('❌ Failed to verify admin creation');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 11000) {
      console.error('   Duplicate key error - admin already exists');
    }
    throw error;
  } finally {
    if (connection) {
      await connection.connection.close();
      console.log('📥 Database connection closed');
    }
  }
};

/**
 * Test the created admin by attempting login
 */
const testAdminLogin = async () => {
  try {
    console.log('🧪 Testing admin login...');
    
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    const db = connection.connection.db;
    const adminCollection = db.collection('admins');
    
    // Find admin
    const admin = await adminCollection.findOne({
      email: 'infinitecargo254@gmail.com'
    });
    
    if (!admin) {
      console.log('❌ Admin not found');
      return false;
    }
    
    // Test password
    const passwordMatch = await bcrypt.compare('Admin@254Cargo!', admin.password);
    console.log(`Password test: ${passwordMatch ? '✅ Pass' : '❌ Fail'}`);
    
    // Test admin properties
    console.log(`Role check: ${admin.role === 'super_admin' ? '✅ Pass' : '❌ Fail'}`);
    console.log(`Active check: ${admin.isActive ? '✅ Pass' : '❌ Fail'}`);
    console.log(`Permissions check: ${admin.permissions.systemSettings ? '✅ Pass' : '❌ Fail'}`);
    
    await connection.connection.close();
    return passwordMatch && admin.role === 'super_admin' && admin.isActive;
    
  } catch (error) {
    console.error('❌ Login test error:', error.message);
    return false;
  }
};

/**
 * Create essential database indexes
 */
const createIndexes = async () => {
  try {
    console.log('📇 Creating database indexes...');
    
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    const db = connection.connection.db;
    const adminCollection = db.collection('admins');
    
    // Create unique indexes
    await adminCollection.createIndex({ email: 1 }, { unique: true });
    await adminCollection.createIndex({ phone: 1 }, { unique: true });
    await adminCollection.createIndex({ role: 1 });
    await adminCollection.createIndex({ isActive: 1 });
    await adminCollection.createIndex({ createdAt: 1 });
    
    console.log('✅ Indexes created successfully');
    
    await connection.connection.close();
  } catch (error) {
    console.error('❌ Index creation error:', error.message);
  }
};

// Command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    testAdminLogin();
  } else if (args.includes('--indexes')) {
    createIndexes();
  } else if (args.includes('--full')) {
    // Full setup: indexes + admin + test
    createIndexes()
      .then(() => createSuperAdminDirect())
      .then(() => testAdminLogin());
  } else {
    createSuperAdminDirect();
  }
}

module.exports = { 
  createSuperAdminDirect, 
  testAdminLogin, 
  createIndexes 
};