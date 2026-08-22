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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AviatorGame', AviatorGameSchema);