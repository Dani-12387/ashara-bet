// backend/controllers/cashierController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// ✅ SAFE IMPORTS — Won't crash if models don't exist
let Deposit = null;
let Withdrawal = null;

try { Deposit = require('../models/Deposit'); } catch (e) { console.warn('⚠️ Deposit model missing'); }
try { Withdrawal = require('../models/Withdrawal'); } catch (e) { console.warn('⚠️ Withdrawal model missing'); }

// =====================================================
// CASHIER: CREATE DEPOSIT FOR A USER (BY EMAIL)
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

    const oldBalance = user.wallet?.balance || 0;
    user.wallet.balance = oldBalance + Number(amount);
    await user.save();

    // ✅ Only create deposit record if model exists
    if (Deposit) {
      try {
        await Deposit.create({
          user: user._id,
          amount: Number(amount),
          paymentMethod: 'CASHIER',
          transactionReference: `CASHIER-${Date.now()}`,
          notes: `Agent Code: ${notes || 'N/A'} | By: ${req.user.username}`,
          status: 'approved',
          processedBy: cashierId,
          processedAt: new Date()
        });
      } catch (e) {
        console.warn('Deposit record save failed:', e.message);
      }
    }

    return res.json({
      success: true,
      message: `Deposited ETB ${amount} to ${user.username} (${user.email})`,
      newBalance: user.wallet.balance
    });
  } catch (error) {
    console.error('Cashier deposit error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// CASHIER: WITHDRAW FROM A USER (BY EMAIL)
// =====================================================
exports.cashierCreateWithdrawal = async (req, res) => {
  try {
    const { email, amount, notes } = req.body;
    const cashierId = req.user.id;

    if (!email || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Email and valid amount are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ success: false, message: 'User with this email not found' });

    const currentBalance = user.wallet?.balance || 0;
    if (currentBalance < Number(amount)) {
      return res.status(400).json({ success: false, message: `User has insufficient balance (ETB ${currentBalance.toFixed(2)})` });
    }

    user.wallet.balance = currentBalance - Number(amount);
    await user.save();

    // ✅ Only create withdrawal record if model exists
    if (Withdrawal) {
      try {
        await Withdrawal.create({
          user: user._id,
          amount: Number(amount),
          paymentMethod: 'CASHIER',
          status: 'approved',
          notes: `Agent Code: ${notes || 'N/A'} | By: ${req.user.username}`,
          processedBy: cashierId,
          processedAt: new Date()
        });
      } catch (e) {
        console.warn('Withdrawal record save failed:', e.message);
      }
    }

    return res.json({
      success: true,
      message: `Withdrew ETB ${amount} from ${user.username} (${user.email})`,
      newBalance: user.wallet.balance
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
// CASHIER: GENERATE REPORT
// =====================================================
exports.cashierReport = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { startDate, endDate } = req.query;

    let deposits = [];
    let withdrawals = [];

    if (Deposit) {
      const filter = { processedBy: cashierId };
      if (startDate || endDate) {
        filter.processedAt = {};
        if (startDate) filter.processedAt.$gte = new Date(startDate);
        if (endDate) filter.processedAt.$lte = new Date(endDate);
      }
      try { deposits = await Deposit.find(filter).populate('user', 'username email'); } catch (e) {}
    }

    if (Withdrawal) {
      const filter = { processedBy: cashierId };
      if (startDate || endDate) {
        filter.processedAt = {};
        if (startDate) filter.processedAt.$gte = new Date(startDate);
        if (endDate) filter.processedAt.$lte = new Date(endDate);
      }
      try { withdrawals = await Withdrawal.find(filter).populate('user', 'username email'); } catch (e) {}
    }

    const totalDeposits = deposits.reduce((s, d) => s + Number(d.amount), 0);
    const totalWithdrawals = withdrawals.reduce((s, w) => s + Number(w.amount), 0);

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
// ADMIN: LIST CASHIERS
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
// CASHIER: GET REFERRAL LINK
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
// CASHIER: GET MY REFERRALS
// =====================================================
exports.cashierGetMyReferrals = async (req, res) => {
  try {
    const cashierId = req.user.id;

    const referredUsers = await User.find({ referredBy: cashierId })
      .select('username email phone wallet referralCode referredBy createdAt status')
      .sort({ createdAt: -1 });

    const usersWithStats = await Promise.all(
      referredUsers.map(async (u) => {
        let deposits = [];
        let withdrawals = [];

        if (Deposit) {
          try { deposits = await Deposit.find({ user: u._id, status: 'approved' }); } catch (e) {}
        }
        if (Withdrawal) {
          try { withdrawals = await Withdrawal.find({ user: u._id, status: 'approved' }); } catch (e) {}
        }

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
          bonusBalance: u.wallet?.bonusBalance || 0,
          totalDeposits,
          totalWithdrawals,
          depositCount: deposits.length,
          withdrawalCount: withdrawals.length,
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
// ADMIN: GET CASHIER REFERRALS
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
        let deposits = [];
        let withdrawals = [];
        if (Deposit) { try { deposits = await Deposit.find({ user: u._id, status: 'approved' }); } catch (e) {} }
        if (Withdrawal) { try { withdrawals = await Withdrawal.find({ user: u._id, status: 'approved' }); } catch (e) {} }

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

console.log('✅ Cashier controller loaded');