const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

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

// Create new match
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
      oddsAway
    } = req.body;

    // Validate required fields
    if (!league || !country || !homeTeam || !awayTeam || !date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please fill all required fields' 
      });
    }

    const match = new Match({
      sport: sport || 'FOOTBALL',
      league,
      country,
      homeTeam,
      awayTeam,
      date: new Date(date),
      odds: {
        home: parseFloat(oddsHome) || 1.00,
        draw: parseFloat(oddsDraw) || 1.00,
        away: parseFloat(oddsAway) || 1.00
      }
    });

    await match.save();
    res.json({ success: true, match, message: 'Match created successfully' });
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Update match
router.put('/admin/matches/:id', auth, adminAuth, async (req, res) => {
  try {
    const matchId = req.params.id;
    const updates = req.body;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    // Update fields
    if (updates.league) match.league = updates.league;
    if (updates.country) match.country = updates.country;
    if (updates.homeTeam) match.homeTeam = updates.homeTeam;
    if (updates.awayTeam) match.awayTeam = updates.awayTeam;
    if (updates.date) match.date = new Date(updates.date);
    if (updates.sport) match.sport = updates.sport;
    
    // Update odds
    if (updates.oddsHome) match.odds.home = parseFloat(updates.oddsHome);
    if (updates.oddsDraw) match.odds.draw = parseFloat(updates.oddsDraw);
    if (updates.oddsAway) match.odds.away = parseFloat(updates.oddsAway);

    await match.save();
    res.json({ success: true, match, message: 'Match updated successfully' });
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
    res.json({ success: true, match, message: 'Match status updated' });
  } catch (error) {
    console.error('Error updating match status:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;