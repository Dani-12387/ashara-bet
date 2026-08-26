const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const axios = require("axios");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config();

const connectDB = require("./config/db");

// ===== CATCH UNHANDLED ERRORS =====
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});

const app = express();

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ===== MIDDLEWARE =====
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://ashara-bet-frontend.onrender.com',
    'https://ashara-bet-backend.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ===== DEBUG: Log MongoDB events =====
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB Connected Successfully');
  console.log('📊 Database Name:', mongoose.connection.name);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Connection Error:', err);
});

// =============================================
// ===== SIMPLE TEST ROUTES (FIRST) =====
// =============================================

app.get("/", (req, res) => {
  res.json({ 
    message: "AsharaBet API is running",
    endpoints: {
      health: "/health",
      test: "/api/test",
      testOdds: "/api/test-odds",
      odds: "/api/odds",
      oddsTest: "/api/odds/test",
      oddsLive: "/api/odds/odds/:sport",
      matches: "/api/matches",
      bets: "/api/bets",
      auth: "/api/auth",
      aviator: "/api/aviator"
    }
  });
});

app.get("/api/test", (req, res) => {
  res.json({ 
    success: true, 
    message: "API is working",
    timestamp: new Date().toISOString()
  });
});

// ===== SIMPLE TEST FOR ODDS =====
app.get('/api/test-odds', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Test odds route is working!',
    timestamp: new Date().toISOString()
  });
});

// =============================================
// ===== DIRECT ODDS ROUTES =====
// =============================================

// Test route - Check if odds routes are loaded
app.get('/api/odds/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Odds routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Get live odds
app.get('/api/odds/odds/:sport', async (req, res) => {
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
    
    // Try to fetch from The Odds API
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
    
    const matches = response.data.map(game => {
      const bookmaker = game.bookmakers?.[0];
      const market = bookmaker?.markets?.find(m => m.key === 'h2h');
      
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
        league: game.sport_title,
        country: game.sport_title?.split(' ')[0] || 'Unknown'
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
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get available sports
app.get('/api/odds/sports', (req, res) => {
  res.json([
    { key: 'soccer_epl', title: 'Premier League', active: true },
    { key: 'basketball_nba', title: 'NBA', active: true },
    { key: 'tennis_atp', title: 'ATP Tennis', active: true }
  ]);
});

// =============================================
// ===== ROUTES =====
// =============================================

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const depositRoutes = require("./routes/depositRoutes");
const adminTransactionRoutes = require("./routes/adminTransactionRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const adminWithdrawalRoutes = require("./routes/adminWithdrawalRoutes");
const matchRoutes = require('./routes/matches');
const adminMatchRoutes = require('./routes/adminMatches');
const betRoutes = require('./routes/betRoutes');

// ===== AVIATOR ROUTES =====
console.log('🔄 Loading aviator routes...');
const aviatorRoutes = require('./routes/aviatorRoutes');
console.log('✅ Aviator routes loaded');

app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/admin", adminWithdrawalRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/admin", adminTransactionRoutes);
app.use('/api', matchRoutes);
app.use('/api', adminMatchRoutes);
app.use('/api/bets', betRoutes);

// ===== AVIATOR ROUTES REGISTERED =====
app.use('/api/aviator', aviatorRoutes);
console.log('✅ Aviator routes mounted at /api/aviator');

// =============================================
// ===== ERROR HANDLING =====
// =============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// =============================================
// ===== CREATE HTTP SERVER WITH SOCKET.IO =====
// =============================================

const PORT = process.env.PORT || 5000;

console.log('🔄 Starting server...');
console.log('📊 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('📊 PORT:', PORT);
console.log('📊 MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
console.log('📊 ODDS_API_KEY:', process.env.ODDS_API_KEY ? '✅ Set' : '❌ Missing');
console.log('📊 JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');

// Connect to MongoDB
connectDB();

// Create HTTP server
const server = http.createServer(app);

// ===== SOCKET.IO SETUP =====
const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://ashara-bet-frontend.onrender.com'
    ],
    credentials: true,
    methods: ['GET', 'POST']
  }
});

console.log('🔄 Setting up Socket.IO...');

// ===== AVIATOR SOCKET =====
let aviatorGameEngine = null;

try {
  const { initializeAviatorSocket } = require('./sockets/aviatorSocket');
  aviatorGameEngine = initializeAviatorSocket(io);
  console.log('✅ Aviator Socket.IO initialized');
} catch (error) {
  console.error('❌ Failed to initialize Aviator Socket:', error.message);
  console.log('⚠️ Aviator game will run without Socket.IO');
  
  // Fallback: Simple socket connection
  io.on('connection', (socket) => {
    console.log(`📡 Client connected: ${socket.id}`);
    socket.emit('round:state', {
      status: 'WAITING',
      multiplier: 1.00,
      serverTime: Date.now()
    });
    
    socket.on('disconnect', () => {
      console.log(`📡 Client disconnected: ${socket.id}`);
    });
  });
}

// Make io accessible to routes
app.set('io', io);

// ===== START SERVER =====
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API endpoints:`);
  console.log(`   - /health (health check)`);
  console.log(`   - /api/test (API test)`);
  console.log(`   - /api/test-odds (Simple test)`);
  console.log(`   - /api/odds/test (Odds test)`);
  console.log(`   - /api/odds/odds/:sport (Live Odds)`);
  console.log(`   - /api/odds/sports (Available Sports)`);
  console.log(`   - /api/aviator/test (Aviator Test)`);
  console.log(`   - /api/aviator/state (Aviator State)`);
  console.log(`   - /api/aviator/start (Start Game - Admin)`);
  console.log(`   - /api/aviator/stop (Stop Game - Admin)`);
  console.log(`   - /api/aviator/close (Close Game - Admin)`);
  console.log(`   - /api/aviator/set-crash (Set Crash Point - Admin)`);
  console.log(`   - /api/aviator/settings (Update Settings - Admin)`);
  console.log(`   - /api/aviator/history (Game History)`);
  console.log(`   - /api/aviator/active-bets (Active Bets)`);
  console.log(`   - /api/aviator/bet (Place Bet - User)`);
  console.log(`   - /api/aviator/cashout (Cash Out - User)`);
  console.log(`   - /api/aviator/current-round (Current Round)`);
  console.log(`   - /api/aviator/my-bets (My Bets)`);
  console.log(`   - /api/aviator/live-players (Live Players)`);
  console.log(`   - /api/aviator/verify/:roundId (Verify Round)`);
  console.log(`   - /api/auth/login (Login)`);
  console.log(`   - /api/auth/register (Register)`);
  console.log(`   - /api/user/balance (User Balance)`);
  console.log(`   - /api/matches (Matches)`);
  console.log(`   - /api/bets (Bets)`);
  console.log(`📡 Socket.IO running on port ${PORT}`);
  console.log(`📡 Socket.IO endpoints:`);
  console.log(`   - round:state (Round State)`);
  console.log(`   - round:countdown (Countdown)`);
  console.log(`   - round:multiplier (Multiplier Update)`);
  console.log(`   - bet:accepted (Bet Accepted)`);
  console.log(`   - bet:rejected (Bet Rejected)`);
  console.log(`   - bet:placed (Bet Placed)`);
  console.log(`   - bet:cashed_out (Bet Cashed Out)`);
  console.log(`   - cashout:success (Cashout Success)`);
  console.log(`   - wallet:updated (Wallet Updated)`);
  console.log(`   - system:error (System Error)`);
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received. Closing server...');
  server.close(() => {
    console.log('✅ Server closed');
    if (aviatorGameEngine) {
      aviatorGameEngine.stop();
    }
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = { app, server, io };