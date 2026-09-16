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
      if (bonusRules.blockedMarkets.includes(sel.market)) {
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
// Calculate funding split (bonus first, real second)
// =====================================================
exports.calculateFundingSplit = (user, stake) => {
  const bonusAvailable = user.wallet?.bonusBalance || 0;
  const realAvailable = user.wallet?.balance || 0;
  const totalAvailable = bonusAvailable + realAvailable;

  if (stake > totalAvailable) {
    return {
      valid: false,
      message: `Insufficient balance. Available: ETB ${totalAvailable.toFixed(2)}`,
    };
  }

  // Bonus is used FIRST
  const bonusPortion = Math.min(stake, bonusAvailable);
  const realPortion = stake - bonusPortion;

  return {
    valid: true,
    bonusPortion,
    realPortion,
    usesBonus: bonusPortion > 0,
    usesReal: realPortion > 0,
  };
};

// =====================================================
// Deduct balance after placing bet
// =====================================================
exports.deductBetBalance = (user, split) => {
  user.wallet.balance = (user.wallet?.balance || 0) - split.realPortion;
  user.wallet.bonusBalance = (user.wallet?.bonusBalance || 0) - split.bonusPortion;

  // Track wagered bonus (for rollover)
  if (split.bonusPortion > 0) {
    user.wallet.bonusWagered = (user.wallet?.bonusWagered || 0) + split.bonusPortion;

    // Check rollover complete
    const target = user.wallet.bonusRolloverTarget || 0;
    if (user.wallet.bonusWagered >= target && !user.wallet.bonusConvertedToReal) {
      const remaining = user.wallet.bonusBalance || 0;
      if (remaining > 0) {
        user.wallet.balance += remaining;
        user.wallet.bonusBalance = 0;
      }
      user.wallet.bonusConvertedToReal = true;
    }
  }

  return user;
};

module.exports = exports;