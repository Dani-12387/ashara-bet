const express = require('express');
const router = express.Router();
const aviatorController = require('../controllers/aviatorController');

// =============================================
// ADMIN CONTROLS
// =============================================

// Start a new game round
router.post('/start', aviatorController.startGame);

// Stop/crash the current game
router.post('/stop', aviatorController.stopGame);

// Close game and refund all bets
router.post('/close', aviatorController.closeGame);

// Set next crash point
router.post('/set-crash', aviatorController.setCrashPoint);

// Update game settings
router.post('/settings', aviatorController.updateSettings);

// =============================================
// USER ACTIONS
// =============================================

// Place a bet
router.post('/bet', aviatorController.placeBet);

// Cash out
router.post('/cashout', aviatorController.cashOut);

// =============================================
// DATA RETRIEVAL
// =============================================

// Get current game state
router.get('/state', aviatorController.getGameState);

// Get game history
router.get('/history', aviatorController.getHistory);

// Get active bets
router.get('/active-bets', aviatorController.getActiveBets);

module.exports = router;