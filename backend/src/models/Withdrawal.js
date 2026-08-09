const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['TELE_BIRR', 'BANK_TRANSFER', 'MOBILE_MONEY'],
    required: true
  },
  accountName: {
    type: String,
    required: true
  },
  accountNumber: {
    type: String,
    required: true
  },
  bankName: {
    type: String
  },
  phoneNumber: {
    type: String
  },
  notes: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  rejectionReason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);