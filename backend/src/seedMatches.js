const mongoose = require('mongoose');
const Match = require('./models/Match');
require('dotenv').config();

const sampleMatches = [
  {
    sport: 'FOOTBALL',
    league: 'Premier League',
    country: 'England',
    homeTeam: 'Manchester United',
    awayTeam: 'Liverpool',
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    odds: { home: 2.10, draw: 3.40, away: 3.20 },
    status: 'UPCOMING'
  },
  {
    sport: 'FOOTBALL',
    league: 'Premier League',
    country: 'England',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    odds: { home: 2.30, draw: 3.30, away: 2.90 },
    status: 'UPCOMING'
  },
  {
    sport: 'FOOTBALL',
    league: 'Premier League',
    country: 'England',
    homeTeam: 'Manchester City',
    awayTeam: 'Tottenham',
    date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    odds: { home: 1.80, draw: 3.60, away: 4.20 },
    status: 'UPCOMING'
  },
  {
    sport: 'FOOTBALL',
    league: 'La Liga',
    country: 'Spain',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    odds: { home: 2.30, draw: 3.30, away: 2.90 },
    status: 'UPCOMING'
  },
  {
    sport: 'FOOTBALL',
    league: 'La Liga',
    country: 'Spain',
    homeTeam: 'Atletico Madrid',
    awayTeam: 'Sevilla',
    date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    odds: { home: 1.95, draw: 3.20, away: 4.00 },
    status: 'UPCOMING'
  },
  {
    sport: 'FOOTBALL',
    league: 'Serie A',
    country: 'Italy',
    homeTeam: 'Juventus',
    awayTeam: 'AC Milan',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    odds: { home: 1.95, draw: 3.20, away: 4.00 },
    status: 'UPCOMING'
  },
  {
    sport: 'FOOTBALL',
    league: 'Bundesliga',
    country: 'Germany',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    odds: { home: 1.65, draw: 3.80, away: 4.50 },
    status: 'UPCOMING'
  },
  {
    sport: 'FOOTBALL',
    league: 'Ligue 1',
    country: 'France',
    homeTeam: 'PSG',
    awayTeam: 'Marseille',
    date: new Date(), // Today
    odds: { home: 1.50, draw: 4.20, away: 6.00 },
    status: 'LIVE',
    score: { home: 1, away: 0 }
  },
  {
    sport: 'FOOTBALL',
    league: 'Premier League',
    country: 'England',
    homeTeam: 'Aston Villa',
    awayTeam: 'Newcastle',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
    odds: { home: 2.50, draw: 3.20, away: 2.80 },
    status: 'FINISHED',
    score: { home: 2, away: 1 }
  }
];

async function seedMatches() {
  try {
    // Connect to your database
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/betting_db';
    console.log('Connecting to:', mongoURI);
    
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
    console.log('📊 Database:', mongoose.connection.name);
    
    // Clear existing matches
    const deleted = await Match.deleteMany({});
    console.log(`🗑️  Deleted ${deleted.deletedCount} existing matches`);
    
    // Insert new matches
    const inserted = await Match.insertMany(sampleMatches);
    console.log(`✅ Inserted ${inserted.length} sample matches`);
    
    // List all matches
    const matches = await Match.find().sort({ date: 1 });
    console.log('\n📋 Current matches in database:');
    matches.forEach(match => {
      console.log(`   - ${match.homeTeam} vs ${match.awayTeam} (${match.league}) - ${match.status}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding matches:', error);
    process.exit(1);
  }
}

seedMatches();