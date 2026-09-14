// backend/src/controllers/authController.js
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// =====================================================
// @desc    Register user (with referral support)
// @route   POST /api/auth/register
// =====================================================
exports.register = async (req, res) => {
  try {
    const { username, email, phone, password, referralCode, referredBy } = req.body;

    // ✅ Accept BOTH 'referralCode' and 'referredBy' (frontend compatibility)
    const incomingReferralCode = (referralCode || referredBy || '').trim().toUpperCase();

    console.log('📝 Register attempt:', { username, email, phone, incomingReferralCode });

    // Validate required fields
    if (!username || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }, { phone }]
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        return res.status(400).json({ success: false, message: "Email already exists" });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ success: false, message: "Username already exists" });
      }
      if (existingUser.phone === phone) {
        return res.status(400).json({ success: false, message: "Phone number already exists" });
      }
    }

    // ✅ Find referrer if referral code provided
    let referrerId = null;
    let referrerUsername = null;
    let referrerRole = null;

    if (incomingReferralCode) {
      const referrer = await User.findOne({ referralCode: incomingReferralCode });

      if (referrer) {
        referrerId = referrer._id;
        referrerUsername = referrer.username;
        referrerRole = referrer.role;
        console.log(`✅ New user referred by: ${referrer.username} (${referrer.role})`);
      } else {
        console.log(`⚠️ Invalid referral code: ${incomingReferralCode}`);
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ✅ Create user (referralCode auto-generated in pre-save hook)
    const user = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      role: "user",
      status: "active",
      referredBy: referrerId,
      wallet: {
        balance: 20,
        bonusBalance: 0,
        lockedBalance: 0,
        welcomeBonusClaimed: true
      }
    });

    await user.save();

    // ✅ Add this new user to referrer's referrals array
    if (referrerId) {
      await User.findByIdAndUpdate(referrerId, {
        $push: { referrals: user._id },
        $set: { 'cashierInfo.lastActivity': new Date() }
      });
      console.log(`✅ Added ${user.username} to ${referrerUsername}'s referrals list`);
    }

    // Create token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "mysecretkey123",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: referrerUsername
        ? `Welcome! You were invited by ${referrerUsername}.`
        : "User registered successfully",
      token,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        referralCode: user.referralCode,
        wallet: user.wallet,
        referredBy: user.referredBy
      },
      referrer: referrerUsername ? {
        username: referrerUsername,
        role: referrerRole
      } : null
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message
    });
  }
};

// =====================================================
// @desc    Login user
// @route   POST /api/auth/login
// =====================================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: email }]
    }).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ success: false, message: "Account is not active. Please contact admin." });
    }

    // Update last login
    await user.updateLogin();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "mysecretkey123",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        referralCode: user.referralCode,
        wallet: user.wallet
      }
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message
    });
  }
};

// =====================================================
// @desc    Get current user
// @route   GET /api/auth/me
// =====================================================
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        wallet: user.wallet,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("❌ Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user",
      error: error.message
    });
  }
};

// =====================================================
// @desc    Check if phone exists
// @route   POST /api/auth/check-phone
// =====================================================
exports.checkPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    const existingUser = await User.findOne({ phone });
    res.json({
      success: true,
      exists: !!existingUser
    });
  } catch (error) {
    console.error("❌ Check phone error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check phone",
      error: error.message
    });
  }
};

// =====================================================
// @desc    Check if referral code is valid
// @route   GET /api/auth/check-referral/:code
// =====================================================
exports.checkReferral = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ success: false, message: "Referral code required" });
    }

    const referrer = await User.findOne({
      referralCode: code.trim().toUpperCase()
    }).select('username role');

    if (!referrer) {
      return res.json({
        success: false,
        message: "Invalid referral code"
      });
    }

    return res.json({
      success: true,
      username: referrer.username,
      role: referrer.role
    });
  } catch (error) {
    console.error("❌ Check referral error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check referral",
      error: error.message
    });
  }
};

// =====================================================
// @desc    Get referral info (code + referred friends)
// @route   GET /api/user/referral-info
// =====================================================
exports.getReferralInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId)
      .populate('referrals', 'username email createdAt status');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Map referrals to frontend format
    const referrals = (user.referrals || []).map(ref => ({
      username: ref.username,
      email: ref.email,
      createdAt: ref.createdAt,
      status: ref.status === 'active' ? 'Active' : 'Inactive'
    }));

    res.json({
      success: true,
      referralCode: user.referralCode || '',
      referrals: referrals
    });
  } catch (error) {
    console.error('❌ Error fetching referral info:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};