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
      type: 'deposit',
      amount: Number(amount),
      paymentMethod: 'CASHIER',
      transactionReference: `CASHIER-DEP-${Date.now()}`,
      notes: `Agent Code: ${notes || 'N/A'} | By: ${req.user.username}`,
      status: 'pending',
      source: 'cashier',
      processedBy: cashierId,
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
      notes: `Agent Code: ${notes || 'N/A'} | By: ${req.user.username}`,
      source: 'cashier',
      processedBy: cashierId,
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
// (deposits + withdrawals - both self-made AND cashier-made)
// =====================================================
exports.cashierGetMyReferrals = async (req, res) => {
  try {
    const cashierId = req.user.id;

    const referredUsers = await User.find({ referredBy: cashierId })
      .select('username email phone wallet referralCode createdAt status')
      .sort({ createdAt: -1 });

    const usersWithStats = await Promise.all(
      referredUsers.map(async (u) => {
        // ✅ Get ALL approved deposits (self-made OR cashier-made)
        const deposits = await Transaction.find({
          user: u._id,
          type: 'deposit',
          status: 'approved'
        });

        // ✅ Get ALL approved withdrawals (self-made OR cashier-made)
        const withdrawals = await Withdrawal.find({
          user: u._id,
          status: 'approved'
        });

        // Pending counts
        const pendingDeposits = await Transaction.countDocuments({
          user: u._id,
          type: 'deposit',
          status: 'pending'
        });

        const pendingWithdrawals = await Withdrawal.countDocuments({
          user: u._id,
          status: 'pending'
        });

        const totalDeposits = deposits.reduce((s, d) => s + Number(d.amount || 0), 0);
        const totalWithdrawals = withdrawals.reduce((s, w) => s + Number(w.amount || 0), 0);

        return {
          _id: u._id,
          username: u.username,
          email: u.email,
          phone: u.phone,
          status: u.status,
          joinedAt: u.createdAt,
          balance: u.wallet?.balance || 0,
          totalDeposits,           // ✅ always positive
          totalWithdrawals,        // ✅ always positive (shown as -ETB on frontend)
          depositCount: deposits.length,
          withdrawalCount: withdrawals.length,
          pendingDeposits,
          pendingWithdrawals,
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
        netFlow: grandTotalDeposits - grandTotalWithdrawals,
        users: usersWithStats
      }
    });
  } catch (error) {
    console.error('Cashier referrals error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// CASHIER: GET REFERRAL HISTORY
// Returns deposits + withdrawals (self + cashier made)
// =====================================================
exports.cashierGetReferralHistory = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { userId } = req.params;
    const { type } = req.query; // 'deposit' | 'withdrawal' | 'all'

    // Verify user is in this cashier's referrals
    const user = await User.findOne({ _id: userId, referredBy: cashierId })
      .select('username email phone wallet');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found in your referrals' });
    }

    let deposits = [];
    let withdrawals = [];

    // ✅ Fetch ALL deposits (self + cashier)
    if (!type || type === 'deposit' || type === 'all') {
      const rawDeposits = await Transaction.find({
        user: userId,
        type: 'deposit'
      }).sort({ createdAt: -1 });

      deposits = rawDeposits.map(d => ({
        _id: d._id,
        transactionType: 'deposit',
        amount: Number(d.amount),
        email: user.email,
        username: user.username,
        status: d.status,
        agentCode: d.notes ? d.notes.replace('Agent Code: ', '').split(' | ')[0] : '',
        reference: d.transactionReference || '',
        date: d.createdAt,
        source: d.source || 'user',
        createdBy: d.processedBy ? 'Cashier' : 'Self'
      }));
    }

    // ✅ Fetch ALL withdrawals (self + cashier)
    if (!type || type === 'withdrawal' || type === 'all') {
      const rawWithdrawals = await Withdrawal.find({
        user: userId
      }).sort({ createdAt: -1 });

      withdrawals = rawWithdrawals.map(w => ({
        _id: w._id,
        transactionType: 'withdrawal',
        amount: Number(w.amount),
        email: user.email,
        username: user.username,
        status: w.status,
        agentCode: w.notes ? w.notes.replace('Agent Code: ', '').split(' | ')[0] : '',
        reference: '',
        date: w.createdAt,
        source: w.source || 'user',
        createdBy: w.processedBy ? 'Cashier' : 'Self'
      }));
    }

    // Combined list sorted by date (newest first)
    const combined = [...deposits, ...withdrawals].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    const approvedDeposits = deposits.filter(d => d.status === 'approved');
    const approvedWithdrawals = withdrawals.filter(w => w.status === 'approved');

    const totalDeposits = approvedDeposits.reduce((s, d) => s + Number(d.amount), 0);
    const totalWithdrawals = approvedWithdrawals.reduce((s, w) => s + Number(w.amount), 0);

    return res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          balance: user.wallet?.balance || 0
        },
        deposits,
        withdrawals,
        combined,
        totalDeposits,           // ✅ always positive
        totalWithdrawals,        // ✅ always positive
        netFlow: totalDeposits - totalWithdrawals,
        depositCount: deposits.length,
        withdrawalCount: withdrawals.length,
        approvedDepositCount: approvedDeposits.length,
        approvedWithdrawalCount: approvedWithdrawals.length
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
    })
      .populate('user', 'username email')
      .populate('processedBy', 'username')
      .sort({ createdAt: -1 });

    const pendingWithdrawals = await Withdrawal.find({
      status: 'pending',
      source: 'cashier'
    })
      .populate('user', 'username email')
      .populate('processedBy', 'username')
      .sort({ createdAt: -1 });

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
// ADMIN: ASSIGN CASHIER
// =====================================================
exports.adminAssignCashier = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.role = 'cashier';
    user.cashierInfo = {
      ...user.cashierInfo,
      assignedBy: req.user.id,
      assignedAt: new Date()
    };
    await user.save();

    return res.json({ success: true, message: `${user.username} is now a Cashier`, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// ADMIN: REMOVE CASHIER
// =====================================================
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

// =====================================================
// ADMIN: LIST ALL CASHIERS
// =====================================================
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

// =====================================================
// ADMIN: LIST CANDIDATE USERS
// =====================================================
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

// =====================================================
// ADMIN: GET CASHIER'S REFERRALS (for admin view)
// =====================================================
exports.adminGetCashierReferrals = async (req, res) => {
  try {
    const { cashierId } = req.params;

    const cashier = await User.findById(cashierId).select('username email referralCode');
    if (!cashier) return res.status(404).json({ success: false, message: 'Cashier not found' });

    const referredUsers = await User.find({ referredBy: cashierId })
      .select('username email phone wallet createdAt status')
      .sort({ createdAt: -1 });

    const usersWithStats = await Promise.all(
      referredUsers.map(async (u) => {
        const deposits = await Transaction.find({ user: u._id, type: 'deposit', status: 'approved' });
        const withdrawals = await Withdrawal.find({ user: u._id, status: 'approved' });

        return {
          _id: u._id,
          username: u.username,
          email: u.email,
          phone: u.phone,
          status: u.status,
          joinedAt: u.createdAt,
          balance: u.wallet?.balance || 0,
          totalDeposits: deposits.reduce((s, d) => s + Number(d.amount || 0), 0),
          totalWithdrawals: withdrawals.reduce((s, w) => s + Number(w.amount || 0), 0)
        };
      })
    );

    return res.json({
      success: true,
      data: {
        cashier,
        referralCount: usersWithStats.length,
        users: usersWithStats
      }
    });
  } catch (error) {
    console.error('Admin cashier referrals error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

console.log('✅ Cashier controller loaded with referral system + history tracking');