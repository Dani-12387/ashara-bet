const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    // ✅ Added 'CASHIER' for cashier-created withdrawals
    enum: ['TELE_BIRR', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CASHIER'],
    required: true
  },
  // ✅ Only required for regular users, not cashiers
  accountName: {
    type: String,
    required: function () { return this.paymentMethod !== 'CASHIER'; },
    default: ''
  },
  accountNumber: {
    type: String,
    required: function () { return this.paymentMethod !== 'CASHIER'; },
    default: ''
  },
  bankName: {
    type: String,
    default: ''
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
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
  // ✅ NEW: The cashier who created this request
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // ✅ NEW: Admin who approved/rejected
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

module.exports = mongoose.model('Withdrawal', withdrawalSchema);