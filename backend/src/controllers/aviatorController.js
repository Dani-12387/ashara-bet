// ============================================
// AVIATOR GAME CONTROLLER - FULL WORKING VERSION
// ============================================

// ========== GAME STATE ==========
let gameState = {
  status: 'idle', // idle, active, crashed, closed
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

// ========== GAME HISTORY - STORE REAL DATA ==========
let gameHistory = [];

// ========== ACTIVE BETS STORAGE ==========
let activeBets = [];

// ========== BROADCAST FUNCTION ==========
function broadcastGameState() {
  console.log(`📊 Round ${gameState.roundNumber}: ${gameState.multiplier.toFixed(2)}x | Status: ${gameState.status}`);
}

// ========== START GAME ==========
exports.startGame = async (req, res) => {
  try {
    console.log('🚀 Start game called');
    
    if (gameState.status === 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Game is already active' 
      });
    }

    gameState.status = 'active';
    gameState.multiplier = 1.00;
    gameState.roundNumber += 1;
    gameState.startTime = Date.now();
    gameState.totalBets = 0;
    gameState.totalAmount = 0;

    if (gameState.nextCrashPoint > 1.01) {
      gameState.crashPoint = gameState.nextCrashPoint;
      gameState.nextCrashPoint = 0;
    } else {
      gameState.crashPoint = 2 + Math.random() * 98;
    }

    console.log(`🎯 Crash point set to: ${gameState.crashPoint.toFixed(2)}x`);
    console.log(`🔄 Round ${gameState.roundNumber} started!`);

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
    console.error('❌ Error starting game:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GAME LOOP ==========
function startGameLoop() {
  if (gameState.gameInterval) {
    clearInterval(gameState.gameInterval);
    gameState.gameInterval = null;
  }

  const startTime = Date.now();
  console.log('⏱️ Game loop started');
  
  gameState.gameInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    
    const increment = 0.01;
    const newMultiplier = gameState.multiplier + increment;
    const cappedMultiplier = Math.min(newMultiplier, 100);
    gameState.multiplier = Math.round(cappedMultiplier * 100) / 100;

    // ✅ Auto cash out for all active bets
    checkAutoCashOut();

    if (gameState.multiplier >= gameState.crashPoint) {
      crashGame();
    }

    broadcastGameState();
  }, 100);
}

// ========== CHECK AUTO CASH OUT ==========
function checkAutoCashOut() {
  for (const bet of activeBets) {
    if (bet.status === 'active' && bet.autoCashOut > 0) {
      if (gameState.multiplier >= bet.autoCashOut) {
        // Auto cash out this bet
        processCashOut(bet);
      }
    }
  }
}

// ========== PROCESS CASH OUT ==========
async function processCashOut(bet) {
  try {
    const User = require('../models/User');
    
    const user = await User.findById(bet.userId);
    if (!user) return;

    const winAmount = bet.amount * gameState.multiplier;
    const profit = winAmount - bet.amount;
    
    // Add winnings to user balance
    user.balance += winAmount;
    await user.save();
    
    // Update bet status
    bet.status = 'cashed';
    bet.winAmount = winAmount;
    bet.cashedAt = gameState.multiplier;
    
    console.log(`✅ User ${user.username} cashed out at ${gameState.multiplier.toFixed(2)}x | Profit: ${profit.toFixed(2)}`);
  } catch (error) {
    console.error('Error processing cash out:', error);
  }
}

// ========== CRASH GAME ==========
async function crashGame() {
  if (gameState.status === 'crashed') return;
  
  const crashMultiplier = gameState.multiplier;
  const crashRound = gameState.roundNumber;
  
  console.log(`💥 Game crashed at ${crashMultiplier.toFixed(2)}x (Round ${crashRound})`);
  
  if (gameState.gameInterval) {
    clearInterval(gameState.gameInterval);
    gameState.gameInterval = null;
  }

  gameState.status = 'crashed';
  
  // ✅ Process all active bets as lost
  for (const bet of activeBets) {
    if (bet.status === 'active') {
      bet.status = 'lost';
      console.log(`❌ Bet lost for user ${bet.userId}`);
    }
  }
  
  // ✅ Store REAL crash data in history
  const crashRecord = {
    roundNumber: crashRound,
    crashPoint: crashMultiplier,
    crashed: true,
    playersActive: activeBets.length,
    totalAmount: activeBets.reduce((sum, b) => sum + b.amount, 0),
    endTime: new Date().toISOString()
  };
  
  gameHistory = [crashRecord, ...gameHistory].slice(0, 7);
  console.log(`📜 History updated: ${gameHistory.length} records`);
  
  // Clear active bets for next round
  activeBets = [];
  
  broadcastGameState();

  setTimeout(() => {
    console.log('🔄 Resetting game state...');
    if (gameState.autoStart) {
      gameState.status = 'idle';
      exports.startGame();
    } else {
      gameState.status = 'idle';
      gameState.multiplier = 1.00;
      broadcastGameState();
    }
  }, 3000);
}

// ========== STOP GAME ==========
exports.stopGame = async (req, res) => {
  try {
    console.log('🛑 Stop game called');
    
    if (gameState.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: `Game is not active. Current status: ${gameState.status}` 
      });
    }

    const stopMultiplier = gameState.multiplier;
    console.log(`🛑 Stopping game at ${stopMultiplier.toFixed(2)}x`);
    
    await crashGame();
    
    res.json({ 
      success: true, 
      message: `Game stopped at ${stopMultiplier.toFixed(2)}x`,
      multiplier: stopMultiplier,
      roundNumber: gameState.roundNumber
    });
  } catch (error) {
    console.error('❌ Error stopping game:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== CLOSE GAME ==========
exports.closeGame = async (req, res) => {
  try {
    console.log('🔒 Close game called');
    
    if (gameState.gameInterval) {
      clearInterval(gameState.gameInterval);
      gameState.gameInterval = null;
    }

    // ✅ Refund all active bets
    const User = require('../models/User');
    for (const bet of activeBets) {
      if (bet.status === 'active') {
        const user = await User.findById(bet.userId);
        if (user) {
          user.balance += bet.amount;
          await user.save();
          console.log(`💰 Refunded ${bet.amount} to user ${user.username}`);
        }
        bet.status = 'refunded';
      }
    }
    
    activeBets = [];
    gameState.status = 'closed';
    gameState.multiplier = 1.00;

    broadcastGameState();

    res.json({ 
      success: true, 
      message: 'Game closed successfully! All bets refunded.',
      gameState: {
        status: gameState.status,
        multiplier: gameState.multiplier,
        roundNumber: gameState.roundNumber
      }
    });
  } catch (error) {
    console.error('❌ Error closing game:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== SET NEXT CRASH POINT ==========
exports.setCrashPoint = async (req, res) => {
  try {
    console.log('🎯 Set crash point called');
    const { crashPoint } = req.body;
    
    if (!crashPoint || crashPoint < 1.01) {
      return res.status(400).json({ 
        success: false, 
        message: 'Crash point must be at least 1.01' 
      });
    }

    gameState.nextCrashPoint = Math.round(crashPoint * 100) / 100;
    console.log(`✅ Next crash point set to ${gameState.nextCrashPoint.toFixed(2)}x`);

    res.json({ 
      success: true, 
      message: `Next crash point set to ${gameState.nextCrashPoint.toFixed(2)}x`,
      crashPoint: gameState.nextCrashPoint
    });
  } catch (error) {
    console.error('❌ Error setting crash point:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== UPDATE SETTINGS ==========
exports.updateSettings = async (req, res) => {
  try {
    console.log('⚙️ Update settings called');
    const { autoStart, autoStartDelay, minBet, maxBet, houseEdge } = req.body;

    if (autoStart !== undefined) gameState.autoStart = autoStart;
    if (autoStartDelay) gameState.autoStartDelay = autoStartDelay;
    if (minBet) gameState.minBet = minBet;
    if (maxBet) gameState.maxBet = maxBet;
    if (houseEdge) gameState.houseEdge = houseEdge;

    res.json({ 
      success: true, 
      message: 'Settings updated successfully!',
      settings: {
        autoStart: gameState.autoStart,
        autoStartDelay: gameState.autoStartDelay,
        minBet: gameState.minBet,
        maxBet: gameState.maxBet,
        houseEdge: gameState.houseEdge
      }
    });
  } catch (error) {
    console.error('❌ Error updating settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET GAME STATE ==========
exports.getGameState = async (req, res) => {
  try {
    res.json({
      status: gameState.status,
      multiplier: gameState.multiplier || 1.00,
      crashPoint: gameState.crashPoint || 0,
      roundNumber: gameState.roundNumber || 0,
      playersActive: activeBets.filter(b => b.status === 'active').length || 0,
      totalBets: activeBets.filter(b => b.status === 'active').length || 0,
      totalAmount: activeBets.reduce((sum, b) => sum + (b.status === 'active' ? b.amount : 0), 0),
      nextCrashPoint: gameState.nextCrashPoint || 0,
      autoStart: gameState.autoStart || false,
      autoStartDelay: gameState.autoStartDelay || 10,
      minBet: gameState.minBet || 1,
      maxBet: gameState.maxBet || 1000,
      houseEdge: gameState.houseEdge || 5
    });
  } catch (error) {
    console.error('❌ Error getting game state:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET HISTORY ==========
exports.getHistory = async (req, res) => {
  try {
    console.log(`📜 Returning ${gameHistory.length} real history records`);
    res.json(gameHistory);
  } catch (error) {
    console.error('❌ Error getting history:', error);
    res.json([]);
  }
};

// ========== GET ACTIVE BETS ==========
exports.getActiveBets = async (req, res) => {
  try {
    res.json(activeBets.filter(b => b.status === 'active'));
  } catch (error) {
    console.error('❌ Error getting active bets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== PLACE BET ==========
exports.placeBet = async (req, res) => {
  try {
    const { amount, autoCashOut } = req.body;
    const userId = req.user?.id;

    console.log(`📊 Place bet called - User: ${userId}, Amount: ${amount}`);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // ✅ Check if game is active
    if (gameState.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Game is not active. Wait for the next round.' 
      });
    }

    // ✅ Check bet limits
    if (amount < gameState.minBet || amount > gameState.maxBet) {
      return res.status(400).json({
        success: false,
        message: `Bet must be between ${gameState.minBet} and ${gameState.maxBet}`
      });
    }

    // ✅ Get user and check balance
    const User = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`💰 User balance before bet: ${user.balance}`);

    if (user.balance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient balance! Balance: ${user.balance.toFixed(2)}` 
      });
    }

    // ✅ Deduct balance
    user.balance -= amount;
    await user.save();

    console.log(`💰 User balance after bet: ${user.balance}`);

    // ✅ Create bet
    const bet = {
      userId: userId,
      amount: amount,
      autoCashOut: autoCashOut || 0,
      gameRound: gameState.roundNumber,
      status: 'active',
      placedAt: new Date().toISOString()
    };
    
    activeBets.push(bet);
    
    // Update game stats
    gameState.totalBets += 1;
    gameState.totalAmount += amount;

    console.log(`✅ Bet placed: ${amount} by user ${user.username || userId}`);

    res.json({ 
      success: true, 
      message: 'Bet placed successfully!',
      newBalance: user.balance,
      bet: {
        amount: amount,
        autoCashOut: autoCashOut || 0,
        gameRound: gameState.roundNumber
      }
    });
  } catch (error) {
    console.error('❌ Error placing bet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== CASH OUT ==========
exports.cashOut = async (req, res) => {
  try {
    const userId = req.user?.id;

    console.log(`💰 Cash out called - User: ${userId}`);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (gameState.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Game is not active!' 
      });
    }

    // ✅ Find user's active bet
    const betIndex = activeBets.findIndex(b => b.userId === userId && b.status === 'active');
    
    if (betIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active bet found' 
      });
    }

    const bet = activeBets[betIndex];
    const currentMultiplier = gameState.multiplier;
    
    // ✅ Calculate winnings
    const winAmount = bet.amount * currentMultiplier;
    const profit = winAmount - bet.amount;

    console.log(`💰 Cash out: ${bet.amount} * ${currentMultiplier} = ${winAmount} (Profit: ${profit})`);

    // ✅ Update user balance
    const User = require('../models/User');
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.balance += winAmount;
    await user.save();

    console.log(`💰 User balance after cash out: ${user.balance}`);

    // ✅ Update bet status
    bet.status = 'cashed';
    bet.winAmount = winAmount;
    bet.cashedAt = currentMultiplier;

    res.json({ 
      success: true, 
      message: `Cashed out at ${currentMultiplier.toFixed(2)}x!`,
      winAmount: winAmount,
      profit: profit,
      multiplier: currentMultiplier,
      newBalance: user.balance
    });
  } catch (error) {
    console.error('❌ Error cashing out:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};