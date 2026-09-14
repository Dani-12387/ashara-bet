// backend/src/controllers/adminWithdrawalController.js
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');

// =====================================================
// @desc    Get all withdrawals (with status filter)
// @route   GET /api/admin/withdrawals
// =====================================================
exports.getWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    const withdrawals = await Withdrawal.find(filter)
      .populate('user', 'username email phone wallet')
      .populate('processedBy', 'username email')
      .populate('approvedBy', 'username')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: withdrawals.length,
      withdrawals
    });
  } catch (error) {
    console.error('❌ Get withdrawals error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// @desc    Get single withdrawal
// @route   GET /api/admin/withdrawals/:id
// =====================================================
exports.getWithdrawalById = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id)
      .populate('user', 'username email phone wallet')
      .populate('processedBy', 'username email')
      .populate('approvedBy', 'username')
      .populate('rejectedBy', 'username');

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    res.json({ success: true, withdrawal });
  } catch (error) {
    console.error('❌ Get withdrawal error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// @desc    Approve withdrawal (Step 1 — ready for payment)
// @route   POST /api/admin/withdrawals/:id/approve
// ✅ CRITICAL FIX: Does NOT overwrite processedBy (keeps cashier ID)
// =====================================================
exports.approveWithdrawal = async (req, res) => {
  try {
    const adminId = req.user.id;

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve. Current status: ${withdrawal.status}`
      });
    }

    // ✅ ONLY change status + admin tracking
    // ❌ DO NOT touch: withdrawal.processedBy  (keep the cashier's ID)
    // ❌ DO NOT touch: withdrawal.source        (keep 'cashier' or 'user')
    withdrawal.status = 'approved';
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();

    await withdrawal.save();

    // Update cashier stats if this was created by a cashier
    if (withdrawal.processedBy && withdrawal.source === 'cashier') {
      await User.findByIdAndUpdate(withdrawal.processedBy, {
        $set: { 'cashierInfo.lastActivity': new Date() }
      });
    }

    // Notify user (optional — via socket if you have it)
    if (global.io) {
      global.io.emit('withdrawal:approved', {
        withdrawalId: withdrawal._id,
        userId: withdrawal.user,
        amount: withdrawal.amount
      });
    }

    return res.json({
      success: true,
      message: '✅ Withdrawal approved. Ready to mark as paid.',
      withdrawal
    });
  } catch (error) {
    console.error('❌ Approve withdrawal error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// @desc    Mark withdrawal as paid (Step 2 — deduct balance)
// @route   POST /api/admin/withdrawals/:id/complete
// ✅ Deducts the user's balance, marks status as 'completed'
// ✅ Does NOT overwrite processedBy
// =====================================================
exports.completeWithdrawal = async (req, res) => {
  try {
    const adminId = req.user.id;

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    if (withdrawal.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete. Current status: ${withdrawal.status}. Must be 'approved' first.`
      });
    }

    // Load the user
    const user = await User.findById(withdrawal.user);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check balance again at payment time
    const currentBalance = user.wallet?.balance || 0;
    if (currentBalance < Number(withdrawal.amount)) {
      return res.status(400).json({
        success: false,
        message: `User now has insufficient balance (ETB ${currentBalance.toFixed(2)})`
      });
    }

    // ✅ Deduct from user's balance
    user.wallet.balance = currentBalance - Number(withdrawal.amount);
    await user.save();

    // Mark withdrawal as completed
    // ❌ DO NOT touch processedBy — keep the cashier's ID
    withdrawal.status = 'completed';
    withdrawal.completedAt = new Date();
    withdrawal.completedBy = adminId;
    await withdrawal.save();

    // Update cashier stats if cashier-created
    if (withdrawal.processedBy && withdrawal.source === 'cashier') {
      await User.findByIdAndUpdate(withdrawal.processedBy, {
        $inc: { 'cashierInfo.totalWithdrawalsProcessed': Number(withdrawal.amount) },
        $set: { 'cashierInfo.lastActivity': new Date() }
      });
    }

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

    return res.json({
      success: true,
      message: `💰 Withdrawal of ETB ${withdrawal.amount} completed. User balance updated.`,
      withdrawal,
      newBalance: user.wallet.balance
    });
  } catch (error) {
    console.error('❌ Complete withdrawal error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// @desc    Reject withdrawal
// @route   POST /api/admin/withdrawals/:id/reject
// ✅ Does NOT touch processedBy
// =====================================================
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { reason } = req.body;
    const adminId = req.user.id;

    const withdrawal = await Withdrawal.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    if (withdrawal.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject a completed withdrawal'
      });
    }

    // ❌ DO NOT touch processedBy — keep the cashier's ID
    withdrawal.status = 'rejected';
    withdrawal.rejectionReason = reason || 'Rejected by admin';
    withdrawal.rejectedBy = adminId;
    withdrawal.rejectedAt = new Date();
    await withdrawal.save();

    // Notify user
    if (global.io) {
      global.io.emit('withdrawal:rejected', {
        withdrawalId: withdrawal._id,
        userId: withdrawal.user,
        reason: withdrawal.rejectionReason
      });
    }

    return res.json({
      success: true,
      message: '❌ Withdrawal rejected',
      withdrawal
    });
  } catch (error) {
    console.error('❌ Reject withdrawal error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// @desc    Get pending cashier-created withdrawals only
// @route   GET /api/admin/withdrawals/pending-cashier
// =====================================================
exports.getPendingCashierWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      status: 'pending',
      source: 'cashier'
    })
      .populate('user', 'username email phone wallet')
      .populate('processedBy', 'username email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: withdrawals.length,
      withdrawals
    });
  } catch (error) {
    console.error('❌ Get pending cashier withdrawals error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// @desc    Get summary stats
// @route   GET /api/admin/withdrawals/stats
// =====================================================
exports.getWithdrawalStats = async (req, res) => {
  try {
    const allWithdrawals = await Withdrawal.find();

    const stats = {
      total: allWithdrawals.length,
      pending: allWithdrawals.filter(w => w.status === 'pending').length,
      approved: allWithdrawals.filter(w => w.status === 'approved').length,
      rejected: allWithdrawals.filter(w => w.status === 'rejected').length,
      completed: allWithdrawals.filter(w => w.status === 'completed').length,

      totalAmount: allWithdrawals
        .filter(w => w.status === 'completed' || w.status === 'approved')
        .reduce((s, w) => s + Number(w.amount), 0),

      cashierCreated: allWithdrawals.filter(w => w.source === 'cashier').length,
      userCreated: allWithdrawals.filter(w => w.source === 'user' || !w.source).length
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Get withdrawal stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

console.log('✅ Admin withdrawal controller loaded');