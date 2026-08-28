const express = require('express');
const router = express.Router();
const aviatorController = require('../controllers/aviatorController');

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
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

// ============================================
// ADMIN MIDDLEWARE
// ============================================
const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' }
    });
  }
};

// ============================================
// ADMIN ROUTES (protected with auth + admin)
// ============================================

// 🚀 Start a new round
router.post('/start', authMiddleware, adminMiddleware, aviatorController.startGame);

// 🛑 Stop / crash the current round
router.post('/stop', authMiddleware, adminMiddleware, aviatorController.stopGame);

// 🔒 Close game & refund all bets
router.post('/close', authMiddleware, adminMiddleware, aviatorController.closeGame);

// 🎯 Set next crash point
router.post('/set-crash', authMiddleware, adminMiddleware, aviatorController.setCrashPoint);

// ⚙️ Update settings (auto‑start, limits, etc.)
router.post('/settings', authMiddleware, adminMiddleware, aviatorController.updateSettings);

// ============================================
// DATA RETRIEVAL (authenticated users)
// ============================================

// 📊 Get current game state (admin & player)
router.get('/state', authMiddleware, aviatorController.getGameState);

// 📜 Get round history
router.get('/history', authMiddleware, aviatorController.getHistory);

// 👥 Get active bets
router.get('/active-bets', authMiddleware, aviatorController.getActiveBets);

// ============================================
// PLAYER ACTIONS (authenticated users)
// ============================================

// 💰 Place a bet
router.post('/bet', authMiddleware, aviatorController.placeBet);

// 💵 Cash out an active bet
router.post('/cashout', authMiddleware, aviatorController.cashOut);

// ❌ Cancel a pending bet
router.post('/cancel-pending', authMiddleware, aviatorController.cancelPendingBet);

// ============================================
// PLAYER PAGE ENDPOINTS
// ============================================

// 🔄 Get current round (for player page)
router.get('/current-round', authMiddleware, aviatorController.getCurrentRound);

// 📋 Get user's own bet history
router.get('/my-bets', authMiddleware, aviatorController.getMyBets);

// 👥 Get live players
router.get('/live-players', authMiddleware, aviatorController.getLivePlayers);

// ✅ Verify a round (provably fair)
router.get('/verify/:roundId', authMiddleware, aviatorController.verifyRound);

// ============================================
// TEST ROUTE (public)
// ============================================
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Aviator routes are working!' });
});

module.exports = router;