const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// @desc    Register user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    // Check if user exists (including phone)
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }, { phone }] 
    });
    
    if (existingUser) {
      // Determine which field already exists
      if (existingUser.email === email) {
        return res.status(400).json({ 
          success: false, 
          message: "Email already exists" 
        });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ 
          success: false, 
          message: "Username already exists" 
        });
      }
      if (existingUser.phone === phone) {
        return res.status(400).json({ 
          success: false, 
          message: "Phone number already exists" 
        });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with phone number
    const user = await User.create({
      username,
      email,
      phone, // Add phone number
      password: hashedPassword,
      role: "user", // Default role
      status: "active", // Default status
      wallet: {
        balance: 0,
        bonusBalance: 0,
        lockedBalance: 0
      }
    });

    // Create token
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
        phone: user.phone, // Include phone in response
        role: user.role,
        status: user.status
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

    // Find user (can also login with phone in future)
    const user = await User.findOne({ 
      $or: [{ email }, { phone: email }] // Allow login with email or phone
    }).select("+password");
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Check if user is active
    if (user.status !== "active") {
      return res.status(403).json({ 
        success: false, 
        message: "Account is not active. Please contact admin." 
      });
    }

    // Create token
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
        phone: user.phone, // Include phone in response
        role: user.role,
        status: user.status
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
        phone: user.phone, // Include phone in response
        role: user.role,
        status: user.status,
        wallet: user.wallet, // Include wallet info
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

// @desc    Check if phone exists (optional endpoint)
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