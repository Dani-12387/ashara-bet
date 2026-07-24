const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { protect, authorize } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Match = require('../models/Match'); // ✅ ADD THIS IMPORT

// ============================================
// USER MANAGEMENT ROUTES
// ============================================

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

    const existingUser = await User.findOne({ $or: [{ email }, { username }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

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
      { username, email, phone, role, status, profile },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ success: true, message: 'User updated successfully', user });
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
    res.json({ success: true, message: 'User deleted successfully' });
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

    res.json({ success: true, message: `User ${status} successfully`, user });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update user balance
router.post('/users/:id/balance', protect, authorize('admin'), async (req, res) => {
  try {
    const { balance, bonusBalance, lockedBalance, action } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.wallet) {
      user.wallet = { balance: 0, bonusBalance: 0, lockedBalance: 0 };
    }

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
      temporaryPassword
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

    res.json({ success: true, message: 'KYC verified successfully', user });
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

    if (type === 'transaction') {
      const transactions = await Transaction.find({ user: userId }).sort('-createdAt');
      const formattedTransactions = transactions.map(t => ({
        date: t.createdAt,
        type: t.type,
        amount: t.amount,
        method: t.paymentMethod,
        status: t.status,
        reference: t.transactionReference
      }));
      res.json(formattedTransactions);
    } else if (type === 'betting') {
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
        }
      ];
      res.json(bettingHistory);
    } else {
      res.json([]);
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
    
    const totalDeposits = await Transaction.aggregate([
      { $match: { type: 'deposit', status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalWithdrawals = await Transaction.aggregate([
      { $match: { type: 'withdrawal', status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const stats = {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      totalBets: 0,
      totalDeposits: totalDeposits[0]?.total || 0,
      totalWithdrawals: totalWithdrawals[0]?.total || 0,
      todayProfit: 0,
      activeMatches: 0
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
    const recentTransactions = await Transaction.find()
      .populate('user', 'username')
      .sort('-createdAt')
      .limit(10);
    
    const formatted = recentTransactions.map(t => ({
      userName: t.user?.username || 'Unknown',
      type: t.type,
      amount: t.amount,
      status: t.status,
      date: t.createdAt
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// MATCH MANAGEMENT ROUTES - ADD THIS SECTION
// ============================================

// Get all matches (admin)
router.get('/matches', protect, authorize('admin'), async (req, res) => {
  try {
    const { sport, status, dateFrom, dateTo } = req.query;
    const query = {};

    if (sport) query.sport = sport;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }

    const matches = await Match.find(query)
      .sort({ date: 1 })
      .lean();

    console.log(`Found ${matches.length} matches for admin`);
    matches.forEach(m => {
      console.log(`  - ${m.homeTeam} vs ${m.awayTeam}: markets =`, m.markets ? Object.keys(m.markets) : 'None');
    });

    res.json({ success: true, matches });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single match (admin)
router.get('/matches/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    res.json({ success: true, match });
  } catch (error) {
    console.error('Error fetching match:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create match (admin)
router.post('/matches', protect, authorize('admin'), async (req, res) => {
  try {
    const { 
      sport, league, country, homeTeam, awayTeam, date, 
      odds, score, status, markets 
    } = req.body;

    console.log('Creating match with markets:', markets);

    const match = new Match({
      sport: sport || 'FOOTBALL',
      league,
      country,
      homeTeam,
      awayTeam,
      date,
      odds: {
        home: parseFloat(odds?.home) || 1.01,
        draw: parseFloat(odds?.draw) || 1.01,
        away: parseFloat(odds?.away) || 1.01
      },
      score: score || { home: 0, away: 0 },
      status: status || 'UPCOMING',
      markets: markets || {},
      isActive: true
    });

    await match.save();
    console.log('Match created with ID:', match._id);
    console.log('Match markets saved:', match.markets);

    res.status(201).json({ success: true, match });
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update match (admin)
router.put('/matches/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { 
      sport, league, country, homeTeam, awayTeam, date, 
      odds, score, status, markets 
    } = req.body;

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    // Update fields
    if (sport) match.sport = sport;
    if (league) match.league = league;
    if (country) match.country = country;
    if (homeTeam) match.homeTeam = homeTeam;
    if (awayTeam) match.awayTeam = awayTeam;
    if (date) match.date = date;
    if (status) match.status = status;
    
    if (odds) {
      match.odds.home = parseFloat(odds.home) || match.odds.home;
      match.odds.draw = parseFloat(odds.draw) || match.odds.draw;
      match.odds.away = parseFloat(odds.away) || match.odds.away;
    }
    
    if (score) {
      match.score.home = score.home || match.score.home;
      match.score.away = score.away || match.score.away;
    }
    
    // ← IMPORTANT: Update markets
    if (markets !== undefined) {
      match.markets = markets;
    }

    await match.save();
    console.log('Match updated with markets:', match.markets);

    res.json({ success: true, match });
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update match status (admin)
router.patch('/matches/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, scoreHome, scoreAway } = req.body;

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    match.status = status || match.status;
    if (scoreHome !== undefined) match.score.home = scoreHome;
    if (scoreAway !== undefined) match.score.away = scoreAway;

    await match.save();

    res.json({ success: true, match });
  } catch (error) {
    console.error('Error updating match status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete match (admin)
router.delete('/matches/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    res.json({ success: true, message: 'Match deleted successfully' });
  } catch (error) {
    console.error('Error deleting match:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;