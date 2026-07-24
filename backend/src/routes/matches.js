const express = require('express');
const router = express.Router();
const Match = require('../models/Match');

// Get all active matches for users
router.get('/matches', async (req, res) => {
  try {
    const { sport, league, country, date } = req.query;
    let query = { isActive: true };

    // Apply filters
    if (sport) query.sport = sport;
    if (league) query.league = league;
    if (country) query.country = country;
    
    // Date filtering
    if (date === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (date === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const endOfTomorrow = new Date(tomorrow);
      endOfTomorrow.setHours(23, 59, 59, 999);
      query.date = { $gte: tomorrow, $lte: endOfTomorrow };
    } else if (date === 'week') {
      const startOfWeek = new Date();
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      endOfWeek.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfWeek, $lte: endOfWeek };
    }

    // ===== IMPORTANT: Make sure to fetch the markets field =====
    const matches = await Match.find(query)
      .sort({ date: 1, league: 1 })
      .lean();

    // Debug: Log matches with markets
    console.log(`Found ${matches.length} matches`);
    matches.forEach(m => {
      console.log(`Match: ${m.homeTeam} vs ${m.awayTeam}`);
      console.log(`  - markets:`, m.markets ? Object.keys(m.markets) : 'No markets');
      console.log(`  - markets data:`, m.markets);
    });

    // Group by league
    const groupedByLeague = matches.reduce((acc, match) => {
      if (!acc[match.league]) {
        acc[match.league] = {
          league: match.league,
          country: match.country,
          matches: []
        };
      }
      acc[match.league].matches.push(match);
      return acc;
    }, {});

    // Get unique leagues and countries
    const leagues = [...new Set(matches.map(m => m.league))];
    const countries = [...new Set(matches.map(m => m.country))];

    res.json({
      success: true,
      matches,
      groupedMatches: Object.values(groupedByLeague),
      filters: { leagues, countries },
      total: matches.length
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Get single match details
router.get('/matches/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    res.json({ success: true, match });
  } catch (error) {
    console.error('Error fetching match:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;