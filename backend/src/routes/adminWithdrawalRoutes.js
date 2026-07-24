const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');

// Get all withdrawals with optional status filter
router.get('/withdrawals', protect, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const withdrawals = await Withdrawal.find(query)
      .populate('user', 'username email phone')
      .sort('-createdAt');
    
    res.json(withdrawals);
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ message: error.message });
  }
});

// Approve withdrawal
router.post('/withdrawals/:id/approve', protect, authorize('admin'), async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal already processed' });
    }

    // Update withdrawal status
    withdrawal.status = 'approved';
    withdrawal.processedBy = req.user.id;
    withdrawal.processedAt = new Date();
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

// Complete withdrawal (mark as paid)
router.post('/withdrawals/:id/complete', protect, authorize('admin'), async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);
    
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'approved') {
      return res.status(400).json({ message: 'Withdrawal must be approved first' });
    }

    // Update user balance - deduct the amount
    const user = await User.findById(withdrawal.user);
    user.wallet.balance -= withdrawal.amount;
    user.wallet.lockedBalance -= withdrawal.amount;
    await user.save();

    // Update withdrawal status
    withdrawal.status = 'completed';
    withdrawal.completedAt = new Date();
    await withdrawal.save();

    res.json({ 
      success: true, 
      message: 'Withdrawal completed successfully',
      withdrawal
    });
  } catch (error) {
    console.error('Error completing withdrawal:', error);
    res.status(500).json({ message: error.message });
  }
});

// Reject withdrawal
router.post('/withdrawals/:id/reject', protect, authorize('admin'), async (req, res) => {
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
    user.wallet.lockedBalance -= withdrawal.amount;
    await user.save();

    // Update withdrawal status
    withdrawal.status = 'rejected';
    withdrawal.rejectionReason = reason || 'No reason provided';
    withdrawal.processedBy = req.user.id;
    withdrawal.processedAt = new Date();
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