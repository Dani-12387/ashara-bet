const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    // ✅ Added 'CASHIER' for cashier-created deposits
    enum: ['BANK_TRANSFER', 'TELE_BIRR', 'MOBILE_MONEY', 'CASHIER'],
    required: true
  },
  transactionReference: {
    type: String,
    trim: true,
    default: ''
  },
  screenshot: {
    type: String,
    // ✅ Required ONLY for user deposits (not cashier deposits)
    required: function () {
      return this.type === 'deposit' && this.paymentMethod !== 'CASHIER';
    },
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  accountName: {
    type: String,
    default: ''
  },
  accountNumber: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  // ✅ NEW: Tracks whether this was created by a cashier or a user
  source: {
    type: String,
    enum: ['user', 'cashier'],
    default: 'user'
  },
  // ✅ NEW: The cashier who created this deposit
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);