// backend/scripts/fixTickets.js
const { MongoClient } = require('mongodb');

// Your MongoDB connection string
const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function fixTicketIds() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('betting_db');
    const betsCollection = db.collection('bets');

    // Find bets without ticketId
    const bets = await betsCollection.find({ 
      ticketId: { $exists: false } 
    }).toArray();
    
    console.log(`📊 Found ${bets.length} bets without ticket ID`);

    if (bets.length === 0) {
      console.log('✅ All bets already have ticket IDs');
      await client.close();
      return;
    }

    // Update each bet
    let updated = 0;
    for (const bet of bets) {
      const ticketId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      
      await betsCollection.updateOne(
        { _id: bet._id },
        { $set: { ticketId: ticketId } }
      );
      updated++;
      console.log(`✅ Updated bet ${bet._id} with ticket ID: ${ticketId}`);
    }

    console.log(`✅ Successfully updated ${updated} bets`);
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
    await client.close();
  }
}

fixTicketIds();