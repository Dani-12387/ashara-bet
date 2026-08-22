const mongoose = require('mongoose');

const AviatorBetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AviatorGame',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  autoCashOut: {
    type: Number,
    default: 0
  },
  cashOutMultiplier: {
    type: Number,
    default: 0
  },
  winAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'cashed', 'lost', 'cancelled'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AviatorBet', AviatorBetSchema);