const AviatorGameEngine = require('../services/aviatorGameEngine');
const User = require('../models/User');

let gameEngine = null;

function initializeAviatorSocket(io) {
  console.log('🔄 Initializing Aviator Socket...');

  // Create game engine
  gameEngine = new AviatorGameEngine(io);
  gameEngine.start();

  // Socket connection handler
  io.on('connection', (socket) => {
    console.log(`📡 Aviator client connected: ${socket.id}`);

    // Authenticate socket
    const token = socket.handshake.auth.token;
    let userId = null;

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
      userId = decoded.id;
      socket.userId = userId;
      
      console.log(`✅ Aviator socket authenticated for user: ${userId}`);
    } catch (error) {
      console.log('🔑 Unauthenticated socket connection');
      socket.emit('system:error', { 
        code: 'UNAUTHORIZED', 
        message: 'Please authenticate' 
      });
      
      // Still allow connection but limit functionality
      socket.emit('round:state', {
        status: 'WAITING',
        message: 'Please login to play'
      });
    }

    // Join room for user
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Send current round state
    socket.emit('round:state', {
      roundId: gameEngine.currentRound?.roundId || null,
      status: gameEngine.currentRound?.status || 'WAITING',
      multiplier: gameEngine.multiplier || 1.00,
      crashMultiplier: gameEngine.currentRound?.crashMultiplier || 0,
      serverTime: Date.now()
    });

    // Send current countdown if active
    // (This would need to be tracked separately)

    // Handle bet request
    socket.on('bet:request', async (data) => {
      try {
        if (!userId) {
          socket.emit('bet:rejected', {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Please login to bet' }
          });
          return;
        }

        const { roundId, stake, betSlot, idempotencyKey } = data;

        // Validate
        if (!roundId || !stake || stake <= 0) {
          socket.emit('bet:rejected', {
            success: false,
            error: { code: 'INVALID_REQUEST', message: 'Invalid bet request' }
          });
          return;
        }

        const result = await gameEngine.placeBet(userId, roundId, stake, betSlot || 1);

        socket.emit('bet:accepted', {
          success: true,
          bet: result.bet,
          balance: result.newBalance
        });

        // Broadcast to all clients
        io.emit('bet:placed', {
          roundId: roundId,
          stake: stake,
          betSlot: betSlot || 1
        });

      } catch (error) {
        console.error('❌ Bet error:', error);
        socket.emit('bet:rejected', {
          success: false,
          error: { 
            code: error.message.toUpperCase().replace(/ /g, '_'),
            message: error.message 
          }
        });
      }
    });

    // Handle cashout request
    socket.on('cashout:request', async (data) => {
      try {
        if (!userId) {
          socket.emit('system:error', {
            code: 'UNAUTHORIZED',
            message: 'Please login to cash out'
          });
          return;
        }

        const { betId, idempotencyKey } = data;

        if (!betId) {
          socket.emit('system:error', {
            code: 'INVALID_REQUEST',
            message: 'Missing bet ID'
          });
          return;
        }

        const result = await gameEngine.cashOut(userId, betId);

        socket.emit('cashout:success', {
          success: true,
          betId: result.bet.betId,
          multiplier: result.multiplier,
          stake: result.bet.stake,
          payout: result.payout,
          profit: result.profit,
          balance: result.newBalance
        });

      } catch (error) {
        console.error('❌ Cashout error:', error);
        socket.emit('system:error', {
          code: error.message.toUpperCase().replace(/ /g, '_'),
          message: error.message
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`📡 Aviator client disconnected: ${socket.id}`);
    });
  });

  return gameEngine;
}

module.exports = { initializeAviatorSocket, getGameEngine: () => gameEngine };