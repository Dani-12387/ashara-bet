const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Add this import for password hashing
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

// Get user profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        profile: user.profile,
        wallet: user.wallet,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { username, phone, profile } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { username, phone, profile },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        profile: user.profile,
        wallet: user.wallet
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user balance (deprecated - use /wallet instead)
router.get('/balance', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      balance: user.wallet?.balance || 0,
      bonusBalance: user.wallet?.bonusBalance || 0,
      lockedBalance: user.wallet?.lockedBalance || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// NEW: Get user wallet (complete wallet info)
router.get('/wallet', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      balance: user.wallet?.balance || 0,
      bonusBalance: user.wallet?.bonusBalance || 0,
      lockedBalance: user.wallet?.lockedBalance || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user stats
router.get('/stats', protect, async (req, res) => {
  try {
    // Mock data - replace with actual database queries
    res.json({
      totalBets: 45,
      totalWon: 23,
      winRate: 51,
      totalDeposits: 12500,
      totalWithdrawals: 8700
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Change password
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');
    
    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.passwordChangedAt = new Date();
    await user.save();
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;