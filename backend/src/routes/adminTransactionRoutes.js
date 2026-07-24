const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// Get all transactions with optional status filter
router.get('/transactions', protect, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.query;
    let query = { type: 'deposit' }; // Only deposits for now
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const transactions = await Transaction.find(query)
      .populate('user', 'username email phone') // ✅ Make sure phone is included here
      .sort('-createdAt');
    
    console.log('Transactions with user data:', transactions.map(t => ({
      transactionId: t._id,
      username: t.user?.username,
      email: t.user?.email,
      phone: t.user?.phone // This should now show the phone number
    })));
    
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: error.message });
  }
});

// Approve deposit
router.post('/transactions/:id/approve', protect, authorize('admin'), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Transaction already processed' });
    }

    // Update transaction status
    transaction.status = 'approved';
    transaction.approvedBy = req.user.id;
    transaction.approvedAt = new Date();
    await transaction.save();

    // Update user balance
    const user = await User.findById(transaction.user);
    if (!user.wallet) {
      user.wallet = { balance: 0, bonusBalance: 0, lockedBalance: 0 };
    }
    user.wallet.balance += transaction.amount;
    await user.save();

    res.json({ 
      success: true, 
      message: 'Deposit approved successfully',
      transaction
    });
  } catch (error) {
    console.error('Error approving deposit:', error);
    res.status(500).json({ message: error.message });
  }
});

// Reject deposit
router.post('/transactions/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Transaction already processed' });
    }

    transaction.status = 'rejected';
    transaction.rejectionReason = reason || 'No reason provided';
    await transaction.save();

    res.json({ 
      success: true, 
      message: 'Deposit rejected successfully',
      transaction
    });
  } catch (error) {
    console.error('Error rejecting deposit:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;