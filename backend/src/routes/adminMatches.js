const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// ✅ Helper: Create date without timezone offset
const createLocalDate = (dateString) => {
  if (!dateString) return null;
  
  // Parse the date string
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  
  // Get local time components without timezone offset
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  // Create date using local components (no timezone offset)
  // This preserves the exact time the admin entered
  return new Date(year, month, day, hours, minutes);
};

// ✅ Helper: Format date for display (fixed)
const formatDateForDisplay = (date) => {
  if (!date) return null;
  // Return the date as-is, it's already stored correctly
  return date;
};

// Get all matches (admin view)
router.get('/admin/matches', auth, adminAuth, async (req, res) => {
  try {
    const { sport, status, dateFrom, dateTo } = req.query;
    let query = {};

    if (sport) query.sport = sport;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }

    const matches = await Match.find(query).sort({ date: -1 });
    res.json({ success: true, matches });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Get single match
router.get('/admin/matches/:id', auth, adminAuth, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    res.json({ success: true, match });
  } catch (error) {
    console.error('Error fetching match:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ✅ FIXED: Create new match - Preserves exact time
router.post('/admin/matches', auth, adminAuth, async (req, res) => {
  try {
    const {
      sport,
      league,
      country,
      homeTeam,
      awayTeam,
      date,
      oddsHome,
      oddsDraw,
      oddsAway,
      markets
    } = req.body;

    console.log('📥 Received date from frontend:', date);

    // Validate required fields
    if (!league || !country || !homeTeam || !awayTeam || !date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please fill all required fields' 
      });
    }

    // ✅ FIX: Create date preserving the exact time entered
    // This handles both "2024-08-11T15:00" and "2024-08-11T15:00:00.000Z"
    const inputDate = new Date(date);
    
    // If the date is already in local format (has no Z or timezone offset)
    // we need to preserve the local time
    let matchDate;
    if (date.includes('Z') || date.includes('+')) {
      // It's UTC time, convert to local
      const localDate = new Date(date);
      matchDate = new Date(
        localDate.getFullYear(),
        localDate.getMonth(),
        localDate.getDate(),
        localDate.getHours(),
        localDate.getMinutes()
      );
    } else {
      // It's local time, use it directly
      matchDate = new Date(
        inputDate.getFullYear(),
        inputDate.getMonth(),
        inputDate.getDate(),
        inputDate.getHours(),
        inputDate.getMinutes()
      );
    }

    console.log('📅 Stored date (local):', matchDate);
    console.log('📅 Stored date (ISO):', matchDate.toISOString());

    const match = new Match({
      sport: sport || 'FOOTBALL',
      league,
      country,
      homeTeam,
      awayTeam,
      date: matchDate, // Store as-is (already local)
      odds: {
        home: parseFloat(oddsHome) || 1.00,
        draw: parseFloat(oddsDraw) || 1.00,
        away: parseFloat(oddsAway) || 1.00
      },
      status: 'UPCOMING',
      markets: markets || {}
    });

    await match.save();
    
    res.json({ 
      success: true, 
      match, 
      message: 'Match created successfully' 
    });
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ✅ FIXED: Update match - Preserves exact time
router.put('/admin/matches/:id', auth, adminAuth, async (req, res) => {
  try {
    const matchId = req.params.id;
    const updates = req.body;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    // Update basic fields
    if (updates.league) match.league = updates.league;
    if (updates.country) match.country = updates.country;
    if (updates.homeTeam) match.homeTeam = updates.homeTeam;
    if (updates.awayTeam) match.awayTeam = updates.awayTeam;
    if (updates.sport) match.sport = updates.sport;
    if (updates.status) match.status = updates.status;
    
    // ✅ FIX: Update date preserving local time
    if (updates.date) {
      const inputDate = new Date(updates.date);
      // Preserve the exact time entered
      match.date = new Date(
        inputDate.getFullYear(),
        inputDate.getMonth(),
        inputDate.getDate(),
        inputDate.getHours(),
        inputDate.getMinutes()
      );
    }
    
    // Update odds
    if (updates.oddsHome !== undefined) {
      match.odds.home = parseFloat(updates.oddsHome);
    }
    if (updates.oddsDraw !== undefined) {
      match.odds.draw = parseFloat(updates.oddsDraw);
    }
    if (updates.oddsAway !== undefined) {
      match.odds.away = parseFloat(updates.oddsAway);
    }

    // Update markets if provided
    if (updates.markets) {
      match.markets = updates.markets;
    }

    // Update score if provided
    if (updates.score) {
      if (updates.score.home !== undefined) match.score.home = updates.score.home;
      if (updates.score.away !== undefined) match.score.away = updates.score.away;
    }

    await match.save();
    res.json({ 
      success: true, 
      match, 
      message: 'Match updated successfully' 
    });
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Delete match
router.delete('/admin/matches/:id', auth, adminAuth, async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    res.json({ success: true, message: 'Match deleted successfully' });
  } catch (error) {
    console.error('Error deleting match:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Update match status (live/finished)
router.patch('/admin/matches/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const { status, scoreHome, scoreAway } = req.body;
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    match.status = status;
    if (scoreHome !== undefined) match.score.home = scoreHome;
    if (scoreAway !== undefined) match.score.away = scoreAway;
    
    await match.save();
    res.json({ 
      success: true, 
      match, 
      message: 'Match status updated' 
    });
  } catch (error) {
    console.error('Error updating match status:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ✅ FIXED: Update match markets
router.patch('/admin/matches/:id/markets', auth, adminAuth, async (req, res) => {
  try {
    const { markets } = req.body;
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    if (!markets || typeof markets !== 'object') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid markets data' 
      });
    }

    match.markets = { ...match.markets, ...markets };
    await match.save();
    
    res.json({ 
      success: true, 
      match, 
      message: 'Markets updated successfully' 
    });
  } catch (error) {
    console.error('Error updating markets:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// ✅ NEW: Bulk create matches
router.post('/admin/matches/bulk', auth, adminAuth, async (req, res) => {
  try {
    const { matches } = req.body;
    
    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No matches provided' 
      });
    }

    const createdMatches = [];
    for (const matchData of matches) {
      const { date, ...otherData } = matchData;
      
      const inputDate = new Date(date);
      const matchDate = new Date(
        inputDate.getFullYear(),
        inputDate.getMonth(),
        inputDate.getDate(),
        inputDate.getHours(),
        inputDate.getMinutes()
      );

      const match = new Match({
        ...otherData,
        date: matchDate,
        status: otherData.status || 'UPCOMING'
      });
      
      await match.save();
      createdMatches.push(match);
    }

    res.json({ 
      success: true, 
      matches: createdMatches, 
      message: `${createdMatches.length} matches created successfully` 
    });
  } catch (error) {
    console.error('Error bulk creating matches:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;