import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MatchesManagement.css';

const MatchesManagement = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [filters, setFilters] = useState({
    sport: 'FOOTBALL',
    status: '',
    dateFrom: '',
    dateTo: ''
  });
  
  // State for live odds
  const [liveOdds, setLiveOdds] = useState([]);
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [showLiveOdds, setShowLiveOdds] = useState(false);
  const [oddsError, setOddsError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Sport mapping
  const sportMapping = {
    'FOOTBALL': 'soccer_epl',
    'BASKETBALL': 'basketball_nba',
    'TENNIS': 'tennis_atp',
    'CRICKET': 'cricket_t20_blast'
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  const factorial = (n) => {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  };

  const poisson = (lambda, k) => {
    if (k === 0) return Math.exp(-lambda);
    if (lambda === 0) return k === 0 ? 1 : 0;
    return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
  };

  const cumulativePoisson = (lambda, maxK) => {
    let sum = 0;
    for (let i = 0; i <= maxK; i++) {
      sum += poisson(lambda, i);
    }
    return sum;
  };

  const odds = (probability, margin = 0.95) => {
    if (probability <= 0 || probability > 1) return 999.0;
    return (1 / probability) * margin;
  };

  // ============================================
  // GENERATE ALL 82 MARKETS using Poisson Distribution
  // ============================================
  const generateAllMarkets = (homeOdds, drawOdds, awayOdds) => {
    // Parse odds
    const h = parseFloat(homeOdds) || 2.0;
    const d = parseFloat(drawOdds) || 3.5;
    const a = parseFloat(awayOdds) || 2.5;

    if (h <= 0 || d <= 0 || a <= 0) {
      return generateDefaultMarkets();
    }

    // Calculate probabilities (remove bookmaker margin)
    const totalProb = (1 / h + 1 / d + 1 / a);
    const homeProb = (1 / h) / totalProb;
    const drawProb = (1 / d) / totalProb;
    const awayProb = (1 / a) / totalProb;

    // Poisson parameters (league average ~2.8 goals per match)
    const leagueAvgGoals = 2.8;
    const totalExpectedGoals = (homeProb + awayProb) * leagueAvgGoals;
    const homeExpectedGoals = totalExpectedGoals * (homeProb / (homeProb + awayProb));
    const awayExpectedGoals = totalExpectedGoals - homeExpectedGoals;
    const totalGoalsDist = homeExpectedGoals + awayExpectedGoals;

    // Half-time parameters (~55% of total goals)
    const halfExpectedGoals = totalExpectedGoals * 0.55;
    const halfHomeGoals = homeExpectedGoals * 0.55;
    const halfAwayGoals = awayExpectedGoals * 0.55;
    const halfTotalGoals = halfHomeGoals + halfAwayGoals;

    // BTTS probability
    const bttsYes = (1 - poisson(homeExpectedGoals, 0)) * (1 - poisson(awayExpectedGoals, 0));
    const bttsNo = 1 - bttsYes;

    // Clean sheet probabilities
    const homeCleanSheetProb = poisson(awayExpectedGoals, 0);
    const awayCleanSheetProb = poisson(homeExpectedGoals, 0);

    // Over/Under calculations
    const ou = (threshold) => {
      const under = cumulativePoisson(totalGoalsDist, threshold);
      const over = 1 - under;
      return { over: odds(over), under: odds(under) };
    };

    const ouHalf = (threshold) => {
      const under = cumulativePoisson(halfTotalGoals, threshold);
      const over = 1 - under;
      return { over: odds(over), under: odds(under) };
    };

    // Correct score probabilities
    const correctScoreProbs = {};
    const scoreLines = ['0-0', '1-0', '2-0', '2-1', '3-0', '3-1', '3-2', '1-1', '2-2', '0-1', '0-2', '1-2', '0-3'];
    scoreLines.forEach(score => {
      const [hg, ag] = score.split('-').map(Number);
      correctScoreProbs[score] = poisson(homeExpectedGoals, hg) * poisson(awayExpectedGoals, ag);
    });

    // First half correct score
    const halfCorrectScoreProbs = {};
    scoreLines.forEach(score => {
      const [hg, ag] = score.split('-').map(Number);
      halfCorrectScoreProbs[score] = poisson(halfHomeGoals, hg) * poisson(halfAwayGoals, ag);
    });

    // Second half correct score
    const secondHalfCorrectScoreProbs = {};
    const secondHalfHomeGoals = homeExpectedGoals * 0.45;
    const secondHalfAwayGoals = awayExpectedGoals * 0.45;
    scoreLines.forEach(score => {
      const [hg, ag] = score.split('-').map(Number);
      secondHalfCorrectScoreProbs[score] = poisson(secondHalfHomeGoals, hg) * poisson(secondHalfAwayGoals, ag);
    });

    // ============================================
    // RETURN ALL 82 MARKETS
    // ============================================
    return {
      // ===== 1. MAIN MATCH RESULT =====
      result: { 'Home': h, 'Draw': d, 'Away': a },

      // ===== 2. BOTH TEAMS TO SCORE (BTTS) =====
      btts: {
        'Yes': odds(bttsYes),
        'No': odds(bttsNo)
      },

      // ===== 3. DOUBLE CHANCE =====
      doubleChance: {
        '1X': odds(homeProb + drawProb),
        '12': odds(homeProb + awayProb),
        'X2': odds(drawProb + awayProb)
      },

      // ===== 4. OVER / UNDER GOALS =====
      totalGoals: {
        'Over 0.5': ou(0).over,
        'Under 0.5': ou(0).under,
        'Over 1.5': ou(1).over,
        'Under 1.5': ou(1).under,
        'Over 2.5': ou(2).over,
        'Under 2.5': ou(2).under,
        'Over 3.5': ou(3).over,
        'Under 3.5': ou(3).under,
        'Over 4.5': ou(4).over,
        'Under 4.5': ou(4).under
      },

      // ===== 5. CORRECT SCORE =====
      correctScore: {
        '0-0': odds(correctScoreProbs['0-0']),
        '1-0': odds(correctScoreProbs['1-0']),
        '2-0': odds(correctScoreProbs['2-0']),
        '2-1': odds(correctScoreProbs['2-1']),
        '3-0': odds(correctScoreProbs['3-0']),
        '3-1': odds(correctScoreProbs['3-1']),
        '3-2': odds(correctScoreProbs['3-2']),
        '1-1': odds(correctScoreProbs['1-1']),
        '2-2': odds(correctScoreProbs['2-2']),
        '0-1': odds(correctScoreProbs['0-1']),
        '0-2': odds(correctScoreProbs['0-2']),
        '1-2': odds(correctScoreProbs['1-2']),
        '0-3': odds(correctScoreProbs['0-3']),
        'Any Other Home Win': odds(1 - cumulativePoisson(homeExpectedGoals, 3) * cumulativePoisson(awayExpectedGoals, 3)),
        'Any Other Away Win': odds(1 - cumulativePoisson(homeExpectedGoals, 3) * cumulativePoisson(awayExpectedGoals, 3)),
        'Any Other Draw': odds(1 - (correctScoreProbs['0-0'] + correctScoreProbs['1-1'] + correctScoreProbs['2-2']))
      },

      // ===== 6. FIRST HALF RESULT =====
      firstHalfResult: {
        'Home': odds(homeProb * (1 + (1 - homeProb) * 0.3)),
        'Draw': odds(drawProb * (1 + (1 - drawProb) * 0.2)),
        'Away': odds(awayProb * (1 + (1 - awayProb) * 0.3))
      },

      // ===== 7. HALF TIME / FULL TIME =====
      halfTimeFullTime: {
        'Home/Home': odds(homeProb * homeProb * 1.2),
        'Home/Draw': odds(homeProb * drawProb * 3.5),
        'Home/Away': odds(homeProb * awayProb * 8),
        'Draw/Home': odds(drawProb * homeProb * 1.6),
        'Draw/Draw': odds(drawProb * drawProb * 1.3),
        'Draw/Away': odds(drawProb * awayProb * 2.0),
        'Away/Home': odds(awayProb * homeProb * 7),
        'Away/Draw': odds(awayProb * drawProb * 3.5),
        'Away/Away': odds(awayProb * awayProb * 1.2)
      },

      // ===== 8. FIRST HALF CORRECT SCORE =====
      firstHalfCorrectScore: {
        '0-0': odds(halfCorrectScoreProbs['0-0']),
        '1-0': odds(halfCorrectScoreProbs['1-0']),
        '2-0': odds(halfCorrectScoreProbs['2-0']),
        '2-1': odds(halfCorrectScoreProbs['2-1']),
        '3-0': odds(halfCorrectScoreProbs['3-0']),
        '3-1': odds(halfCorrectScoreProbs['3-1']),
        '3-2': odds(halfCorrectScoreProbs['3-2']),
        '1-1': odds(halfCorrectScoreProbs['1-1']),
        '2-2': odds(halfCorrectScoreProbs['2-2']),
        '0-1': odds(halfCorrectScoreProbs['0-1']),
        '0-2': odds(halfCorrectScoreProbs['0-2']),
        '1-2': odds(halfCorrectScoreProbs['1-2']),
        '0-3': odds(halfCorrectScoreProbs['0-3'])
      },

      // ===== 9. DRAW NO BET =====
      drawNoBet: {
        'Home': odds(homeProb / (homeProb + awayProb)),
        'Away': odds(awayProb / (homeProb + awayProb))
      },

      // ===== 10. ODD / EVEN =====
      oddEven: { 'Odd': 1.91, 'Even': 1.91 },
      firstHalfOddEven: { 'Odd': 1.91, 'Even': 1.91 },
      secondHalfOddEven: { 'Odd': 1.91, 'Even': 1.91 },
      homeOddEven: { 'Odd': 1.91, 'Even': 1.91 },
      awayOddEven: { 'Odd': 1.91, 'Even': 1.91 },

      // ===== 11. FIRST HALF BTTS =====
      firstHalfBtts: {
        'Yes': odds((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        'No': odds(1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))))
      },

      // ===== 12. FIRST HALF OVER/UNDER =====
      firstHalfTotalGoals: {
        'Over 0.5': ouHalf(0).over,
        'Under 0.5': ouHalf(0).under,
        'Over 1.5': ouHalf(1).over,
        'Under 1.5': ouHalf(1).under,
        'Over 2.5': ouHalf(2).over,
        'Under 2.5': ouHalf(2).under,
        'Over 3.5': ouHalf(3).over,
        'Under 3.5': ouHalf(3).under,
        'Over 4.5': ouHalf(4).over,
        'Under 4.5': ouHalf(4).under
      },

      // ===== 13. EXACT GOALS =====
      exactGoals: {
        '0 Goals': odds(poisson(totalGoalsDist, 0)),
        '1 Goal': odds(poisson(totalGoalsDist, 1)),
        '2 Goals': odds(poisson(totalGoalsDist, 2)),
        '3 Goals': odds(poisson(totalGoalsDist, 3)),
        '4 Goals': odds(poisson(totalGoalsDist, 4)),
        '5+ Goals': odds(1 - cumulativePoisson(totalGoalsDist, 4))
      },

      // ===== 14. 3 WAY & OVER/UNDER =====
      threeWayOverUnder: {
        'Home & Over 2.5': odds(homeProb * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Home & Under 2.5': odds(homeProb * cumulativePoisson(totalGoalsDist, 2)),
        'Draw & Over 2.5': odds(drawProb * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Draw & Under 2.5': odds(drawProb * cumulativePoisson(totalGoalsDist, 2)),
        'Away & Over 2.5': odds(awayProb * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Away & Under 2.5': odds(awayProb * cumulativePoisson(totalGoalsDist, 2))
      },

      // ===== 15. 3 WAY & BTTS =====
      threeWayBtts: {
        'Home & Yes': odds(homeProb * bttsYes),
        'Home & No': odds(homeProb * bttsNo),
        'Draw & Yes': odds(drawProb * bttsYes),
        'Draw & No': odds(drawProb * bttsNo),
        'Away & Yes': odds(awayProb * bttsYes),
        'Away & No': odds(awayProb * bttsNo)
      },

      // ===== 16. HANDICAP MARKETS =====
      firstHalfHandicap: {
        'Home -1': odds(homeProb * 1.4),
        'Away +1': odds(1 - homeProb * 1.4)
      },
      secondHalfHandicap: {
        'Home -1': odds(homeProb * 1.4),
        'Away +1': odds(1 - homeProb * 1.4)
      },
      handicap: {
        'Home -1': odds(homeProb * 1.2),
        'Home -2': odds(homeProb * 0.8),
        'Away +1': odds(1 - homeProb * 1.2),
        'Away +2': odds(1 - homeProb * 0.8)
      },

      // ===== 17. CLEAN SHEET =====
      homeCleanSheet: {
        'Yes': odds(homeCleanSheetProb),
        'No': odds(1 - homeCleanSheetProb)
      },
      awayCleanSheet: {
        'Yes': odds(awayCleanSheetProb),
        'No': odds(1 - awayCleanSheetProb)
      },
      firstHalfHomeCleanSheet: {
        'Yes': odds(poisson(halfAwayGoals, 0)),
        'No': odds(1 - poisson(halfAwayGoals, 0))
      },
      firstHalfAwayCleanSheet: {
        'Yes': odds(poisson(halfHomeGoals, 0)),
        'No': odds(1 - poisson(halfHomeGoals, 0))
      },
      secondHalfHomeCleanSheet: {
        'Yes': odds(poisson(secondHalfAwayGoals, 0)),
        'No': odds(1 - poisson(secondHalfAwayGoals, 0))
      },
      secondHalfAwayCleanSheet: {
        'Yes': odds(poisson(secondHalfHomeGoals, 0)),
        'No': odds(1 - poisson(secondHalfHomeGoals, 0))
      },

      // ===== 18. HOME/AWAY OVER/UNDER =====
      homeOverUnder: {
        'Over 0.5': odds(1 - poisson(homeExpectedGoals, 0)),
        'Under 0.5': odds(poisson(homeExpectedGoals, 0)),
        'Over 1.5': odds(1 - cumulativePoisson(homeExpectedGoals, 1)),
        'Under 1.5': odds(cumulativePoisson(homeExpectedGoals, 1)),
        'Over 2.5': odds(1 - cumulativePoisson(homeExpectedGoals, 2)),
        'Under 2.5': odds(cumulativePoisson(homeExpectedGoals, 2))
      },
      firstHalfHomeOverUnder: {
        'Over 0.5': odds(1 - poisson(halfHomeGoals, 0)),
        'Under 0.5': odds(poisson(halfHomeGoals, 0)),
        'Over 1.5': odds(1 - cumulativePoisson(halfHomeGoals, 1)),
        'Under 1.5': odds(cumulativePoisson(halfHomeGoals, 1))
      },
      secondHalfHomeOverUnder: {
        'Over 0.5': odds(1 - poisson(secondHalfHomeGoals, 0)),
        'Under 0.5': odds(poisson(secondHalfHomeGoals, 0)),
        'Over 1.5': odds(1 - cumulativePoisson(secondHalfHomeGoals, 1)),
        'Under 1.5': odds(cumulativePoisson(secondHalfHomeGoals, 1))
      },
      awayTotal: {
        'Over 0.5': odds(1 - poisson(awayExpectedGoals, 0)),
        'Under 0.5': odds(poisson(awayExpectedGoals, 0)),
        'Over 1.5': odds(1 - cumulativePoisson(awayExpectedGoals, 1)),
        'Under 1.5': odds(cumulativePoisson(awayExpectedGoals, 1))
      },
      firstHalfAwayOverUnder: {
        'Over 0.5': odds(1 - poisson(halfAwayGoals, 0)),
        'Under 0.5': odds(poisson(halfAwayGoals, 0)),
        'Over 1.5': odds(1 - cumulativePoisson(halfAwayGoals, 1)),
        'Under 1.5': odds(cumulativePoisson(halfAwayGoals, 1))
      },
      secondHalfAwayOverUnder: {
        'Over 0.5': odds(1 - poisson(secondHalfAwayGoals, 0)),
        'Under 0.5': odds(poisson(secondHalfAwayGoals, 0)),
        'Over 1.5': odds(1 - cumulativePoisson(secondHalfAwayGoals, 1)),
        'Under 1.5': odds(cumulativePoisson(secondHalfAwayGoals, 1))
      },

      // ===== 19. HOME/AWAY EXACT GOALS =====
      homeExactGoals: {
        '0 Goals': odds(poisson(homeExpectedGoals, 0)),
        '1 Goal': odds(poisson(homeExpectedGoals, 1)),
        '2 Goals': odds(poisson(homeExpectedGoals, 2)),
        '3 Goals': odds(poisson(homeExpectedGoals, 3)),
        '4 Goals': odds(poisson(homeExpectedGoals, 4))
      },
      awayExactGoals: {
        '0 Goals': odds(poisson(awayExpectedGoals, 0)),
        '1 Goal': odds(poisson(awayExpectedGoals, 1)),
        '2 Goals': odds(poisson(awayExpectedGoals, 2)),
        '3 Goals': odds(poisson(awayExpectedGoals, 3)),
        '4 Goals': odds(poisson(awayExpectedGoals, 4))
      },

      // ===== 20. GOAL RANGE =====
      goalRange: {
        '0 Goals': odds(poisson(totalGoalsDist, 0)),
        '1 Goal': odds(poisson(totalGoalsDist, 1)),
        '2 Goals': odds(poisson(totalGoalsDist, 2)),
        '3 Goals': odds(poisson(totalGoalsDist, 3)),
        '4 Goals': odds(poisson(totalGoalsDist, 4)),
        '5+ Goals': odds(1 - cumulativePoisson(totalGoalsDist, 4))
      },

      // ===== 21. DOUBLE CHANCE VARIATIONS =====
      doubleChanceFirstHalfBtts: {
        '1X & Yes': odds((homeProb + drawProb) * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        '1X & No': odds((homeProb + drawProb) * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))))),
        '12 & Yes': odds((homeProb + awayProb) * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        '12 & No': odds((homeProb + awayProb) * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))))),
        'X2 & Yes': odds((drawProb + awayProb) * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        'X2 & No': odds((drawProb + awayProb) * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0)))))
      },
      doubleChanceSecondHalfBtts: {
        '1X & Yes': odds((homeProb + drawProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        '1X & No': odds((homeProb + drawProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        '12 & Yes': odds((homeProb + awayProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        '12 & No': odds((homeProb + awayProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        'X2 & Yes': odds((drawProb + awayProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'X2 & No': odds((drawProb + awayProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0)))))
      },
      doubleChanceBtts: {
        '1X & Yes': odds((homeProb + drawProb) * bttsYes),
        '1X & No': odds((homeProb + drawProb) * bttsNo),
        '12 & Yes': odds((homeProb + awayProb) * bttsYes),
        '12 & No': odds((homeProb + awayProb) * bttsNo),
        'X2 & Yes': odds((drawProb + awayProb) * bttsYes),
        'X2 & No': odds((drawProb + awayProb) * bttsNo)
      },
      doubleChanceOverUnder: {
        '1X & Over 2.5': odds((homeProb + drawProb) * (1 - cumulativePoisson(totalGoalsDist, 2))),
        '1X & Under 2.5': odds((homeProb + drawProb) * cumulativePoisson(totalGoalsDist, 2)),
        '12 & Over 2.5': odds((homeProb + awayProb) * (1 - cumulativePoisson(totalGoalsDist, 2))),
        '12 & Under 2.5': odds((homeProb + awayProb) * cumulativePoisson(totalGoalsDist, 2)),
        'X2 & Over 2.5': odds((drawProb + awayProb) * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'X2 & Under 2.5': odds((drawProb + awayProb) * cumulativePoisson(totalGoalsDist, 2))
      },

      // ===== 22. HT/FT VARIATIONS =====
      htFtFirstHalfOverUnder: {
        'Home/Home & Over 1.5': odds(homeProb * homeProb * 1.2 * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Home/Home & Under 1.5': odds(homeProb * homeProb * 1.2 * cumulativePoisson(halfTotalGoals, 1)),
        'Draw/Home & Over 1.5': odds(drawProb * homeProb * 1.6 * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Draw/Home & Under 1.5': odds(drawProb * homeProb * 1.6 * cumulativePoisson(halfTotalGoals, 1)),
        'Away/Away & Over 1.5': odds(awayProb * awayProb * 1.2 * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Away/Away & Under 1.5': odds(awayProb * awayProb * 1.2 * cumulativePoisson(halfTotalGoals, 1))
      },
      htFtExactGoals: {
        'Home/Home & 1 Goal': odds(homeProb * homeProb * 1.2 * poisson(totalGoalsDist, 1)),
        'Home/Home & 2 Goals': odds(homeProb * homeProb * 1.2 * poisson(totalGoalsDist, 2)),
        'Draw/Home & 1 Goal': odds(drawProb * homeProb * 1.6 * poisson(totalGoalsDist, 1)),
        'Draw/Home & 2 Goals': odds(drawProb * homeProb * 1.6 * poisson(totalGoalsDist, 2)),
        'Away/Away & 1 Goal': odds(awayProb * awayProb * 1.2 * poisson(totalGoalsDist, 1)),
        'Away/Away & 2 Goals': odds(awayProb * awayProb * 1.2 * poisson(totalGoalsDist, 2))
      },
      htFtOverUnder: {
        'Home/Home & Over 2.5': odds(homeProb * homeProb * 1.2 * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Home/Home & Under 2.5': odds(homeProb * homeProb * 1.2 * cumulativePoisson(totalGoalsDist, 2)),
        'Draw/Home & Over 2.5': odds(drawProb * homeProb * 1.6 * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Draw/Home & Under 2.5': odds(drawProb * homeProb * 1.6 * cumulativePoisson(totalGoalsDist, 2)),
        'Away/Away & Over 2.5': odds(awayProb * awayProb * 1.2 * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Away/Away & Under 2.5': odds(awayProb * awayProb * 1.2 * cumulativePoisson(totalGoalsDist, 2))
      },
      htFtCorrectScore: {
        'Home/Home 1-0': odds(homeProb * homeProb * 1.2 * correctScoreProbs['1-0']),
        'Home/Home 2-0': odds(homeProb * homeProb * 1.2 * correctScoreProbs['2-0']),
        'Home/Home 2-1': odds(homeProb * homeProb * 1.2 * correctScoreProbs['2-1']),
        'Draw/Home 1-0': odds(drawProb * homeProb * 1.6 * correctScoreProbs['1-0']),
        'Draw/Home 2-0': odds(drawProb * homeProb * 1.6 * correctScoreProbs['2-0']),
        'Away/Away 0-1': odds(awayProb * awayProb * 1.2 * correctScoreProbs['0-1']),
        'Away/Away 0-2': odds(awayProb * awayProb * 1.2 * correctScoreProbs['0-2'])
      },

      // ===== 23. FIRST HALF DOUBLE CHANCE =====
      firstHalfDoubleChance: {
        '1X': odds(homeProb + drawProb),
        '12': odds(homeProb + awayProb),
        'X2': odds(drawProb + awayProb)
      },
      secondHalfDoubleChance: {
        '1X': odds(homeProb + drawProb),
        '12': odds(homeProb + awayProb),
        'X2': odds(drawProb + awayProb)
      },

      // ===== 24. LAST GOAL =====
      lastGoal: {
        'Home': odds(homeProb * 1.5),
        'Away': odds(awayProb * 1.5),
        'No Goal': odds(0.1)
      },

      // ===== 25. WHICH TEAM TO SCORE =====
      whichTeamToScore: {
        'Home Only': odds(homeProb * (1 - awayProb)),
        'Away Only': odds(awayProb * (1 - homeProb)),
        'Both': odds(homeProb * awayProb * 1.5),
        'Neither': odds((1 - homeProb) * (1 - awayProb))
      },

      // ===== 26. 1 GOAL VARIATIONS =====
      oneGoal: {
        '0 Goals': odds(poisson(totalGoalsDist, 0)),
        '1 Goal': odds(poisson(totalGoalsDist, 1)),
        '2+ Goals': odds(1 - cumulativePoisson(totalGoalsDist, 1))
      },
      oneGoalAnd1x2: {
        'Home & 1 Goal': odds(homeProb * poisson(totalGoalsDist, 1)),
        'Draw & 1 Goal': odds(drawProb * poisson(totalGoalsDist, 1)),
        'Away & 1 Goal': odds(awayProb * poisson(totalGoalsDist, 1))
      },
      firstHalfOneGoal: {
        '0 Goals': odds(poisson(halfTotalGoals, 0)),
        '1 Goal': odds(poisson(halfTotalGoals, 1)),
        '2+ Goals': odds(1 - cumulativePoisson(halfTotalGoals, 1))
      },
      secondHalfOneGoal: {
        '0 Goals': odds(poisson(secondHalfHomeGoals + secondHalfAwayGoals, 0)),
        '1 Goal': odds(poisson(secondHalfHomeGoals + secondHalfAwayGoals, 1)),
        '2+ Goals': odds(1 - cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1))
      },

      // ===== 27. TEAM MARKETS =====
      homeNoBet: { 'Yes': odds(homeProb / (homeProb + awayProb)), 'No': odds(awayProb / (homeProb + awayProb)) },
      awayNoBet: { 'Yes': odds(awayProb / (homeProb + awayProb)), 'No': odds(homeProb / (homeProb + awayProb)) },
      homeWinBothHalves: { 'Yes': odds(homeProb * homeProb * 1.2), 'No': odds(1 - homeProb * homeProb * 1.2) },
      homeScoreBothHalves: { 'Yes': odds((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(secondHalfHomeGoals, 0))), 'No': odds(1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(secondHalfHomeGoals, 0)))) },
      awayScoreBothHalves: { 'Yes': odds((1 - poisson(halfAwayGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))), 'No': odds(1 - ((1 - poisson(halfAwayGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0)))) },
      homeWinEitherHalf: { 'Yes': odds(homeProb * 1.2), 'No': odds(1 - homeProb * 1.2) },
      awayWinEitherHalf: { 'Yes': odds(awayProb * 1.2), 'No': odds(1 - awayProb * 1.2) },

      // ===== 28. HIGHEST SCORING HALF =====
      highestScoringHalf: {
        '1st Half': odds(0.40),
        '2nd Half': odds(0.40),
        'Both Equal': odds(0.20)
      },
      homeHighestScoringHalf: {
        '1st Half': odds(0.45),
        '2nd Half': odds(0.45),
        'Both Equal': odds(0.10)
      },
      awayHighestScoringHalf: {
        '1st Half': odds(0.45),
        '2nd Half': odds(0.45),
        'Both Equal': odds(0.10)
      },

      // ===== 29. FIRST HALF 1X2 VARIATIONS =====
      firstHalf1x2Btts: {
        'Home & Yes': odds(homeProb * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        'Home & No': odds(homeProb * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))))),
        'Draw & Yes': odds(drawProb * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        'Draw & No': odds(drawProb * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))))),
        'Away & Yes': odds(awayProb * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        'Away & No': odds(awayProb * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0)))))
      },
      firstHalf1x2OverUnder: {
        'Home & Over 1.5': odds(homeProb * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Home & Under 1.5': odds(homeProb * cumulativePoisson(halfTotalGoals, 1)),
        'Draw & Over 1.5': odds(drawProb * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Draw & Under 1.5': odds(drawProb * cumulativePoisson(halfTotalGoals, 1)),
        'Away & Over 1.5': odds(awayProb * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Away & Under 1.5': odds(awayProb * cumulativePoisson(halfTotalGoals, 1))
      },

      // ===== 30. SECOND HALF MARKETS =====
      secondHalfResult: {
        'Home': odds(homeProb * 1.2),
        'Draw': odds(drawProb * 0.9),
        'Away': odds(awayProb * 1.2)
      },
      secondHalfBtts: {
        'Yes': odds((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'No': odds(1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))
      },
      secondHalf3WayBtts: {
        'Home & Yes': odds(homeProb * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'Home & No': odds(homeProb * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        'Draw & Yes': odds(drawProb * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'Draw & No': odds(drawProb * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        'Away & Yes': odds(awayProb * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'Away & No': odds(awayProb * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0)))))
      },
      secondHalf3WayOverUnder: {
        'Home & Over 1.5': odds(homeProb * (1 - cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1))),
        'Home & Under 1.5': odds(homeProb * cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1)),
        'Draw & Over 1.5': odds(drawProb * (1 - cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1))),
        'Draw & Under 1.5': odds(drawProb * cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1)),
        'Away & Over 1.5': odds(awayProb * (1 - cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1))),
        'Away & Under 1.5': odds(awayProb * cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1))
      },

      // ===== 31. SECOND HALF CORRECT SCORE =====
      secondHalfCorrectScore: {
        '0-0': odds(secondHalfCorrectScoreProbs['0-0']),
        '1-0': odds(secondHalfCorrectScoreProbs['1-0']),
        '2-0': odds(secondHalfCorrectScoreProbs['2-0']),
        '2-1': odds(secondHalfCorrectScoreProbs['2-1']),
        '1-1': odds(secondHalfCorrectScoreProbs['1-1']),
        '0-1': odds(secondHalfCorrectScoreProbs['0-1']),
        '0-2': odds(secondHalfCorrectScoreProbs['0-2']),
        '1-2': odds(secondHalfCorrectScoreProbs['1-2'])
      },

      // ===== 32. SECOND HALF DOUBLE CHANCE =====
      secondHalfDoubleChance: {
        '1X': odds(homeProb + drawProb),
        '12': odds(homeProb + awayProb),
        'X2': odds(drawProb + awayProb)
      },
      secondHalfDoubleChanceBtts: {
        '1X & Yes': odds((homeProb + drawProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        '1X & No': odds((homeProb + drawProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        '12 & Yes': odds((homeProb + awayProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        '12 & No': odds((homeProb + awayProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        'X2 & Yes': odds((drawProb + awayProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'X2 & No': odds((drawProb + awayProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0)))))
      },

      // ===== 33. SECOND HALF DRAW NO BET =====
      secondHalfDrawNoBet: {
        'Home': odds(homeProb / (homeProb + awayProb)),
        'Away': odds(awayProb / (homeProb + awayProb))
      },

      // ===== 34. SECOND HALF EXACT GOALS =====
      secondHalfExactGoals: {
        '0 Goals': odds(poisson(secondHalfHomeGoals + secondHalfAwayGoals, 0)),
        '1 Goal': odds(poisson(secondHalfHomeGoals + secondHalfAwayGoals, 1)),
        '2 Goals': odds(poisson(secondHalfHomeGoals + secondHalfAwayGoals, 2)),
        '3 Goals': odds(poisson(secondHalfHomeGoals + secondHalfAwayGoals, 3)),
        '4 Goals': odds(poisson(secondHalfHomeGoals + secondHalfAwayGoals, 4))
      },

      // ===== 35. SECOND HALF OVER/UNDER =====
      secondHalfOverUnder: {
        'Over 0.5': odds(1 - poisson(secondHalfHomeGoals + secondHalfAwayGoals, 0)),
        'Under 0.5': odds(poisson(secondHalfHomeGoals + secondHalfAwayGoals, 0)),
        'Over 1.5': odds(1 - cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1)),
        'Under 1.5': odds(cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1)),
        'Over 2.5': odds(1 - cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 2)),
        'Under 2.5': odds(cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 2))
      },

      // ===== 36. BOTH HALVES =====
      bothHalvesBtts: {
        'Yes': odds((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0)) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'No': odds(1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0)) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))
      },
      bothHalvesOver1_5: {
        'Yes': odds((1 - cumulativePoisson(halfTotalGoals, 1)) * (1 - cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1))),
        'No': odds(1 - ((1 - cumulativePoisson(halfTotalGoals, 1)) * (1 - cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1))))
      },
      bothHalvesUnder1_5: {
        'Yes': odds(cumulativePoisson(halfTotalGoals, 1) * cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1)),
        'No': odds(1 - (cumulativePoisson(halfTotalGoals, 1) * cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1)))
      },

      // ===== 37. 10 MINUTE 3 WAY =====
      tenMinute3Way: {
        'Home': odds(0.25),
        'Draw': odds(0.50),
        'Away': odds(0.25)
      },

      // ===== 38. OVER/UNDER BTTS =====
      overUnderBtts: {
        'Over 2.5 & Yes': odds((1 - cumulativePoisson(totalGoalsDist, 2)) * bttsYes),
        'Over 2.5 & No': odds((1 - cumulativePoisson(totalGoalsDist, 2)) * bttsNo),
        'Under 2.5 & Yes': odds(cumulativePoisson(totalGoalsDist, 2) * bttsYes),
        'Under 2.5 & No': odds(cumulativePoisson(totalGoalsDist, 2) * bttsNo)
      },

      // ===== 39. CORNERS =====
      corners: {
        'Over 8.5': 1.85,
        'Under 8.5': 1.95,
        'Home Most': 1.95,
        'Away Most': 2.05,
        'First Corner - Home': 1.90,
        'First Corner - Away': 2.10,
        'Last Corner - Home': 1.95,
        'Last Corner - Away': 1.95
      },

      // ===== 40. CARDS =====
      cards: {
        'Over 2.5 Yellow': 1.70,
        'Under 2.5 Yellow': 2.10,
        'Red Card - Yes': 3.00,
        'Red Card - No': 1.30
      },

      // ===== 41. PENALTY =====
      penalty: {
        'Penalty Awarded': 2.50,
        'No Penalty': 1.50
      },

      // ===== 42. PLAYER MARKETS =====
      playerMarkets: {
        'Anytime Goalscorer': 2.50,
        'First Goalscorer': 5.00,
        'Last Goalscorer': 5.50,
        'Player to Receive Card': 3.00,
        'Player to Assist': 3.50
      },

      // ===== 43. SPECIALS =====
      specials: {
        'Clean Sheet - Home': odds(poisson(awayExpectedGoals, 0)),
        'Clean Sheet - Away': odds(poisson(homeExpectedGoals, 0)),
        'Win to Nil - Home': odds(homeProb * poisson(awayExpectedGoals, 0)),
        'Win to Nil - Away': odds(awayProb * poisson(homeExpectedGoals, 0)),
        'Both Halves Over 1.5': odds((1 - cumulativePoisson(halfTotalGoals, 1)) * (1 - cumulativePoisson(secondHalfHomeGoals + secondHalfAwayGoals, 1))),
        'Highest Scoring Half - 1st': odds(0.40),
        'Highest Scoring Half - 2nd': odds(0.40),
        'Odd Total Goals': 1.90,
        'Even Total Goals': 1.90
      }
    };
  };

  // ============================================
  // DEFAULT MARKETS (Fallback)
  // ============================================
  const generateDefaultMarkets = () => {
    return {
      result: { 'Home': 2.00, 'Draw': 3.50, 'Away': 2.50 },
      btts: { 'Yes': 1.95, 'No': 1.85 },
      doubleChance: { '1X': 1.30, '12': 1.15, 'X2': 1.45 },
      totalGoals: {
        'Over 0.5': 1.05, 'Under 0.5': 10.00,
        'Over 1.5': 1.15, 'Under 1.5': 5.25,
        'Over 2.5': 1.85, 'Under 2.5': 1.95,
        'Over 3.5': 2.50, 'Under 3.5': 1.50,
        'Over 4.5': 4.00, 'Under 4.5': 1.20
      },
      correctScore: {
        '0-0': 8.00, '1-0': 6.00, '2-0': 8.50, '2-1': 9.00,
        '3-0': 15.00, '3-1': 18.00, '3-2': 25.00, '1-1': 7.00,
        '2-2': 12.00, '0-1': 6.50, '0-2': 9.00, '1-2': 10.00,
        '0-3': 20.00, 'Any Other Home Win': 30.00,
        'Any Other Away Win': 35.00, 'Any Other Draw': 40.00
      },
      // ... add all other markets with default values
      // (Keep your existing defaultOdds here)
    };
  };

  // ============================================
  // ALL CLUBS BY LEAGUE (Keep your existing data)
  // ============================================
  const clubsByLeague = {
    'Premier League': [
      'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
      'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town',
      'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United',
      'Nottingham Forest', 'Sunderland', 'Tottenham Hotspur', 'Coventry City',
      'Hull City', 'Leicester City'
    ],
    // ... keep all your existing clubsByLeague data here
  };

  const countries = [
    'England', 'Germany', 'Netherlands', 'Spain', 'Portugal', 'France',
    'Belgium', 'Italy', 'Sweden', 'Denmark', 'Norway', 'Switzerland',
    'Austria', 'Greece', 'Turkey', 'Russia', 'Ukraine', 'Poland'
  ];

  const europeanLeagues = [
    'UEFA Champions League',
    'UEFA Europa League',
    'UEFA Conference League'
  ];

  const leaguesByCountry = {
    'England': [
      'Premier League', 'Championship', 'FA Cup', 'EFL Cup', 'Community Shield'
    ],
    'Germany': [
      'Bundesliga', '2. Bundesliga', 'DFB-Pokal', 'DFL-Supercup'
    ],
    'Netherlands': [
      'Eredivisie', 'Eerste Divisie', 'KNVB Cup', 'Johan Cruyff Shield'
    ],
    'Spain': [
      'La Liga', 'Segunda División', 'Copa del Rey', 'Supercopa de España'
    ],
    'Portugal': [
      'Liga Portugal', 'Liga Portugal 2', 'Taça de Portugal', 'Supertaça Cândido de Oliveira'
    ],
    'France': [
      'Ligue 1', 'Ligue 2', 'Coupe de France', 'Trophée des Champions'
    ],
    'Belgium': [
      'Pro League', 'Challenger Pro League', 'Belgian Cup', 'Belgian Super Cup'
    ],
    'Italy': [
      'Serie A', 'Serie B', 'Coppa Italia', 'Supercoppa Italiana'
    ],
    'Sweden': [
      'Allsvenskan', 'Superettan', 'Svenska Cupen', 'Svenska Supercupen'
    ],
    'Denmark': [
      'Danish Superliga', '1st Division', 'Danish Cup', 'Danish Super Cup'
    ],
    'Norway': [
      'Eliteserien', 'OBOS-ligaen', 'Norwegian Cup', 'Mesterfinalen'
    ],
    'Switzerland': [
      'Swiss Super League', 'Challenge League', 'Swiss Cup', 'Swiss Super Cup'
    ],
    'Austria': [
      'Austrian Bundesliga', '2. Liga', 'Austrian Cup', 'Austrian Supercup'
    ],
    'Greece': [
      'Super League Greece', 'Super League Greece 2', 'Greek Cup', 'Greek Super Cup'
    ],
    'Turkey': [
      'Süper Lig', 'TFF 1. Lig', 'Turkish Cup', 'Turkish Super Cup'
    ],
    'Russia': [
      'Russian Premier League', 'Russian First League', 'Russian Cup', 'Russian Super Cup'
    ],
    'Ukraine': [
      'Ukrainian Premier League', 'Ukrainian First League', 'Ukrainian Cup', 'Ukrainian Super Cup'
    ],
    'Poland': [
      'Ekstraklasa', 'I Liga', 'Polish Cup', 'Polish Super Cup'
    ],
    'Europa': europeanLeagues
  };

  const getLeaguesForCountry = (country) => {
    if (!country) return [];
    if (country === 'Europa') {
      return europeanLeagues;
    }
    return leaguesByCountry[country] || [];
  };

  const getTeamsForLeague = (league) => {
    if (!league) return [];
    return clubsByLeague[league] || [];
  };

  // ============================================
  // GENERATE MOCK DATA (Fallback)
  // ============================================
  const generateMockMatches = (sport) => {
    const now = new Date();
    const mockData = {
      'soccer_epl': [
        { id: 'mock_1', homeTeam: 'Manchester City', awayTeam: 'Arsenal', odds: { home: 1.85, draw: 3.40, away: 4.20 }, league: 'Premier League', country: 'England', commenceTime: new Date(now.getTime() + 3600000).toISOString() },
        { id: 'mock_2', homeTeam: 'Liverpool', awayTeam: 'Chelsea', odds: { home: 1.90, draw: 3.50, away: 4.00 }, league: 'Premier League', country: 'England', commenceTime: new Date(now.getTime() + 7200000).toISOString() },
        { id: 'mock_3', homeTeam: 'Tottenham Hotspur', awayTeam: 'Manchester United', odds: { home: 2.30, draw: 3.20, away: 3.10 }, league: 'Premier League', country: 'England', commenceTime: new Date(now.getTime() + 10800000).toISOString() },
        { id: 'mock_4', homeTeam: 'Newcastle United', awayTeam: 'Aston Villa', odds: { home: 2.10, draw: 3.30, away: 3.60 }, league: 'Premier League', country: 'England', commenceTime: new Date(now.getTime() + 14400000).toISOString() },
        { id: 'mock_5', homeTeam: 'West Ham United', awayTeam: 'Crystal Palace', odds: { home: 2.05, draw: 3.25, away: 3.80 }, league: 'Premier League', country: 'England', commenceTime: new Date(now.getTime() + 18000000).toISOString() }
      ],
      'basketball_nba': [
        { id: 'mock_nba_1', homeTeam: 'Los Angeles Lakers', awayTeam: 'Golden State Warriors', odds: { home: 1.75, draw: 0, away: 2.25 }, league: 'NBA', country: 'USA', commenceTime: new Date(now.getTime() + 3600000).toISOString() }
      ],
      'tennis_atp': [
        { id: 'mock_tennis_1', homeTeam: 'Novak Djokovic', awayTeam: 'Carlos Alcaraz', odds: { home: 1.80, draw: 0, away: 2.10 }, league: 'ATP Tennis', country: 'International', commenceTime: new Date(now.getTime() + 3600000).toISOString() }
      ]
    };
    return mockData[sport] || mockData['soccer_epl'];
  };

  // ============================================
  // FETCH LIVE ODDS
  // ============================================
  const fetchLiveOdds = async () => {
    try {
      setLoadingOdds(true);
      setOddsError('');
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Please login to fetch live odds');
        setLoadingOdds(false);
        return;
      }
      
      const sportKey = sportMapping[formData.sport] || 'soccer_epl';
      console.log('📡 Fetching odds for:', sportKey);
      console.log('🔗 URL:', `${API_URL}/api/odds/odds/${sportKey}`);
      
      try {
        const response = await axios.get(
          `${API_URL}/api/odds/odds/${sportKey}`,
          { 
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            timeout: 15000
          }
        );
        
        console.log('✅ Response status:', response.status);
        console.log('✅ Response data:', response.data);
        
        if (response.data && response.data.success) {
          const matchesData = response.data.matches || [];
          console.log(`✅ Found ${matchesData.length} matches from API`);
          
          if (matchesData.length > 0) {
            setLiveOdds(matchesData);
            setShowLiveOdds(true);
            const sourceMsg = response.data.source === 'mock' ? ' (Mock data from backend)' : ' (Live data from API)';
            alert(`✅ Found ${matchesData.length} matches!${sourceMsg}`);
            setLoadingOdds(false);
            return;
          }
        }
      } catch (apiError) {
        console.log('⚠️ API error, using mock data:', apiError.message);
        if (apiError.response) {
          console.log('Status:', apiError.response.status);
          console.log('Data:', apiError.response.data);
        }
      }
      
      console.log('📊 Using mock data as fallback');
      const mockMatches = generateMockMatches(sportKey);
      console.log(`✅ Generated ${mockMatches.length} mock matches`);
      
      setLiveOdds(mockMatches);
      setShowLiveOdds(true);
      alert(`✅ Found ${mockMatches.length} matches! (Using sample data - API not available)`);
      
    } catch (error) {
      console.error('❌ Error fetching live odds:', error);
      const mockMatches = generateMockMatches('soccer_epl');
      setLiveOdds(mockMatches);
      setShowLiveOdds(true);
      alert(`✅ Found ${mockMatches.length} sample matches! (API unavailable)`);
    } finally {
      setLoadingOdds(false);
    }
  };

  // ============================================
  // APPLY LIVE ODDS
  // ============================================
  const applyLiveOdds = (match) => {
    try {
      console.log('📝 Applying odds from match:', match);
      
      const homeOdds = match.odds?.home || match.odds?.['1'] || 2.0;
      const drawOdds = match.odds?.draw || match.odds?.X || 3.5;
      const awayOdds = match.odds?.away || match.odds?.['2'] || 2.5;
      
      const allMarketsData = generateAllMarkets(homeOdds, drawOdds, awayOdds);
      
      console.log('✅ Generated all markets:', Object.keys(allMarketsData).length);
      
      setFormData({
        ...formData,
        homeTeam: match.homeTeam || '',
        awayTeam: match.awayTeam || '',
        oddsHome: homeOdds?.toString() || '',
        oddsDraw: drawOdds?.toString() || '',
        oddsAway: awayOdds?.toString() || '',
        league: match.league || match.sportTitle || formData.league || '',
        country: match.country || formData.country || '',
        markets: allMarketsData
      });
      
      setShowLiveOdds(false);
      alert(`✅ Odds loaded for ${match.homeTeam || 'Home'} vs ${match.awayTeam || 'Away'}! All 82 markets generated!`);
    } catch (error) {
      console.error('Error applying odds:', error);
      alert('Failed to apply odds. Please try manually entering them.');
    }
  };

  // ============================================
  // ALL MARKETS LIST (for display)
  // ============================================
  const allMarkets = {
    result: { label: '3 Way (1X2)', key: 'result' },
    btts: { label: 'Both Teams to Score', key: 'btts' },
    doubleChance: { label: 'Double Chance', key: 'doubleChance' },
    totalGoals: { label: 'Over/Under', key: 'totalGoals' },
    firstHalfResult: { label: '1st Half - 3 Way', key: 'firstHalfResult' },
    firstHalfTotalGoals: { label: '1st Half - Over/Under', key: 'firstHalfTotalGoals' },
    firstHalfCorrectScore: { label: '1st Half - Correct Score', key: 'firstHalfCorrectScore' },
    halfTimeFullTime: { label: 'Halftime/Fulltime', key: 'halfTimeFullTime' },
    exactGoals: { label: 'Exact Goals', key: 'exactGoals' },
    oddEven: { label: 'Odd/Even', key: 'oddEven' },
    drawNoBet: { label: 'Draw No Bet', key: 'drawNoBet' },
    firstHalfBtts: { label: '1st Half - Both Teams to Score', key: 'firstHalfBtts' },
    threeWayOverUnder: { label: '3 Way & Over/Under', key: 'threeWayOverUnder' },
    threeWayBtts: { label: '3 Way & Both Teams to Score', key: 'threeWayBtts' },
    homeWinEitherHalf: { label: 'Home Team to Win Either Half', key: 'homeWinEitherHalf' },
    awayWinEitherHalf: { label: 'Away Team to Win Either Half', key: 'awayWinEitherHalf' },
    highestScoringHalf: { label: 'Highest Scoring Half', key: 'highestScoringHalf' },
    goalRange: { label: 'Goal Range', key: 'goalRange' },
    oneGoal: { label: '1 Goal', key: 'oneGoal' },
    oneGoalAnd1x2: { label: '1 Goal & 1X2', key: 'oneGoalAnd1x2' },
    tenMinute3Way: { label: '10 Minutes - 3 Way (1-10)', key: 'tenMinute3Way' },
    firstHalfOneGoal: { label: '1st Half - 1 Goal', key: 'firstHalfOneGoal' },
    firstHalf1x2Btts: { label: '1st Half - 1X2 & Both Teams to Score', key: 'firstHalf1x2Btts' },
    firstHalf1x2OverUnder: { label: '1st Half - 1X2 & Over/Under', key: 'firstHalf1x2OverUnder' },
    firstHalfHomeCleanSheet: { label: '1st Half - Home Team Clean Sheet', key: 'firstHalfHomeCleanSheet' },
    firstHalfHomeOverUnder: { label: '1st Half - Home Team Over/Under', key: 'firstHalfHomeOverUnder' },
    firstHalfAwayCleanSheet: { label: '1st Half - Away Team Clean Sheet', key: 'firstHalfAwayCleanSheet' },
    firstHalfAwayOverUnder: { label: '1st Half - Away Team Over/Under', key: 'firstHalfAwayOverUnder' },
    firstHalfDoubleChance: { label: '1st Half - Double Chance', key: 'firstHalfDoubleChance' },
    firstHalfDoubleChanceBtts: { label: '1st Half - Double Chance & Both Teams to Score', key: 'firstHalfDoubleChanceBtts' },
    firstHalfDrawNoBet: { label: '1st Half - Draw No Bet', key: 'firstHalfDrawNoBet' },
    firstHalfExactGoals: { label: '1st Half - Exact Goals', key: 'firstHalfExactGoals' },
    firstHalfHandicap: { label: '1st Half - Handicap 1:0', key: 'firstHalfHandicap' },
    firstHalfOddEven: { label: '1st Half - Odd/Even', key: 'firstHalfOddEven' },
    bothHalvesBtts: { label: '1st/2nd Half - Both Teams to Score', key: 'bothHalvesBtts' },
    secondHalfOneGoal: { label: '2nd Half - 1 Goal', key: 'secondHalfOneGoal' },
    secondHalfResult: { label: '2nd Half - 3 Way', key: 'secondHalfResult' },
    secondHalf3WayBtts: { label: '2nd Half - 3 Way & Both Teams to Score', key: 'secondHalf3WayBtts' },
    secondHalf3WayOverUnder: { label: '2nd Half - 3 Way & Over/Under', key: 'secondHalf3WayOverUnder' },
    secondHalfHomeCleanSheet: { label: '2nd Half - Home Team Clean Sheet', key: 'secondHalfHomeCleanSheet' },
    secondHalfHomeOverUnder: { label: '2nd Half - Home Team Over/Under', key: 'secondHalfHomeOverUnder' },
    secondHalfBtts: { label: '2nd Half - Both Teams to Score', key: 'secondHalfBtts' },
    secondHalfCorrectScore: { label: '2nd Half - Correct Score', key: 'secondHalfCorrectScore' },
    secondHalfAwayCleanSheet: { label: '2nd Half - Away Team Clean Sheet', key: 'secondHalfAwayCleanSheet' },
    secondHalfAwayOverUnder: { label: '2nd Half - Away Team Over/Under', key: 'secondHalfAwayOverUnder' },
    secondHalfDoubleChance: { label: '2nd Half - Double Chance', key: 'secondHalfDoubleChance' },
    secondHalfDoubleChanceBtts: { label: '2nd Half - Double Chance & Both Teams to Score', key: 'secondHalfDoubleChanceBtts' },
    secondHalfDrawNoBet: { label: '2nd Half - Draw No Bet', key: 'secondHalfDrawNoBet' },
    secondHalfExactGoals: { label: '2nd Half - Exact Goals', key: 'secondHalfExactGoals' },
    secondHalfHandicap: { label: '2nd Half - Handicap 1:0', key: 'secondHalfHandicap' },
    secondHalfOddEven: { label: '2nd Half - Odd/Even', key: 'secondHalfOddEven' },
    secondHalfOverUnder: { label: '2nd Half - Over/Under', key: 'secondHalfOverUnder' },
    homeCleanSheet: { label: 'Home Team Clean Sheet', key: 'homeCleanSheet' },
    homeExactGoals: { label: 'Home Team Exact Goals', key: 'homeExactGoals' },
    homeHighestScoringHalf: { label: 'Home Team Highest Scoring Half', key: 'homeHighestScoringHalf' },
    homeNoBet: { label: 'Home Team No Bet', key: 'homeNoBet' },
    homeOddEven: { label: 'Home Team Odd/Even', key: 'homeOddEven' },
    homeOverUnder: { label: 'Home Team Over/Under', key: 'homeOverUnder' },
    homeScoreBothHalves: { label: 'Home Team to Score in Both Halves', key: 'homeScoreBothHalves' },
    homeWinBothHalves: { label: 'Home Team to Win Both Halves', key: 'homeWinBothHalves' },
    bothHalvesOver1_5: { label: 'Both Halves Over 1.5', key: 'bothHalvesOver1_5' },
    bothHalvesUnder1_5: { label: 'Both Halves Under 1.5', key: 'bothHalvesUnder1_5' },
    correctScore: { label: 'Correct Score', key: 'correctScore' },
    awayCleanSheet: { label: 'Away Team Clean Sheet', key: 'awayCleanSheet' },
    awayExactGoals: { label: 'Away Team Exact Goals', key: 'awayExactGoals' },
    awayHighestScoringHalf: { label: 'Away Team Highest Scoring Half', key: 'awayHighestScoringHalf' },
    awayNoBet: { label: 'Away Team No Bet', key: 'awayNoBet' },
    awayOddEven: { label: 'Away Team Odd/Even', key: 'awayOddEven' },
    awayTotal: { label: 'Away Team Total', key: 'awayTotal' },
    awayScoreBothHalves: { label: 'Away Team to Score in Both Halves', key: 'awayScoreBothHalves' },
    doubleChanceFirstHalfBtts: { label: 'Double Chance & 1st Half Both Teams Score', key: 'doubleChanceFirstHalfBtts' },
    doubleChanceSecondHalfBtts: { label: 'Double Chance & 2nd Half Both Teams Score', key: 'doubleChanceSecondHalfBtts' },
    doubleChanceBtts: { label: 'Double Chance & Both Teams to Score', key: 'doubleChanceBtts' },
    doubleChanceOverUnder: { label: 'Double Chance & Over/Under', key: 'doubleChanceOverUnder' },
    htFtFirstHalfOverUnder: { label: 'Halftime/Fulltime & 1st Half Over/Under', key: 'htFtFirstHalfOverUnder' },
    htFtExactGoals: { label: 'Halftime/Fulltime & Exact Goals', key: 'htFtExactGoals' },
    htFtOverUnder: { label: 'Halftime/Fulltime & Over/Under', key: 'htFtOverUnder' },
    htFtCorrectScore: { label: 'Halftime/Fulltime Correct Score', key: 'htFtCorrectScore' },
    handicap: { label: 'Handicap 0:1', key: 'handicap' },
    lastGoal: { label: 'Last Goal', key: 'lastGoal' },
    overUnderBtts: { label: 'Over/Under & Both Teams to Score', key: 'overUnderBtts' },
    whichTeamToScore: { label: 'Which Team to Score', key: 'whichTeamToScore' }
  };

  // ============================================
  // DEFAULT ODDS (for "Add All 82 Markets" button)
  // ============================================
  const defaultOdds = {
    doubleChance: { '1X': 1.01, '12': 1.07, 'X2': 5.45 },
    drawNoBet: { 'Home': 1.5, 'Away': 2.5 },
    btts: { 'Yes': 2.0, 'No': 1.8 },
    totalGoals: { 'Over 0.5': 1.05, 'Under 0.5': 10.0, 'Over 1.5': 1.15, 'Under 1.5': 5.25, 'Over 2.5': 1.56, 'Under 2.5': 2.43, 'Over 3.5': 1.9, 'Under 3.5': 1.9, 'Over 4.5': 3.5, 'Under 4.5': 1.3 },
    exactGoals: { '0 Goals': 8.0, '1 Goal': 4.5, '2 Goals': 3.5, '3 Goals': 4.0, '4 Goals': 7.0, '5+ Goals': 12.0 },
    correctScore: { '0-0': 8.0, '1-0': 6.0, '2-0': 8.5, '2-1': 9.0, '3-0': 15.0, '3-1': 18.0, '3-2': 25.0, '1-1': 7.0, '2-2': 12.0, '0-1': 6.5, '0-2': 9.0, '1-2': 10.0, '0-3': 20.0, 'Any Other Home Win': 30.0, 'Any Other Away Win': 35.0, 'Any Other Draw': 40.0 },
    halfTimeResult: { 'Home': 2.5, 'Draw': 2.0, 'Away': 3.0 },
    halfTimeFullTime: { 'Home/Home': 2.5, 'Home/Draw': 15.0, 'Home/Away': 30.0, 'Draw/Home': 5.0, 'Draw/Draw': 4.5, 'Draw/Away': 6.0, 'Away/Home': 25.0, 'Away/Draw': 12.0, 'Away/Away': 3.5 },
    firstTeamScore: { 'Home': 1.8, 'Away': 2.2, 'No Goal': 10.0 },
    lastTeamScore: { 'Home': 1.9, 'Away': 2.1, 'No Goal': 10.0 },
    firstGoalTime: { '0-15 Min': 3.0, '16-30 Min': 3.5, '31-45 Min': 4.0, '46-60 Min': 5.0, '61-75 Min': 6.0, '76-90 Min': 4.5, 'No Goal': 10.0 },
    teamGoalsHome: { 'Over 0.5': 1.2, 'Over 1.5': 2.0, 'Over 2.5': 4.0 },
    teamGoalsAway: { 'Over 0.5': 1.5, 'Over 1.5': 3.0, 'Over 2.5': 6.0 },
    handicap: { 'Home -1': 1.5, 'Home -2': 2.5, 'Away +1': 2.0, 'Away +2': 1.8 },
    asianHandicap: { 'Home -0.5': 1.8, 'Home -1': 2.0, 'Away +0.5': 1.9, 'Away +1': 1.7 },
    corners: { 'Over 8.5': 1.8, 'Under 8.5': 2.0, 'Home Most': 2.0, 'Away Most': 2.2, 'First Corner - Home': 1.9, 'First Corner - Away': 2.1, 'Last Corner - Home': 2.0, 'Last Corner - Away': 2.0 },
    cards: { 'Over 2.5 Yellow': 1.7, 'Under 2.5 Yellow': 2.1, 'Red Card - Yes': 3.0, 'Red Card - No': 1.3 },
    penalty: { 'Penalty Awarded': 2.5, 'No Penalty': 1.5 },
    playerMarkets: { 'Anytime Goalscorer': 2.5, 'First Goalscorer': 5.0, 'Last Goalscorer': 5.5, 'Player to Receive Card': 3.0, 'Player to Assist': 3.5 },
    specials: { 'Clean Sheet - Home': 2.0, 'Clean Sheet - Away': 2.5, 'Win to Nil - Home': 3.0, 'Win to Nil - Away': 4.0, 'Both Halves Over 1.5': 6.0, 'Highest Scoring Half - 1st': 2.0, 'Highest Scoring Half - 2nd': 2.2, 'Odd Total Goals': 1.9, 'Even Total Goals': 1.9 },
    firstHalfCorrectScore: { '0-0': 4.0, '1-0': 3.5, '2-0': 5.0, '2-1': 6.0, '3-0': 8.0, '3-1': 10.0, '3-2': 15.0, '1-1': 4.5, '2-2': 8.0, '0-1': 4.0, '0-2': 5.5, '1-2': 6.5, '0-3': 12.0 },
    oddEven: { 'Odd': 1.9, 'Even': 1.9 },
    firstHalfOddEven: { 'Odd': 1.9, 'Even': 1.9 },
    secondHalfOddEven: { 'Odd': 1.9, 'Even': 1.9 },
    homeOddEven: { 'Odd': 1.9, 'Even': 1.9 },
    awayOddEven: { 'Odd': 1.9, 'Even': 1.9 },
    threeWayOverUnder: { 'Home & Over 2.5': 3.5, 'Home & Under 2.5': 4.0, 'Draw & Over 2.5': 6.0, 'Draw & Under 2.5': 5.0, 'Away & Over 2.5': 4.5, 'Away & Under 2.5': 5.5 },
    threeWayBtts: { 'Home & Yes': 4.0, 'Home & No': 5.0, 'Draw & Yes': 6.0, 'Draw & No': 7.0, 'Away & Yes': 4.5, 'Away & No': 5.5 },
    homeWinEitherHalf: { 'Yes': 2.0, 'No': 1.8 },
    awayWinEitherHalf: { 'Yes': 2.2, 'No': 1.7 },
    highestScoringHalf: { '1st Half': 2.0, '2nd Half': 2.0, 'Both Equal': 3.0 },
    goalRange: { '0 Goals': 8.0, '1 Goal': 4.5, '2 Goals': 3.5, '3 Goals': 4.0, '4 Goals': 7.0, '5+ Goals': 12.0 },
    oneGoal: { '0 Goals': 8.0, '1 Goal': 4.5, '2+ Goals': 2.5 },
    oneGoalAnd1x2: { 'Home & 1 Goal': 6.0, 'Draw & 1 Goal': 8.0, 'Away & 1 Goal': 7.0 },
    tenMinute3Way: { 'Home': 4.0, 'Draw': 2.5, 'Away': 5.0 },
    firstHalfOneGoal: { '0 Goals': 3.0, '1 Goal': 2.5, '2+ Goals': 3.5 },
    firstHalf1x2Btts: { 'Home & Yes': 5.0, 'Home & No': 6.0, 'Draw & Yes': 7.0, 'Draw & No': 8.0, 'Away & Yes': 5.5, 'Away & No': 6.5 },
    firstHalf1x2OverUnder: { 'Home & Over 1.5': 4.5, 'Home & Under 1.5': 5.5, 'Draw & Over 1.5': 6.0, 'Draw & Under 1.5': 5.0, 'Away & Over 1.5': 5.0, 'Away & Under 1.5': 6.0 },
    firstHalfHomeCleanSheet: { 'Yes': 2.5, 'No': 1.5 },
    firstHalfHomeOverUnder: { 'Over 0.5': 1.8, 'Under 0.5': 2.0, 'Over 1.5': 3.0, 'Under 1.5': 1.3 },
    firstHalfAwayCleanSheet: { 'Yes': 3.0, 'No': 1.3 },
    firstHalfAwayOverUnder: { 'Over 0.5': 2.0, 'Under 0.5': 1.8, 'Over 1.5': 3.5, 'Under 1.5': 1.3 },
    firstHalfDoubleChance: { '1X': 1.5, '12': 1.8, 'X2': 2.0 },
    firstHalfDoubleChanceBtts: { '1X & Yes': 3.5, '1X & No': 4.0, '12 & Yes': 4.0, '12 & No': 4.5, 'X2 & Yes': 4.5, 'X2 & No': 5.0 },
    firstHalfDrawNoBet: { 'Home': 1.8, 'Away': 2.2 },
    firstHalfExactGoals: { '0 Goals': 3.0, '1 Goal': 2.5, '2 Goals': 4.0, '3 Goals': 7.0, '4 Goals': 12.0 },
    firstHalfHandicap: { 'Home -1': 3.0, 'Away +1': 1.5 },
    bothHalvesBtts: { 'Yes': 3.0, 'No': 1.3 },
    secondHalfOneGoal: { '0 Goals': 3.5, '1 Goal': 2.5, '2+ Goals': 3.0 },
    secondHalfResult: { 'Home': 2.5, 'Draw': 2.0, 'Away': 3.0 },
    secondHalf3WayBtts: { 'Home & Yes': 4.5, 'Home & No': 5.5, 'Draw & Yes': 6.0, 'Draw & No': 7.0, 'Away & Yes': 5.0, 'Away & No': 6.0 },
    secondHalf3WayOverUnder: { 'Home & Over 1.5': 4.0, 'Home & Under 1.5': 5.0, 'Draw & Over 1.5': 6.0, 'Draw & Under 1.5': 5.5, 'Away & Over 1.5': 4.5, 'Away & Under 1.5': 5.5 },
    secondHalfHomeCleanSheet: { 'Yes': 2.5, 'No': 1.5 },
    secondHalfHomeOverUnder: { 'Over 0.5': 1.8, 'Under 0.5': 2.0, 'Over 1.5': 3.0, 'Under 1.5': 1.3 },
    secondHalfBtts: { 'Yes': 2.5, 'No': 1.5 },
    secondHalfCorrectScore: { '0-0': 5.0, '1-0': 4.5, '2-0': 6.0, '2-1': 7.0, '1-1': 5.5, '0-1': 5.0, '0-2': 7.0, '1-2': 8.0 },
    secondHalfAwayCleanSheet: { 'Yes': 3.0, 'No': 1.3 },
    secondHalfAwayOverUnder: { 'Over 0.5': 2.0, 'Under 0.5': 1.8, 'Over 1.5': 3.5, 'Under 1.5': 1.3 },
    secondHalfDoubleChance: { '1X': 1.5, '12': 1.8, 'X2': 2.0 },
    secondHalfDoubleChanceBtts: { '1X & Yes': 3.5, '1X & No': 4.0, '12 & Yes': 4.0, '12 & No': 4.5, 'X2 & Yes': 4.5, 'X2 & No': 5.0 },
    secondHalfDrawNoBet: { 'Home': 1.8, 'Away': 2.2 },
    secondHalfExactGoals: { '0 Goals': 3.5, '1 Goal': 2.5, '2 Goals': 4.5, '3 Goals': 8.0, '4 Goals': 14.0 },
    secondHalfHandicap: { 'Home -1': 3.0, 'Away +1': 1.5 },
    secondHalfOverUnder: { 'Over 0.5': 1.5, 'Under 0.5': 2.5, 'Over 1.5': 2.5, 'Under 1.5': 1.5, 'Over 2.5': 4.5, 'Under 2.5': 1.2 },
    homeCleanSheet: { 'Yes': 2.0, 'No': 1.7 },
    homeExactGoals: { '0 Goals': 3.0, '1 Goal': 2.5, '2 Goals': 4.0, '3 Goals': 6.0, '4 Goals': 10.0 },
    homeHighestScoringHalf: { '1st Half': 2.5, '2nd Half': 2.5, 'Both Equal': 3.5 },
    homeNoBet: { 'Yes': 1.8, 'No': 2.0 },
    homeOverUnder: { 'Over 0.5': 1.5, 'Under 0.5': 2.5, 'Over 1.5': 2.5, 'Under 1.5': 1.5, 'Over 2.5': 4.5, 'Under 2.5': 1.2 },
    homeScoreBothHalves: { 'Yes': 3.0, 'No': 1.3 },
    homeWinBothHalves: { 'Yes': 4.0, 'No': 1.2 },
    bothHalvesOver1_5: { 'Yes': 3.5, 'No': 1.3 },
    bothHalvesUnder1_5: { 'Yes': 1.3, 'No': 3.5 },
    awayCleanSheet: { 'Yes': 2.5, 'No': 1.5 },
    awayExactGoals: { '0 Goals': 2.5, '1 Goal': 2.0, '2 Goals': 4.5, '3 Goals': 8.0, '4 Goals': 14.0 },
    awayHighestScoringHalf: { '1st Half': 2.5, '2nd Half': 2.5, 'Both Equal': 3.5 },
    awayNoBet: { 'Yes': 2.0, 'No': 1.8 },
    awayTotal: { 'Over 0.5': 1.8, 'Under 0.5': 2.0, 'Over 1.5': 3.5, 'Under 1.5': 1.3 },
    awayScoreBothHalves: { 'Yes': 3.5, 'No': 1.2 },
    doubleChanceFirstHalfBtts: { '1X & Yes': 4.0, '1X & No': 5.0, '12 & Yes': 4.5, '12 & No': 5.5, 'X2 & Yes': 5.0, 'X2 & No': 6.0 },
    doubleChanceSecondHalfBtts: { '1X & Yes': 4.0, '1X & No': 5.0, '12 & Yes': 4.5, '12 & No': 5.5, 'X2 & Yes': 5.0, 'X2 & No': 6.0 },
    doubleChanceBtts: { '1X & Yes': 3.5, '1X & No': 4.5, '12 & Yes': 4.0, '12 & No': 5.0, 'X2 & Yes': 4.5, 'X2 & No': 5.5 },
    doubleChanceOverUnder: { '1X & Over 2.5': 4.0, '1X & Under 2.5': 3.5, '12 & Over 2.5': 4.5, '12 & Under 2.5': 4.0, 'X2 & Over 2.5': 5.0, 'X2 & Under 2.5': 4.5 },
    htFtFirstHalfOverUnder: { 'Home/Home & Over 1.5': 6.0, 'Home/Home & Under 1.5': 7.0, 'Draw/Home & Over 1.5': 8.0, 'Draw/Home & Under 1.5': 9.0, 'Away/Away & Over 1.5': 7.0, 'Away/Away & Under 1.5': 8.0 },
    htFtExactGoals: { 'Home/Home & 1 Goal': 5.0, 'Home/Home & 2 Goals': 7.0, 'Draw/Home & 1 Goal': 6.0, 'Draw/Home & 2 Goals': 8.0, 'Away/Away & 1 Goal': 6.0, 'Away/Away & 2 Goals': 8.0 },
    htFtOverUnder: { 'Home/Home & Over 2.5': 5.5, 'Home/Home & Under 2.5': 6.5, 'Draw/Home & Over 2.5': 7.0, 'Draw/Home & Under 2.5': 8.0, 'Away/Away & Over 2.5': 6.0, 'Away/Away & Under 2.5': 7.0 },
    htFtCorrectScore: { 'Home/Home 1-0': 8.0, 'Home/Home 2-0': 12.0, 'Home/Home 2-1': 14.0, 'Draw/Home 1-0': 10.0, 'Draw/Home 2-0': 15.0, 'Away/Away 0-1': 9.0, 'Away/Away 0-2': 13.0 },
    lastGoal: { 'Home': 1.9, 'Away': 1.9, 'No Goal': 10.0 },
    overUnderBtts: { 'Over 2.5 & Yes': 3.5, 'Over 2.5 & No': 4.5, 'Under 2.5 & Yes': 4.0, 'Under 2.5 & No': 3.0 },
    whichTeamToScore: { 'Home Only': 3.0, 'Away Only': 3.5, 'Both': 2.0, 'Neither': 8.0 }
  };

  const [formData, setFormData] = useState({
    sport: 'FOOTBALL',
    country: '',
    league: '',
    homeTeam: '',
    awayTeam: '',
    date: '',
    oddsHome: '',
    oddsDraw: '',
    oddsAway: '',
    markets: {}
  });

  const availableLeagues = getLeaguesForCountry(formData.country);
  const availableTeams = getTeamsForLeague(formData.league);

  useEffect(() => {
    fetchMatches();
  }, [filters]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.sport) params.append('sport', filters.sport);
      if (filters.status) params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await axios.get(`${API_URL}/api/admin/matches?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMatches(response.data.matches || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
      if (error.response?.status === 401) {
        alert('Session expired. Please login again.');
      } else {
        alert('Failed to fetch matches');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (matchId) => {
    if (!window.confirm('Are you sure you want to delete this match?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/admin/matches/${matchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Match deleted successfully');
      fetchMatches();
    } catch (error) {
      console.error('Error deleting match:', error);
      alert('Failed to delete match');
    }
  };

  const handleAddAllMarkets = () => {
    const allMarketsData = {};
    Object.keys(allMarkets).forEach(key => {
      allMarketsData[key] = defaultOdds[key] || {};
    });
    setFormData({
      ...formData,
      markets: allMarketsData
    });
    alert('✅ All 82 betting markets added successfully!');
  };

  const handleClearAllMarkets = () => {
    if (!window.confirm('Are you sure you want to remove all markets?')) return;
    setFormData({
      ...formData,
      markets: {}
    });
    alert('✅ All markets cleared!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      const cleanedMarkets = {};
      Object.keys(formData.markets || {}).forEach(key => {
        const marketData = formData.markets[key];
        const hasValidOdds = Object.values(marketData).some(val => val && parseFloat(val) > 0);
        if (hasValidOdds) {
          cleanedMarkets[key] = marketData;
        }
      });
      
      const data = {
        ...formData,
        odds: {
          home: parseFloat(formData.oddsHome) || 0,
          draw: parseFloat(formData.oddsDraw) || 0,
          away: parseFloat(formData.oddsAway) || 0
        },
        markets: cleanedMarkets
      };

      if (editingMatch) {
        await axios.put(`${API_URL}/api/admin/matches/${editingMatch._id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Match updated successfully');
      } else {
        await axios.post(`${API_URL}/api/admin/matches`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Match created successfully');
      }
      resetForm();
      fetchMatches();
    } catch (error) {
      console.error('Error saving match:', error);
      alert(error.response?.data?.message || 'Failed to save match');
    }
  };

  const handleMarketChange = (marketKey, optionId, value) => {
    setFormData({
      ...formData,
      markets: {
        ...formData.markets,
        [marketKey]: {
          ...(formData.markets?.[marketKey] || {}),
          [optionId]: parseFloat(value) || 0
        }
      }
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingMatch(null);
    setFormData({
      sport: 'FOOTBALL',
      country: '',
      league: '',
      homeTeam: '',
      awayTeam: '',
      date: '',
      oddsHome: '',
      oddsDraw: '',
      oddsAway: '',
      markets: {}
    });
    setShowLiveOdds(false);
    setOddsError('');
  };

  const editMatch = (match) => {
    setEditingMatch(match);
    
    const date = new Date(match.date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const localDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    setFormData({
      sport: match.sport,
      country: match.country || '',
      league: match.league || '',
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      date: localDateTime,
      oddsHome: match.odds?.home?.toString() || '',
      oddsDraw: match.odds?.draw?.toString() || '',
      oddsAway: match.odds?.away?.toString() || '',
      markets: match.markets || {}
    });
    setShowForm(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    return `${year}/${month}/${day} ${hours}:${minutes} ${ampm}`;
  };

  return (
    <div className="admin-matches-page">
      <div className="admin-header">
        <h2>⚽ Match Management</h2>
        <button onClick={() => setShowForm(true)} className="btn-add">+ Add New Match</button>
      </div>

      <div className="filters-container">
        <select value={filters.sport} onChange={(e) => setFilters({ ...filters, sport: e.target.value })}>
          <option value="FOOTBALL">⚽ Football</option>
          <option value="BASKETBALL">🏀 Basketball</option>
          <option value="TENNIS">🎾 Tennis</option>
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Status</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="LIVE">Live</option>
          <option value="FINISHED">Finished</option>
        </select>
        <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
        <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
        <button onClick={fetchMatches} className="btn-filter">Apply Filters</button>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingMatch ? '✏️ Edit Match' : '➕ Add New Match'}</h3>
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-live-odds" 
                  onClick={fetchLiveOdds}
                  disabled={loadingOdds}
                >
                  {loadingOdds ? '⏳ Loading...' : '📡 Pull Live Odds'}
                </button>
                <button 
                  type="button" 
                  className="btn-add-all-markets" 
                  onClick={handleAddAllMarkets}
                >
                  📊 Add All 82 Markets
                </button>
                <button 
                  type="button" 
                  className="btn-clear-markets" 
                  onClick={handleClearAllMarkets}
                >
                  🗑️ Clear Markets
                </button>
              </div>
            </div>

            {showLiveOdds && (
              <div className="live-odds-results">
                <div className="live-odds-header">
                  <h4>📡 Live Odds Results</h4>
                  <button 
                    type="button" 
                    className="close-live-odds"
                    onClick={() => setShowLiveOdds(false)}
                  >
                    ✕
                  </button>
                </div>
                {loadingOdds ? (
                  <div className="loading-odds">Loading odds...</div>
                ) : liveOdds.length === 0 ? (
                  <div className="no-odds">No live matches available for this sport</div>
                ) : (
                  <div className="live-odds-list">
                    {liveOdds.slice(0, 10).map((match) => (
                      <div key={match.id || match._id} className="live-odds-item" onClick={() => applyLiveOdds(match)}>
                        <div className="live-match-teams">
                          <span className="home">{match.homeTeam || 'Home'}</span>
                          <span className="vs">vs</span>
                          <span className="away">{match.awayTeam || 'Away'}</span>
                        </div>
                        <div className="live-match-odds">
                          <span className="odd">1: {match.odds?.home || match.odds?.['1'] || 'N/A'}</span>
                          <span className="odd">X: {match.odds?.draw || match.odds?.X || 'N/A'}</span>
                          <span className="odd">2: {match.odds?.away || match.odds?.['2'] || 'N/A'}</span>
                        </div>
                        <button className="apply-odds-btn">Apply</button>
                      </div>
                    ))}
                  </div>
                )}
                {oddsError && (
                  <div className="odds-error">{oddsError}</div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="match-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Sport</label>
                  <select value={formData.sport} onChange={(e) => setFormData({ ...formData, sport: e.target.value })} required>
                    <option value="FOOTBALL">Football</option>
                    <option value="BASKETBALL">Basketball</option>
                    <option value="TENNIS">Tennis</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Country</label>
                  <select 
                    value={formData.country} 
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        country: e.target.value,
                        league: '',
                        homeTeam: '',
                        awayTeam: ''
                      });
                    }} 
                    required
                  >
                    <option value="">Select a country</option>
                    <option value="Europa">🌍 Europa (UEFA Leagues)</option>
                    {countries.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>League</label>
                  <select 
                    value={formData.league} 
                    onChange={(e) => {
                      setFormData({ 
                        ...formData, 
                        league: e.target.value,
                        homeTeam: '',
                        awayTeam: ''
                      });
                    }} 
                    required
                    disabled={!formData.country}
                  >
                    <option value="">
                      {formData.country ? 'Select a league' : 'Select country first'}
                    </option>
                    {availableLeagues.map((league) => (
                      <option key={league} value={league}>{league}</option>
                    ))}
                  </select>
                  {!formData.country && (
                    <small style={{ color: '#888', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      Please select a country first
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Home Team</label>
                  <select 
                    value={formData.homeTeam} 
                    onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })} 
                    required
                    disabled={!formData.league}
                  >
                    <option value="">
                      {formData.league ? 'Select home team' : 'Select league first'}
                    </option>
                    {availableTeams.map((team) => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                  {!formData.league && (
                    <small style={{ color: '#888', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      Please select a league first
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Away Team</label>
                  <select 
                    value={formData.awayTeam} 
                    onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })} 
                    required
                    disabled={!formData.league}
                  >
                    <option value="">
                      {formData.league ? 'Select away team' : 'Select league first'}
                    </option>
                    {availableTeams.map((team) => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                  {!formData.league && (
                    <small style={{ color: '#888', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                      Please select a league first
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>Date &amp; Time (12H)</label>
                  <input 
                    type="datetime-local" 
                    value={formData.date} 
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
                    required 
                  />
                  <small style={{ color: '#888', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    Format: YYYY-MM-DD HH:MM (e.g. 2026-08-09 02:30 PM)
                  </small>
                </div>
              </div>

              <div className="odds-section">
                <h4>1X2 - Match Result</h4>
                <div className="odds-grid">
                  <div className="form-group">
                    <label>Home (1)</label>
                    <input type="number" step="0.01" min="1.01" value={formData.oddsHome} onChange={(e) => setFormData({ ...formData, oddsHome: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Draw (X)</label>
                    <input type="number" step="0.01" min="1.01" value={formData.oddsDraw} onChange={(e) => setFormData({ ...formData, oddsDraw: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Away (2)</label>
                    <input type="number" step="0.01" min="1.01" value={formData.oddsAway} onChange={(e) => setFormData({ ...formData, oddsAway: e.target.value })} required />
                  </div>
                </div>
              </div>

              <div className="markets-section">
                <div className="markets-header">
                  <h4>All Betting Markets <span className="markets-count-badge">{Object.keys(formData.markets || {}).length} / 82</span></h4>
                  <div className="markets-actions">
                    <button type="button" className="btn-add-all-markets-small" onClick={handleAddAllMarkets}>
                      📊 Add All 82
                    </button>
                    <button type="button" className="btn-clear-markets-small" onClick={handleClearAllMarkets}>
                      🗑️ Clear All
                    </button>
                  </div>
                </div>
                <div className="markets-grid-admin">
                  {Object.entries(allMarkets).map(([key, market]) => (
                    <div key={key} className="market-group-admin">
                      <div className="market-header-admin">
                        <h5>{market.label}</h5>
                        <span className="market-status">
                          {formData.markets?.[key] ? '✅' : '❌'}
                        </span>
                      </div>
                      <div className="market-options-admin">
                        {formData.markets?.[key] && Object.entries(formData.markets[key]).map(([optionId, value]) => (
                          <div key={optionId} className="market-option-admin">
                            <span className="option-label-admin">{optionId}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="1.01"
                              placeholder="Odds"
                              value={value || ''}
                              onChange={(e) => handleMarketChange(key, optionId, e.target.value)}
                            />
                            <button 
                              type="button" 
                              className="btn-remove-option"
                              onClick={() => {
                                const newMarkets = { ...formData.markets };
                                delete newMarkets[key][optionId];
                                if (Object.keys(newMarkets[key]).length === 0) {
                                  delete newMarkets[key];
                                }
                                setFormData({ ...formData, markets: newMarkets });
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-save">{editingMatch ? 'Update' : 'Create'}</button>
                <button type="button" className="btn-cancel" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading matches...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Country</th>
                <th>League</th>
                <th>Home</th>
                <th>Away</th>
                <th>1X2 Odds</th>
                <th>Markets</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(match => (
                <tr key={match._id}>
                  <td>{formatDate(match.date)}</td>
                  <td>{match.country || 'N/A'}</td>
                  <td>{match.league}</td>
                  <td>{match.homeTeam}</td>
                  <td>{match.awayTeam}</td>
                  <td className="odds-display">{match.odds?.home || 'N/A'} / {match.odds?.draw || 'N/A'} / {match.odds?.away || 'N/A'}</td>
                  <td>
                    {match.markets && Object.keys(match.markets).length > 0 ? (
                      <span className="markets-count">{Object.keys(match.markets).length} markets</span>
                    ) : (
                      <span className="no-markets">No markets</span>
                    )}
                  </td>
                  <td><span className={`status-badge ${match.status?.toLowerCase() || 'upcoming'}`}>{match.status || 'UPCOMING'}</span></td>
                  <td className="action-buttons">
                    <button onClick={() => editMatch(match)} className="btn-edit" title="Edit">✏️</button>
                    <button onClick={() => handleDelete(match._id)} className="btn-delete" title="Delete">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MatchesManagement;