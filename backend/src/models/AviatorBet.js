const mongoose = require('mongoose');

const aviatorBetSchema = new mongoose.Schema({
  betId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  roundId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  betSlot: {
    type: Number,
    enum: [1, 2],
    required: true
  },
  stake: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'CASHED_OUT', 'LOST', 'REFUNDED'],
    default: 'ACTIVE'
  },
  cashoutMultiplier: {
    type: Number,
    default: 0
  },
  payout: {
    type: Number,
    default: 0
  },
  profit: {
    type: Number,
    default: 0
  },
  cashoutTime: {
    type: Date
  },
  placedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate bet ID: BET-XXXXX
aviatorBetSchema.statics.generateBetId = function() {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `BET-${random}`;
};

module.exports = mongoose.model('AviatorBet', aviatorBetSchema);