// middleware/ensureBalance.js
const User = require('../models/User');

const ensureBalance = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    
    if (!userId) {
      return next();
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return next();
    }

    // ✅ Ensure minimum balance of 20
    if (user.wallet.balance < 20) {
      user.wallet.balance = 20;
      await user.save();
      console.log(`✅ Balance updated to 20 for ${user.username}`);
      
      // Update the balance in req.user
      if (req.user) {
        req.user.balance = 20;
        req.user.wallet = user.wallet;
      }
    }

    next();
  } catch (error) {
    console.error('Balance check error:', error);
    next();
  }
};

module.exports = ensureBalance;