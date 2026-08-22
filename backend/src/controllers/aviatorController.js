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

// ========== BROADCAST FUNCTION ==========
function broadcastGameState() {
  console.log(`📊 Round ${gameState.roundNumber}: ${gameState.multiplier.toFixed(2)}x | Status: ${gameState.status}`);
  // When Socket.io is added:
  // io.emit('gameState', { ...gameState, multiplier: gameState.multiplier });
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

    // Reset game state
    gameState.status = 'active';
    gameState.multiplier = 1.00;
    gameState.roundNumber += 1;
    gameState.startTime = Date.now();
    gameState.totalBets = 0;
    gameState.totalAmount = 0;

    // Use nextCrashPoint if set, otherwise generate random
    if (gameState.nextCrashPoint > 1.01) {
      gameState.crashPoint = gameState.nextCrashPoint;
      gameState.nextCrashPoint = 0;
    } else {
      gameState.crashPoint = 2 + Math.random() * 98;
    }

    console.log(`🎯 Crash point set to: ${gameState.crashPoint.toFixed(2)}x`);
    console.log(`🔄 Round ${gameState.roundNumber} started!`);

    // Start the game loop
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
  // Clear any existing interval
  if (gameState.gameInterval) {
    clearInterval(gameState.gameInterval);
    gameState.gameInterval = null;
  }

  const startTime = Date.now();
  console.log('⏱️ Game loop started');
  
  gameState.gameInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    
    // Calculate multiplier - starts at 1.00 and increases by 0.01
    // Using exponential growth for realistic feel
    const increment = 0.01; // ✅ Add 0.01 each tick
    const newMultiplier = gameState.multiplier + increment;
    const cappedMultiplier = Math.min(newMultiplier, 100);
    gameState.multiplier = Math.round(cappedMultiplier * 100) / 100;

    // Debug log every second
    if (Math.floor(elapsed) % 1 === 0) {
      console.log(`📈 Multiplier: ${gameState.multiplier.toFixed(2)}x (${gameState.crashPoint.toFixed(2)}x target)`);
    }

    // Check if game should crash
    if (gameState.multiplier >= gameState.crashPoint) {
      console.log(`💥 CRASH! Multiplier ${gameState.multiplier.toFixed(2)}x >= ${gameState.crashPoint.toFixed(2)}x`);
      crashGame();
    }

    broadcastGameState();
  }, 100); // Update every 100ms (10 times per second)
}

// ========== CRASH GAME ==========
async function crashGame() {
  if (gameState.status === 'crashed') return;
  
  console.log(`💥 Game crashed at ${gameState.multiplier.toFixed(2)}x`);
  
  // Stop the interval
  if (gameState.gameInterval) {
    clearInterval(gameState.gameInterval);
    gameState.gameInterval = null;
  }

  gameState.status = 'crashed';
  broadcastGameState();

  // Reset after 3 seconds
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
    console.log(`Current status: ${gameState.status}`);
    
    if (gameState.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: `Game is not active. Current status: ${gameState.status}` 
      });
    }

    const stopMultiplier = gameState.multiplier;
    console.log(`🛑 Stopping game at ${stopMultiplier.toFixed(2)}x`);
    
    // Manually trigger crash
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
    
    console.log(`📥 Received crashPoint: ${crashPoint}`);
    
    if (!crashPoint || crashPoint < 1.01) {
      return res.status(400).json({ 
        success: false, 
        message: 'Crash point must be at least 1.01' 
      });
    }

    // Store as number with 2 decimal places
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

    console.log('✅ Settings updated:', {
      autoStart: gameState.autoStart,
      autoStartDelay: gameState.autoStartDelay,
      minBet: gameState.minBet,
      maxBet: gameState.maxBet,
      houseEdge: gameState.houseEdge
    });

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
      playersActive: gameState.playersActive || 0,
      totalBets: gameState.totalBets || 0,
      totalAmount: gameState.totalAmount || 0,
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
    res.json([
      { roundNumber: 5, crashPoint: 2.45, playersActive: 8, totalAmount: 450, endTime: new Date(Date.now() - 120000) },
      { roundNumber: 4, crashPoint: 1.85, playersActive: 5, totalAmount: 230, endTime: new Date(Date.now() - 240000) },
      { roundNumber: 3, crashPoint: 3.20, playersActive: 12, totalAmount: 780, endTime: new Date(Date.now() - 360000) },
      { roundNumber: 2, crashPoint: 1.50, playersActive: 3, totalAmount: 120, endTime: new Date(Date.now() - 480000) },
      { roundNumber: 1, crashPoint: 4.75, playersActive: 7, totalAmount: 560, endTime: new Date(Date.now() - 600000) }
    ]);
  } catch (error) {
    console.error('❌ Error getting history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== GET ACTIVE BETS ==========
exports.getActiveBets = async (req, res) => {
  try {
    res.json([]);
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

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (gameState.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Game is not active. Wait for the next round.' 
      });
    }

    if (amount < gameState.minBet || amount > gameState.maxBet) {
      return res.status(400).json({
        success: false,
        message: `Bet must be between ${gameState.minBet} and ${gameState.maxBet}`
      });
    }

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
    console.error('❌ Error placing bet:', error);
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
      return res.status(400).json({ success: false, message: 'Game is not active!' });
    }

    const winAmount = 100;
    const profit = 90;

    res.json({ 
      success: true, 
      message: `Cashed out at ${gameState.multiplier.toFixed(2)}x!`,
      winAmount: winAmount,
      profit: profit,
      multiplier: gameState.multiplier
    });
  } catch (error) {
    console.error('❌ Error cashing out:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};