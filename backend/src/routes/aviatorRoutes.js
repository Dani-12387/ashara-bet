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
// ADMIN ROUTES
// ============================================

// 🚀 Start a new round
router.post('/start', authMiddleware, adminMiddleware, aviatorController.startGame);

// 🛑 Stop / crash the current round
router.post('/stop', authMiddleware, adminMiddleware, aviatorController.stopGame);

// 🔒 Close game & refund all bets
router.post('/close', authMiddleware, adminMiddleware, aviatorController.closeGame);

// 🎯 Set next crash point (single fallback)
router.post('/set-crash', authMiddleware, adminMiddleware, aviatorController.setCrashPoint);

// ⚙️ Update settings
router.post('/settings', authMiddleware, adminMiddleware, aviatorController.updateSettings);

// ============================================
// CRASH POINT QUEUE MANAGEMENT (NEW)
// ============================================

// 📋 Get the current crash point queue
router.get('/crash-queue', authMiddleware, adminMiddleware, aviatorController.getCrashPointQueue);

// 📝 Replace the entire queue (set multiple points at once)
router.post('/crash-queue/set', authMiddleware, adminMiddleware, aviatorController.setCrashPointQueue);

// ➕ Add a single crash point to the end of the queue
router.post('/crash-queue/add', authMiddleware, adminMiddleware, aviatorController.addCrashPointToQueue);

// ❌ Remove a specific crash point from the queue by index
router.delete('/crash-queue/:index', authMiddleware, adminMiddleware, aviatorController.removeCrashPointFromQueue);

// 🧹 Clear the entire queue
router.delete('/crash-queue/clear', authMiddleware, adminMiddleware, aviatorController.clearCrashPointQueue);

// ============================================
// DATA RETRIEVAL (Admin & Player)
// ============================================

// 📊 Get current game state
router.get('/state', authMiddleware, aviatorController.getGameState);

// 📜 Get round history
router.get('/history', authMiddleware, aviatorController.getHistory);

// 👥 Get active bets (admin sees all, user sees own active)
router.get('/active-bets', authMiddleware, aviatorController.getActiveBets);

// 🔚 Get ended bets (cashed out or lost) – admin only
router.get('/ended-bets', authMiddleware, adminMiddleware, aviatorController.getEndedBets);

// ============================================
// PLAYER ACTIONS
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

// 🔄 Get current round
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