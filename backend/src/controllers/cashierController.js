// backend/src/controllers/cashierController.js
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const bcrypt = require('bcryptjs');

// =====================================================
// CASHIER: CREATE DEPOSIT REQUEST (PENDING ADMIN APPROVAL)
// =====================================================
exports.cashierCreateDeposit = async (req, res) => {
  try {
    const { email, amount, notes } = req.body;
    const cashierId = req.user.id;

    if (!email || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Email and valid amount are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ success: false, message: 'User with this email not found' });

    // ✅ Create PENDING transaction — do NOT update balance yet
    const deposit = await Transaction.create({
      user: user._id,
      amount: Number(amount),
      type: 'deposit',
      paymentMethod: 'CASHIER',
      transactionReference: `CASHIER-DEP-${Date.now()}`,
      notes: `Agent Code: ${notes || 'N/A'} | Created by cashier: ${req.user.username}`,
      status: 'pending',
      processedBy: cashierId,
      source: 'cashier',
      createdAt: new Date()
    });

    return res.json({
      success: true,
      message: `✅ Deposit request of ETB ${amount} for ${user.username} submitted. Waiting for admin approval.`,
      deposit,
      status: 'pending'
    });
  } catch (error) {
    console.error('Cashier deposit error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// CASHIER: CREATE WITHDRAWAL REQUEST (PENDING ADMIN APPROVAL, MIN 50)
// =====================================================
exports.cashierCreateWithdrawal = async (req, res) => {
  try {
    const { email, amount, notes } = req.body;
    const cashierId = req.user.id;

    if (!email || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Email and valid amount are required' });
    }

    // ✅ Minimum withdrawal: 50 ETB
    if (Number(amount) < 50) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is ETB 50' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ success: false, message: 'User with this email not found' });

    const currentBalance = user.wallet?.balance || 0;
    if (currentBalance < Number(amount)) {
      return res.status(400).json({ success: false, message: `User has insufficient balance (ETB ${currentBalance.toFixed(2)})` });
    }

    // ✅ Create PENDING withdrawal — do NOT deduct balance yet
    const withdrawal = await Withdrawal.create({
      user: user._id,
      amount: Number(amount),
      paymentMethod: 'CASHIER',
      status: 'pending',
      notes: `Agent Code: ${notes || 'N/A'} | Created by cashier: ${req.user.username}`,
      processedBy: cashierId,
      source: 'cashier',
      createdAt: new Date()
    });

    return res.json({
      success: true,
      message: `✅ Withdrawal request of ETB ${amount} for ${user.username} submitted. Waiting for admin approval.`,
      withdrawal,
      status: 'pending'
    });
  } catch (error) {
    console.error('Cashier withdrawal error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// CASHIER: ADD NEW USER
// =====================================================
exports.cashierAddUser = async (req, res) => {
  try {
    const { username, email, phone, password, initialBalance } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Username, email and password are required' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { username: username.trim() }]
    });
    if (existingUser) return res.status(400).json({ success: false, message: 'User already exists' });

    let finalPhone = phone && phone.trim() ? phone.trim() : `CASH-${Date.now()}`;
    if (!phone || !phone.trim()) {
      const phoneCheck = await User.findOne({ phone: finalPhone });
      if (phoneCheck) finalPhone = `CASH-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    let referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const refCheck = await User.findOne({ referralCode });
    if (refCheck) {
      referralCode = 'REF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 4).toUpperCase();
    }

    const newUser = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      phone: finalPhone,
      password: hashedPassword,
      role: 'user',
      status: 'active',
      referralCode,
      referredBy: req.user.id,
      wallet: {
        balance: Number(initialBalance) || 0,
        bonusBalance: 0,
        lockedBalance: 0,
        welcomeBonusClaimed: true
      }
    });

    await User.findByIdAndUpdate(req.user.id, {
      $push: { referrals: newUser._id },
      $inc: { 'cashierInfo.totalUsersCreated': 1 },
      $set: { 'cashierInfo.lastActivity': new Date() }
    });

    return res.json({
      success: true,
      message: `User ${username} created successfully`,
      user: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        wallet: newUser.wallet,
        referralCode: newUser.referralCode
      }
    });
  } catch (error) {
    console.error('Cashier add user error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// CASHIER: GET MY REFERRALS WITH STATS
// =====================================================
exports.cashierGetMyReferrals = async (req, res) => {
  try {
    const cashierId = req.user.id;

    const referredUsers = await User.find({ referredBy: cashierId })
      .select('username email phone wallet referralCode referredBy createdAt status')
      .sort({ createdAt: -1 });

    const usersWithStats = await Promise.all(
      referredUsers.map(async (u) => {
        // Get cashier-created deposits
        const deposits = await Transaction.find({
          user: u._id,
          processedBy: cashierId,
          source: 'cashier'
        });

        // Get cashier-created withdrawals
        const withdrawals = await Withdrawal.find({
          user: u._id,
          processedBy: cashierId,
          source: 'cashier'
        });

        const approvedDeposits = deposits.filter(d => d.status === 'approved');
        const approvedWithdrawals = withdrawals.filter(w => w.status === 'approved');

        const totalDeposits = approvedDeposits.reduce((s, d) => s + Number(d.amount || 0), 0);
        const totalWithdrawals = approvedWithdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);

        return {
          _id: u._id,
          username: u.username,
          email: u.email,
          phone: u.phone,
          status: u.status,
          joinedAt: u.createdAt,
          balance: u.wallet?.balance || 0,
          bonusBalance: u.wallet?.bonusBalance || 0,
          totalDeposits,
          totalWithdrawals,
          depositCount: approvedDeposits.length,
          withdrawalCount: approvedWithdrawals.length,
          pendingDeposits: deposits.filter(d => d.status === 'pending').length,
          pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length,
          netDeposit: totalDeposits - totalWithdrawals
        };
      })
    );

    const grandTotalDeposits = usersWithStats.reduce((s, u) => s + u.totalDeposits, 0);
    const grandTotalWithdrawals = usersWithStats.reduce((s, u) => s + u.totalWithdrawals, 0);
    const grandTotalBalance = usersWithStats.reduce((s, u) => s + u.balance, 0);

    return res.json({
      success: true,
      data: {
        referralCount: usersWithStats.length,
        grandTotalDeposits,
        grandTotalWithdrawals,
        grandTotalBalance,
        users: usersWithStats
      }
    });
  } catch (error) {
    console.error('Cashier referrals error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// ✅ CASHIER: GET REFERRAL HISTORY (DEPOSITS OR WITHDRAWALS)
// =====================================================
exports.cashierGetReferralHistory = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { userId } = req.params;
    const { type } = req.query; // 'deposit' or 'withdrawal'

    // Verify this user was referred by this cashier
    const user = await User.findOne({ _id: userId, referredBy: cashierId })
      .select('username email phone wallet');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found in your referrals' });
    }

    let history = [];

    if (type === 'deposit') {
      const deposits = await Transaction.find({
        user: userId,
        processedBy: cashierId,
        source: 'cashier'
      }).sort({ createdAt: -1 });

      history = deposits.map(d => ({
        _id: d._id,
        amount: d.amount,
        email: user.email,
        username: user.username,
        status: d.status,
        agentCode: d.notes || 'N/A',
        reference: d.transactionReference,
        date: d.createdAt,
        approvedAt: d.approvedAt || null
      }));
    } else if (type === 'withdrawal') {
      const withdrawals = await Withdrawal.find({
        user: userId,
        processedBy: cashierId,
        source: 'cashier'
      }).sort({ createdAt: -1 });

      history = withdrawals.map(w => ({
        _id: w._id,
        amount: w.amount,
        email: user.email,
        username: user.username,
        status: w.status,
        agentCode: w.notes || 'N/A',
        date: w.createdAt,
        approvedAt: w.approvedAt || null
      }));
    } else {
      return res.status(400).json({ success: false, message: 'type must be "deposit" or "withdrawal"' });
    }

    return res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          balance: user.wallet?.balance || 0
        },
        type,
        count: history.length,
        total: history.filter(h => h.status === 'approved').reduce((s, h) => s + Number(h.amount), 0),
        history
      }
    });
  } catch (error) {
    console.error('Cashier referral history error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// CASHIER: REFERRAL LINK
// =====================================================
exports.cashierGetReferralLink = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const user = await User.findById(cashierId).select('username referralCode');

    if (!user) return res.status(404).json({ success: false, message: 'Cashier not found' });

    if (!user.referralCode) {
      let code = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const exists = await User.findOne({ referralCode: code });
      if (exists) {
        code = 'REF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 4).toUpperCase();
      }
      user.referralCode = code;
      await user.save();
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://asharabet.com';
    const referralLink = `${baseUrl}/register?ref=${user.referralCode}`;

    return res.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralLink,
        cashierUsername: user.username
      }
    });
  } catch (error) {
    console.error('Cashier referral link error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// CASHIER: GENERATE REPORT
// =====================================================
exports.cashierReport = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { startDate, endDate } = req.query;

    const buildFilter = () => {
      const filter = { processedBy: cashierId, source: 'cashier' };
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      return filter;
    };

    const deposits = await Transaction.find(buildFilter()).populate('user', 'username email');
    const withdrawals = await Withdrawal.find(buildFilter()).populate('user', 'username email');

    const totalDeposits = deposits.filter(d => d.status === 'approved').reduce((s, d) => s + Number(d.amount), 0);
    const totalWithdrawals = withdrawals.filter(w => w.status === 'approved').reduce((s, w) => s + Number(w.amount), 0);

    return res.json({
      success: true,
      data: {
        cashier: { id: cashierId, username: req.user.username },
        deposits,
        withdrawals,
        totalDeposits,
        totalWithdrawals,
        netFlow: totalDeposits - totalWithdrawals,
        totalDepositCount: deposits.length,
        totalWithdrawalCount: withdrawals.length,
        pendingDeposits: deposits.filter(d => d.status === 'pending').length,
        pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Cashier report error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// CASHIER: LOOKUP USER
// =====================================================
exports.cashierLookupUser = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Query required' });

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ]
    }).select('username email phone wallet role').limit(10);

    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// ADMIN: APPROVE CASHIER DEPOSIT
// =====================================================
exports.adminApproveCashierDeposit = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const adminId = req.user.id;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });

    if (transaction.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Already approved' });
    }

    const user = await User.findById(transaction.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // ✅ NOW update balance
    user.wallet.balance = (user.wallet?.balance || 0) + Number(transaction.amount);
    await user.save();

    transaction.status = 'approved';
    transaction.approvedBy = adminId;
    transaction.approvedAt = new Date();
    await transaction.save();

    // Update cashier stats
    if (transaction.processedBy) {
      await User.findByIdAndUpdate(transaction.processedBy, {
        $inc: { 'cashierInfo.totalDepositsProcessed': Number(transaction.amount) },
        $set: { 'cashierInfo.lastActivity': new Date() }
      });
    }

    return res.json({
      success: true,
      message: `✅ Approved deposit of ETB ${transaction.amount} for ${user.username}`,
      newBalance: user.wallet.balance
    });
  } catch (error) {
    console.error('Admin approve deposit error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// ADMIN: REJECT CASHIER DEPOSIT
// =====================================================
exports.adminRejectCashierDeposit = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found' });

    transaction.status = 'rejected';
    transaction.rejectionReason = reason || 'Rejected by admin';
    transaction.rejectedAt = new Date();
    transaction.rejectedBy = req.user.id;
    await transaction.save();

    return res.json({ success: true, message: 'Deposit rejected' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// ADMIN: APPROVE CASHIER WITHDRAWAL
// =====================================================
exports.adminApproveCashierWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const adminId = req.user.id;

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });

    if (withdrawal.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Already approved' });
    }

    const user = await User.findById(withdrawal.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if ((user.wallet?.balance || 0) < Number(withdrawal.amount)) {
      return res.status(400).json({ success: false, message: 'User now has insufficient balance' });
    }

    // ✅ NOW deduct balance
    user.wallet.balance = (user.wallet?.balance || 0) - Number(withdrawal.amount);
    await user.save();

    withdrawal.status = 'approved';
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();
    await withdrawal.save();

    if (withdrawal.processedBy) {
      await User.findByIdAndUpdate(withdrawal.processedBy, {
        $inc: { 'cashierInfo.totalWithdrawalsProcessed': Number(withdrawal.amount) },
        $set: { 'cashierInfo.lastActivity': new Date() }
      });
    }

    return res.json({
      success: true,
      message: `✅ Approved withdrawal of ETB ${withdrawal.amount} for ${user.username}`,
      newBalance: user.wallet.balance
    });
  } catch (error) {
    console.error('Admin approve withdrawal error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// ADMIN: REJECT CASHIER WITHDRAWAL
// =====================================================
exports.adminRejectCashierWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { reason } = req.body;

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });

    withdrawal.status = 'rejected';
    withdrawal.rejectionReason = reason || 'Rejected by admin';
    withdrawal.rejectedAt = new Date();
    withdrawal.rejectedBy = req.user.id;
    await withdrawal.save();

    return res.json({ success: true, message: 'Withdrawal rejected' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// ADMIN: LIST PENDING CASHIER TRANSACTIONS
// =====================================================
exports.adminListPendingCashierTransactions = async (req, res) => {
  try {
    const pendingDeposits = await Transaction.find({
      status: 'pending',
      source: 'cashier'
    }).populate('user', 'username email').populate('processedBy', 'username').sort({ createdAt: -1 });

    const pendingWithdrawals = await Withdrawal.find({
      status: 'pending',
      source: 'cashier'
    }).populate('user', 'username email').populate('processedBy', 'username').sort({ createdAt: -1 });

    return res.json({
      success: true,
      pendingDeposits,
      pendingWithdrawals,
      totalPending: pendingDeposits.length + pendingWithdrawals.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// ADMIN: ASSIGN / REMOVE CASHIER
// =====================================================
exports.adminAssignCashier = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.role = 'cashier';
    user.cashierInfo = { ...user.cashierInfo, assignedBy: req.user.id, assignedAt: new Date() };
    await user.save();

    return res.json({ success: true, message: `${user.username} is now a Cashier`, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.adminRemoveCashier = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.role = 'user';
    await user.save();

    return res.json({ success: true, message: `${user.username} is no longer a Cashier`, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.adminListCashiers = async (req, res) => {
  try {
    const cashiers = await User.find({ role: 'cashier' })
      .select('username email phone wallet createdAt cashierInfo referrals')
      .sort({ createdAt: -1 });

    return res.json({ success: true, cashiers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.adminListCandidateUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('username email phone wallet createdAt')
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.adminGetCashierReferrals = async (req, res) => {
  try {
    const { cashierId } = req.params;
    const cashier = await User.findById(cashierId).select('username email referralCode');
    if (!cashier) return res.status(404).json({ success: false, message: 'Cashier not found' });

    const referredUsers = await User.find({ referredBy: cashierId })
      .select('username email phone wallet createdAt status')
      .sort({ createdAt: -1 });

    return res.json({ success: true, data: { cashier, referralCount: referredUsers.length, users: referredUsers } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

console.log('✅ Cashier controller loaded (with admin approval workflow)');