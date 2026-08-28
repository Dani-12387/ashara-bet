const express = require('express');
const router = express.Router();
const AviatorRound = require('../models/AviatorRound');
const AviatorBet = require('../models/AviatorBet');
const User = require('../models/User');
const { getGameEngine } = require('../sockets/aviatorSocket');
// ✅ Import the controller directly as fallback
const aviatorController = require('../controllers/aviatorController');

// ========== AUTHENTICATION MIDDLEWARE ==========
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: { code: 'UNAUTHORIZED', message: 'No token provided' }
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ 
      success: false, 
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
    });
  }
};

// =============================================
// ✅ ADMIN ROUTES - Using controller directly
// =============================================

router.post('/start', authMiddleware, async (req, res) => {
  try {
    // Check admin role
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }
    
    // ✅ Use controller directly instead of engine
    await aviatorController.startGame(req, res);
  } catch (error) {
    console.error('❌ Error starting game:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.post('/stop', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }
    
    await aviatorController.stopGame(req, res);
  } catch (error) {
    console.error('❌ Error stopping game:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.post('/close', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }
    
    await aviatorController.closeGame(req, res);
  } catch (error) {
    console.error('❌ Error closing game:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.post('/set-crash', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }
    
    await aviatorController.setCrashPoint(req, res);
  } catch (error) {
    console.error('❌ Error setting crash point:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.post('/settings', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required' }
      });
    }
    
    await aviatorController.updateSettings(req, res);
  } catch (error) {
    console.error('❌ Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

// =============================================
// ✅ DATA ROUTES
// =============================================

router.get('/state', authMiddleware, async (req, res) => {
  try {
    await aviatorController.getGameState(req, res);
  } catch (error) {
    console.error('❌ Error getting game state:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.get('/history', authMiddleware, async (req, res) => {
  try {
    await aviatorController.getHistory(req, res);
  } catch (error) {
    console.error('❌ Error getting history:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.get('/active-bets', authMiddleware, async (req, res) => {
  try {
    await aviatorController.getActiveBets(req, res);
  } catch (error) {
    console.error('❌ Error getting active bets:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

// =============================================
// ✅ USER ROUTES
// =============================================

router.post('/bet', authMiddleware, async (req, res) => {
  try {
    await aviatorController.placeBet(req, res);
  } catch (error) {
    console.error('❌ Error placing bet:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.post('/cashout', authMiddleware, async (req, res) => {
  try {
    await aviatorController.cashOut(req, res);
  } catch (error) {
    console.error('❌ Error cashing out:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.post('/cancel-pending', authMiddleware, async (req, res) => {
  try {
    await aviatorController.cancelPendingBet(req, res);
  } catch (error) {
    console.error('❌ Error cancelling bet:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

// =============================================
// ✅ PLAYER PAGE ROUTES
// =============================================

router.get('/current-round', authMiddleware, async (req, res) => {
  try {
    await aviatorController.getCurrentRound(req, res);
  } catch (error) {
    console.error('❌ Error getting current round:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.get('/my-bets', authMiddleware, async (req, res) => {
  try {
    await aviatorController.getMyBets(req, res);
  } catch (error) {
    console.error('❌ Error getting my bets:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.get('/live-players', authMiddleware, async (req, res) => {
  try {
    await aviatorController.getLivePlayers(req, res);
  } catch (error) {
    console.error('❌ Error getting live players:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

router.get('/verify/:roundId', authMiddleware, async (req, res) => {
  try {
    await aviatorController.verifyRound(req, res);
  } catch (error) {
    console.error('❌ Error verifying round:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

// =============================================
// ✅ TEST ROUTE
// =============================================

router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Aviator routes are working!' });
});

module.exports = router;