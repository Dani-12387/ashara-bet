// backend/src/utils/bonusHelper.js
const bonusRules = require('../config/bonusRules');

// =====================================================
// Validate a bet against bonus rules
// Returns: { allowed: bool, errors: [] }
// =====================================================
exports.validateBonusBet = (bets, totalStake) => {
  const errors = [];

  // 1. Minimum selections
  if (!bets || bets.length < bonusRules.minSelections) {
    errors.push(
      `Bonus bet requires at least ${bonusRules.minSelections} selections (you have ${bets?.length || 0})`
    );
  }

  // 2. Each selection odds ≥ 1.60
  if (bets && bets.length > 0) {
    for (let i = 0; i < bets.length; i++) {
      const sel = bets[i];
      const odds = Number(sel.odds || 0);

      if (odds < bonusRules.minOddsPerSelection) {
        errors.push(
          `Selection #${i + 1} (${sel.betType || 'N/A'} @ ${sel.match || ''}) has odds ${odds} — must be ≥ ${bonusRules.minOddsPerSelection}`
        );
      }
    }
  }

  // 3. Stake ≤ 20
  const stake = Number(totalStake || 0);
  if (stake > bonusRules.maxStakePerBet) {
    errors.push(
      `Bonus bet stake cannot exceed ETB ${bonusRules.maxStakePerBet} (you entered ETB ${stake})`
    );
  }

  // 4. Blocked markets
  if (bets && bets.length > 0) {
    for (const sel of bets) {
      if (bonusRules.blockedMarkets && bonusRules.blockedMarkets.includes(sel.market)) {
        errors.push(`Market "${sel.market}" is not allowed with bonus balance`);
      }
    }
  }

  return {
    allowed: errors.length === 0,
    errors,
  };
};

// =====================================================
// ✅ FIXED: Calculate funding split — includes BOTH balances
// =====================================================
exports.calculateFundingSplit = (user, stake) => {
  // ✅ Read BOTH balances
  const bonusAvailable = user.wallet?.bonusBalance || 0;
  const realAvailable = user.wallet?.balance || 0;
  const totalAvailable = bonusAvailable + realAvailable;

  // ✅ Debug logging so you can see in Render logs
  console.log('💰 calculateFundingSplit:', {
    realAvailable,
    bonusAvailable,
    totalAvailable,
    requestedStake: stake,
  });

  if (stake > totalAvailable) {
    return {
      valid: false,
      message: `Insufficient balance. Available: ETB ${totalAvailable.toFixed(2)} (real: ${realAvailable.toFixed(2)}, bonus: ${bonusAvailable.toFixed(2)})`,
    };
  }

  // ✅ Bonus is used FIRST, then real balance
  const bonusPortion = Math.min(stake, bonusAvailable);
  const realPortion = stake - bonusPortion;

  return {
    valid: true,
    bonusPortion,
    realPortion,
    usesBonus: bonusPortion > 0,
    usesReal: realPortion > 0,
    totalAvailable,
  };
};

// =====================================================
// Deduct balance after placing bet
// =====================================================
exports.deductBetBalance = (user, split) => {
  const oldBalance = user.wallet?.balance || 0;
  const oldBonus = user.wallet?.bonusBalance || 0;

  user.wallet.balance = oldBalance - split.realPortion;
  user.wallet.bonusBalance = oldBonus - split.bonusPortion;

  // Track wagered bonus (for rollover) — optional
  if (split.bonusPortion > 0) {
    user.wallet.bonusWagered = (user.wallet?.bonusWagered || 0) + split.bonusPortion;
  }

  console.log('💸 deductBetBalance:', {
    oldBalance,
    oldBonus,
    newBalance: user.wallet.balance,
    newBonus: user.wallet.bonusBalance,
  });

  return user;
};

// =====================================================
// Credit winnings after a bet wins
// =====================================================
exports.creditBetWinnings = (user, split, winAmount) => {
  const totalStake = split.bonusPortion + split.realPortion;
  if (totalStake === 0) return user;

  const bonusRatio = split.bonusPortion / totalStake;
  const realRatio = split.realPortion / totalStake;

  const bonusWinnings = winAmount * bonusRatio;
  const realWinnings = winAmount * realRatio;

  user.wallet.bonusBalance += bonusWinnings;
  user.wallet.balance += realWinnings;

  return user;
};