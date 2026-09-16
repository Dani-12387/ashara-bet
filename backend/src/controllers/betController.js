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

    // =====================================================
    // ✅ DUPLICATE CHECK #1 — Same matchId already in a pending bet
    // =====================================================
    const matchIds = bets.map(b => b.matchId).filter(id => id);

    if (matchIds.length > 0) {
      const existingBets = await Bet.find({
        user: userId,
        status: 'pending',
        'selections.matchId': { $in: matchIds }
      });

      if (existingBets.length > 0) {
        const existingMatchIds = new Set();
        existingBets.forEach(bet => {
          bet.selections.forEach(sel => {
            if (sel.matchId && matchIds.includes(sel.matchId.toString())) {
              existingMatchIds.add(sel.matchId.toString());
            }
          });
        });

        const duplicateMatches = bets
          .filter(b => b.matchId && existingMatchIds.has(b.matchId.toString()))
          .map(b => b.match);

        console.log('⚠️ Duplicate match bet blocked:', duplicateMatches);

        return res.status(400).json({
          success: false,
          message: `You already have a pending bet on: ${duplicateMatches.join(', ')}`,
          errors: [
            `You already placed a bet on these matches. Wait for them to settle before betting again.`,
            ...duplicateMatches.map(m => `• ${m}`)
          ]
        });
      }
    }

    // =====================================================
    // ✅ DUPLICATE CHECK #2 — Same bet in last 30 seconds
    // =====================================================
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

    const recentBet = await Bet.findOne({
      user: userId,
      totalStake: stake,
      totalOdds: Number(totalOdds),
      createdAt: { $gte: thirtySecondsAgo }
    });

    if (recentBet) {
      console.log('⚠️ Duplicate bet blocked:', recentBet.ticketId);
      return res.status(429).json({
        success: false,
        message: '⚠️ You just placed this bet. Please wait 30 seconds.',
        ticketId: recentBet.ticketId,
      });
    }

    // ===== CALCULATE FUNDING SPLIT =====
    const split = calculateFundingSplit(user, stake);

    if (!split.valid) {
      return res.status(400).json({
        success: false,
        message: split.message,
        errors: [split.message],
      });
    }

    // ===== BONUS RULES CHECK =====
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

    // ===== PREPARE SELECTIONS =====
    const selections = bets.map(b => ({
      matchId: b.matchId,
      match: b.match,
      league: b.league || 'Unknown',
      betType: b.betType,
      market: b.market || 'Result',
      odds: Number(b.odds),
      status: 'pending'
    }));

    // ===== SAVE BET =====
    const ticketId = generateTicketId();

    const betRecord = await Bet.create({
      user: userId,
      ticketId: ticketId,
      selections: selections,
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

    console.log('✅ Bet placed:', { ticketId, selections: selections.length });

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

// =====================================================
// ✅ GET PENDING MATCH IDS — matches user already bet on
// Used by frontend to disable those matches
// =====================================================
exports.getPendingMatchIds = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all pending bets for this user
    const pendingBets = await Bet.find({
      user: userId,
      status: 'pending'
    }).select('selections.matchId');

    // Extract match IDs into a flat array
    const matchIds = [];
    pendingBets.forEach(bet => {
      bet.selections.forEach(sel => {
        if (sel.matchId) {
          matchIds.push(sel.matchId.toString());
        }
      });
    });

    res.json({
      success: true,
      matchIds: [...new Set(matchIds)],   // unique
      count: matchIds.length
    });
  } catch (error) {
    console.error('❌ getPendingMatchIds error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};