const crypto = require('crypto');
const AviatorRound = require('../models/AviatorRound');
const AviatorBet = require('../models/AviatorBet');
const GameTransaction = require('../models/GameTransaction');
const User = require('../models/User');
const mongoose = require('mongoose');

class AviatorGameEngine {
  constructor(io) {
    this.io = io;
    this.currentRound = null;
    this.roundTimers = {};
    this.isRunning = false;
    this.multiplier = 1.00;
    this.intervalId = null;
    this.startTime = null;
  }

  // ========== START ENGINE ==========
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🚀 Aviator Game Engine started');
    await this.startNewRound();
  }

  // ========== START NEW ROUND ==========
  async startNewRound() {
    try {
      // Generate round data
      const roundId = await AviatorRound.generateRoundId();
      const { seed, hash } = await AviatorRound.generateServerSeed();
      const clientSeed = await AviatorRound.generateClientSeed();
      const nonce = await this.getNextNonce();

      // Create round
      const round = new AviatorRound({
        roundId,
        status: 'WAITING',
        serverSeed: seed,
        serverSeedHash: hash,
        clientSeed,
        nonce,
        startTime: new Date()
      });

      await round.save();
      this.currentRound = round;
      this.multiplier = 1.00;

      console.log(`🔄 New round created: ${roundId}`);

      // Broadcast round created
      this.broadcastRoundState();

      // Start countdown
      await this.startCountdown(round);

    } catch (error) {
      console.error('❌ Error starting new round:', error);
      setTimeout(() => this.startNewRound(), 5000);
    }
  }

  // ========== GET NEXT NONCE ==========
  async getNextNonce() {
    const lastRound = await AviatorRound.findOne().sort({ nonce: -1 });
    return lastRound ? lastRound.nonce + 1 : 1;
  }

  // ========== COUNTDOWN ==========
  async startCountdown(round) {
    const countdownSeconds = 5;
    let count = countdownSeconds;

    this.broadcastCountdown(count);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.broadcastCountdown(count);
      } else {
        clearInterval(interval);
        this.openBetting(round);
      }
    }, 1000);
  }

  broadcastCountdown(count) {
    if (this.io) {
      this.io.emit('round:countdown', {
        roundId: this.currentRound?.roundId,
        countdown: count
      });
    }
  }

  // ========== OPEN BETTING ==========
  async openBetting(round) {
    try {
      round.status = 'BETTING_OPEN';
      await round.save();

      console.log(`📊 Betting open for round: ${round.roundId}`);
      this.broadcastRoundState();

      // Close betting after 10 seconds
      setTimeout(() => {
        this.closeBetting(round);
      }, 10000);

    } catch (error) {
      console.error('❌ Error opening betting:', error);
    }
  }

  // ========== CLOSE BETTING ==========
  async closeBetting(round) {
    try {
      if (round.status !== 'BETTING_OPEN') return;

      round.status = 'BETTING_CLOSED';
      await round.save();

      console.log(`🔒 Betting closed for round: ${round.roundId}`);
      this.broadcastRoundState();

      // Start the round
      await this.startRound(round);

    } catch (error) {
      console.error('❌ Error closing betting:', error);
    }
  }

  // ========== START ROUND ==========
  async startRound(round) {
    try {
      round.status = 'RUNNING';
      round.startTime = new Date();
      await round.save();

      console.log(`🚀 Round started: ${round.roundId}`);
      this.broadcastRoundState();

      // Calculate crash point
      const crashMultiplier = this.calculateCrashPoint(round);
      round.crashMultiplier = crashMultiplier;
      await round.save();

      console.log(`🎯 Crash point: ${crashMultiplier.toFixed(2)}x`);

      // Start multiplier
      this.startMultiplier(round, crashMultiplier);

    } catch (error) {
      console.error('❌ Error starting round:', error);
    }
  }

  // ========== CALCULATE CRASH POINT ==========
  calculateCrashPoint(round) {
    // Provably fair calculation using server seed, client seed, and nonce
    const { serverSeed, clientSeed, nonce } = round;
    
    // Combine seeds and nonce
    const combined = `${serverSeed}:${clientSeed}:${nonce}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    
    // Convert first 8 hex chars to number
    const hex = hash.substring(0, 8);
    const decimal = parseInt(hex, 16);
    
    // Calculate crash point using algorithm
    // Formula: 1 / (1 - decimal / 2^32) with house edge
    const houseEdge = 0.05; // 5%
    const max = 100;
    const min = 1.01;
    
    // Using inverse CDF for uniform distribution
    const random = decimal / 0xFFFFFFFF;
    let crashPoint = (1 / (1 - random)) * (1 - houseEdge);
    
    // Clamp values
    crashPoint = Math.min(Math.max(crashPoint, min), max);
    
    return Math.round(crashPoint * 100) / 100;
  }

  // ========== START MULTIPLIER ==========
  startMultiplier(round, crashMultiplier) {
    this.startTime = Date.now();
    this.multiplier = 1.00;

    this.intervalId = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      
      // Exponential growth
      const increment = 0.01 + (elapsed * 0.001);
      this.multiplier = Math.round((this.multiplier + increment) * 100) / 100;

      // Check if crashed
      if (this.multiplier >= crashMultiplier) {
        this.multiplier = crashMultiplier;
        this.crashRound(round);
        return;
      }

      // Broadcast multiplier
      this.broadcastMultiplier();

    }, 100);
  }

  // ========== CRASH ROUND ==========
  async crashRound(round) {
    if (round.status === 'CRASHED') return;

    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    try {
      round.status = 'CRASHED';
      round.crashMultiplier = this.multiplier;
      round.crashTime = new Date();
      round.endTime = new Date();
      await round.save();

      console.log(`💥 Round crashed at ${this.multiplier.toFixed(2)}x: ${round.roundId}`);

      // Settle bets
      await this.settleBets(round);

      // Broadcast crash
      this.broadcastRoundState();

      // Start next round after delay
      setTimeout(() => {
        this.startNewRound();
      }, 5000);

    } catch (error) {
      console.error('❌ Error crashing round:', error);
    }
  }

  // ========== SETTLE BETS ==========
  async settleBets(round) {
    try {
      const activeBets = await AviatorBet.find({
        roundId: round.roundId,
        status: 'ACTIVE'
      });

      console.log(`📊 Settling ${activeBets.length} active bets`);

      for (const bet of activeBets) {
        bet.status = 'LOST';
        bet.payout = 0;
        bet.profit = -bet.stake;
        await bet.save();

        // Create transaction for lost bet
        const user = await User.findById(bet.userId);
        if (user) {
          const transaction = new GameTransaction({
            transactionId: await GameTransaction.generateTransactionId(),
            userId: user._id,
            betId: bet.betId,
            roundId: round.roundId,
            type: 'BET',
            amount: -bet.stake,
            balanceBefore: user.balance + bet.stake,
            balanceAfter: user.balance,
            status: 'COMPLETED',
            metadata: { result: 'LOST' }
          });
          await transaction.save();
        }
      }

      // Update round totals
      round.totalBets = activeBets.length;
      round.totalAmount = activeBets.reduce((sum, b) => sum + b.stake, 0);
      await round.save();

    } catch (error) {
      console.error('❌ Error settling bets:', error);
    }
  }

  // ========== PLACE BET ==========
  async placeBet(userId, roundId, stake, betSlot) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate user
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate round
      const round = await AviatorRound.findOne({ roundId }).session(session);
      if (!round) {
        throw new Error('Round not found');
      }

      if (round.status !== 'BETTING_OPEN') {
        throw new Error('Betting is not open');
      }

      // Validate stake
      if (stake <= 0) {
        throw new Error('Invalid stake');
      }

      if (stake > user.balance) {
        throw new Error('Insufficient balance');
      }

      // Check minimum and maximum
      const minStake = 1;
      const maxStake = 10000;
      if (stake < minStake || stake > maxStake) {
        throw new Error(`Stake must be between ${minStake} and ${maxStake}`);
      }

      // Deduct balance
      const balanceBefore = user.balance;
      user.balance -= stake;
      await user.save({ session });

      // Create bet
      const bet = new AviatorBet({
        betId: await AviatorBet.generateBetId(),
        roundId: round.roundId,
        userId: user._id,
        betSlot: betSlot || 1,
        stake: stake,
        status: 'ACTIVE'
      });
      await bet.save({ session });

      // Create transaction
      const transaction = new GameTransaction({
        transactionId: await GameTransaction.generateTransactionId(),
        userId: user._id,
        betId: bet.betId,
        roundId: round.roundId,
        type: 'BET',
        amount: -stake,
        balanceBefore: balanceBefore,
        balanceAfter: user.balance,
        status: 'COMPLETED'
      });
      await transaction.save({ session });

      await session.commitTransaction();

      // Broadcast bet placed
      this.broadcastBetPlaced(user, bet);

      return {
        bet,
        newBalance: user.balance
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ========== CASH OUT ==========
  async cashOut(userId, betId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate user
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Find bet
      const bet = await AviatorBet.findOne({ betId }).session(session);
      if (!bet) {
        throw new Error('Bet not found');
      }

      if (bet.userId.toString() !== userId) {
        throw new Error('Bet does not belong to user');
      }

      if (bet.status !== 'ACTIVE') {
        throw new Error('Bet already settled');
      }

      // Validate round
      const round = await AviatorRound.findOne({ roundId: bet.roundId }).session(session);
      if (!round) {
        throw new Error('Round not found');
      }

      if (round.status !== 'RUNNING') {
        throw new Error('Round is not running');
      }

      // Calculate payout
      const multiplier = this.multiplier;
      const payout = bet.stake * multiplier;
      const profit = payout - bet.stake;

      // Update bet
      bet.status = 'CASHED_OUT';
      bet.cashoutMultiplier = multiplier;
      bet.payout = payout;
      bet.profit = profit;
      bet.cashoutTime = new Date();
      await bet.save({ session });

      // Credit wallet
      const balanceBefore = user.balance;
      user.balance += payout;
      await user.save({ session });

      // Create transaction
      const transaction = new GameTransaction({
        transactionId: await GameTransaction.generateTransactionId(),
        userId: user._id,
        betId: bet.betId,
        roundId: round.roundId,
        type: 'WIN',
        amount: payout,
        balanceBefore: balanceBefore,
        balanceAfter: user.balance,
        status: 'COMPLETED',
        metadata: {
          multiplier: multiplier,
          profit: profit
        }
      });
      await transaction.save({ session });

      await session.commitTransaction();

      // Broadcast cashout
      this.broadcastCashOut(user, bet);

      return {
        bet,
        multiplier,
        payout,
        profit,
        newBalance: user.balance
      };

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ========== BROADCAST METHODS ==========
  broadcastRoundState() {
    if (!this.io) return;

    const round = this.currentRound;
    if (!round) return;

    this.io.emit('round:state', {
      roundId: round.roundId,
      status: round.status,
      multiplier: this.multiplier,
      crashMultiplier: round.crashMultiplier || 0,
      serverTime: Date.now()
    });
  }

  broadcastMultiplier() {
    if (!this.io) return;

    this.io.emit('round:multiplier', {
      roundId: this.currentRound?.roundId,
      multiplier: this.multiplier,
      serverTime: Date.now()
    });
  }

  broadcastBetPlaced(user, bet) {
    if (!this.io) return;

    const displayName = user.username ? `${user.username.substring(0, 6)}***` : 'User***';

    this.io.emit('bet:placed', {
      roundId: bet.roundId,
      displayName: displayName,
      stake: bet.stake,
      betSlot: bet.betSlot
    });
  }

  broadcastCashOut(user, bet) {
    if (!this.io) return;

    const displayName = user.username ? `${user.username.substring(0, 6)}***` : 'User***';

    this.io.emit('bet:cashed_out', {
      roundId: bet.roundId,
      displayName: displayName,
      multiplier: bet.cashoutMultiplier,
      payout: bet.payout
    });
  }

  // ========== GET ROUND STATE ==========
  async getRoundState(roundId) {
    const round = await AviatorRound.findOne({ roundId });
    if (!round) return null;

    return {
      roundId: round.roundId,
      status: round.status,
      multiplier: round.status === 'RUNNING' ? this.multiplier : 1.00,
      crashMultiplier: round.crashMultiplier || 0,
      serverTime: Date.now()
    };
  }

  // ========== GET ACTIVE BETS ==========
  async getActiveBets(userId) {
    return await AviatorBet.find({
      userId: userId,
      status: 'ACTIVE'
    });
  }

  // ========== GET HISTORY ==========
  async getHistory(limit = 20) {
    return await AviatorRound.find({
      status: 'CRASHED'
    })
    .sort({ endTime: -1 })
    .limit(limit)
    .select('roundId crashMultiplier endTime');
  }

  // ========== GET MY BETS ==========
  async getMyBets(userId, limit = 20, offset = 0) {
    const bets = await AviatorBet.find({ userId })
      .sort({ placedAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('roundId', 'roundId');

    const total = await AviatorBet.countDocuments({ userId });

    return { bets, total };
  }

  // ========== GET LIVE PLAYERS ==========
  async getLivePlayers(roundId) {
    const bets = await AviatorBet.find({
      roundId: roundId,
      status: 'ACTIVE'
    }).populate('userId', 'username');

    return bets.map(bet => ({
      displayName: bet.userId?.username ? `${bet.userId.username.substring(0, 6)}***` : 'User***',
      stake: bet.stake,
      multiplier: this.multiplier,
      status: 'ACTIVE'
    }));
  }

  // ========== VERIFY ROUND ==========
  async verifyRound(roundId) {
    const round = await AviatorRound.findOne({ roundId });
    if (!round) return null;

    // Recalculate crash point
    const { serverSeed, clientSeed, nonce } = round;
    const combined = `${serverSeed}:${clientSeed}:${nonce}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    
    const hex = hash.substring(0, 8);
    const decimal = parseInt(hex, 16);
    const random = decimal / 0xFFFFFFFF;
    const houseEdge = 0.05;
    const min = 1.01;
    const max = 100;
    let crashPoint = (1 / (1 - random)) * (1 - houseEdge);
    crashPoint = Math.min(Math.max(crashPoint, min), max);
    crashPoint = Math.round(crashPoint * 100) / 100;

    return {
      roundId: round.roundId,
      serverSeed: round.serverSeed,
      serverSeedHash: round.serverSeedHash,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      calculatedCrash: crashPoint,
      actualCrash: round.crashMultiplier,
      verified: Math.abs(crashPoint - round.crashMultiplier) < 0.01
    };
  }

  // ========== STOP ENGINE ==========
  async stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Aviator Game Engine stopped');
  }
}

module.exports = AviatorGameEngine;