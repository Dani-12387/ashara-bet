const mongoose = require('mongoose');

const gameTransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  betId: {
    type: String,
    index: true
  },
  roundId: {
    type: String,
    index: true
  },
  type: {
    type: String,
    enum: ['BET', 'WIN', 'REFUND', 'CANCELLED'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'COMPLETED'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Generate transaction ID: TX-XXXXX
gameTransactionSchema.statics.generateTransactionId = function() {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `TX-${random}`;
};

module.exports = mongoose.model('GameTransaction', gameTransactionSchema);