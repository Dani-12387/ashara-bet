const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

// ✅ Import authController for referral endpoint
const authController = require('../controllers/authController');

// ==================== USER PROFILE ====================

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
        referralCode: user.referralCode,
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
        wallet: user.wallet,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== WALLET / BALANCE ====================

// Get user balance (deprecated – use /wallet)
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

// Get user wallet (complete wallet info)
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

// ==================== STATS ====================

// Get user stats (mock data)
router.get('/stats', protect, async (req, res) => {
  try {
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

// ==================== PASSWORD ====================

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

// ==================== REFERRAL ====================

// ✅ Get referral info (code + referred friends)
router.get('/referral-info', protect, authController.getReferralInfo);

module.exports = router;