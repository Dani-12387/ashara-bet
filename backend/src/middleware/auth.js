const jwt = require('jsonwebtoken');
const User = require('../models/User');

// =====================================================
// MAIN AUTH MIDDLEWARE
// Verifies JWT and attaches req.user (without password)
// =====================================================
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token, authorization denied' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey123');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // ✅ Check if user account is suspended or inactive
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Contact support.'
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Contact support.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Token is not valid' 
    });
  }
};

// =====================================================
// PROTECT (alias for auth – same logic)
// Use this in new code for clarity
// =====================================================
const protect = auth;

// =====================================================
// IS ADMIN MIDDLEWARE
// Must be used AFTER 'auth' / 'protect'
// =====================================================
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.'
    });
  }

  next();
};

// =====================================================
// IS CASHIER MIDDLEWARE
// Allows both 'cashier' AND 'admin' (admin has all privileges)
// =====================================================
const isCashier = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  if (req.user.role !== 'cashier' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Cashier only.'
    });
  }

  next();
};

// =====================================================
// IS ADMIN OR CASHIER (same as isCashier but explicit name)
// =====================================================
const isAdminOrCashier = isCashier;

// =====================================================
// IS MANAGER MIDDLEWARE (in case you use 'manager' role)
// =====================================================
const isManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  if (req.user.role !== 'manager' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Manager only.'
    });
  }

  next();
};

// =====================================================
// IS SUPPORT MIDDLEWARE (in case you use 'support' role)
// =====================================================
const isSupport = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  if (
    req.user.role !== 'support' && 
    req.user.role !== 'admin' && 
    req.user.role !== 'manager'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Support only.'
    });
  }

  next();
};

// =====================================================
// EXPORTS
// We export the main function as default (backward-compatible)
// AND attach named exports so both styles work:
//   const auth = require('./middleware/auth');          ✅
//   const { protect, isAdmin } = require('./middleware/auth'); ✅
// =====================================================

module.exports = auth;

// Named exports
module.exports.auth = auth;
module.exports.protect = protect;
module.exports.isAdmin = isAdmin;
module.exports.isCashier = isCashier;
module.exports.isAdminOrCashier = isAdminOrCashier;
module.exports.isManager = isManager;
module.exports.isSupport = isSupport;