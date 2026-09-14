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
    enum: ['TELE_BIRR', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CBE_BIRR', 'CASHIER'],
    required: true
  },
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

  // ✅ Tracks whether created by 'user' or 'cashier' (NEVER changed by admin)
  source: {
    type: String,
    enum: ['user', 'cashier'],
    default: 'user'
  },

  // ✅ The CREATOR — cashier or user. NEVER overwritten by admin!
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  },

  // ✅ Admin who APPROVED
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },

  // ✅ Admin who REJECTED
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },

  // ✅ Admin who marked as PAID — NEW
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);