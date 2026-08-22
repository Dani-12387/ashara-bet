// ============================================
// AVIATOR GAME CONTROLLER - Backend Logic
// ============================================

// ========== GAME STATE ==========
let gameState = {
  status: 'idle', // idle, waiting, active, crashed
  multiplier: 1.00,
  crashPoint: 0,
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

// ========== START GAME ==========
exports.startGame = async (req, res) => {
  try {
    if (gameState.status === 'active') {
      return res.status(400).json({ success: false, message: 'Game is already active' });
    }

    // Reset game state
    gameState.status = 'active';
    gameState.multiplier = 1.00;
    gameState.roundNumber += 1;
    gameState.startTime = Date.now();
    gameState.totalBets = 0;
    gameState.totalAmount = 0;

    // Generate random crash point (2x - 100x)
    gameState.crashPoint = 2 + Math.random() * 98;

    // Start the game loop
    startGameLoop();

    res.json({ 
      success: true, 
      message: `Round ${gameState.roundNumber} started!`,
      gameState: gameState
    });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GAME LOOP ==========
function startGameLoop() {
  if (gameState.gameInterval) {
    clearInterval(gameState.gameInterval);
  }

  const startTime = Date.now();
  
  gameState.gameInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    
    // Calculate multiplier - starts at 1.00 and increases
    const newMultiplier = 1 + Math.pow(elapsed * 0.5, 1.5) * 0.3;
    const cappedMultiplier = Math.min(newMultiplier, 100);
    gameState.multiplier = Math.round(cappedMultiplier * 100) / 100;

    // Check if game should crash
    if (gameState.multiplier >= gameState.crashPoint) {
      crashGame();
    }

    console.log(`📊 Round ${gameState.roundNumber}: ${gameState.multiplier.toFixed(2)}x`);
  }, 100);
}

// ========== CRASH GAME ==========
async function crashGame() {
  if (gameState.status === 'crashed') return;
  
  // Stop the interval
  if (gameState.gameInterval) {
    clearInterval(gameState.gameInterval);
    gameState.gameInterval = null;
  }

  gameState.status = 'crashed';
  
  console.log(`💥 Round ${gameState.roundNumber} crashed at ${gameState.multiplier.toFixed(2)}x`);

  // Process bets (they lose)
  try {
    // You'll need your Bet model here
    // const Bet = require('../models/Bet');
    // const activeBets = await Bet.find({ status: 'active', gameRound: gameState.roundNumber });
    // for (const bet of activeBets) {
    //   bet.status = 'lost';
    //   await bet.save();
    // }
  } catch (error) {
    console.error('Error processing bets:', error);
  }

  // Reset after 3 seconds
  setTimeout(() => {
    if (gameState.autoStart) {
      // Auto-start next round
      gameState.status = 'idle';
      exports.startGame();
    } else {
      gameState.status = 'idle';
      gameState.multiplier = 1.00;
    }
  }, 3000);
}

// ========== STOP GAME (Manual Crash) ==========
exports.stopGame = async (req, res) => {
  try {
    if (gameState.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Game is not active' });
    }

    await crashGame();
    
    res.json({ 
      success: true, 
      message: `Game stopped at ${gameState.multiplier.toFixed(2)}x`,
      gameState: gameState
    });
  } catch (error) {
    console.error('Error stopping game:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== CLOSE GAME ==========
exports.closeGame = async (req, res) => {
  try {
    if (gameState.gameInterval) {
      clearInterval(gameState.gameInterval);
      gameState.gameInterval = null;
    }

    gameState.status = 'closed';
    gameState.multiplier = 1.00;

    res.json({ 
      success: true, 
      message: 'Game closed successfully!',
      gameState: gameState
    });
  } catch (error) {
    console.error('Error closing game:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET GAME STATE ==========
exports.getGameState = async (req, res) => {
  try {
    // Return current game state with multiplier
    res.json({
      status: gameState.status,
      multiplier: gameState.multiplier || 1.00,
      crashPoint: gameState.crashPoint || 0,
      roundNumber: gameState.roundNumber || 0,
      playersActive: gameState.playersActive || 0,
      totalBets: gameState.totalBets || 0,
      totalAmount: gameState.totalAmount || 0,
      autoStart: gameState.autoStart || false,
      autoStartDelay: gameState.autoStartDelay || 10,
      minBet: gameState.minBet || 1,
      maxBet: gameState.maxBet || 1000,
      houseEdge: gameState.houseEdge || 5
    });
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== SET NEXT CRASH POINT ==========
exports.setCrashPoint = async (req, res) => {
  try {
    const { crashPoint } = req.body;
    
    if (!crashPoint || crashPoint < 1.01) {
      return res.status(400).json({ 
        success: false, 
        message: 'Crash point must be at least 1.01' 
      });
    }

    gameState.crashPoint = crashPoint;

    res.json({ 
      success: true, 
      message: `Next crash point set to ${crashPoint}x`,
      crashPoint: crashPoint
    });
  } catch (error) {
    console.error('Error setting crash point:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== UPDATE SETTINGS ==========
exports.updateSettings = async (req, res) => {
  try {
    const { autoStart, autoStartDelay, minBet, maxBet, houseEdge } = req.body;

    if (autoStart !== undefined) gameState.autoStart = autoStart;
    if (autoStartDelay) gameState.autoStartDelay = autoStartDelay;
    if (minBet) gameState.minBet = minBet;
    if (maxBet) gameState.maxBet = maxBet;
    if (houseEdge) gameState.houseEdge = houseEdge;

    res.json({ 
      success: true, 
      message: 'Settings updated!',
      settings: {
        autoStart: gameState.autoStart,
        autoStartDelay: gameState.autoStartDelay,
        minBet: gameState.minBet,
        maxBet: gameState.maxBet,
        houseEdge: gameState.houseEdge
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET HISTORY ==========
exports.getHistory = async (req, res) => {
  try {
    // Return dummy history for now
    // You'll connect this to your database later
    res.json([
      { roundNumber: 1, crashPoint: 2.45, playersActive: 5, endTime: new Date() },
      { roundNumber: 2, crashPoint: 1.85, playersActive: 8, endTime: new Date() },
      { roundNumber: 3, crashPoint: 3.20, playersActive: 12, endTime: new Date() }
    ]);
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET ACTIVE BETS ==========
exports.getActiveBets = async (req, res) => {
  try {
    // Return dummy active bets for now
    res.json([]);
  } catch (error) {
    console.error('Error getting active bets:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== PLACE BET ==========
exports.placeBet = async (req, res) => {
  try {
    const { amount, autoCashOut } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (gameState.status !== 'active' && gameState.status !== 'waiting') {
      return res.status(400).json({ 
        success: false, 
        message: 'Game is not active. Wait for the next round.' 
      });
    }

    // Check bet limits
    if (amount < gameState.minBet || amount > gameState.maxBet) {
      return res.status(400).json({
        success: false,
        message: `Bet must be between ${gameState.minBet} and ${gameState.maxBet}`
      });
    }

    // Here you would:
    // 1. Check user balance
    // 2. Deduct balance
    // 3. Create bet in database

    // For now, return success
    res.json({ 
      success: true, 
      message: 'Bet placed successfully!',
      bet: {
        amount: amount,
        autoCashOut: autoCashOut || 0,
        gameRound: gameState.roundNumber
      }
    });
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== CASH OUT ==========
exports.cashOut = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (gameState.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Game is not active!' 
      });
    }

    // Here you would:
    // 1. Find user's active bet
    // 2. Calculate winnings
    // 3. Update balance
    // 4. Mark bet as cashed

    const winAmount = 100; // Example
    const profit = winAmount - 10; // Example

    res.json({ 
      success: true, 
      message: `Cashed out at ${gameState.multiplier.toFixed(2)}x!`,
      winAmount: winAmount,
      profit: profit,
      multiplier: gameState.multiplier
    });
  } catch (error) {
    console.error('Error cashing out:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};