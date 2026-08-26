const express = require('express');
const router = express.Router();
const AviatorRound = require('../models/AviatorRound');
const AviatorBet = require('../models/AviatorBet');
const User = require('../models/User');
const { getGameEngine } = require('../sockets/aviatorSocket');

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

// ========== GET CURRENT ROUND ==========
router.get('/current-round', async (req, res) => {
  try {
    const engine = getGameEngine();
    if (!engine || !engine.currentRound) {
      return res.json({
        success: true,
        data: {
          status: 'WAITING',
          multiplier: 1.00,
          serverTime: Date.now()
        }
      });
    }

    const round = engine.currentRound;
    res.json({
      success: true,
      data: {
        roundId: round.roundId,
        status: round.status,
        multiplier: engine.multiplier || 1.00,
        crashMultiplier: round.crashMultiplier || 0,
        serverTime: Date.now()
      }
    });
  } catch (error) {
    console.error('❌ Error getting current round:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

// ========== GET HISTORY ==========
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const engine = getGameEngine();
    
    let history;
    if (engine) {
      history = await engine.getHistory(limit);
    } else {
      history = await AviatorRound.find({ status: 'CRASHED' })
        .sort({ endTime: -1 })
        .limit(limit)
        .select('roundId crashMultiplier endTime');
    }

    res.json({
      success: true,
      data: history.map(h => ({
        roundId: h.roundId,
        crashMultiplier: h.crashMultiplier,
        crashedAt: h.endTime
      }))
    });
  } catch (error) {
    console.error('❌ Error getting history:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

// ========== GET MY BETS ==========
router.get('/my-bets', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const engine = getGameEngine();

    let bets, total;
    if (engine) {
      const result = await engine.getMyBets(userId, limit, offset);
      bets = result.bets;
      total = result.total;
    } else {
      bets = await AviatorBet.find({ userId })
        .sort({ placedAt: -1 })
        .skip(offset)
        .limit(limit);
      total = await AviatorBet.countDocuments({ userId });
    }

    res.json({
      success: true,
      data: {
        bets: bets.map(b => ({
          betId: b.betId,
          roundId: b.roundId,
          stake: b.stake,
          cashoutMultiplier: b.cashoutMultiplier || 0,
          payout: b.payout || 0,
          status: b.status,
          result: b.status === 'CASHED_OUT' ? 'WON' : b.status === 'LOST' ? 'LOST' : 'PENDING',
          placedAt: b.placedAt
        })),
        total,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('❌ Error getting my bets:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

// ========== GET LIVE PLAYERS ==========
router.get('/live-players', async (req, res) => {
  try {
    const engine = getGameEngine();
    if (!engine || !engine.currentRound) {
      return res.json({
        success: true,
        data: []
      });
    }

    const players = await engine.getLivePlayers(engine.currentRound.roundId);
    res.json({
      success: true,
      data: players
    });
  } catch (error) {
    console.error('❌ Error getting live players:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

// ========== VERIFY ROUND ==========
router.get('/verify/:roundId', async (req, res) => {
  try {
    const { roundId } = req.params;
    const engine = getGameEngine();

    let verification;
    if (engine) {
      verification = await engine.verifyRound(roundId);
    } else {
      // Fallback: calculate directly
      const round = await AviatorRound.findOne({ roundId });
      if (!round) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Round not found' }
        });
      }
      // ... verification logic
    }

    if (!verification) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Round not found' }
      });
    }

    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('❌ Error verifying round:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

// ========== PLACE BET ==========
router.post('/bet', authMiddleware, async (req, res) => {
  try {
    const { roundId, stake, betSlot, idempotencyKey } = req.body;
    const userId = req.user.id;

    if (!roundId || !stake || stake <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Invalid bet request' }
      });
    }

    const engine = getGameEngine();
    if (!engine) {
      return res.status(503).json({
        success: false,
        error: { code: 'GAME_UNAVAILABLE', message: 'Game engine is not available' }
      });
    }

    const result = await engine.placeBet(userId, roundId, stake, betSlot || 1);

    res.json({
      success: true,
      data: {
        bet: result.bet,
        balance: result.newBalance
      }
    });
  } catch (error) {
    console.error('❌ Error placing bet:', error);
    res.status(400).json({
      success: false,
      error: {
        code: error.message.toUpperCase().replace(/ /g, '_'),
        message: error.message
      }
    });
  }
});

// ========== CASH OUT ==========
router.post('/cashout', authMiddleware, async (req, res) => {
  try {
    const { betId, idempotencyKey } = req.body;
    const userId = req.user.id;

    if (!betId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Missing bet ID' }
      });
    }

    const engine = getGameEngine();
    if (!engine) {
      return res.status(503).json({
        success: false,
        error: { code: 'GAME_UNAVAILABLE', message: 'Game engine is not available' }
      });
    }

    const result = await engine.cashOut(userId, betId);

    res.json({
      success: true,
      data: {
        betId: result.bet.betId,
        multiplier: result.multiplier,
        stake: result.bet.stake,
        payout: result.payout,
        profit: result.profit,
        balance: result.newBalance
      }
    });
  } catch (error) {
    console.error('❌ Error cashing out:', error);
    res.status(400).json({
      success: false,
      error: {
        code: error.message.toUpperCase().replace(/ /g, '_'),
        message: error.message
      }
    });
  }
});

// ========== CANCEL PENDING BET ==========
router.post('/cancel-pending', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { betId } = req.body;

    if (!betId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Missing bet ID' }
      });
    }

    const bet = await AviatorBet.findOne({ betId, userId, status: 'ACTIVE' });
    if (!bet) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Active bet not found' }
      });
    }

    const round = await AviatorRound.findOne({ roundId: bet.roundId });
    if (!round || round.status !== 'BETTING_OPEN') {
      return res.status(400).json({
        success: false,
        error: { code: 'BETTING_CLOSED', message: 'Cannot cancel bet now' }
      });
    }

    // Refund bet
    const user = await User.findById(userId);
    if (user) {
      user.balance += bet.stake;
      await user.save();
    }

    bet.status = 'REFUNDED';
    await bet.save();

    // Create refund transaction
    const GameTransaction = require('../models/GameTransaction');
    const transaction = new GameTransaction({
      transactionId: await GameTransaction.generateTransactionId(),
      userId: userId,
      betId: bet.betId,
      roundId: round.roundId,
      type: 'REFUND',
      amount: bet.stake,
      balanceBefore: user.balance - bet.stake,
      balanceAfter: user.balance,
      status: 'COMPLETED'
    });
    await transaction.save();

    res.json({
      success: true,
      data: {
        message: 'Bet cancelled and refunded',
        balance: user.balance
      }
    });
  } catch (error) {
    console.error('❌ Error cancelling bet:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

module.exports = router;