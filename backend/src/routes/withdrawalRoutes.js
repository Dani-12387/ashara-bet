const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');

// ✅ TEST ROUTE - This MUST work first
router.get('/test', auth, (req, res) => {
  console.log('✅ Test route hit!');
  res.json({ 
    success: true, 
    message: 'Withdrawal route is working!',
    user: req.user.id
  });
});

// ✅ Create withdrawal request
router.post('/create', auth, async (req, res) => {
  console.log('📥 Withdrawal request received');
  console.log('📦 Body:', req.body);
  console.log('👤 User:', req.user.id);

  try {
    const { amount, paymentMethod, accountName, accountNumber, bankName, phoneNumber, notes } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!amount || amount < 50) {
      return res.status(400).json({ 
        success: false, 
        message: 'Minimum withdrawal amount is ETB 50' 
      });
    }

    if (parseFloat(amount) > user.wallet.balance) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    if (!accountName || !accountNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account name and number are required' 
      });
    }

    if (paymentMethod === 'BANK_TRANSFER' && !bankName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bank name is required for bank transfer' 
      });
    }

    if (paymentMethod === 'TELE_BIRR' && !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number is required for Tele Birr' 
      });
    }

    const withdrawal = new Withdrawal({
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

    await withdrawal.save();

    console.log('✅ Withdrawal created:', withdrawal._id);

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawal
    });
  } catch (error) {
    console.error('❌ Error creating withdrawal:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ✅ Get user's recent withdrawals
router.get('/recent', auth, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(withdrawals);
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;