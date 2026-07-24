// backend/models/Bet.js
const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ticketId: {
    type: String,
    required: true,
    unique: true,
    default: () => Math.floor(1000000000 + Math.random() * 9000000000).toString()
  },
  selections: [{
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true
    },
    match: String,
    league: String,
    betType: String,
    market: String,
    odds: Number,
    status: {
      type: String,
      enum: ['pending', 'won', 'lost'],
      default: 'pending'
    }
  }],
  totalStake: {
    type: Number,
    required: true,
    min: 0
  },
  totalOdds: {
    type: Number,
    required: true,
    min: 1
  },
  potentialWin: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'won', 'lost', 'cancelled'],
    default: 'pending'
  },
  result: {
    type: String,
    enum: ['pending', 'won', 'lost', 'cancelled'],
    default: 'pending'
  },
  settledAt: {
    type: Date
  },
  settledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes
betSchema.index({ user: 1, createdAt: -1 });
betSchema.index({ status: 1 });
betSchema.index({ createdAt: -1 });
betSchema.index({ ticketId: 1 });

module.exports = mongoose.model('Bet', betSchema);