const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');

// ✅ TEST ROUTE
router.get('/test', auth, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Odds routes are working!',
    user: req.user.id,
    timestamp: new Date().toISOString()
  });
});

// ✅ Get odds for a specific sport
router.get('/odds/:sport', auth, async (req, res) => {
  try {
    const { sport } = req.params;
    const apiKey = process.env.ODDS_API_KEY;
    
    console.log(`📊 Fetching odds for: ${sport}`);
    console.log(`🔑 API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
    
    if (!apiKey) {
      console.log('⚠️ No API key found - returning mock data');
      const mockMatches = getMockMatches(sport);
      return res.json({
        success: true,
        count: mockMatches.length,
        matches: mockMatches,
        source: 'mock',
        note: 'Using mock data - Please set ODDS_API_KEY in environment variables'
      });
    }
    
    // ✅ Try multiple sport keys
    const sportKeysToTry = [
      sport,
      'soccer_epl',
      'soccer_england_premier_league',
      'soccer_spain_la_liga',
      'soccer_germany_bundesliga',
      'soccer_italy_serie_a',
      'soccer_france_ligue_one'
    ];
    
    let matchesData = [];
    let usedKey = null;
    
    for (const key of sportKeysToTry) {
      try {
        console.log(`📡 Trying sport key: ${key}`);
        const response = await axios.get(
          `https://api.the-odds-api.com/v4/sports/${key}/odds/`,
          {
            params: {
              apiKey: apiKey,
              regions: 'eu,us',
              markets: 'h2h,totals',
              oddsFormat: 'decimal',
              dateFormat: 'iso',
            },
            timeout: 10000
          }
        );
        
        if (response.data && response.data.length > 0) {
          matchesData = response.data;
          usedKey = key;
          console.log(`✅ Found ${matchesData.length} matches with key: ${key}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Failed with key: ${key}`);
        continue;
      }
    }
    
    if (matchesData.length === 0) {
      console.log('⚠️ No matches found with any sport key, using mock data');
      const mockMatches = getMockMatches(sport);
      return res.json({
        success: true,
        count: mockMatches.length,
        matches: mockMatches,
        source: 'mock',
        note: 'No matches found in API, using mock data'
      });
    }
    
    const matches = matchesData.map(game => {
      const bookmaker = game.bookmakers?.[0] || null;
      const market = bookmaker?.markets?.find(m => m.key === 'h2h') || null;
      
      return {
        id: game.id,
        sportKey: game.sport_key,
        sportTitle: game.sport_title,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        commenceTime: game.commence_time,
        bookmaker: bookmaker?.title || 'Unknown',
        odds: {
          home: market?.outcomes?.find(o => o.name === game.home_team)?.price || 0,
          draw: market?.outcomes?.find(o => o.name === 'Draw')?.price || 0,
          away: market?.outcomes?.find(o => o.name === game.away_team)?.price || 0,
        },
        totals: game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals')?.outcomes || [],
        league: game.sport_title,
        country: game.sport_title?.split(' ')[0] || 'Unknown'
      };
    });
    
    res.json({
      success: true,
      count: matches.length,
      matches: matches,
      source: 'api',
      sportKeyUsed: usedKey,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error fetching odds:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    const mockMatches = getMockMatches(req.params.sport);
    res.json({
      success: true,
      count: mockMatches.length,
      matches: mockMatches,
      source: 'mock',
      note: 'Using mock data - API error occurred: ' + error.message
    });
  }
});

// ✅ Mock data for testing
const getMockMatches = (sport) => {
  const now = new Date();
  const mockData = {
    'soccer_epl': [
      {
        id: 'mock_1',
        sportKey: 'soccer_epl',
        sportTitle: 'Premier League',
        homeTeam: 'Manchester City',
        awayTeam: 'Arsenal',
        commenceTime: new Date(now.getTime() + 3600000).toISOString(),
        bookmaker: 'MockBook',
        odds: { home: 1.85, draw: 3.40, away: 4.20 },
        totals: [],
        league: 'Premier League',
        country: 'England'
      },
      {
        id: 'mock_2',
        sportKey: 'soccer_epl',
        sportTitle: 'Premier League',
        homeTeam: 'Liverpool',
        awayTeam: 'Chelsea',
        commenceTime: new Date(now.getTime() + 7200000).toISOString(),
        bookmaker: 'MockBook',
        odds: { home: 1.90, draw: 3.50, away: 4.00 },
        totals: [],
        league: 'Premier League',
        country: 'England'
      },
      {
        id: 'mock_3',
        sportKey: 'soccer_epl',
        sportTitle: 'Premier League',
        homeTeam: 'Tottenham Hotspur',
        awayTeam: 'Manchester United',
        commenceTime: new Date(now.getTime() + 10800000).toISOString(),
        bookmaker: 'MockBook',
        odds: { home: 2.30, draw: 3.20, away: 3.10 },
        totals: [],
        league: 'Premier League',
        country: 'England'
      },
      {
        id: 'mock_4',
        sportKey: 'soccer_epl',
        sportTitle: 'Premier League',
        homeTeam: 'Newcastle United',
        awayTeam: 'Aston Villa',
        commenceTime: new Date(now.getTime() + 14400000).toISOString(),
        bookmaker: 'MockBook',
        odds: { home: 2.10, draw: 3.30, away: 3.60 },
        totals: [],
        league: 'Premier League',
        country: 'England'
      },
      {
        id: 'mock_5',
        sportKey: 'soccer_epl',
        sportTitle: 'Premier League',
        homeTeam: 'West Ham United',
        awayTeam: 'Crystal Palace',
        commenceTime: new Date(now.getTime() + 18000000).toISOString(),
        bookmaker: 'MockBook',
        odds: { home: 2.05, draw: 3.25, away: 3.80 },
        totals: [],
        league: 'Premier League',
        country: 'England'
      }
    ],
    'basketball_nba': [
      {
        id: 'mock_nba_1',
        sportKey: 'basketball_nba',
        sportTitle: 'NBA',
        homeTeam: 'Los Angeles Lakers',
        awayTeam: 'Golden State Warriors',
        commenceTime: new Date(now.getTime() + 3600000).toISOString(),
        bookmaker: 'MockBook',
        odds: { home: 1.75, draw: 0, away: 2.25 },
        totals: [],
        league: 'NBA',
        country: 'USA'
      }
    ],
    'tennis_atp': [
      {
        id: 'mock_tennis_1',
        sportKey: 'tennis_atp',
        sportTitle: 'ATP Tennis',
        homeTeam: 'Novak Djokovic',
        awayTeam: 'Carlos Alcaraz',
        commenceTime: new Date(now.getTime() + 3600000).toISOString(),
        bookmaker: 'MockBook',
        odds: { home: 1.80, draw: 0, away: 2.10 },
        totals: [],
        league: 'ATP Tennis',
        country: 'International'
      }
    ]
  };
  
  return mockData[sport] || mockData['soccer_epl'];
};

// ✅ Get available sports
router.get('/sports', auth, async (req, res) => {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    
    if (!apiKey) {
      return res.json([
        { key: 'soccer_epl', title: 'Premier League', active: true },
        { key: 'basketball_nba', title: 'NBA', active: true },
        { key: 'tennis_atp', title: 'ATP Tennis', active: true }
      ]);
    }
    
    const response = await axios.get(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${apiKey}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching sports:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch sports' 
    });
  }
});

module.exports = router;