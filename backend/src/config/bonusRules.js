// backend/src/config/bonusRules.js
module.exports = {
  minSelections: 7,           // Minimum 7 selections
  minOddsPerSelection: 1.60,  // Each selection must have odds ≥ 1.60
  maxStakePerBet: 20,         // Maximum stake with bonus
  rolloverMultiplier: 3,      // 20 × 3 = 60 ETB rollover target

  blockedMarkets: [
    // Optional: block specific markets from bonus bets
    // 'Correct Score',
    // 'First Goal Time',
  ],
};