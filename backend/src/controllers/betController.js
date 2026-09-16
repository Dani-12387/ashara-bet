// backend/src/controllers/betController.js
const User = require('../models/User');
const Bet = require('../models/Bet');
const {
  validateBonusBet,
  calculateFundingSplit,
  deductBetBalance,
} = require('../utils/bonusHelper');

// =====================================================
// PLACE BETS
// =====================================================
exports.placeBets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bets, totalStake, totalOdds } = req.body;

    // ===== BASIC VALIDATION =====
    if (!bets || bets.length === 0) {
      return res.status(400).json({ success: false, message: 'No bets to place' });
    }

    const stake = Number(totalStake);
    if (!stake || stake <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid stake amount' });
    }

    // ===== LOAD USER =====
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ===== CALCULATE FUNDING SPLIT (bonus first, then real) =====
    const split = calculateFundingSplit(user, stake);

    if (!split.valid) {
      return res.status(400).json({
        success: false,
        message: split.message,
        errors: [split.message],
      });
    }

    // ===== IF USING BONUS → CHECK BONUS RULES =====
    if (split.usesBonus) {
      const bonusCheck = validateBonusBet(bets, stake);

      if (!bonusCheck.allowed) {
        return res.status(400).json({
          success: false,
          message: '🎁 Bonus bet rules not satisfied',
          errors: bonusCheck.errors,
        });
      }
    }

    // ✅ If only using real balance → NO restrictions

    // ===== DEDUCT BALANCE =====
    deductBetBalance(user, split);
    await user.save();

    // ===== SAVE BET RECORD =====
    const betRecord = await Bet.create({
      user: userId,
      bets,
      totalStake: stake,
      totalOdds: Number(totalOdds),
      potentialWin: stake * Number(totalOdds),
      status: 'pending',
      fundedBy: split.usesBonus && split.usesReal ? 'mixed'
               : split.usesBonus ? 'bonus'
               : 'real',
      bonusPortion: split.bonusPortion,
      realPortion: split.realPortion,
    });

    return res.json({
      success: true,
      message: split.usesBonus
        ? `✅ Bet placed with ETB ${split.bonusPortion.toFixed(2)} bonus${split.realPortion > 0 ? ` + ETB ${split.realPortion.toFixed(2)} real` : ''}`
        : `✅ Bet placed with real balance`,
      betId: betRecord._id,
      fundingBreakdown: {
        fromBonus: split.bonusPortion,
        fromReal: split.realPortion,
      },
      newBalance: user.wallet.balance,
      newBonusBalance: user.wallet.bonusBalance,
      bonusWagered: user.wallet.bonusWagered,
      rolloverTarget: user.wallet.bonusRolloverTarget,
    });
  } catch (error) {
    console.error('❌ Place bets error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};