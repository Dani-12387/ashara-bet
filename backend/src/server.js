const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
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

// ===== HEALTH CHECK (CRITICAL FOR RENDER) =====
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ===== MIDDLEWARE =====
app.use(cors());
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

// ===== TEST ROUTES =====
app.get("/", (req, res) => {
  res.json({ 
    message: "AsharaBet API is running",
    endpoints: {
      health: "/health",
      matches: "/api/matches",
      bets: "/api/bets",
      auth: "/api/auth",
      odds: "/api/odds",
      withdrawals: "/api/withdrawals",
      deposits: "/api/deposits",
      user: "/api/user"
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

// ===== ROUTES =====
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
const oddsRoutes = require('./routes/oddsRoutes'); // ✅ ADDED

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
app.use('/api/odds', oddsRoutes); // ✅ ADDED

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

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;

console.log('🔄 Starting server...');
console.log('📊 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('📊 PORT:', PORT);
console.log('📊 MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
console.log('📊 ODDS_API_KEY:', process.env.ODDS_API_KEY ? '✅ Set' : '❌ Missing (using mock data)');

// Connect to MongoDB
connectDB();

// Start server - bind to 0.0.0.0 for Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API endpoints:`);
  console.log(`   - /health (health check)`);
  console.log(`   - /api/matches`);
  console.log(`   - /api/bets/place`);
  console.log(`   - /api/bets/history`);
  console.log(`   - /api/auth/login`);
  console.log(`   - /api/auth/register`);
  console.log(`   - /api/odds/test (odds test)`);
  console.log(`   - /api/odds/odds/:sport (Live Odds)`);
  console.log(`   - /api/odds/sports (Available Sports)`);
});