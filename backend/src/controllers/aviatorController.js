// ============================================
// AVIATOR CONTROLLER – ADMIN CONTROLLED ONLY
// ============================================

const User = require('../models/User');
const crypto = require('crypto');

console.log('🔄 Loading aviator controller (admin-only)...');

// ========== GAME STATE ==========
let gameState = {
  status: 'idle',              // idle, active, crashed, closed
  multiplier: 1.00,
  crashPoint: 0,
  nextCrashPoint: 0,
  roundNumber: 0,
  playersActive: 0,
  totalBets: 0,
  totalAmount: 0,
  gameInterval: null,
  startTime: null,
  autoStart: false,            // ✅ MUST be false – admin only
  autoStartDelay: 10,
  minBet: 1,
  maxBet: 1000,
  houseEdge: 5
};

// ========== IN‑MEMORY STORAGE ==========
let gameHistory = [];
let activeBets = [];
let pendingBets = [];

// ========== BROADCAST (Socket.IO) ==========
function broadcastGameState() {
  if (global.io) {
    global.io.emit('round:state', {
      status: gameState.status,
      multiplier: gameState.multiplier,
      roundNumber: gameState.roundNumber,
      crashPoint: gameState.crashPoint,
      playersActive: activeBets.filter(b => b.status === 'active').length,
      totalBets: activeBets.length,
      totalAmount: activeBets.reduce((s, b) => s + b.amount, 0),
      pendingBets: pendingBets.length
    });
  } else {
    console.warn('⚠️ global.io not available – cannot broadcast');
  }
  console.log(`📊 Round ${gameState.roundNumber}: ${gameState.multiplier.toFixed(2)}x | Status: ${gameState.status}`);
}

// ========== GAME LOOP ==========
function startGameLoop() {
  if (gameState.gameInterval) clearInterval(gameState.gameInterval);
  const startTime = Date.now();

  gameState.gameInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const increment = 0.01 + elapsed * 0.001;
    gameState.multiplier = Math.round((gameState.multiplier + increment) * 100) / 100;

    // Auto cash out
    for (const bet of activeBets) {
      if (bet.status === 'active' && bet.autoCashOut > 0 && gameState.multiplier >= bet.autoCashOut) {
        processCashOut(bet);
      }
    }

    // Check crash
    if (gameState.multiplier >= gameState.crashPoint) {
      crashGame();
    }

    broadcastGameState();
  }, 100);
}

// ========== PROCESS CASH OUT (auto) ==========
async function processCashOut(bet) {
  try {
    const user = await User.findById(bet.userId);
    if (!user) return;
    const winAmount = bet.amount * gameState.multiplier;
    const profit = winAmount - bet.amount;
    user.wallet.balance = (user.wallet?.balance ?? 0) + winAmount;
    await user.save();
    bet.status = 'cashed';
    bet.winAmount = winAmount;
    bet.cashedAt = gameState.multiplier;
    console.log(`✅ User ${user.username} cashed out at ${gameState.multiplier.toFixed(2)}x | Profit: ${profit.toFixed(2)}`);
  } catch (error) {
    console.error('Cash out error:', error);
  }
}

// ========== CRASH GAME ==========
async function crashGame() {
  if (gameState.status === 'crashed') return;
  console.log(`💥 Game crashed at ${gameState.multiplier.toFixed(2)}x`);

  if (gameState.gameInterval) {
    clearInterval(gameState.gameInterval);
    gameState.gameInterval = null;
  }

  gameState.status = 'crashed';
  const crashMultiplier = gameState.multiplier;

  for (const bet of activeBets) {
    if (bet.status === 'active') {
      bet.status = 'lost';
      const user = await User.findById(bet.userId);
      if (user) console.log(`❌ Bet lost for user ${user.username}`);
    }
  }

  const crashRecord = {
    roundNumber: gameState.roundNumber,
    crashPoint: crashMultiplier,
    playersActive: activeBets.length,
    totalAmount: activeBets.reduce((s, b) => s + b.amount, 0),
    endTime: new Date()
  };
  gameHistory = [crashRecord, ...gameHistory].slice(0, 10);
  activeBets = [];

  broadcastGameState();

  setTimeout(() => {
    console.log('🔄 Resetting to idle. Admin must start next round.');
    gameState.status = 'idle';
    gameState.multiplier = 1.00;
    broadcastGameState();
  }, 3000);
}

// ============================================
//  ADMIN EXPORTS
// ============================================

exports.startGame = async (req, res) => {
  try {
    if (gameState.status === 'active') {
      return res.status(400).json({ success: false, message: 'Game already active' });
    }

    for (const p of pendingBets) {
      activeBets.push({ ...p, status: 'active', activatedAt: new Date() });
    }
    pendingBets = [];

    gameState.status = 'active';
    gameState.multiplier = 1.00;
    gameState.roundNumber += 1;
    gameState.startTime = Date.now();
    gameState.totalBets = activeBets.length;
    gameState.totalAmount = activeBets.reduce((s, b) => s + b.amount, 0);

    gameState.crashPoint = gameState.nextCrashPoint > 1.01
      ? gameState.nextCrashPoint
      : 2 + Math.random() * 98;
    gameState.nextCrashPoint = 0;

    startGameLoop();
    broadcastGameState();

    res.json({
      success: true,
      message: `Round ${gameState.roundNumber} started!`,
      gameState: {
        status: gameState.status,
        multiplier: gameState.multiplier,
        crashPoint: gameState.crashPoint,
        roundNumber: gameState.roundNumber
      }
    });
  } catch (error) {
    console.error('Start error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.stopGame = async (req, res) => {
  try {
    if (gameState.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Game not active' });
    }
    await crashGame();
    res.json({
      success: true,
      message: `Game stopped at ${gameState.multiplier.toFixed(2)}x`,
      multiplier: gameState.multiplier,
      roundNumber: gameState.roundNumber
    });
  } catch (error) {
    console.error('Stop error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.closeGame = async (req, res) => {
  try {
    if (gameState.gameInterval) clearInterval(gameState.gameInterval);
    gameState.status = 'closed';
    gameState.multiplier = 1.00;

    const allBets = [...activeBets, ...pendingBets];
    for (const bet of allBets) {
      if (bet.status === 'active' || bet.status === 'pending') {
        const user = await User.findById(bet.userId);
        if (user) {
          user.wallet.balance = (user.wallet?.balance ?? 0) + bet.amount;
          await user.save();
        }
      }
    }
    activeBets = [];
    pendingBets = [];
    broadcastGameState();
    res.json({ success: true, message: 'Game closed, all bets refunded' });
  } catch (error) {
    console.error('Close error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setCrashPoint = async (req, res) => {
  try {
    const { crashPoint } = req.body;
    if (!crashPoint || crashPoint < 1.01) {
      return res.status(400).json({ success: false, message: 'Invalid crash point' });
    }
    gameState.nextCrashPoint = Math.round(crashPoint * 100) / 100;
    res.json({ success: true, message: `Next crash point set to ${gameState.nextCrashPoint.toFixed(2)}x` });
  } catch (error) {
    console.error('Set crash error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { autoStart, autoStartDelay, minBet, maxBet, houseEdge } = req.body;
    if (autoStart !== undefined) gameState.autoStart = autoStart;
    if (autoStartDelay) gameState.autoStartDelay = autoStartDelay;
    if (minBet) gameState.minBet = minBet;
    if (maxBet) gameState.maxBet = maxBet;
    if (houseEdge) gameState.houseEdge = houseEdge;
    res.json({ success: true, message: 'Settings updated', settings: gameState });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
//  DATA RETRIEVAL
// ============================================

exports.getGameState = async (req, res) => {
  try {
    res.json({
      status: gameState.status,
      multiplier: gameState.multiplier,
      crashPoint: gameState.crashPoint,
      roundNumber: gameState.roundNumber,
      playersActive: activeBets.filter(b => b.status === 'active').length,
      totalBets: activeBets.length,
      totalAmount: activeBets.reduce((s, b) => s + b.amount, 0),
      pendingBets: pendingBets.length,
      nextCrashPoint: gameState.nextCrashPoint,
      autoStart: gameState.autoStart,
      autoStartDelay: gameState.autoStartDelay,
      minBet: gameState.minBet,
      maxBet: gameState.maxBet,
      houseEdge: gameState.houseEdge
    });
  } catch (error) {
    console.error('Get state error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    res.json(gameHistory);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ UPDATED: Admin sees both active and pending bets with usernames
exports.getActiveBets = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    let bets = [];
    if (isAdmin) {
      bets = [...activeBets, ...pendingBets];
    } else {
      bets = activeBets.filter(b => b.status === 'active');
    }

    const formatted = bets.map(bet => ({
      _id: bet.betId || bet._id,
      user: { username: bet.username || 'Unknown' },
      amount: bet.amount,
      stake: bet.amount,
      autoCashOut: bet.autoCashOut || 0,
      status: bet.status,        // active, pending, cashed, lost
      gameRound: bet.gameRound,
      placedAt: bet.placedAt
    }));

    res.json(formatted);
  } catch (error) {
    console.error('❌ Error getting active bets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
//  PLAYER ACTIONS
// ============================================

exports.placeBet = async (req, res) => {
  try {
    const { amount, autoCashOut } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });
    if (gameState.status !== 'idle' && gameState.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Game not available' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const currentBalance = user.wallet?.balance ?? 0;
    if (amount < gameState.minBet || amount > gameState.maxBet) {
      return res.status(400).json({ success: false, message: `Bet must be between ${gameState.minBet} and ${gameState.maxBet}` });
    }
    if (currentBalance < amount) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    // Deduct balance
    user.wallet.balance = currentBalance - amount;
    await user.save();

    const isActive = gameState.status === 'active';
    const bet = {
      userId,
      username: user.username,        // ✅ store username for admin display
      amount,
      autoCashOut: autoCashOut || 0,
      status: isActive ? 'active' : 'pending',
      gameRound: isActive ? gameState.roundNumber : gameState.roundNumber + 1,
      placedAt: new Date(),
      betId: `BET-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    };

    if (isActive) {
      activeBets.push(bet);
      gameState.totalBets += 1;
      gameState.totalAmount += amount;
    } else {
      pendingBets.push(bet);
    }

    broadcastGameState();
    res.json({
      success: true,
      message: isActive ? 'Bet placed!' : 'Bet placed (pending)',
      status: isActive ? 'active' : 'pending',
      newBalance: user.wallet.balance,
      bet
    });
  } catch (error) {
    console.error('Place bet error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cashOut = async (req, res) => {
  try {
    const userId = req.user.id;
    if (gameState.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Game not active' });
    }
    const index = activeBets.findIndex(b => b.userId === userId && b.status === 'active');
    if (index === -1) return res.status(404).json({ success: false, message: 'No active bet' });

    const bet = activeBets[index];
    const multiplier = gameState.multiplier;
    const winAmount = bet.amount * multiplier;
    const profit = winAmount - bet.amount;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.wallet.balance = (user.wallet?.balance ?? 0) + winAmount;
    await user.save();

    bet.status = 'cashed';
    bet.winAmount = winAmount;
    bet.cashedAt = multiplier;
    activeBets.splice(index, 1);

    broadcastGameState();
    res.json({
      success: true,
      message: `Cashed out at ${multiplier.toFixed(2)}x`,
      winAmount,
      profit,
      multiplier,
      newBalance: user.wallet.balance
    });
  } catch (error) {
    console.error('Cash out error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelPendingBet = async (req, res) => {
  try {
    const userId = req.user.id;
    const index = pendingBets.findIndex(b => b.userId === userId && b.status === 'pending');
    if (index === -1) return res.status(404).json({ success: false, message: 'No pending bet' });

    const bet = pendingBets[index];
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.wallet.balance = (user.wallet?.balance ?? 0) + bet.amount;
    await user.save();

    pendingBets.splice(index, 1);
    broadcastGameState();
    res.json({ success: true, message: 'Bet cancelled', newBalance: user.wallet.balance });
  } catch (error) {
    console.error('Cancel bet error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
//  PLAYER PAGE ENDPOINTS
// ============================================

exports.getCurrentRound = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        roundId: gameState.roundNumber ? `AV-${gameState.roundNumber}` : null,
        status: gameState.status === 'active' ? 'RUNNING' :
                gameState.status === 'idle' ? 'WAITING' :
                gameState.status === 'crashed' ? 'CRASHED' :
                gameState.status === 'closed' ? 'CLOSED' : 'WAITING',
        multiplier: gameState.multiplier || 1.00,
        crashMultiplier: gameState.crashPoint || 0,
        serverTime: Date.now()
      }
    });
  } catch (error) {
    console.error('Get current round error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyBets = async (req, res) => {
  try {
    const userId = req.user.id;
    const userBets = [...pendingBets, ...activeBets].filter(b => b.userId === userId);
    const formatted = userBets.map(b => ({
      betId: b.betId,
      roundId: b.gameRound ? `AV-${b.gameRound}` : null,
      stake: b.amount,
      cashoutMultiplier: b.cashedAt || 0,
      payout: b.winAmount || 0,
      status: b.status,
      result: b.status === 'cashed' ? 'WON' : b.status === 'lost' ? 'LOST' : 'PENDING',
      placedAt: b.placedAt
    }));
    res.json({ success: true, data: { bets: formatted, total: formatted.length } });
  } catch (error) {
    console.error('Get my bets error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLivePlayers = async (req, res) => {
  try {
    const players = [];
    for (const bet of activeBets) {
      if (bet.status === 'active') {
        const user = await User.findById(bet.userId);
        players.push({
          displayName: user ? `${user.username.slice(0, 6)}***` : 'User***',
          stake: bet.amount,
          multiplier: gameState.multiplier,
          status: 'ACTIVE'
        });
      }
    }
    res.json({ success: true, data: players });
  } catch (error) {
    console.error('Get live players error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyRound = async (req, res) => {
  try {
    const { roundId } = req.params;
    const num = parseInt(roundId.replace('AV-', ''));
    const round = gameHistory.find(h => h.roundNumber === num);
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });
    res.json({ success: true, data: { roundId, crashPoint: round.crashPoint, verified: true } });
  } catch (error) {
    console.error('Verify round error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

console.log('✅ Aviator controller ready (admin-only). Auto-start is OFF.');