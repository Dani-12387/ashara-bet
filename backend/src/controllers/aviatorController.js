// ============================================
// AVIATOR GAME CONTROLLER - ADMIN CONTROLLED
// ============================================

const User = require('../models/User');

console.log('🔄 Loading aviator controller...');

// ========== GAME STATE ==========
// ✅ autoStart is FALSE by default - Admin must manually start
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
  autoStart: false,        // ✅ MUST be false - Admin controlled only
  autoStartDelay: 10,
  minBet: 1,
  maxBet: 1000,
  houseEdge: 5
};

// ========== GAME HISTORY ==========
let gameHistory = [];

// ========== ACTIVE BETS ==========
let activeBets = [];

// ========== PENDING BETS ==========
let pendingBets = [];

// ========== BROADCAST FUNCTION ==========
function broadcastGameState() {
  console.log(`📊 Round ${gameState.roundNumber}: ${gameState.multiplier.toFixed(2)}x | Status: ${gameState.status}`);
  console.log(`📊 Active bets: ${activeBets.length}, Pending bets: ${pendingBets.length}`);
}

// ========== START GAME (Admin Only) ==========
exports.startGame = async (req, res) => {
  try {
    console.log('🚀 Admin: Start game called');
    console.log(`📊 Pending bets before start: ${pendingBets.length}`);
    
    if (gameState.status === 'active') {
      return res.status(400).json({ success: false, message: 'Game is already active' });
    }

    // ✅ Move all pending bets to active bets
    for (const pendingBet of pendingBets) {
      const user = await User.findById(pendingBet.userId);
      if (user) {
        activeBets.push({
          ...pendingBet,
          status: 'active',
          activatedAt: new Date().toISOString()
        });
        console.log(`✅ Pending bet activated for user ${user.username || pendingBet.userId}`);
      }
    }
    
    // Clear pending bets
    pendingBets = [];

    gameState.status = 'active';
    gameState.multiplier = 1.00;
    gameState.roundNumber += 1;
    gameState.startTime = Date.now();
    gameState.totalBets = activeBets.length;
    gameState.totalAmount = activeBets.reduce((sum, b) => sum + b.amount, 0);

    // Use nextCrashPoint if set by admin, otherwise generate random
    if (gameState.nextCrashPoint > 1.01) {
      gameState.crashPoint = gameState.nextCrashPoint;
      gameState.nextCrashPoint = 0;
      console.log(`🎯 Using admin-set crash point: ${gameState.crashPoint.toFixed(2)}x`);
    } else {
      gameState.crashPoint = 2 + Math.random() * 98;
      console.log(`🎯 Random crash point: ${gameState.crashPoint.toFixed(2)}x`);
    }

    console.log(`🔄 Round ${gameState.roundNumber} started with ${activeBets.length} active bets!`);

    startGameLoop();
    broadcastGameState();

    res.json({ 
      success: true, 
      message: `Round ${gameState.roundNumber} started! ${activeBets.length} bets active.`,
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

    // Check auto cash out
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
        processCashOut(bet);
      }
    }
  }
}

// ========== PROCESS CASH OUT ==========
async function processCashOut(bet) {
  try {
    const user = await User.findById(bet.userId);
    if (!user) return;

    const winAmount = bet.amount * gameState.multiplier;
    const profit = winAmount - bet.amount;
    
    user.balance += winAmount;
    await user.save();
    
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
  
  // Process all active bets as lost
  for (const bet of activeBets) {
    if (bet.status === 'active') {
      bet.status = 'lost';
      console.log(`❌ Bet lost for user ${bet.userId}`);
    }
  }
  
  // Store crash in history
  const crashRecord = {
    roundNumber: crashRound,
    crashPoint: crashMultiplier,
    crashed: true,
    playersActive: activeBets.filter(b => b.status === 'active').length,
    totalAmount: activeBets.reduce((sum, b) => sum + (b.status === 'active' ? b.amount : 0), 0),
    endTime: new Date().toISOString()
  };
  
  gameHistory = [crashRecord, ...gameHistory].slice(0, 7);
  console.log(`📜 History updated: ${gameHistory.length} records`);
  
  // Clear active bets
  activeBets = [];
  
  broadcastGameState();

  // ✅ Reset to idle WITHOUT auto-start - Admin must click Start
  setTimeout(() => {
    console.log('🔄 Resetting game state to idle...');
    console.log(`📊 Pending bets for next round: ${pendingBets.length}`);
    
    // ✅ Always go to idle, never auto-start
    gameState.status = 'idle';
    gameState.multiplier = 1.00;
    broadcastGameState();
    
    console.log('⏸️ Game is idle. Admin must start the next round.');
  }, 3000);
}

// ========== STOP GAME (Admin) ==========
exports.stopGame = async (req, res) => {
  try {
    console.log('🛑 Admin: Stop game called');
    
    if (gameState.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: `Game is not active. Current status: ${gameState.status}` 
      });
    }

    const stopMultiplier = gameState.multiplier;
    console.log(`🛑 Admin stopping game at ${stopMultiplier.toFixed(2)}x`);
    
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

// ========== CLOSE GAME (Admin) ==========
exports.closeGame = async (req, res) => {
  try {
    console.log('🔒 Admin: Close game called');
    
    if (gameState.gameInterval) {
      clearInterval(gameState.gameInterval);
      gameState.gameInterval = null;
    }

    // ✅ Refund all pending bets
    for (const bet of pendingBets) {
      if (bet.status === 'pending') {
        const user = await User.findById(bet.userId);
        if (user) {
          user.balance += bet.amount;
          await user.save();
          console.log(`💰 Refunded pending bet ${bet.amount} to user ${user.username}`);
        }
        bet.status = 'refunded';
      }
    }
    
    // Refund all active bets
    for (const bet of activeBets) {
      if (bet.status === 'active') {
        const user = await User.findById(bet.userId);
        if (user) {
          user.balance += bet.amount;
          await user.save();
          console.log(`💰 Refunded active bet ${bet.amount} to user ${user.username}`);
        }
        bet.status = 'refunded';
      }
    }
    
    pendingBets = [];
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

// ========== SET NEXT CRASH POINT (Admin) ==========
exports.setCrashPoint = async (req, res) => {
  try {
    console.log('🎯 Admin: Set crash point called');
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

// ========== UPDATE SETTINGS (Admin) ==========
exports.updateSettings = async (req, res) => {
  try {
    console.log('⚙️ Admin: Update settings called');
    const { autoStart, autoStartDelay, minBet, maxBet, houseEdge } = req.body;

    if (autoStart !== undefined) {
      gameState.autoStart = autoStart;
      console.log(`🔄 Auto-start ${autoStart ? 'ENABLED' : 'DISABLED'} (Admin controlled)`);
    }
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
      pendingBets: pendingBets.filter(b => b.status === 'pending').length || 0,
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

// ========== CANCEL PENDING BET ==========
exports.cancelPendingBet = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`🔴 Cancel pending bet called - User: ${userId}`);

    // Find pending bet for this user
    const betIndex = pendingBets.findIndex(b => b.userId === userId && b.status === 'pending');
    
    if (betIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'No pending bet found' 
      });
    }

    const bet = pendingBets[betIndex];
    const betAmount = bet.amount;
    
    // ✅ REFUND THE BET AMOUNT
    const user = await User.findById(userId);
    if (user) {
      user.balance += betAmount;
      await user.save();
      console.log(`💰 Refunded pending bet ${betAmount} to user ${user.username}`);
    }
    
    // Remove bet from pending
    pendingBets.splice(betIndex, 1);
    
    const updatedUser = await User.findById(userId);
    
    res.json({ 
      success: true, 
      message: 'Bet cancelled and refunded!',
      newBalance: updatedUser ? updatedUser.balance : 0,
      refundAmount: betAmount
    });
  } catch (error) {
    console.error('❌ Error cancelling pending bet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== PLACE BET ==========
exports.placeBet = async (req, res) => {
  try {
    console.log('📥 Place bet request received');
    console.log('📥 Request body:', req.body);
    
    const { amount, autoCashOut } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid bet amount' 
      });
    }

    // ✅ Allow betting when game is idle (for pending bets)
    if (gameState.status !== 'idle') {
      return res.status(400).json({ 
        success: false, 
        message: 'Game is not available. Please wait for the next round.' 
      });
    }

    // Check bet limits
    if (amount < gameState.minBet || amount > gameState.maxBet) {
      return res.status(400).json({
        success: false,
        message: `Bet must be between ${gameState.minBet} and ${gameState.maxBet}`
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    console.log(`💰 User balance before bet: ${user.balance}`);

    if (user.balance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient balance! Balance: ${user.balance.toFixed(2)}` 
      });
    }

    // ✅ DEDUCT BALANCE IMMEDIATELY
    user.balance -= amount;
    await user.save();

    console.log(`💰 User balance after bet: ${user.balance}`);

    // ✅ Always add to pending bets (game must be idle)
    const bet = {
      userId: userId,
      amount: amount,
      autoCashOut: autoCashOut || 0,
      gameRound: gameState.roundNumber + 1, // Next round
      status: 'pending',
      placedAt: new Date().toISOString()
    };
    
    pendingBets.push(bet);
    console.log(`⏳ Pending bet placed: ${amount} by user ${user.username || userId}`);
    console.log(`📊 Total pending bets: ${pendingBets.length}`);

    // ✅ Get updated user balance
    const updatedUser = await User.findById(userId);
    
    res.json({ 
      success: true, 
      message: 'Bet placed! Waiting for next round...',
      status: 'pending',
      newBalance: updatedUser ? updatedUser.balance : 0,
      bet: {
        amount: amount,
        autoCashOut: autoCashOut || 0,
        gameRound: gameState.roundNumber + 1,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('❌ Error placing bet:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    });
  }
};

// ========== CASH OUT ==========
exports.cashOut = async (req, res) => {
  try {
    const userId = req.user.id;

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

    // Find user's active bet
    const betIndex = activeBets.findIndex(b => b.userId === userId && b.status === 'active');
    
    if (betIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active bet found' 
      });
    }

    const bet = activeBets[betIndex];
    const currentMultiplier = gameState.multiplier;
    
    const winAmount = bet.amount * currentMultiplier;
    const profit = winAmount - bet.amount;

    console.log(`💰 Cash out: ${bet.amount} * ${currentMultiplier} = ${winAmount} (Profit: ${profit})`);

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ✅ ADD WINNINGS TO BALANCE
    user.balance += winAmount;
    await user.save();

    console.log(`💰 User balance after cash out: ${user.balance}`);

    bet.status = 'cashed';
    bet.winAmount = winAmount;
    bet.cashedAt = currentMultiplier;

    // Remove bet from active bets (it's done)
    activeBets.splice(betIndex, 1);

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

console.log('✅ Aviator controller loaded successfully');
console.log('⏸️ Admin-controlled mode: Game starts only when admin clicks Start Round');