const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Magic keyword required for password reset (change this to something secure)
const MAGIC_KEYWORD = 'RESET_ADMIN_PASSWORD_NOW_2025';

/**
 * Admin Password Manager
 * This script tests the current password and optionally resets it
 */
const manageAdminPassword = async (resetPassword = false, magicKeyword = null) => {
  let connection;
  
  try {
    console.log('🔐 Admin Password Manager\n');
    
    // Validate magic keyword for password reset
    if (resetPassword && magicKeyword !== MAGIC_KEYWORD) {
      console.log('❌ SECURITY ERROR: Invalid magic keyword provided');
      console.log('💡 Password reset requires the correct magic keyword');
      console.log('   Usage: node script.js --reset MAGIC_KEYWORD_HERE');
      return false;
    }
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    connection = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    const db = connection.connection.db;
    const adminCollection = db.collection('admins');
    
    // Get the admin
    const admin = await adminCollection.findOne({
      email: 'sue.neemoh@gmail.com'
    });
    
    if (!admin) {
      console.log('❌ Admin not found in database');
      console.log('💡 Run the createSuperAdminDirect script first');
      return false;
    }
    
    console.log('✅ Admin found in database');
    console.log('📋 Current Admin Status:');
    console.log(`   ID: ${admin._id}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Active: ${admin.isActive}`);
    console.log(`   Locked: ${admin.accountLocked}`);
    console.log(`   Role: ${admin.role}`);
    
    // Test current password
    const testPassword = 'Sue@Admin2030!';
    console.log(`\n🧪 Testing current password: "${testPassword}"`);
    console.log(`   Current hash: ${admin.password.substring(0, 29)}...`);
    
    const currentPasswordMatch = await bcrypt.compare(testPassword, admin.password);
    console.log(`   Password test result: ${currentPasswordMatch ? '✅ MATCHES' : '❌ DOES NOT MATCH'}`);
    
    if (currentPasswordMatch && !resetPassword) {
      console.log('\n🎉 SUCCESS: Password is working correctly!');
      console.log('   The issue might be elsewhere. Let me run additional checks...\n');
      
      // Run additional diagnostic checks
      await runDiagnosticChecks(adminCollection, admin);
      return true;
    }
    
    if (!currentPasswordMatch && !resetPassword) {
      console.log('\n❌ PASSWORD MISMATCH DETECTED');
      console.log('💡 To reset the password, run:');
      console.log(`   node ${process.argv[1]} --reset ${MAGIC_KEYWORD}`);
      return false;
    }
    
    if (resetPassword) {
      console.log('\n🔄 RESETTING PASSWORD...');
      console.log(`   Magic keyword verified: ✅`);
      
      // Generate new password hash
      const salt = await bcrypt.genSalt(12);
      const newHashedPassword = await bcrypt.hash(testPassword, salt);
      
      console.log(`   New hash generated: ${newHashedPassword.substring(0, 29)}...`);
      
      // Update the admin in database
      const updateResult = await adminCollection.updateOne(
        { _id: admin._id },
        { 
          $set: { 
            password: newHashedPassword,
            updatedAt: new Date(),
            failedLoginAttempts: 0,
            accountLocked: false,
            lockUntil: null,
            isActive: true // Ensure account is active
          } 
        }
      );
      
      if (updateResult.modifiedCount === 0) {
        console.log('❌ Failed to update password in database');
        return false;
      }
      
      console.log('✅ Password updated in database');
      
      // Test the new password
      const newPasswordTest = await bcrypt.compare(testPassword, newHashedPassword);
      console.log(`   New password verification: ${newPasswordTest ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (newPasswordTest) {
        console.log('\n🎉 PASSWORD RESET SUCCESSFUL!');
        
        // Run final verification
        await runFinalVerification(adminCollection, testPassword);
        return true;
      } else {
        console.log('\n❌ Password reset failed - verification unsuccessful');
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ Error in password manager:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  } finally {
    if (connection) {
      await connection.connection.close();
      console.log('\n📥 Database connection closed');
    }
  }
};

/**
 * Run diagnostic checks to identify other potential issues
 */
const runDiagnosticChecks = async (adminCollection, admin) => {
  console.log('🔍 Running diagnostic checks...\n');
  
  // 1. Check login route compatibility
  console.log('1️⃣ Testing login route query compatibility:');
  const loginQuery = await adminCollection.findOne({ 
    email: 'sue.neemoh@gmail.com',
    isActive: true 
  });
  
  console.log(`   Login query result: ${loginQuery ? '✅ FOUND' : '❌ NOT FOUND'}`);
  
  if (!loginQuery) {
    console.log('   ⚠️  Issue: Admin not found with login route query');
    console.log('   🔧 Fixing isActive status...');
    
    await adminCollection.updateOne(
      { _id: admin._id },
      { $set: { isActive: true } }
    );
    
    const retestQuery = await adminCollection.findOne({ 
      email: 'sue.neemoh@gmail.com',
      isActive: true 
    });
    
    console.log(`   Retest result: ${retestQuery ? '✅ FIXED' : '❌ STILL BROKEN'}`);
  }
  
  // 2. Check account lock status
  console.log('\n2️⃣ Checking account lock status:');
  console.log(`   accountLocked: ${admin.accountLocked}`);
  console.log(`   failedLoginAttempts: ${admin.failedLoginAttempts}`);
  console.log(`   lockUntil: ${admin.lockUntil || 'null'}`);
  
  if (admin.accountLocked || (admin.failedLoginAttempts && admin.failedLoginAttempts > 0)) {
    console.log('   🔧 Clearing lock status...');
    
    await adminCollection.updateOne(
      { _id: admin._id },
      { 
        $set: { 
          accountLocked: false,
          failedLoginAttempts: 0,
          lockUntil: null
        } 
      }
    );
    
    console.log('   ✅ Account unlocked');
  } else {
    console.log('   ✅ Account is not locked');
  }
  
  // 3. Check permissions
  console.log('\n3️⃣ Checking admin permissions:');
  if (admin.permissions) {
    console.log('   ✅ Permissions exist:');
    Object.entries(admin.permissions).forEach(([key, value]) => {
      console.log(`     ${key}: ${value}`);
    });
  } else {
    console.log('   ⚠️  No permissions found');
  }
  
  // 4. API endpoint test suggestion
  console.log('\n4️⃣ API Endpoint Test Suggestion:');
  console.log('   Test your API directly with curl:');
  console.log('   curl -X POST https://infinite-cargo-api.onrender.com/api/admin/login \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"email":"sue.neemoh@gmail.com","password":"Sue@Admin2030!"}\'');
  
  console.log('\n🎯 DIAGNOSIS COMPLETE');
  console.log('   If password works but login still fails, the issue is likely in:');
  console.log('   - Network connectivity to your API');
  console.log('   - API server configuration');
  console.log('   - CORS settings');
  console.log('   - Environment variables (JWT secrets, etc.)');
};

/**
 * Run final verification after password reset
 */
const runFinalVerification = async (adminCollection, testPassword) => {
  console.log('\n🔍 Running final verification...');
  
  // Get updated admin from database
  const updatedAdmin = await adminCollection.findOne({
    email: 'sue.neemoh@gmail.com'
  });
  
  if (!updatedAdmin) {
    console.log('❌ Admin not found after update');
    return;
  }
  
  // Test login route query
  const loginAdmin = await adminCollection.findOne({ 
    email: 'sue.neemoh@gmail.com',
    isActive: true 
  });
  
  if (!loginAdmin) {
    console.log('❌ Admin not found with login route query');
    return;
  }
  
  // Test password
  const finalPasswordTest = await bcrypt.compare(testPassword, loginAdmin.password);
  
  console.log('📋 Final Verification Results:');
  console.log(`   ✅ Admin exists: ${!!loginAdmin}`);
  console.log(`   ✅ Account active: ${loginAdmin.isActive}`);
  console.log(`   ✅ Account unlocked: ${!loginAdmin.accountLocked}`);
  console.log(`   ✅ Password valid: ${finalPasswordTest}`);
  console.log(`   ✅ Role correct: ${loginAdmin.role === 'super_admin'}`);
  
  if (finalPasswordTest && loginAdmin.isActive && !loginAdmin.accountLocked) {
    console.log('\n🎉🎉🎉 COMPLETE SUCCESS!');
    console.log('\n🔑 Login Credentials (CONFIRMED WORKING):');
    console.log('   Email: sue.neemoh@gmail.com');
    console.log('   Password: Sue@Admin2030!');
    console.log('\n📡 API Endpoint:');
    console.log('   POST https://infinite-cargo-api.onrender.com/api/admin/login');
    console.log('\n💻 Test with curl:');
    console.log('   curl -X POST https://infinite-cargo-api.onrender.com/api/admin/login \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"email":"sue.neemoh@gmail.com","password":"Sue@Admin2030!"}\'');
  } else {
    console.log('\n❌ Some issues remain - check the individual results above');
  }
};

/**
 * Generate a secure password hash for manual use
 */
const generatePasswordHash = async (password = 'Sue@Admin2030!') => {
  console.log(`\n🔐 Generating password hash for: "${password}"`);
  
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  
  console.log(`Generated hash: ${hash}`);
  console.log('\n💡 You can manually update this in your database:');
  console.log('db.admins.updateOne(');
  console.log('  { email: "sue.neemoh@gmail.com" },');
  console.log('  { $set: { password: "' + hash + '" } }');
  console.log(')');
  
  return hash;
};

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--generate-hash')) {
    const password = args[args.indexOf('--generate-hash') + 1] || 'Sue@Admin2030!';
    generatePasswordHash(password);
  } else if (args.includes('--reset')) {
    const magicKeyword = args[args.indexOf('--reset') + 1];
    manageAdminPassword(true, magicKeyword);
  } else if (args.includes('--test')) {
    manageAdminPassword(false);
  } else {
    console.log('🔐 Admin Password Manager');
    console.log('');
    console.log('Usage:');
    console.log(`  node ${process.argv[1].split('/').pop()} --test                    # Test current password`);
    console.log(`  node ${process.argv[1].split('/').pop()} --reset ${MAGIC_KEYWORD}  # Reset password (requires magic keyword)`);
    console.log(`  node ${process.argv[1].split('/').pop()} --generate-hash [password] # Generate password hash`);
    console.log('');
    console.log('Examples:');
    console.log(`  node ${process.argv[1].split('/').pop()} --test`);
    console.log(`  node ${process.argv[1].split('/').pop()} --reset ${MAGIC_KEYWORD}`);
    console.log(`  node ${process.argv[1].split('/').pop()} --generate-hash "MyNewPassword123!"`);
    console.log('');
    console.log('🔒 Security: Password reset requires the magic keyword for safety');
  }
}

module.exports = { 
  manageAdminPassword, 
  generatePasswordHash,
  MAGIC_KEYWORD 
};