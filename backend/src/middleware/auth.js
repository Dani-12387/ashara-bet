const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'No token, authorization denied' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // ✅ Get user from database
    const user = await User.findById(decoded.id || decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // ✅ Ensure minimum balance of 20
    let balanceUpdated = false;
    if (user.wallet.balance < 20) {
      user.wallet.balance = 20;
      balanceUpdated = true;
    }

    // ✅ Update last login
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;

    // ✅ Save if any changes
    if (balanceUpdated || user.isModified()) {
      await user.save();
      if (balanceUpdated) {
        console.log(`✅ Balance reset to 20 for ${user.username}`);
      }
    }

    // ✅ Attach full user data to request
    req.user = {
      id: user._id,
      userId: user._id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      balance: user.wallet.balance,
      wallet: user.wallet,
      profile: user.profile,
      kyc: user.kyc,
      createdAt: user.createdAt
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    res.status(401).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};