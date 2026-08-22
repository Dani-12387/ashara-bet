const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const AviatorGame = require('../models/AviatorGame');
const AviatorBet = require('../models/AviatorBet');
const User = require('../models/User');

// ============================================
// ADMIN ROUTES
// ============================================

// Get game state
router.get('/state', auth, async (req, res) => {
  try {
    const game = await AviatorGame.findOne().sort({ createdAt: -1 });
    res.json(game || { status: 'idle', multiplier: 1.00 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start game (Admin only)
router.post('/start', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { crashPoint } = req.body;
    
    // Check if there's already an active game
    const existing = await AviatorGame.findOne({ status: 'active' });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Game already active' });
    }

    const game = new AviatorGame({
      status: 'active',
      startTime: new Date(),
      crashPoint: crashPoint || 0,
      roundNumber: (await AviatorGame.countDocuments()) + 1
    });

    await game.save();
    res.json({ success: true, game });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Stop game (Admin only)
router.post('/stop', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const game = await AviatorGame.findOne({ status: 'active' });
    if (!game) {
      return res.status(400).json({ success: false, message: 'No active game' });
    }

    game.status = 'crashed';
    game.endTime = new Date();
    game.crashPoint = game.multiplier || 1.5;
    await game.save();

    // Process all active bets
    const activeBets = await AviatorBet.find({ gameId: game._id, status: 'active' });
    for (const bet of activeBets) {
      bet.status = 'lost';
      await bet.save();
    }

    res.json({ success: true, game });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Close game (Admin only)
router.post('/close', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const game = await AviatorGame.findOne({ status: { $in: ['active', 'waiting'] } });
    if (game) {
      game.status = 'closed';
      await game.save();
    }

    // Cancel all active bets
    await AviatorBet.updateMany({ status: 'active' }, { status: 'cancelled' });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Set crash point (Admin only)
router.post('/set-crash', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { crashPoint } = req.body;
    if (!crashPoint || crashPoint < 1.01) {
      return res.status(400).json({ success: false, message: 'Invalid crash point' });
    }

    const game = await AviatorGame.findOne({ status: { $in: ['idle', 'waiting'] } });
    if (game) {
      game.crashPoint = crashPoint;
      await game.save();
    } else {
      const newGame = new AviatorGame({
        status: 'idle',
        crashPoint: crashPoint,
        roundNumber: (await AviatorGame.countDocuments()) + 1
      });
      await newGame.save();
    }

    res.json({ success: true, message: 'Crash point set' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update settings (Admin only)
router.post('/settings', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const settings = req.body;
    // Save settings to database or file
    // For now, just return success
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get history
router.get('/history', auth, async (req, res) => {
  try {
    const history = await AviatorGame.find({ status: 'crashed' })
      .sort({ endTime: -1 })
      .limit(50);
    res.json(history);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get active bets
router.get('/active-bets', auth, async (req, res) => {
  try {
    const game = await AviatorGame.findOne({ status: 'active' });
    if (!game) {
      return res.json([]);
    }

    const bets = await AviatorBet.find({ gameId: game._id, status: 'active' })
      .populate('userId', 'username email');
    res.json(bets);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// USER ROUTES
// ============================================

// Place bet
router.post('/bet', auth, async (req, res) => {
  try {
    const { amount, autoCashOut } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const game = await AviatorGame.findOne({ status: 'active' });
    if (!game) {
      return res.status(400).json({ success: false, message: 'No active game' });
    }

    // Deduct balance
    user.balance -= amount;
    await user.save();

    const bet = new AviatorBet({
      userId: user._id,
      gameId: game._id,
      amount,
      autoCashOut: autoCashOut || 0,
      status: 'active'
    });

    await bet.save();

    res.json({ success: true, bet, balance: user.balance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cash out
router.post('/cashout', auth, async (req, res) => {
  try {
    const { betId } = req.body;
    const bet = await AviatorBet.findOne({ _id: betId, userId: req.user.id });
    
    if (!bet) {
      return res.status(404).json({ success: false, message: 'Bet not found' });
    }

    if (bet.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Bet already settled' });
    }

    const game = await AviatorGame.findById(bet.gameId);
    if (!game || game.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Game not active' });
    }

    const multiplier = game.multiplier || 1.0;
    const winAmount = bet.amount * multiplier;
    const profit = winAmount - bet.amount;

    bet.status = 'cashed';
    bet.cashOutMultiplier = multiplier;
    bet.winAmount = winAmount;
    await bet.save();

    // Add to user balance
    const user = await User.findById(req.user.id);
    user.balance += winAmount;
    await user.save();

    res.json({ 
      success: true, 
      bet, 
      winAmount, 
      profit, 
      balance: user.balance 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;