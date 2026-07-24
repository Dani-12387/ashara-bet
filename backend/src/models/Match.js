const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  sport: {
    type: String,
    enum: ['FOOTBALL', 'BASKETBALL', 'TENNIS', 'CRICKET'],
    required: true,
    default: 'FOOTBALL'
  },
  league: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    required: true,
    trim: true
  },
  homeTeam: {
    type: String,
    required: true,
    trim: true
  },
  awayTeam: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['UPCOMING', 'LIVE', 'FINISHED', 'CANCELLED'],
    default: 'UPCOMING'
  },
  odds: {
    home: { type: Number, required: true, min: 1.01, default: 1.00 },
    draw: { type: Number, required: true, min: 1.01, default: 1.00 },
    away: { type: Number, required: true, min: 1.01, default: 1.00 }
  },
  score: {
    home: { type: Number, default: 0 },
    away: { type: Number, default: 0 }
  },
  // ===== ADD THIS: Markets field for all 20 betting markets =====
  markets: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add index for better query performance
matchSchema.index({ date: 1, sport: 1, status: 1 });
matchSchema.index({ league: 1, country: 1 });

module.exports = mongoose.model('Match', matchSchema);