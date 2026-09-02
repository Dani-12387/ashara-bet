const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// @desc    Register user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { username, email, phone, password, referralCode } = req.body;

    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }, { phone }] 
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ success: false, message: "Email already exists" });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ success: false, message: "Username already exists" });
      }
      if (existingUser.phone === phone) {
        return res.status(400).json({ success: false, message: "Phone number already exists" });
      }
    }

    let referredBy = null;
    if (referralCode && referralCode.trim()) {
      const referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
      if (referrer) {
        referredBy = referrer._id;
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email,
      phone,
      password: hashedPassword,
      role: "user",
      status: "active",
      referredBy
    });

    await user.save();

    if (referredBy) {
      await User.findByIdAndUpdate(referredBy, {
        $push: { referrals: user._id }
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "mysecretkey123",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Registration failed", 
      error: error.message 
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ 
      $or: [{ email }, { phone: email }] 
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
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Login failed", 
      error: error.message 
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
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
        wallet: user.wallet,
        referralCode: user.referralCode,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to get user", 
      error: error.message 
    });
  }
};

// @desc    Check if phone exists
// @route   POST /api/auth/check-phone
exports.checkPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    const existingUser = await User.findOne({ phone });
    res.json({
      success: true,
      exists: !!existingUser
    });
  } catch (error) {
    console.error("Check phone error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to check phone", 
      error: error.message 
    });
  }
};

// ✅ REFERRAL INFO – properly exported
exports.getReferralInfo = async (req, res) => {
  try {
    console.log('🔍 Fetching referral info for user:', req.user.id);
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate('referrals', 'username email createdAt status');

    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('✅ User found, referralCode:', user.referralCode);
    console.log('✅ Referrals count:', user.referrals?.length || 0);

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