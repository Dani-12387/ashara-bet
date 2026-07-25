const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("./config/db");

// Connect to database
connectDB();

const app = express();

// ===== HEALTH CHECK (CRITICAL FOR RENDER) =====
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Debug: Log when MongoDB connects
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB Connected Successfully');
  console.log('📊 Database Name:', mongoose.connection.name);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Connection Error:', err);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Import routes
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

// Test route to check database connection
app.get("/api/test-db", async (req, res) => {
  try {
    const Match = require('./models/Match');
    const count = await Match.countDocuments();
    res.json({
      success: true,
      message: 'Database connected successfully',
      databaseName: mongoose.connection.name,
      matchCount: count,
      collections: Object.keys(mongoose.connection.collections)
    });
  } catch (error) {
    console.error('Test DB error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test route to create a sample match
app.post("/api/test-create-match", async (req, res) => {
  try {
    const Match = require('./models/Match');

    const testMatch = new Match({
      sport: 'FOOTBALL',
      league: 'Test Premier League',
      country: 'Test Country',
      homeTeam: 'Test Home Team',
      awayTeam: 'Test Away Team',
      date: new Date(),
      odds: {
        home: 2.00,
        draw: 3.00,
        away: 4.00
      }
    });

    const savedMatch = await testMatch.save();
    console.log('✅ Test match created:', savedMatch);

    res.json({
      success: true,
      message: 'Test match created successfully',
      match: savedMatch
    });
  } catch (error) {
    console.error('❌ Error creating test match:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Regular API Routes
app.get("/", (req, res) => {
  res.send("Betting backend running");
});

// ===== ROUTES =====
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

// ===== ERROR HANDLING =====
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

const PORT = process.env.PORT || 5000;

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API endpoints:`);
  console.log(`   - /api/matches`);
  console.log(`   - /api/bets/place`);
  console.log(`   - /api/bets/history`);
  console.log(`   - /api/auth/login`);
  console.log(`   - /api/auth/register`);
  console.log(`   - /health (health check)`);
});