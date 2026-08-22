const express = require('express');
const router = express.Router();
const aviatorController = require('../controllers/aviatorController');

// ========== GAME CONTROLS ==========
router.post('/start', aviatorController.startGame);
router.post('/stop', aviatorController.stopGame);
router.post('/close', aviatorController.closeGame);
router.get('/state', aviatorController.getGameState);

// ========== SETTINGS ==========
router.post('/settings', aviatorController.updateSettings);
router.post('/set-crash', aviatorController.setCrashPoint);

// ========== BETS ==========
router.post('/bet', aviatorController.placeBet);
router.post('/cashout', aviatorController.cashOut);

// ========== DATA ==========
router.get('/history', aviatorController.getHistory);
router.get('/active-bets', aviatorController.getActiveBets);

module.exports = router;