const mongoose = require('mongoose');

const aviatorRoundSchema = new mongoose.Schema({
  roundId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['WAITING', 'BETTING_OPEN', 'BETTING_CLOSED', 'RUNNING', 'CRASHED', 'SETTLEMENT'],
    default: 'WAITING'
  },
  crashMultiplier: {
    type: Number,
    default: 0
  },
  serverSeed: {
    type: String,
    required: true
  },
  serverSeedHash: {
    type: String,
    required: true,
    index: true
  },
  clientSeed: {
    type: String,
    required: true
  },
  nonce: {
    type: Number,
    required: true
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  crashTime: {
    type: Date
  },
  totalBets: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  totalPayouts: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate round ID: AV-XXXXX
aviatorRoundSchema.statics.generateRoundId = function() {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `AV-${random}`;
};

// Generate server seed hash
aviatorRoundSchema.statics.generateServerSeed = function() {
  const crypto = require('crypto');
  const seed = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return { seed, hash };
};

// Generate client seed
aviatorRoundSchema.statics.generateClientSeed = function() {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex');
};

module.exports = mongoose.model('AviatorRound', aviatorRoundSchema);