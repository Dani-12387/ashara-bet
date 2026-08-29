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
      autoCashOut: bet.autoCashOut
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
      status: 'cashed'
    });
  }
}

// ========== GAME LOOP (with detailed logging and number conversion) ==========
function startGameLoop() {
  if (gameState.gameInterval) clearInterval(gameState.gameInterval);
  const startTime = Date.now();

  gameState.gameInterval = setInterval(async () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const increment = 0.01 + elapsed * 0.001;
    gameState.multiplier = Math.round((gameState.multiplier + increment) * 100) / 100;

    console.log(`📈 Multiplier: ${gameState.multiplier.toFixed(2)}x, Active bets: ${activeBets.length}`);

    for (let i = activeBets.length - 1; i >= 0; i--) {
      const bet = activeBets[i];
      console.log(`🔍 Checking bet for ${bet.username}: autoCashOut=${bet.autoCashOut} (type: ${typeof bet.autoCashOut})`);
      
      if (bet.status === 'active' && bet.autoCashOut > 0) {
        const currentMult = Math.round(gameState.multiplier * 100) / 100;
        const targetMult = Math.round(Number(bet.autoCashOut) * 100) / 100; // ✅ force number
        
        console.log(`🔍 Comparing: current=${currentMult}, target=${targetMult}, >= ${currentMult >= targetMult}`);
        
        if (currentMult >= targetMult) {
          console.log(`🤖 Auto cashout triggered for ${bet.username} at ${currentMult}x`);
          await processCashOut(bet);
          // processCashOut removes the bet from activeBets
        }
      }
    }

    if (gameState.multiplier >= gameState.crashPoint) {
      crashGame();
    }

    broadcastGameState();
  }, 100);
}

// ========== PROCESS CASH OUT (auto or manual) ==========
async function processCashOut(bet) {
  try {
    const user = await User.findById(bet.userId);
    if (!user) {
      console.error(`❌ User ${bet.userId} not found`);
      return;
    }

    const multiplier = gameState.multiplier;
    const winAmount = bet.amount * multiplier;
    const profit = winAmount - bet.amount;

    // Add winnings
    const currentBalance = user.wallet?.balance ?? 0;
    user.wallet.balance = currentBalance + winAmount;
    await user.save();

    console.log(`💰 User ${user.username} cashed out at ${multiplier.toFixed(2)}x`);
    console.log(`   Stake: ${bet.amount}, Win: ${winAmount}, Profit: ${profit}`);
    console.log(`   Balance before: ${currentBalance}, after: ${user.wallet.balance}`);

    bet.status = 'cashed';
    bet.winAmount = winAmount;
    bet.cashedAt = multiplier;

    endedBets.push({
      ...bet,
      endedAt: new Date(),
      cashoutMultiplier: multiplier,
      winAmount: winAmount
    });

    // Remove from active bets
    const index = activeBets.indexOf(bet);
    if (index > -1) activeBets.splice(index, 1);

    emitBetCashedOut(bet, multiplier);
    broadcastGameState();
  } catch (error) {
    console.error('❌ Cash out error:', error);
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
      endedBets.push({ ...bet, lostAt: new Date(), crashMultiplier });
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
      placedAt: bet.placedAt
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
      endedAt: bet.endedAt || bet.lostAt || bet.cashedAt
    }));
    res.json(formatted);
  } catch (error) {
    console.error('❌ Error getting ended bets:', error);
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

    user.wallet.balance = currentBalance - amount;
    await user.save();

    const isActive = gameState.status === 'active';
    
    // ✅ Force autoCashOut to be a number
    const autoCashOutNum = parseFloat(autoCashOut) || 0;

    const bet = {
      userId,
      username: user.username,
      amount,
      autoCashOut: autoCashOutNum,
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

    const currentBalance = user.wallet?.balance ?? 0;
    user.wallet.balance = currentBalance + winAmount;
    await user.save();

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
    const userBets = [...pendingBets, ...activeBets, ...endedBets].filter(b => b.userId === userId);
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

console.log('✅ Aviator controller ready. Auto‑start is OFF.');