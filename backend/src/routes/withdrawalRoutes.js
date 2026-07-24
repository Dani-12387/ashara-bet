const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');

// Create withdrawal request
router.post('/create', protect, async (req, res) => {
  try {
    const { amount, paymentMethod, accountName, accountNumber, bankName, phoneNumber, notes } = req.body;
    
    // Get user with wallet
    const user = await User.findById(req.user.id);
    
    // Validation
    if (!amount || amount < 50) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is ETB 50' });
    }

    if (amount > user.wallet.balance) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    if (!accountName || !accountNumber) {
      return res.status(400).json({ message: 'Account name and number are required' });
    }

    if (paymentMethod === 'BANK_TRANSFER' && !bankName) {
      return res.status(400).json({ message: 'Bank name is required' });
    }

    if (paymentMethod === 'TELE_BIRR' && !phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Create withdrawal
    const withdrawal = await Withdrawal.create({
      user: req.user.id,
      amount: parseFloat(amount),
      paymentMethod,
      accountName,
      accountNumber,
      bankName,
      phoneNumber,
      notes,
      status: 'pending'
    });

    // Lock the amount in user's wallet (prevent double withdrawal)
    user.wallet.lockedBalance = (user.wallet.lockedBalance || 0) + parseFloat(amount);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawal
    });
  } catch (error) {
    console.error('Error creating withdrawal:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user's recent withdrawals
router.get('/recent', protect, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      user: req.user.id
    }).sort('-createdAt').limit(10);
    
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;