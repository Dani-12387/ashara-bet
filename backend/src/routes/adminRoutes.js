const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { protect, authorize } = require('../middleware/authMiddleware');
const User = require('../models/User');

// Get all users
router.get('/users', protect, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort('-createdAt');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single user
router.get('/users/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new user
router.post('/users', protect, authorize('admin'), async (req, res) => {
  try {
    const { username, email, phone, password, role, status, profile } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      username,
      email,
      phone,
      password: hashedPassword,
      role: role || 'user',
      status: status || 'active',
      profile: profile || {},
      wallet: {
        balance: 0,
        bonusBalance: 0,
        lockedBalance: 0
      }
    });

    res.status(201).json({ 
      success: true, 
      message: 'User created successfully',
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.put('/users/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { username, email, phone, role, status, profile } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        username, 
        email,
        phone, 
        role, 
        status, 
        profile 
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'User updated successfully',
      user 
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete user
router.delete('/users/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update user status
router.put('/users/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: `User ${status} successfully`,
      user 
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update user balance - NEW ENDPOINT
router.post('/users/:id/balance', protect, authorize('admin'), async (req, res) => {
  try {
    const { balance, bonusBalance, lockedBalance, action } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize wallet if not exists
    if (!user.wallet) {
      user.wallet = { balance: 0, bonusBalance: 0, lockedBalance: 0 };
    }

    // Perform balance action
    switch(action) {
      case 'add':
        user.wallet.balance = (user.wallet.balance || 0) + (parseFloat(balance) || 0);
        user.wallet.bonusBalance = (user.wallet.bonusBalance || 0) + (parseFloat(bonusBalance) || 0);
        user.wallet.lockedBalance = (user.wallet.lockedBalance || 0) + (parseFloat(lockedBalance) || 0);
        break;
      case 'deduct':
        user.wallet.balance = Math.max(0, (user.wallet.balance || 0) - (parseFloat(balance) || 0));
        user.wallet.bonusBalance = Math.max(0, (user.wallet.bonusBalance || 0) - (parseFloat(bonusBalance) || 0));
        user.wallet.lockedBalance = Math.max(0, (user.wallet.lockedBalance || 0) - (parseFloat(lockedBalance) || 0));
        break;
      case 'set':
        user.wallet.balance = parseFloat(balance) || 0;
        user.wallet.bonusBalance = parseFloat(bonusBalance) || 0;
        user.wallet.lockedBalance = parseFloat(lockedBalance) || 0;
        break;
      default:
        return res.status(400).json({ message: 'Invalid action' });
    }

    await user.save();

    res.json({ 
      success: true, 
      message: 'Balance updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        wallet: user.wallet
      }
    });
  } catch (error) {
    console.error('Error updating balance:', error);
    res.status(500).json({ message: error.message });
  }
});

// Reset user password
router.post('/users/:id/reset-password', protect, authorize('admin'), async (req, res) => {
  try {
    // Generate temporary password
    const temporaryPassword = Math.random().toString(36).slice(-8) + 
                             Math.random().toString(36).slice(-8).toUpperCase();
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { password: hashedPassword }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'Password reset successfully',
      temporaryPassword // In production, send this via email instead
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: error.message });
  }
});

// Verify user KYC
router.put('/users/:id/verify-kyc', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        'kyc.status': 'verified',
        'kyc.verifiedAt': new Date()
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'KYC verified successfully',
      user 
    });
  } catch (error) {
    console.error('Error verifying KYC:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user history
router.get('/users/:id/history', protect, authorize('admin'), async (req, res) => {
  try {
    const { type } = req.query;
    const userId = req.params.id;

    // Mock data - In production, fetch from respective collections
    if (type === 'betting') {
      const bettingHistory = [
        {
          date: new Date(),
          event: 'Manchester United vs Liverpool',
          amount: 100,
          odds: 2.5,
          status: 'won',
          winnings: 250
        },
        {
          date: new Date(Date.now() - 86400000),
          event: 'Barcelona vs Real Madrid',
          amount: 50,
          odds: 1.8,
          status: 'lost',
          winnings: 0
        },
        {
          date: new Date(Date.now() - 172800000),
          event: 'Bayern Munich vs Dortmund',
          amount: 200,
          odds: 1.5,
          status: 'pending',
          winnings: 0
        }
      ];
      res.json(bettingHistory);
    } else if (type === 'transaction') {
      const transactionHistory = [
        {
          date: new Date(),
          type: 'deposit',
          amount: 500,
          method: 'Credit Card',
          status: 'completed'
        },
        {
          date: new Date(Date.now() - 86400000),
          type: 'withdrawal',
          amount: 200,
          method: 'Bank Transfer',
          status: 'pending'
        },
        {
          date: new Date(Date.now() - 172800000),
          type: 'deposit',
          amount: 1000,
          method: 'PayPal',
          status: 'completed'
        }
      ];
      res.json(transactionHistory);
    }
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Dashboard stats
router.get('/dashboard-stats', protect, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    
    const stats = {
      totalUsers,
      activeUsers,
      totalBets: 1250,
      totalDeposits: 50000,
      totalWithdrawals: 35000,
      todayProfit: 2500,
      activeMatches: 8
    };
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Recent transactions
router.get('/recent-transactions', protect, authorize('admin'), async (req, res) => {
  try {
    const transactions = [
      {
        userName: 'John Doe',
        type: 'deposit',
        amount: 500,
        status: 'completed',
        date: new Date()
      },
      {
        userName: 'Jane Smith',
        type: 'withdrawal',
        amount: 200,
        status: 'pending',
        date: new Date()
      }
    ];
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;