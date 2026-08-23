const express = require('express');
const router = express.Router();
const aviatorController = require('../controllers/aviatorController');

console.log('🔄 Loading aviator routes...');

// ========== AUTHENTICATION MIDDLEWARE ==========
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
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
      message: 'Invalid or expired token' 
    });
  }
};

// ========== TEST ROUTE ==========
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Aviator routes are working!' });
});

// =============================================
// ADMIN CONTROLS
// =============================================
router.post('/start', aviatorController.startGame);
router.post('/stop', aviatorController.stopGame);
router.post('/close', aviatorController.closeGame);
router.post('/set-crash', aviatorController.setCrashPoint);
router.post('/settings', aviatorController.updateSettings);

// =============================================
// DATA RETRIEVAL (Public)
// =============================================
router.get('/state', aviatorController.getGameState);
router.get('/history', aviatorController.getHistory);
router.get('/active-bets', aviatorController.getActiveBets);

// =============================================
// USER ACTIONS (Protected with auth)
// =============================================
router.post('/bet', authMiddleware, aviatorController.placeBet);
router.post('/cashout', authMiddleware, aviatorController.cashOut);
router.post('/cancel-pending', authMiddleware, aviatorController.cancelPendingBet);

console.log('✅ All aviator routes registered');

module.exports = router;