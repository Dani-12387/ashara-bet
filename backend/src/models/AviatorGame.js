const mongoose = require('mongoose');

const AviatorGameSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['idle', 'waiting', 'active', 'crashed', 'closed'],
    default: 'idle'
  },
  roundNumber: {
    type: Number,
    default: 0
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  multiplier: {
    type: Number,
    default: 1.00
  },
  crashPoint: {
    type: Number,
    default: 0
  },
  totalBets: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  playersActive: {
    type: Number,
    default: 0
  },
  settings: {
    autoStart: { type: Boolean, default: false },
    autoStartDelay: { type: Number, default: 10 },
    minBet: { type: Number, default: 1 },
    maxBet: { type: Number, default: 1000 },
    houseEdge: { type: Number, default: 5 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AviatorGame', AviatorGameSchema);