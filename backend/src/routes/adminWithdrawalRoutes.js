const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/auth');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');

// =====================================================
// GET ALL WITHDRAWALS (with optional status filter)
// =====================================================
router.get('/withdrawals', protect, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    const withdrawals = await Withdrawal.find(query)
      .populate('user', 'username email phone wallet')
      .populate('processedBy', 'username email')
      .populate('approvedBy', 'username')
      .sort('-createdAt');

    res.json(withdrawals);
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ message: error.message });
  }
});

// =====================================================
// APPROVE WITHDRAWAL (ready for payment)
// ✅ Does NOT overwrite processedBy
// =====================================================
router.post('/withdrawals/:id/approve', protect, isAdmin, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal already processed' });
    }

    // ✅ Update status
    withdrawal.status = 'approved';

    // ✅ Track admin — do NOT touch processedBy!
    withdrawal.approvedBy = req.user.id;
    withdrawal.approvedAt = new Date();

    // ❌ DO NOT set withdrawal.processedBy = req.user.id;

    await withdrawal.save();

    res.json({
      success: true,
      message: 'Withdrawal approved successfully',
      withdrawal
    });
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    res.status(500).json({ message: error.message });
  }
});

// =====================================================
// COMPLETE WITHDRAWAL (mark as paid — deduct balance)
// ✅ Does NOT touch processedBy
// =====================================================
router.post('/withdrawals/:id/complete', protect, isAdmin, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'approved') {
      return res.status(400).json({ message: 'Withdrawal must be approved first' });
    }

    const user = await User.findById(withdrawal.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentBalance = user.wallet?.balance || 0;
    if (currentBalance < Number(withdrawal.amount)) {
      return res.status(400).json({
        message: `User has insufficient balance (ETB ${currentBalance.toFixed(2)})`
      });
    }

    // Deduct balance
    user.wallet.balance = currentBalance - Number(withdrawal.amount);

    if (user.wallet.lockedBalance && user.wallet.lockedBalance >= Number(withdrawal.amount)) {
      user.wallet.lockedBalance -= Number(withdrawal.amount);
    }

    await user.save();

    // Update status
    withdrawal.status = 'completed';
    withdrawal.completedBy = req.user.id;
    withdrawal.completedAt = new Date();
    // ❌ DO NOT touch processedBy

    await withdrawal.save();

    // Notify via socket
    if (global.io) {
      global.io.emit('withdrawal:completed', {
        withdrawalId: withdrawal._id,
        userId: withdrawal.user,
        amount: withdrawal.amount,
        newBalance: user.wallet.balance
      });
      global.io.emit('wallet:updated', {
        userId: user._id.toString(),
        balance: user.wallet.balance
      });
    }

    res.json({
      success: true,
      message: 'Withdrawal completed successfully',
      withdrawal,
      newBalance: user.wallet.balance
    });
  } catch (error) {
    console.error('Error completing withdrawal:', error);
    res.status(500).json({ message: error.message });
  }
});

// =====================================================
// REJECT WITHDRAWAL
// ✅ Does NOT overwrite processedBy
// =====================================================
router.post('/withdrawals/:id/reject', protect, isAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal already processed' });
    }

    // Release locked amount back to user
    const user = await User.findById(withdrawal.user);
    if (user && user.wallet.lockedBalance >= Number(withdrawal.amount)) {
      user.wallet.lockedBalance -= Number(withdrawal.amount);
      await user.save();
    }

    // Update status
    withdrawal.status = 'rejected';
    withdrawal.rejectionReason = reason || 'No reason provided';
    withdrawal.rejectedBy = req.user.id;
    withdrawal.rejectedAt = new Date();
    // ❌ DO NOT touch processedBy

    await withdrawal.save();

    res.json({
      success: true,
      message: 'Withdrawal rejected successfully',
      withdrawal
    });
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;