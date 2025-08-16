const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const { Subscription } = require('./models/subscription');

async function addFreeSubscriptionsToExistingUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    const cargoOwners = await db.collection('cargo-owners').find({}).toArray();
    
    console.log(`Found ${cargoOwners.length} cargo owners`);
    
    for (const owner of cargoOwners) {
      // Check if they already have a subscription
      const existingSubscription = await Subscription.findOne({ userId: owner._id });
      
      if (!existingSubscription) {
        await Subscription.createFreeSubscription(owner._id);
        console.log(`Created free subscription for user: ${owner.email}`);
      } else {
        console.log(`User ${owner.email} already has a subscription`);
      }
    }
    
    console.log('Migration completed');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run with: node addFreeSubscriptions.js
if (require.main === module) {
  addFreeSubscriptionsToExistingUsers();
}

module.exports = addFreeSubscriptionsToExistingUsers;