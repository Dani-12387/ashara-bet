// backend/src/controllers/betController.js
const User = require('../models/User');
const Bet = require('../models/Bet');
const {
  validateBonusBet,
  calculateFundingSplit,
  deductBetBalance,
} = require('../utils/bonusHelper');

// ✅ Generate unique 10-digit ticket ID
const generateTicketId = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

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

    // ===== DEDUCT BALANCE =====
    deductBetBalance(user, split);
    await user.save();

    // ===== PREPARE SELECTIONS (map frontend 'bets' → model 'selections') =====
    const selections = bets.map(b => ({
      matchId: b.matchId,
      match: b.match,
      league: b.league || 'Unknown',
      betType: b.betType,
      market: b.market || 'Result',
      odds: Number(b.odds),
      status: 'pending'
    }));

    // ===== GENERATE TICKET ID =====
    const ticketId = generateTicketId();

    // ===== SAVE BET RECORD =====
    const betRecord = await Bet.create({
      user: userId,
      ticketId: ticketId,
      selections: selections,           // ✅ Correct field name
      totalStake: stake,
      totalOdds: Number(totalOdds),
      potentialWin: stake * Number(totalOdds),
      status: 'pending',
      result: 'pending',
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
      ticketId: ticketId,
      fundingBreakdown: {
        fromBonus: split.bonusPortion,
        fromReal: split.realPortion,
      },
      newBalance: user.wallet.balance,
      newBonusBalance: user.wallet.bonusBalance,
    });
  } catch (error) {
    console.error('❌ Place bets error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};