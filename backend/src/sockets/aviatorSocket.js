const AviatorGameEngine = require('../services/aviatorGameEngine');

let gameEngine = null;

function initializeAviatorSocket(io) {
  console.log('🔄 Initializing Aviator Socket...');
  // ✅ Create engine but DO NOT start it automatically
  gameEngine = new AviatorGameEngine(io);
  // ❌ REMOVE: gameEngine.start();

  io.on('connection', (socket) => {
    console.log(`📡 Aviator client connected: ${socket.id}`);
    if (gameEngine) {
      socket.emit('round:state', gameEngine.getCurrentState());
    }
    socket.on('disconnect', () => {
      console.log(`📡 Aviator client disconnected: ${socket.id}`);
    });
  });

  return gameEngine;
}

function getGameEngine() {
  return gameEngine;
}

module.exports = { initializeAviatorSocket, getGameEngine };