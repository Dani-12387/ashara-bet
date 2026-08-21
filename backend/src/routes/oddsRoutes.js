const express = require('express');
const router = express.Router();
const axios = require('axios');

// =============================================
// ODDS ROUTES - No Authentication Required
// =============================================

// Test route - Check if odds routes are working
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Odds routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Get live odds for a specific sport
router.get('/odds/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const apiKey = process.env.ODDS_API_KEY;
    
    console.log(`📊 Fetching odds for: ${sport}`);
    console.log(`🔑 API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
    
    if (!apiKey) {
      return res.json({
        success: false,
        message: 'No API key found. Please set ODDS_API_KEY in environment variables.'
      });
    }
    
    // Fetch from The Odds API
    const response = await axios.get(
      `https://api.the-odds-api.com/v4/sports/soccer_epl/odds/`,
      {
        params: {
          apiKey: apiKey,
          regions: 'eu',
          markets: 'h2h',
          oddsFormat: 'decimal'
        },
        timeout: 10000
      }
    );
    
    if (!response.data || response.data.length === 0) {
      return res.json({
        success: false,
        message: 'No matches found'
      });
    }
    
    // Format the response
    const matches = response.data.map(game => {
      const bookmaker = game.bookmakers?.[0];
      const market = bookmaker?.markets?.find(m => m.key === 'h2h');
      
      return {
        id: game.id,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        odds: {
          home: market?.outcomes?.find(o => o.name === game.home_team)?.price || 0,
          draw: market?.outcomes?.find(o => o.name === 'Draw')?.price || 0,
          away: market?.outcomes?.find(o => o.name === game.away_team)?.price || 0,
        },
        league: game.sport_title,
        commenceTime: game.commence_time
      };
    });
    
    res.json({
      success: true,
      count: matches.length,
      matches: matches,
      source: 'api',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching odds:', error.message);
    res.json({
      success: false,
      message: error.message
    });
  }
});

// Get available sports
router.get('/sports', (req, res) => {
  res.json([
    { key: 'soccer_epl', title: 'Premier League', active: true },
    { key: 'basketball_nba', title: 'NBA', active: true },
    { key: 'tennis_atp', title: 'ATP Tennis', active: true }
  ]);
});

module.exports = router;