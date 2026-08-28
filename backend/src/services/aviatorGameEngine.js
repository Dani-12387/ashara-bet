// backend/src/services/aviatorGameEngine.js

const crypto = require('crypto');
const AviatorRound = require('../models/AviatorRound');
const AviatorBet = require('../models/AviatorBet');
const GameTransaction = require('../models/GameTransaction');
const User = require('../models/User');

class AviatorGameEngine {
  constructor(io) {
    this.io = io;
    this.currentRound = null;
    this.multiplier = 1.00;
    this.intervalId = null;
    this.isRunning = false;
    this.nextCrashPoint = 0;
    this.autoStart = false;
    this.autoStartDelay = 10;
    this.minBet = 1;
    this.maxBet = 1000;
    this.houseEdge = 5;

    // In‑memory storage for active bets during a round
    this.activeBets = [];
    this.pendingBets = []; // bets placed during idle (for next round)
    this.history = []; // last 10 rounds

    // We do NOT start any timer here – admin must call startNewRound()
  }

  // ====================================================
  //  ADMIN CONTROLS
  // ====================================================

  async startNewRound() {
    if (this.isRunning) {
      throw new Error('Game is already running');
    }

    // Move pending bets to active
    for (const pending of this.pendingBets) {
      this.activeBets.push({ ...pending, status: 'active', activatedAt: new Date() });
    }
    this.pendingBets = [];

    // Create a new round
    const roundId = `AV-${Date.now().toString(36).toUpperCase()}`;
    const crashPoint = this.nextCrashPoint > 1.01
      ? this.nextCrashPoint
      : 2 + Math.random() * 98;

    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const nonce = this.history.length + 1;

    const round = new AviatorRound({
      roundId,
      status: 'RUNNING',
      crashMultiplier: crashPoint,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      startTime: new Date(),
    });
    await round.save();

    this.currentRound = round;
    this.multiplier = 1.00;
    this.isRunning = true;

    // Start the multiplier loop
    this.startGameLoop();

    // Broadcast to all clients
    this.broadcastState();

    return { roundId };
  }

  async crashRound() {
    if (!this.isRunning) {
      throw new Error('No running round to crash');
    }

    const crashMultiplier = this.multiplier;
    const crashRound = this.currentRound;

    // Stop the loop
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.currentRound.status = 'CRASHED';
    this.currentRound.crashMultiplier = crashMultiplier;
    this.currentRound.endTime = new Date();
    await this.currentRound.save();

    // Settle active bets
    for (const bet of this.activeBets) {
      if (bet.status === 'active') {
        bet.status = 'lost';
        bet.payout = 0;
        bet.profit = -bet.amount;
        // Create transaction for loss (already deducted)
        const user = await User.findById(bet.userId);
        if (user) {
          const tx = new GameTransaction({
            transactionId: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            userId: user._id,
            betId: bet.betId || `BET-${Date.now()}`,
            roundId: crashRound.roundId,
            type: 'BET',
            amount: -bet.amount,
            balanceBefore: user.balance + bet.amount,
            balanceAfter: user.balance,
            status: 'COMPLETED',
            metadata: { result: 'LOST' },
          });
          await tx.save();
        }
        // Update bet in DB if it has _id
        if (bet._id) {
          await AviatorBet.findByIdAndUpdate(bet._id, { status: 'lost', payout: 0 });
        }
      }
    }

    // Store crash in history
    const crashRecord = {
      roundNumber: this.currentRound.roundNumber || this.history.length + 1,
      crashPoint: crashMultiplier,
      playersActive: this.activeBets.length,
      totalAmount: this.activeBets.reduce((s, b) => s + b.amount, 0),
      endTime: new Date(),
    };
    this.history = [crashRecord, ...this.history].slice(0, 10);

    // Clear active bets
    this.activeBets = [];

    // Broadcast crash
    this.broadcastState();

    // Auto‑start next round if enabled (admin can toggle)
    if (this.autoStart) {
      setTimeout(() => {
        this.startNewRound().catch(console.error);
      }, this.autoStartDelay * 1000);
    }

    return { multiplier: crashMultiplier };
  }

  async closeGame() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;

    // Refund all active and pending bets
    const allBets = [...this.activeBets, ...this.pendingBets];
    for (const bet of allBets) {
      if (bet.status === 'active' || bet.status === 'pending') {
        const user = await User.findById(bet.userId);
        if (user) {
          user.balance += bet.amount;
          await user.save();
          // Create refund transaction
          const tx = new GameTransaction({
            transactionId: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            userId: user._id,
            betId: bet.betId || `BET-${Date.now()}`,
            roundId: this.currentRound?.roundId || 'CLOSED',
            type: 'REFUND',
            amount: bet.amount,
            balanceBefore: user.balance - bet.amount,
            balanceAfter: user.balance,
            status: 'COMPLETED',
          });
          await tx.save();
        }
      }
    }

    this.activeBets = [];
    this.pendingBets = [];
    this.currentRound = null;
    this.multiplier = 1.00;
    this.broadcastState();
  }

  setNextCrashPoint(point) {
    if (point < 1.01) throw new Error('Crash point must be >= 1.01');
    this.nextCrashPoint = point;
  }

  updateSettings(settings) {
    if (settings.autoStart !== undefined) this.autoStart = settings.autoStart;
    if (settings.autoStartDelay) this.autoStartDelay = settings.autoStartDelay;
    if (settings.minBet) this.minBet = settings.minBet;
    if (settings.maxBet) this.maxBet = settings.maxBet;
    if (settings.houseEdge) this.houseEdge = settings.houseEdge;
  }

  // ====================================================
  //  PLAYER ACTIONS
  // ====================================================

  async placeBet(userId, amount, autoCashOut = 0) {
    // Betting allowed only when game is idle (pending) or running (active)
    const isActive = this.isRunning;
    if (!isActive && this.currentRound && this.currentRound.status !== 'IDLE') {
      throw new Error('Betting not available');
    }

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    if (amount < this.minBet || amount > this.maxBet) {
      throw new Error(`Bet must be between ${this.minBet} and ${this.maxBet}`);
    }
    if (user.balance < amount) throw new Error('Insufficient balance');

    // Deduct immediately
    user.balance -= amount;
    await user.save();

    const bet = {
      userId,
      amount,
      autoCashOut,
      status: isActive ? 'active' : 'pending',
      gameRound: isActive ? this.currentRound.roundNumber : (this.currentRound ? this.currentRound.roundNumber + 1 : 1),
      placedAt: new Date(),
      betId: `BET-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };

    if (isActive) {
      this.activeBets.push(bet);
    } else {
      this.pendingBets.push(bet);
    }

    // Save bet to DB for persistence (if needed)
    const betDoc = new AviatorBet({
      betId: bet.betId,
      roundId: this.currentRound?.roundId || `AV-${Date.now()}`,
      userId,
      stake: amount,
      betSlot: 1, // default
      status: bet.status,
      placedAt: bet.placedAt,
    });
    await betDoc.save();

    // Create transaction
    const tx = new GameTransaction({
      transactionId: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: user._id,
      betId: bet.betId,
      roundId: this.currentRound?.roundId || 'PENDING',
      type: 'BET',
      amount: -amount,
      balanceBefore: user.balance + amount,
      balanceAfter: user.balance,
      status: 'COMPLETED',
    });
    await tx.save();

    this.broadcastState();
    return { bet, newBalance: user.balance };
  }

  async cashOut(userId) {
    const betIndex = this.activeBets.findIndex(b => b.userId === userId && b.status === 'active');
    if (betIndex === -1) throw new Error('No active bet found');
    const bet = this.activeBets[betIndex];
    const currentMultiplier = this.multiplier;

    const winAmount = bet.amount * currentMultiplier;
    const profit = winAmount - bet.amount;

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.balance += winAmount;
    await user.save();

    bet.status = 'cashed';
    bet.winAmount = winAmount;
    bet.cashedAt = currentMultiplier;

    // Update DB bet
    await AviatorBet.findOneAndUpdate(
      { betId: bet.betId },
      { status: 'CASHED_OUT', cashoutMultiplier: currentMultiplier, payout: winAmount }
    );

    const tx = new GameTransaction({
      transactionId: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: user._id,
      betId: bet.betId,
      roundId: this.currentRound?.roundId || '',
      type: 'WIN',
      amount: winAmount,
      balanceBefore: user.balance - winAmount,
      balanceAfter: user.balance,
      status: 'COMPLETED',
      metadata: { multiplier: currentMultiplier, profit },
    });
    await tx.save();

    this.activeBets.splice(betIndex, 1); // remove from active
    this.broadcastState();
    return { bet, multiplier: currentMultiplier, payout: winAmount, profit, newBalance: user.balance };
  }

  async cancelPendingBet(userId) {
    const index = this.pendingBets.findIndex(b => b.userId === userId && b.status === 'pending');
    if (index === -1) throw new Error('No pending bet found');
    const bet = this.pendingBets[index];
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.balance += bet.amount;
    await user.save();

    bet.status = 'cancelled';
    this.pendingBets.splice(index, 1);

    // Update DB
    await AviatorBet.findOneAndUpdate(
      { betId: bet.betId },
      { status: 'REFUNDED' }
    );

    const tx = new GameTransaction({
      transactionId: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: user._id,
      betId: bet.betId,
      roundId: 'CANCELLED',
      type: 'REFUND',
      amount: bet.amount,
      balanceBefore: user.balance - bet.amount,
      balanceAfter: user.balance,
      status: 'COMPLETED',
    });
    await tx.save();

    this.broadcastState();
    return { newBalance: user.balance };
  }

  // ====================================================
  //  DATA RETRIEVAL
  // ====================================================

  getCurrentState() {
    return {
      status: this.currentRound ? this.currentRound.status : 'IDLE',
      roundId: this.currentRound?.roundId || null,
      multiplier: this.multiplier,
      crashMultiplier: this.currentRound?.crashMultiplier || 0,
      roundNumber: this.currentRound?.roundNumber || 0,
      playersActive: this.activeBets.filter(b => b.status === 'active').length,
      totalBets: this.activeBets.filter(b => b.status === 'active').length,
      totalAmount: this.activeBets.reduce((s, b) => s + b.amount, 0),
      pendingBets: this.pendingBets.length,
    };
  }

  getCurrentRoundState() {
    return this.getCurrentState();
  }

  async getHistory(limit = 20) {
    return this.history.slice(0, limit);
  }

  getActiveBets() {
    return this.activeBets.filter(b => b.status === 'active');
  }

  async getMyBets(userId, limit = 20, offset = 0) {
    // Combine pending and active bets for this user
    const userBets = [
      ...this.pendingBets.filter(b => b.userId === userId),
      ...this.activeBets.filter(b => b.userId === userId),
    ];
    // You could also fetch from DB for historical bets
    const total = userBets.length;
    const bets = userBets.slice(offset, offset + limit);
    return { bets, total };
  }

  async getLivePlayers() {
    const players = [];
    for (const bet of this.activeBets) {
      if (bet.status === 'active') {
        const user = await User.findById(bet.userId);
        players.push({
          displayName: user ? `${user.username.slice(0, 6)}***` : 'User***',
          stake: bet.amount,
          multiplier: this.multiplier,
          status: 'ACTIVE',
        });
      }
    }
    return players;
  }

  async verifyRound(roundId) {
    const round = this.history.find(r => r.roundNumber === parseInt(roundId.replace('AV-', '')));
    if (!round) return null;
    return {
      roundId,
      verified: true,
      crashPoint: round.crashPoint,
      message: 'Round verified',
    };
  }

  // ====================================================
  //  GAME LOOP (internal)
  // ====================================================

  startGameLoop() {
    if (this.intervalId) clearInterval(this.intervalId);
    const startTime = Date.now();
    this.intervalId = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const increment = 0.01 + elapsed * 0.001;
      this.multiplier += increment;
      this.multiplier = Math.round(this.multiplier * 100) / 100;

      // Check auto cash out
      this.checkAutoCashOut();

      // Check crash condition
      if (this.multiplier >= this.currentRound.crashMultiplier) {
        this.crashRound().catch(console.error);
      }

      this.broadcastMultiplier();
    }, 100);
  }

  checkAutoCashOut() {
    for (const bet of this.activeBets) {
      if (bet.status === 'active' && bet.autoCashOut > 0) {
        if (this.multiplier >= bet.autoCashOut) {
          this.cashOut(bet.userId).catch(console.error);
        }
      }
    }
  }

  // ====================================================
  //  BROADCAST
  // ====================================================

  broadcastState() {
    if (this.io) {
      this.io.emit('round:state', this.getCurrentState());
    }
  }

  broadcastMultiplier() {
    if (this.io) {
      this.io.emit('round:multiplier', {
        roundId: this.currentRound?.roundId || null,
        multiplier: this.multiplier,
        serverTime: Date.now(),
      });
    }
  }
}

module.exports = AviatorGameEngine;