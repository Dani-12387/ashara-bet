const express = require('express');
const router = express.Router();
const { getGameEngine } = require('../sockets/aviatorSocket');

const authMiddleware = (req, res, next) => { /* ... */ };

// ✅ Admin routes – use engine
router.post('/start', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const engine = getGameEngine();
    if (!engine) {
      return res.status(503).json({ error: 'Engine not ready' });
    }
    const result = await engine.startNewRound();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stop', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const engine = getGameEngine();
    if (!engine) {
      return res.status(503).json({ error: 'Engine not ready' });
    }
    const result = await engine.crashRound();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add similar for /close, /set-crash, /settings