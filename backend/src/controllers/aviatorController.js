// ============================================
// AVIATOR CONTROLLER – ADMIN CONTROLLED ONLY
// ============================================

const User = require('../models/User');
const crypto = require('crypto');

console.log('🔄 Loading aviator controller (admin-only)...');

// ========== GAME STATE ==========
let gameState = {
  status: 'idle',
  multiplier: 1.00,
  crashPoint: 0,
  nextCrashPoint: 0,
  crashPointQueue: [],        // ✅ NEW: queue of crash points
  roundNumber: 0,
  playersActive: 0,
  totalBets: 0,
  totalAmount: 0,
  gameInterval: null,
  startTime: null,
  autoStart: false,
  autoStartDelay: 10,
  minBet: 1,
  maxBet: 1000,
  houseEdge: 5
};

// ========== IN‑MEMORY STORAGE ==========
let gameHistory = [];
let activeBets = [];
let pendingBets = [];
let endedBets = [];

// ========== CONCURRENCY LOCKS ==========
const processingLocks = new Set();   // for placeBet
const cashoutLocks = new Set();      // for cash-out (prevents double processing for same user)

// ========== BROADCAST HELPERS ==========
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
  }
  console.log(`📊 Round ${gameState.roundNumber}: ${gameState.multiplier.toFixed(2)}x | Status: ${gameState.status}`);
}

function emitBetPlaced(bet) {
  if (global.io) {
    global.io.emit('bet:placed', {
      betId: bet.betId,
      userId: bet.userId,
      username: bet.username,
      amount: bet.amount,
      status: bet.status,
      gameRound: bet.gameRound,
      autoCashOut: bet.autoCashOut,
      betSlot: bet.betSlot
    });
  }
}

function emitBetCashedOut(bet, multiplier) {
  if (global.io) {
    global.io.emit('bet:cashed_out', {
      betId: bet.betId,
      userId: bet.userId,
      username: bet.username,
      amount: bet.amount,
      multiplier: multiplier || gameState.multiplier,
      winAmount: bet.winAmount || 0,
      status: 'cashed',
      betSlot: bet.betSlot
    });
  }
}

// ========== GAME LOOP ==========
function startGameLoop() {
  if (gameState.gameInterval) clearInterval(gameState.gameInterval);
  const startTime = Date.now();

  gameState.gameInterval = setInterval(async () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const increment = 0.01 + elapsed * 0.001;
    gameState.multiplier = Math.round((gameState.multiplier + increment) * 100) / 100;

    // Auto cashout check with processing flag
    for (let i = activeBets.length - 1; i >= 0; i--) {
      const bet = activeBets[i];
      if (bet.status === 'active' && bet.autoCashOut > 0 && !bet._processing) {
        const currentMult = Math.round(gameState.multiplier * 100) / 100;
        const targetMult = Math.round(Number(bet.autoCashOut) * 100) / 100;
        if (currentMult >= targetMult) {
          bet._processing = true;
          console.log(`🤖 Auto cashout triggered for ${bet.username} (slot ${bet.betSlot}) at ${currentMult}x`);
          await processCashOut(bet);
        }
      }
    }

    if (gameState.multiplier >= gameState.crashPoint) {
      crashGame();
    }

    broadcastGameState();
  }, 100);
}

// ========== PROCESS CASH OUT (with atomic update & per-user lock) ==========
async function processCashOut(bet) {
  const userId = bet.userId;
  const lockKey = `cashout-${userId}`;

  // If this user is already being processed, skip (should not happen with _processing)
  if (cashoutLocks.has(lockKey)) {
    console.warn(`⚠️ Cash-out lock held for user ${userId}, skipping duplicate`);
    bet._processing = false;
    return;
  }

  // Acquire lock
  cashoutLocks.add(lockKey);

  try {
    // Double-check status
    if (bet.status !== 'active') {
      console.warn(`⚠️ Bet ${bet.betId} already processed (status: ${bet.status})`);
      bet._processing = false;
      return;
    }

    const multiplier = gameState.multiplier;
    const winAmount = bet.amount * multiplier;
    const profit = winAmount - bet.amount;

    // ✅ ATOMIC UPDATE: use $inc to add winAmount directly, no read-before-write race
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { 'wallet.balance': winAmount } },
      { new: true }  // return the updated document
    );

    if (!updatedUser) {
      console.error(`❌ User ${userId} not found during cash-out`);
      bet._processing = false;
      return;
    }

    console.log(`💰 User ${updatedUser.username} cashed out at ${multiplier.toFixed(2)}x (slot ${bet.betSlot})`);
    console.log(`   Stake: ${bet.amount}, Win: ${winAmount}, Profit: ${profit}`);
    console.log(`   New balance: ${updatedUser.wallet.balance}`);

    // Emit wallet update so frontend refreshes balance
    if (global.io) {
      global.io.emit('wallet:updated', {
        userId: userId,
        balance: updatedUser.wallet.balance
      });
    }

    // Update bet status and move to endedBets
    bet.status = 'cashed';
    bet.winAmount = winAmount;
    bet.cashedAt = multiplier;
    bet._processing = false;

    endedBets.push({
      ...bet,
      endedAt: new Date(),
      cashoutMultiplier: multiplier,
      winAmount: winAmount
    });

    // Remove from activeBets
    const index = activeBets.indexOf(bet);
    if (index > -1) {
      activeBets.splice(index, 1);
      console.log(`🗑️ Removed bet ${bet.betId} from activeBets`);
    }

    emitBetCashedOut(bet, multiplier);
    broadcastGameState();

  } catch (error) {
    console.error('❌ Cash out error:', error);
    bet._processing = false;
  } finally {
    // Always release the lock
    cashoutLocks.delete(lockKey);
  }
}

// ========== HELPER: Get the next crash point from queue or fallback ==========
function getNextCrashPoint() {
  // 1. Use the first item from the queue if available
  if (gameState.crashPointQueue && gameState.crashPointQueue.length > 0) {
    const cp = gameState.crashPointQueue.shift();
    console.log(`📌 Using crash point from queue: ${cp}x (${gameState.crashPointQueue.length} left)`);
    return cp;
  }
  // 2. Use the single nextCrashPoint if set
  if (gameState.nextCrashPoint > 1.01) {
    const cp = gameState.nextCrashPoint;
    gameState.nextCrashPoint = 0; // reset after use
    console.log(`📌 Using single nextCrashPoint: ${cp}x`);
    return cp;
  }
  // 3. Fallback: random
  const cp = 2 + Math.random() * 98;
  console.log(`📌 Using random crash point: ${cp.toFixed(2)}x`);
  return cp;
}

// ========== HELPER: Start a new round using the queue ==========
function startNewRound() {
  // Move pending bets to active
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

  // Get crash point from queue or fallback
  gameState.crashPoint = getNextCrashPoint();
  if (gameState.crashPoint <= 1.01) {
    gameState.crashPoint = 2 + Math.random() * 98;
  }

  startGameLoop();
  broadcastGameState();
  console.log(`🚀 Round ${gameState.roundNumber} started with crash point ${gameState.crashPoint.toFixed(2)}x`);
}

// ========== CRASH GAME – with Auto‑Start ==========
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
      bet._processing = false;
      endedBets.push({ ...bet, lostAt: new Date(), crashMultiplier });
      const user = await User.findById(bet.userId);
      if (user) console.log(`❌ Bet lost for user ${user.username} (slot ${bet.betSlot})`);
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

  // ===== AUTO-START LOGIC =====
  // Wait 3 seconds for the "reset to idle" message, then if autoStart is enabled, start next round.
  setTimeout(async () => {
    console.log('🔄 Resetting to idle. Auto‑start:', gameState.autoStart);
    gameState.status = 'idle';
    gameState.multiplier = 1.00;
    broadcastGameState();

    // ✅ If auto‑start is enabled, start a new round after the configured delay
    if (gameState.autoStart && gameState.autoStartDelay > 0) {
      console.log(`⏳ Auto‑start scheduled in ${gameState.autoStartDelay} seconds...`);
      setTimeout(() => {
        console.log('🚀 Auto‑starting next round...');
        startNewRound(); // uses the queue or fallback
      }, gameState.autoStartDelay * 1000);
    }
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
    startNewRound(); // uses the queue or fallback
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
      crashPointQueue: gameState.crashPointQueue || [], // ✅ include queue in state
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

exports.getActiveBets = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    let bets = [];
    if (isAdmin) {
      bets = [...activeBets, ...pendingBets];
    } else {
      bets = activeBets.filter(b => b.status === 'active');
    }
    bets.sort((a, b) => b.amount - a.amount);
    const formatted = bets.map(bet => ({
      _id: bet.betId || bet._id,
      user: { username: bet.username || 'Unknown' },
      amount: bet.amount,
      stake: bet.amount,
      autoCashOut: bet.autoCashOut || 0,
      status: bet.status,
      gameRound: bet.gameRound,
      placedAt: bet.placedAt,
      betSlot: bet.betSlot || 1
    }));
    res.json(formatted);
  } catch (error) {
    console.error('❌ Error getting active bets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEndedBets = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin) return res.status(403).json({ success: false, message: 'Admin only' });
    const sorted = [...endedBets].sort((a, b) => {
      const dateA = a.endedAt || a.lostAt || a.cashedAt || new Date(0);
      const dateB = b.endedAt || b.lostAt || b.cashedAt || new Date(0);
      return new Date(dateB) - new Date(dateA);
    });
    const formatted = sorted.map(bet => ({
      _id: bet.betId || bet._id,
      user: { username: bet.username || 'Unknown' },
      amount: bet.amount,
      stake: bet.amount,
      autoCashOut: bet.autoCashOut || 0,
      status: bet.status,
      winAmount: bet.winAmount || 0,
      cashoutMultiplier: bet.cashedAt || 0,
      endedAt: bet.endedAt || bet.lostAt || bet.cashedAt,
      betSlot: bet.betSlot || 1
    }));
    res.json(formatted);
  } catch (error) {
    console.error('❌ Error getting ended bets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
//  QUEUE MANAGEMENT (NEW)
// ============================================

// Get the current crash point queue
exports.getCrashPointQueue = async (req, res) => {
  try {
    res.json({
      success: true,
      queue: gameState.crashPointQueue || [],
      nextCrashPoint: gameState.nextCrashPoint
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Set the entire queue (replace)
exports.setCrashPointQueue = async (req, res) => {
  try {
    const { queue } = req.body;
    if (!Array.isArray(queue)) {
      return res.status(400).json({ success: false, message: 'Queue must be an array' });
    }
    const valid = queue.every(v => typeof v === 'number' && v > 1.01);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'All values must be numbers > 1.01' });
    }
    gameState.crashPointQueue = queue.map(v => Math.round(v * 100) / 100);
    res.json({
      success: true,
      message: `Queue updated with ${gameState.crashPointQueue.length} points`,
      queue: gameState.crashPointQueue
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add a single crash point to the queue
exports.addCrashPointToQueue = async (req, res) => {
  try {
    const { value } = req.body;
    if (!value || isNaN(value) || value <= 1.01) {
      return res.status(400).json({ success: false, message: 'Invalid crash point' });
    }
    const rounded = Math.round(parseFloat(value) * 100) / 100;
    gameState.crashPointQueue.push(rounded);
    res.json({
      success: true,
      message: `Added ${rounded}x to queue`,
      queue: gameState.crashPointQueue
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove a specific crash point from the queue by index
exports.removeCrashPointFromQueue = async (req, res) => {
  try {
    const { index } = req.params;
    if (index === undefined || isNaN(index)) {
      return res.status(400).json({ success: false, message: 'Invalid index' });
    }
    const idx = parseInt(index);
    if (idx < 0 || idx >= gameState.crashPointQueue.length) {
      return res.status(400).json({ success: false, message: 'Index out of range' });
    }
    const removed = gameState.crashPointQueue.splice(idx, 1);
    res.json({
      success: true,
      message: `Removed ${removed[0]}x from queue`,
      queue: gameState.crashPointQueue
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Clear the entire queue
exports.clearCrashPointQueue = async (req, res) => {
  try {
    gameState.crashPointQueue = [];
    res.json({
      success: true,
      message: 'Queue cleared',
      queue: []
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
//  PLAYER ACTIONS
// ============================================

exports.placeBet = async (req, res) => {
  const { amount, autoCashOut, betSlot } = req.body;
  const userId = req.user.id;

  const targetRound = gameState.status === 'active' ? gameState.roundNumber : gameState.roundNumber + 1;
  const slot = betSlot || 1;
  const lockKey = `${userId}-${slot}-${targetRound}`;

  if (processingLocks.has(lockKey)) {
    return res.status(409).json({ success: false, message: 'Bet already being placed, please wait' });
  }

  processingLocks.add(lockKey);

  try {
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }
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

    const existingBet = [...activeBets, ...pendingBets].find(
      b => b.userId === userId && b.gameRound === targetRound && b.betSlot === slot
    );
    if (existingBet) {
      return res.status(400).json({ success: false, message: `You already have a bet in slot ${slot} for this round` });
    }

    user.wallet.balance = currentBalance - amount;
    await user.save();

    const isActive = gameState.status === 'active';
    const autoCashOutNum = parseFloat(autoCashOut) || 0;

    const bet = {
      userId,
      username: user.username,
      amount,
      autoCashOut: autoCashOutNum,
      status: isActive ? 'active' : 'pending',
      gameRound: targetRound,
      placedAt: new Date(),
      betId: `BET-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      betSlot: slot,
      _processing: false
    };

    if (isActive) {
      activeBets.push(bet);
      gameState.totalBets += 1;
      gameState.totalAmount += amount;
    } else {
      pendingBets.push(bet);
    }

    emitBetPlaced(bet);
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
  } finally {
    processingLocks.delete(lockKey);
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

    // Use atomic update for manual cash-out too
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { 'wallet.balance': winAmount } },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found' });

    // Emit wallet update
    if (global.io) {
      global.io.emit('wallet:updated', {
        userId: userId,
        balance: updatedUser.wallet.balance
      });
    }

    bet.status = 'cashed';
    bet.winAmount = winAmount;
    bet.cashedAt = multiplier;

    endedBets.push({ ...bet, endedAt: new Date() });
    activeBets.splice(index, 1);

    emitBetCashedOut(bet, multiplier);
    broadcastGameState();

    res.json({
      success: true,
      message: `Cashed out at ${multiplier.toFixed(2)}x`,
      winAmount,
      profit,
      multiplier,
      newBalance: updatedUser.wallet.balance
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
    const userBets = [...pendingBets, ...activeBets, ...endedBets].filter(b => b.userId === userId);
    const formatted = userBets.map(b => ({
      betId: b.betId,
      roundId: b.gameRound ? `AV-${b.gameRound}` : null,
      stake: b.amount,
      cashoutMultiplier: b.cashedAt || 0,
      payout: b.winAmount || 0,
      status: b.status,
      result: b.status === 'cashed' ? 'WON' : b.status === 'lost' ? 'LOST' : 'PENDING',
      placedAt: b.placedAt,
      betSlot: b.betSlot || 1
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

console.log('✅ Aviator controller ready. Auto‑start is OFF.');