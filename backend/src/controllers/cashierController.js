// backend/controllers/cashierController.js
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');
const bcrypt = require('bcryptjs');

// =====================================================
// CASHIER: CREATE DEPOSIT FOR A USER
// =====================================================
exports.cashierCreateDeposit = async (req, res) => {
  try {
    const { username, amount, notes } = req.body;
    const cashierId = req.user.id;

    if (!username || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Username and valid amount are required' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const oldBalance = user.wallet?.balance || 0;
    user.wallet.balance = oldBalance + Number(amount);
    await user.save();

    const deposit = await Deposit.create({
      user: user._id,
      amount: Number(amount),
      paymentMethod: 'CASHIER',
      transactionReference: `CASHIER-${Date.now()}`,
      notes: notes || `Deposit by cashier ${req.user.username}`,
      status: 'approved',
      processedBy: cashierId,
      processedAt: new Date()
    });

    return res.json({
      success: true,
      message: `Deposited ETB ${amount} to ${username}`,
      newBalance: user.wallet.balance,
      deposit
    });
  } catch (error) {
    console.error('Cashier deposit error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// CASHIER: WITHDRAW FROM A USER
// =====================================================
exports.cashierCreateWithdrawal = async (req, res) => {
  try {
    const { username, amount, notes } = req.body;
    const cashierId = req.user.id;

    if (!username || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Username and valid amount are required' });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const currentBalance = user.wallet?.balance || 0;
    if (currentBalance < Number(amount)) {
      return res.status(400).json({ success: false, message: 'User has insufficient balance' });
    }

    user.wallet.balance = currentBalance - Number(amount);
    await user.save();

    const withdrawal = await Withdrawal.create({
      user: user._id,
      amount: Number(amount),
      paymentMethod: 'CASHIER',
      status: 'approved',
      notes: notes || `Withdrawal by cashier ${req.user.username}`,
      processedBy: cashierId,
      processedAt: new Date()
    });

    return res.json({
      success: true,
      message: `Withdrew ETB ${amount} from ${username}`,
      newBalance: user.wallet.balance,
      withdrawal
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

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ success: false, message: 'User already exists' });

    // Auto-generate phone if not provided (required field, must be unique)
    let finalPhone = phone && phone.trim() ? phone.trim() : `CASH-${Date.now()}`;

    // Ensure the auto-generated phone is unique
    if (!phone || !phone.trim()) {
      const phoneCheck = await User.findOne({ phone: finalPhone });
      if (phoneCheck) finalPhone = `CASH-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique referral code
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
      // ✅ Track that this cashier created this user
      referredBy: req.user.id,
      wallet: {
        balance: Number(initialBalance) || 0,
        bonusBalance: 0,
        lockedBalance: 0,
        welcomeBonusClaimed: true
      }
    });

    // ✅ Add this user to the cashier's referrals array so they appear in "My Referrals"
    await User.findByIdAndUpdate(
      req.user.id,
      {
        $push: { referrals: newUser._id },
        $inc: { 'cashierInfo.totalUsersCreated': 1 },
        $set: { 'cashierInfo.lastActivity': new Date() }
      }
    );

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

    const filter = { processedBy: cashierId };
    if (startDate || endDate) {
      filter.processedAt = {};
      if (startDate) filter.processedAt.$gte = new Date(startDate);
      if (endDate) filter.processedAt.$lte = new Date(endDate);
    }

    const deposits = await Deposit.find({ ...filter }).populate('user', 'username email');
    const withdrawals = await Withdrawal.find({ ...filter }).populate('user', 'username email');

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
// CASHIER: LOOKUP USER (search by username/email/phone)
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
// ADMIN: ASSIGN CASHIER ROLE
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
// ADMIN: REMOVE CASHIER ROLE
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
// ADMIN: LIST CANDIDATE USERS (to become cashiers)
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
// ✅ CASHIER: GET MY REFERRAL LINK
// =====================================================
exports.cashierGetReferralLink = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const user = await User.findById(cashierId).select('username referralCode');

    if (!user) return res.status(404).json({ success: false, message: 'Cashier not found' });

    // If cashier has no referral code, generate one
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
// ✅ CASHIER: GET USERS REGISTERED WITH MY REFERRAL
// Returns each referred user with deposits, withdrawals, balance
// =====================================================
exports.cashierGetMyReferrals = async (req, res) => {
  try {
    const cashierId = req.user.id;

    // Find all users who were referred by this cashier
    const referredUsers = await User.find({ referredBy: cashierId })
      .select('username email phone wallet referralCode referredBy createdAt status')
      .sort({ createdAt: -1 });

    // For each referred user, get deposits and withdrawals totals
    const usersWithStats = await Promise.all(
      referredUsers.map(async (u) => {
        const deposits = await Deposit.find({ user: u._id, status: 'approved' });
        const withdrawals = await Withdrawal.find({ user: u._id, status: 'approved' });

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

    // Totals across all referred users
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
// ✅ ADMIN: GET ANY CASHIER'S REFERRALS (for admin view)
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
        const deposits = await Deposit.find({ user: u._id, status: 'approved' });
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

console.log('✅ Cashier controller loaded with referral system');