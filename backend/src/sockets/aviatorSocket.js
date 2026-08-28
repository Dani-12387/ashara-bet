// backend/src/sockets/aviatorSocket.js

const AviatorGameEngine = require('../services/aviatorGameEngine');

let gameEngine = null;

function initializeAviatorSocket(io) {
  console.log('🔄 Initializing Aviator Socket...');

  // Create game engine
  gameEngine = new AviatorGameEngine(io);
  gameEngine.start();

  // Socket connection handler
  io.on('connection', (socket) => {
    console.log(`📡 Aviator client connected: ${socket.id}`);
    // ... rest of socket code
  });

  return gameEngine;
}

// ✅ Make sure this is exported
function getGameEngine() {
  return gameEngine;
}

module.exports = { initializeAviatorSocket, getGameEngine };