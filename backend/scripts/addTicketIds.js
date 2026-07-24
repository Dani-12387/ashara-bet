// backend/scripts/addTicketIds.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import Bet model - using the correct path from backend root
const Bet = require(path.join(__dirname, '..', 'models', 'Bet'));

const generateTicketId = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

const migrateTicketIds = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/betting_db';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
    console.log('📊 Database:', mongoose.connection.name);

    // Check if Bet model exists
    console.log('📁 Checking Bet model...');
    
    // Find all bets without ticketId
    const betsWithoutTicket = await Bet.find({ ticketId: { $exists: false } });
    console.log(`📊 Found ${betsWithoutTicket.length} bets without ticket ID`);

    if (betsWithoutTicket.length === 0) {
      console.log('✅ All bets already have ticket IDs');
      process.exit(0);
    }

    // Update each bet with a unique ticket ID
    let updated = 0;
    let failed = 0;
    
    for (const bet of betsWithoutTicket) {
      let ticketId;
      let isUnique = false;
      let attempts = 0;
      
      // Keep trying until we get a unique ticket ID
      while (!isUnique && attempts < 50) {
        ticketId = generateTicketId();
        const existing = await Bet.findOne({ ticketId });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }
      
      if (isUnique) {
        bet.ticketId = ticketId;
        await bet.save();
        updated++;
        console.log(`✅ Updated bet ${bet._id} with ticket ID: ${ticketId}`);
      } else {
        failed++;
        console.log(`⚠️ Could not generate unique ticket ID for bet ${bet._id}`);
      }
    }

    console.log(`✅ Successfully updated ${updated} bets with ticket IDs`);
    if (failed > 0) {
      console.log(`⚠️ Failed to update ${failed} bets`);
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
};

migrateTicketIds();