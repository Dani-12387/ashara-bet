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
  
  const [liveOdds, setLiveOdds] = useState([]);
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [showLiveOdds, setShowLiveOdds] = useState(false);
  const [oddsError, setOddsError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const sportMapping = {
    'FOOTBALL': 'soccer_epl',
    'BASKETBALL': 'basketball_nba',
    'TENNIS': 'tennis_atp',
    'CRICKET': 'cricket_t20_blast'
  };

  // ============================================
  // ODDS HELPER FUNCTIONS
  // ============================================
  
  const clampOdds = (value) => {
    if (value <= 0 || isNaN(value)) return 1.05;
    if (value < 1.05) return 1.05;
    if (value > 101.00) return 101.00;
    return Math.round(value * 100) / 100;
  };

  const getOdds = (probability, margin = 0.95) => {
    if (probability <= 0 || probability > 1 || isNaN(probability)) return 101.00;
    const rawOdds = (1 / probability) * margin;
    return clampOdds(rawOdds);
  };

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

  // ============================================
  // GENERATE ALL 82 MARKETS
  // ============================================
  const generateAllMarkets = (homeOdds, drawOdds, awayOdds) => {
    const h = parseFloat(homeOdds) || 2.0;
    const d = parseFloat(drawOdds) || 3.5;
    const a = parseFloat(awayOdds) || 2.5;

    if (h <= 0 || d <= 0 || a <= 0) {
      return generateDefaultMarkets();
    }

    const totalProb = (1 / h + 1 / d + 1 / a);
    const homeProb = (1 / h) / totalProb;
    const drawProb = (1 / d) / totalProb;
    const awayProb = (1 / a) / totalProb;

    const leagueAvgGoals = 2.8;
    const totalExpectedGoals = (homeProb + awayProb) * leagueAvgGoals;
    const homeExpectedGoals = totalExpectedGoals * (homeProb / (homeProb + awayProb));
    const awayExpectedGoals = totalExpectedGoals - homeExpectedGoals;
    const totalGoalsDist = homeExpectedGoals + awayExpectedGoals;

    const halfExpectedGoals = totalExpectedGoals * 0.55;
    const halfHomeGoals = homeExpectedGoals * 0.55;
    const halfAwayGoals = awayExpectedGoals * 0.55;
    const halfTotalGoals = halfHomeGoals + halfAwayGoals;

    const secondHalfHomeGoals = homeExpectedGoals * 0.45;
    const secondHalfAwayGoals = awayExpectedGoals * 0.45;
    const secondHalfTotalGoals = secondHalfHomeGoals + secondHalfAwayGoals;

    const bttsYes = (1 - poisson(homeExpectedGoals, 0)) * (1 - poisson(awayExpectedGoals, 0));
    const bttsNo = 1 - bttsYes;

    const homeCleanSheetProb = poisson(awayExpectedGoals, 0);
    const awayCleanSheetProb = poisson(homeExpectedGoals, 0);

    const ou = (threshold) => {
      const under = cumulativePoisson(totalGoalsDist, threshold);
      const over = 1 - under;
      return { over: getOdds(over), under: getOdds(under) };
    };

    const ouHalf = (threshold) => {
      const under = cumulativePoisson(halfTotalGoals, threshold);
      const over = 1 - under;
      return { over: getOdds(over), under: getOdds(under) };
    };

    const ouSecondHalf = (threshold) => {
      const under = cumulativePoisson(secondHalfTotalGoals, threshold);
      const over = 1 - under;
      return { over: getOdds(over), under: getOdds(under) };
    };

    const correctScoreProbs = {};
    const scoreLines = ['0-0', '1-0', '2-0', '2-1', '3-0', '3-1', '3-2', '1-1', '2-2', '0-1', '0-2', '1-2', '0-3'];
    scoreLines.forEach(score => {
      const [hg, ag] = score.split('-').map(Number);
      correctScoreProbs[score] = poisson(homeExpectedGoals, hg) * poisson(awayExpectedGoals, ag);
    });

    const halfCorrectScoreProbs = {};
    scoreLines.forEach(score => {
      const [hg, ag] = score.split('-').map(Number);
      halfCorrectScoreProbs[score] = poisson(halfHomeGoals, hg) * poisson(halfAwayGoals, ag);
    });

    const secondHalfCorrectScoreProbs = {};
    scoreLines.forEach(score => {
      const [hg, ag] = score.split('-').map(Number);
      secondHalfCorrectScoreProbs[score] = poisson(secondHalfHomeGoals, hg) * poisson(secondHalfAwayGoals, ag);
    });

    const anyOtherHome = 1 - cumulativePoisson(homeExpectedGoals, 3) * cumulativePoisson(awayExpectedGoals, 3);
    const anyOtherAway = 1 - cumulativePoisson(homeExpectedGoals, 3) * cumulativePoisson(awayExpectedGoals, 3);
    const anyOtherDraw = 1 - (correctScoreProbs['0-0'] + correctScoreProbs['1-1'] + correctScoreProbs['2-2']);

    return {
      result: {
        'Home': clampOdds(h),
        'Draw': clampOdds(d),
        'Away': clampOdds(a)
      },

      btts: {
        'Yes': getOdds(bttsYes),
        'No': getOdds(bttsNo)
      },

      doubleChance: {
        '1X': getOdds(homeProb + drawProb),
        '12': getOdds(homeProb + awayProb),
        'X2': getOdds(drawProb + awayProb)
      },

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

      correctScore: {
        '0-0': getOdds(correctScoreProbs['0-0']),
        '1-0': getOdds(correctScoreProbs['1-0']),
        '2-0': getOdds(correctScoreProbs['2-0']),
        '2-1': getOdds(correctScoreProbs['2-1']),
        '3-0': getOdds(correctScoreProbs['3-0']),
        '3-1': getOdds(correctScoreProbs['3-1']),
        '3-2': getOdds(correctScoreProbs['3-2']),
        '1-1': getOdds(correctScoreProbs['1-1']),
        '2-2': getOdds(correctScoreProbs['2-2']),
        '0-1': getOdds(correctScoreProbs['0-1']),
        '0-2': getOdds(correctScoreProbs['0-2']),
        '1-2': getOdds(correctScoreProbs['1-2']),
        '0-3': getOdds(correctScoreProbs['0-3']),
        'Any Other Home Win': getOdds(anyOtherHome),
        'Any Other Away Win': getOdds(anyOtherAway),
        'Any Other Draw': getOdds(anyOtherDraw)
      },

      firstHalfResult: {
        'Home': getOdds(homeProb * (1 + (1 - homeProb) * 0.3)),
        'Draw': getOdds(drawProb * (1 + (1 - drawProb) * 0.2)),
        'Away': getOdds(awayProb * (1 + (1 - awayProb) * 0.3))
      },

      halfTimeFullTime: {
        'Home/Home': getOdds(homeProb * homeProb * 1.2),
        'Home/Draw': getOdds(homeProb * drawProb * 3.5),
        'Home/Away': getOdds(homeProb * awayProb * 8),
        'Draw/Home': getOdds(drawProb * homeProb * 1.6),
        'Draw/Draw': getOdds(drawProb * drawProb * 1.3),
        'Draw/Away': getOdds(drawProb * awayProb * 2.0),
        'Away/Home': getOdds(awayProb * homeProb * 7),
        'Away/Draw': getOdds(awayProb * drawProb * 3.5),
        'Away/Away': getOdds(awayProb * awayProb * 1.2)
      },

      firstHalfCorrectScore: {
        '0-0': getOdds(halfCorrectScoreProbs['0-0']),
        '1-0': getOdds(halfCorrectScoreProbs['1-0']),
        '2-0': getOdds(halfCorrectScoreProbs['2-0']),
        '2-1': getOdds(halfCorrectScoreProbs['2-1']),
        '3-0': getOdds(halfCorrectScoreProbs['3-0']),
        '3-1': getOdds(halfCorrectScoreProbs['3-1']),
        '3-2': getOdds(halfCorrectScoreProbs['3-2']),
        '1-1': getOdds(halfCorrectScoreProbs['1-1']),
        '2-2': getOdds(halfCorrectScoreProbs['2-2']),
        '0-1': getOdds(halfCorrectScoreProbs['0-1']),
        '0-2': getOdds(halfCorrectScoreProbs['0-2']),
        '1-2': getOdds(halfCorrectScoreProbs['1-2']),
        '0-3': getOdds(halfCorrectScoreProbs['0-3'])
      },

      drawNoBet: {
        'Home': getOdds(homeProb / (homeProb + awayProb)),
        'Away': getOdds(awayProb / (homeProb + awayProb))
      },

      oddEven: { 'Odd': 1.91, 'Even': 1.91 },
      firstHalfOddEven: { 'Odd': 1.91, 'Even': 1.91 },
      secondHalfOddEven: { 'Odd': 1.91, 'Even': 1.91 },
      homeOddEven: { 'Odd': 1.91, 'Even': 1.91 },
      awayOddEven: { 'Odd': 1.91, 'Even': 1.91 },

      firstHalfBtts: {
        'Yes': getOdds((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        'No': getOdds(1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))))
      },

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

      exactGoals: {
        '0 Goals': getOdds(poisson(totalGoalsDist, 0)),
        '1 Goal': getOdds(poisson(totalGoalsDist, 1)),
        '2 Goals': getOdds(poisson(totalGoalsDist, 2)),
        '3 Goals': getOdds(poisson(totalGoalsDist, 3)),
        '4 Goals': getOdds(poisson(totalGoalsDist, 4)),
        '5+ Goals': getOdds(1 - cumulativePoisson(totalGoalsDist, 4))
      },

      threeWayOverUnder: {
        'Home & Over 2.5': getOdds(homeProb * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Home & Under 2.5': getOdds(homeProb * cumulativePoisson(totalGoalsDist, 2)),
        'Draw & Over 2.5': getOdds(drawProb * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Draw & Under 2.5': getOdds(drawProb * cumulativePoisson(totalGoalsDist, 2)),
        'Away & Over 2.5': getOdds(awayProb * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Away & Under 2.5': getOdds(awayProb * cumulativePoisson(totalGoalsDist, 2))
      },

      threeWayBtts: {
        'Home & Yes': getOdds(homeProb * bttsYes),
        'Home & No': getOdds(homeProb * bttsNo),
        'Draw & Yes': getOdds(drawProb * bttsYes),
        'Draw & No': getOdds(drawProb * bttsNo),
        'Away & Yes': getOdds(awayProb * bttsYes),
        'Away & No': getOdds(awayProb * bttsNo)
      },

      firstHalfHandicap: {
        'Home -1': getOdds(homeProb * 1.4),
        'Away +1': getOdds(1 - homeProb * 1.4)
      },
      secondHalfHandicap: {
        'Home -1': getOdds(homeProb * 1.4),
        'Away +1': getOdds(1 - homeProb * 1.4)
      },
      handicap: {
        'Home -1': getOdds(homeProb * 1.2),
        'Home -2': getOdds(homeProb * 0.8),
        'Away +1': getOdds(1 - homeProb * 1.2),
        'Away +2': getOdds(1 - homeProb * 0.8)
      },

      homeCleanSheet: {
        'Yes': getOdds(homeCleanSheetProb),
        'No': getOdds(1 - homeCleanSheetProb)
      },
      awayCleanSheet: {
        'Yes': getOdds(awayCleanSheetProb),
        'No': getOdds(1 - awayCleanSheetProb)
      },
      firstHalfHomeCleanSheet: {
        'Yes': getOdds(poisson(halfAwayGoals, 0)),
        'No': getOdds(1 - poisson(halfAwayGoals, 0))
      },
      firstHalfAwayCleanSheet: {
        'Yes': getOdds(poisson(halfHomeGoals, 0)),
        'No': getOdds(1 - poisson(halfHomeGoals, 0))
      },
      secondHalfHomeCleanSheet: {
        'Yes': getOdds(poisson(secondHalfAwayGoals, 0)),
        'No': getOdds(1 - poisson(secondHalfAwayGoals, 0))
      },
      secondHalfAwayCleanSheet: {
        'Yes': getOdds(poisson(secondHalfHomeGoals, 0)),
        'No': getOdds(1 - poisson(secondHalfHomeGoals, 0))
      },

      homeOverUnder: {
        'Over 0.5': getOdds(1 - poisson(homeExpectedGoals, 0)),
        'Under 0.5': getOdds(poisson(homeExpectedGoals, 0)),
        'Over 1.5': getOdds(1 - cumulativePoisson(homeExpectedGoals, 1)),
        'Under 1.5': getOdds(cumulativePoisson(homeExpectedGoals, 1)),
        'Over 2.5': getOdds(1 - cumulativePoisson(homeExpectedGoals, 2)),
        'Under 2.5': getOdds(cumulativePoisson(homeExpectedGoals, 2))
      },
      firstHalfHomeOverUnder: {
        'Over 0.5': getOdds(1 - poisson(halfHomeGoals, 0)),
        'Under 0.5': getOdds(poisson(halfHomeGoals, 0)),
        'Over 1.5': getOdds(1 - cumulativePoisson(halfHomeGoals, 1)),
        'Under 1.5': getOdds(cumulativePoisson(halfHomeGoals, 1))
      },
      secondHalfHomeOverUnder: {
        'Over 0.5': getOdds(1 - poisson(secondHalfHomeGoals, 0)),
        'Under 0.5': getOdds(poisson(secondHalfHomeGoals, 0)),
        'Over 1.5': getOdds(1 - cumulativePoisson(secondHalfHomeGoals, 1)),
        'Under 1.5': getOdds(cumulativePoisson(secondHalfHomeGoals, 1))
      },
      awayTotal: {
        'Over 0.5': getOdds(1 - poisson(awayExpectedGoals, 0)),
        'Under 0.5': getOdds(poisson(awayExpectedGoals, 0)),
        'Over 1.5': getOdds(1 - cumulativePoisson(awayExpectedGoals, 1)),
        'Under 1.5': getOdds(cumulativePoisson(awayExpectedGoals, 1))
      },
      firstHalfAwayOverUnder: {
        'Over 0.5': getOdds(1 - poisson(halfAwayGoals, 0)),
        'Under 0.5': getOdds(poisson(halfAwayGoals, 0)),
        'Over 1.5': getOdds(1 - cumulativePoisson(halfAwayGoals, 1)),
        'Under 1.5': getOdds(cumulativePoisson(halfAwayGoals, 1))
      },
      secondHalfAwayOverUnder: {
        'Over 0.5': getOdds(1 - poisson(secondHalfAwayGoals, 0)),
        'Under 0.5': getOdds(poisson(secondHalfAwayGoals, 0)),
        'Over 1.5': getOdds(1 - cumulativePoisson(secondHalfAwayGoals, 1)),
        'Under 1.5': getOdds(cumulativePoisson(secondHalfAwayGoals, 1))
      },

      homeExactGoals: {
        '0 Goals': getOdds(poisson(homeExpectedGoals, 0)),
        '1 Goal': getOdds(poisson(homeExpectedGoals, 1)),
        '2 Goals': getOdds(poisson(homeExpectedGoals, 2)),
        '3 Goals': getOdds(poisson(homeExpectedGoals, 3)),
        '4 Goals': getOdds(poisson(homeExpectedGoals, 4))
      },
      awayExactGoals: {
        '0 Goals': getOdds(poisson(awayExpectedGoals, 0)),
        '1 Goal': getOdds(poisson(awayExpectedGoals, 1)),
        '2 Goals': getOdds(poisson(awayExpectedGoals, 2)),
        '3 Goals': getOdds(poisson(awayExpectedGoals, 3)),
        '4 Goals': getOdds(poisson(awayExpectedGoals, 4))
      },

      goalRange: {
        '0 Goals': getOdds(poisson(totalGoalsDist, 0)),
        '1 Goal': getOdds(poisson(totalGoalsDist, 1)),
        '2 Goals': getOdds(poisson(totalGoalsDist, 2)),
        '3 Goals': getOdds(poisson(totalGoalsDist, 3)),
        '4 Goals': getOdds(poisson(totalGoalsDist, 4)),
        '5+ Goals': getOdds(1 - cumulativePoisson(totalGoalsDist, 4))
      },

      doubleChanceFirstHalfBtts: {
        '1X & Yes': getOdds((homeProb + drawProb) * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        '1X & No': getOdds((homeProb + drawProb) * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))))),
        '12 & Yes': getOdds((homeProb + awayProb) * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        '12 & No': getOdds((homeProb + awayProb) * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))))),
        'X2 & Yes': getOdds((drawProb + awayProb) * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        'X2 & No': getOdds((drawProb + awayProb) * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0)))))
      },
      doubleChanceSecondHalfBtts: {
        '1X & Yes': getOdds((homeProb + drawProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        '1X & No': getOdds((homeProb + drawProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        '12 & Yes': getOdds((homeProb + awayProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        '12 & No': getOdds((homeProb + awayProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        'X2 & Yes': getOdds((drawProb + awayProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'X2 & No': getOdds((drawProb + awayProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0)))))
      },
      doubleChanceBtts: {
        '1X & Yes': getOdds((homeProb + drawProb) * bttsYes),
        '1X & No': getOdds((homeProb + drawProb) * bttsNo),
        '12 & Yes': getOdds((homeProb + awayProb) * bttsYes),
        '12 & No': getOdds((homeProb + awayProb) * bttsNo),
        'X2 & Yes': getOdds((drawProb + awayProb) * bttsYes),
        'X2 & No': getOdds((drawProb + awayProb) * bttsNo)
      },
      doubleChanceOverUnder: {
        '1X & Over 2.5': getOdds((homeProb + drawProb) * (1 - cumulativePoisson(totalGoalsDist, 2))),
        '1X & Under 2.5': getOdds((homeProb + drawProb) * cumulativePoisson(totalGoalsDist, 2)),
        '12 & Over 2.5': getOdds((homeProb + awayProb) * (1 - cumulativePoisson(totalGoalsDist, 2))),
        '12 & Under 2.5': getOdds((homeProb + awayProb) * cumulativePoisson(totalGoalsDist, 2)),
        'X2 & Over 2.5': getOdds((drawProb + awayProb) * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'X2 & Under 2.5': getOdds((drawProb + awayProb) * cumulativePoisson(totalGoalsDist, 2))
      },

      htFtFirstHalfOverUnder: {
        'Home/Home & Over 1.5': getOdds(homeProb * homeProb * 1.2 * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Home/Home & Under 1.5': getOdds(homeProb * homeProb * 1.2 * cumulativePoisson(halfTotalGoals, 1)),
        'Draw/Home & Over 1.5': getOdds(drawProb * homeProb * 1.6 * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Draw/Home & Under 1.5': getOdds(drawProb * homeProb * 1.6 * cumulativePoisson(halfTotalGoals, 1)),
        'Away/Away & Over 1.5': getOdds(awayProb * awayProb * 1.2 * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Away/Away & Under 1.5': getOdds(awayProb * awayProb * 1.2 * cumulativePoisson(halfTotalGoals, 1))
      },
      htFtExactGoals: {
        'Home/Home & 1 Goal': getOdds(homeProb * homeProb * 1.2 * poisson(totalGoalsDist, 1)),
        'Home/Home & 2 Goals': getOdds(homeProb * homeProb * 1.2 * poisson(totalGoalsDist, 2)),
        'Draw/Home & 1 Goal': getOdds(drawProb * homeProb * 1.6 * poisson(totalGoalsDist, 1)),
        'Draw/Home & 2 Goals': getOdds(drawProb * homeProb * 1.6 * poisson(totalGoalsDist, 2)),
        'Away/Away & 1 Goal': getOdds(awayProb * awayProb * 1.2 * poisson(totalGoalsDist, 1)),
        'Away/Away & 2 Goals': getOdds(awayProb * awayProb * 1.2 * poisson(totalGoalsDist, 2))
      },
      htFtOverUnder: {
        'Home/Home & Over 2.5': getOdds(homeProb * homeProb * 1.2 * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Home/Home & Under 2.5': getOdds(homeProb * homeProb * 1.2 * cumulativePoisson(totalGoalsDist, 2)),
        'Draw/Home & Over 2.5': getOdds(drawProb * homeProb * 1.6 * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Draw/Home & Under 2.5': getOdds(drawProb * homeProb * 1.6 * cumulativePoisson(totalGoalsDist, 2)),
        'Away/Away & Over 2.5': getOdds(awayProb * awayProb * 1.2 * (1 - cumulativePoisson(totalGoalsDist, 2))),
        'Away/Away & Under 2.5': getOdds(awayProb * awayProb * 1.2 * cumulativePoisson(totalGoalsDist, 2))
      },
      htFtCorrectScore: {
        'Home/Home 1-0': getOdds(homeProb * homeProb * 1.2 * correctScoreProbs['1-0']),
        'Home/Home 2-0': getOdds(homeProb * homeProb * 1.2 * correctScoreProbs['2-0']),
        'Home/Home 2-1': getOdds(homeProb * homeProb * 1.2 * correctScoreProbs['2-1']),
        'Draw/Home 1-0': getOdds(drawProb * homeProb * 1.6 * correctScoreProbs['1-0']),
        'Draw/Home 2-0': getOdds(drawProb * homeProb * 1.6 * correctScoreProbs['2-0']),
        'Away/Away 0-1': getOdds(awayProb * awayProb * 1.2 * correctScoreProbs['0-1']),
        'Away/Away 0-2': getOdds(awayProb * awayProb * 1.2 * correctScoreProbs['0-2'])
      },

      firstHalfDoubleChance: {
        '1X': getOdds(homeProb + drawProb),
        '12': getOdds(homeProb + awayProb),
        'X2': getOdds(drawProb + awayProb)
      },
      secondHalfDoubleChance: {
        '1X': getOdds(homeProb + drawProb),
        '12': getOdds(homeProb + awayProb),
        'X2': getOdds(drawProb + awayProb)
      },

      lastGoal: {
        'Home': getOdds(homeProb * 1.5),
        'Away': getOdds(awayProb * 1.5),
        'No Goal': 1.05
      },

      whichTeamToScore: {
        'Home Only': getOdds(homeProb * (1 - awayProb)),
        'Away Only': getOdds(awayProb * (1 - homeProb)),
        'Both': getOdds(homeProb * awayProb * 1.5),
        'Neither': getOdds((1 - homeProb) * (1 - awayProb))
      },

      oneGoal: {
        '0 Goals': getOdds(poisson(totalGoalsDist, 0)),
        '1 Goal': getOdds(poisson(totalGoalsDist, 1)),
        '2+ Goals': getOdds(1 - cumulativePoisson(totalGoalsDist, 1))
      },
      oneGoalAnd1x2: {
        'Home & 1 Goal': getOdds(homeProb * poisson(totalGoalsDist, 1)),
        'Draw & 1 Goal': getOdds(drawProb * poisson(totalGoalsDist, 1)),
        'Away & 1 Goal': getOdds(awayProb * poisson(totalGoalsDist, 1))
      },
      firstHalfOneGoal: {
        '0 Goals': getOdds(poisson(halfTotalGoals, 0)),
        '1 Goal': getOdds(poisson(halfTotalGoals, 1)),
        '2+ Goals': getOdds(1 - cumulativePoisson(halfTotalGoals, 1))
      },
      secondHalfOneGoal: {
        '0 Goals': getOdds(poisson(secondHalfTotalGoals, 0)),
        '1 Goal': getOdds(poisson(secondHalfTotalGoals, 1)),
        '2+ Goals': getOdds(1 - cumulativePoisson(secondHalfTotalGoals, 1))
      },

      homeNoBet: {
        'Yes': getOdds(homeProb / (homeProb + awayProb)),
        'No': getOdds(awayProb / (homeProb + awayProb))
      },
      awayNoBet: {
        'Yes': getOdds(awayProb / (homeProb + awayProb)),
        'No': getOdds(homeProb / (homeProb + awayProb))
      },
      homeWinBothHalves: {
        'Yes': getOdds(homeProb * homeProb * 1.2),
        'No': getOdds(1 - homeProb * homeProb * 1.2)
      },
      homeScoreBothHalves: {
        'Yes': getOdds((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(secondHalfHomeGoals, 0))),
        'No': getOdds(1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(secondHalfHomeGoals, 0))))
      },
      awayScoreBothHalves: {
        'Yes': getOdds((1 - poisson(halfAwayGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'No': getOdds(1 - ((1 - poisson(halfAwayGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))
      },
      homeWinEitherHalf: {
        'Yes': getOdds(homeProb * 1.2),
        'No': getOdds(1 - homeProb * 1.2)
      },
      awayWinEitherHalf: {
        'Yes': getOdds(awayProb * 1.2),
        'No': getOdds(1 - awayProb * 1.2)
      },

      highestScoringHalf: {
        '1st Half': 2.00,
        '2nd Half': 2.00,
        'Both Equal': 3.00
      },
      homeHighestScoringHalf: {
        '1st Half': 2.50,
        '2nd Half': 2.50,
        'Both Equal': 3.50
      },
      awayHighestScoringHalf: {
        '1st Half': 2.50,
        '2nd Half': 2.50,
        'Both Equal': 3.50
      },

      firstHalf1x2Btts: {
        'Home & Yes': getOdds(homeProb * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        'Home & No': getOdds(homeProb * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))))),
        'Draw & Yes': getOdds(drawProb * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        'Draw & No': getOdds(drawProb * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))))),
        'Away & Yes': getOdds(awayProb * (1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0))),
        'Away & No': getOdds(awayProb * (1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0)))))
      },
      firstHalf1x2OverUnder: {
        'Home & Over 1.5': getOdds(homeProb * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Home & Under 1.5': getOdds(homeProb * cumulativePoisson(halfTotalGoals, 1)),
        'Draw & Over 1.5': getOdds(drawProb * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Draw & Under 1.5': getOdds(drawProb * cumulativePoisson(halfTotalGoals, 1)),
        'Away & Over 1.5': getOdds(awayProb * (1 - cumulativePoisson(halfTotalGoals, 1))),
        'Away & Under 1.5': getOdds(awayProb * cumulativePoisson(halfTotalGoals, 1))
      },

      secondHalfResult: {
        'Home': getOdds(homeProb * 1.2),
        'Draw': getOdds(drawProb * 0.9),
        'Away': getOdds(awayProb * 1.2)
      },
      secondHalfBtts: {
        'Yes': getOdds((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'No': getOdds(1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))
      },
      secondHalf3WayBtts: {
        'Home & Yes': getOdds(homeProb * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'Home & No': getOdds(homeProb * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        'Draw & Yes': getOdds(drawProb * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'Draw & No': getOdds(drawProb * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        'Away & Yes': getOdds(awayProb * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'Away & No': getOdds(awayProb * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0)))))
      },
      secondHalf3WayOverUnder: {
        'Home & Over 1.5': getOdds(homeProb * (1 - cumulativePoisson(secondHalfTotalGoals, 1))),
        'Home & Under 1.5': getOdds(homeProb * cumulativePoisson(secondHalfTotalGoals, 1)),
        'Draw & Over 1.5': getOdds(drawProb * (1 - cumulativePoisson(secondHalfTotalGoals, 1))),
        'Draw & Under 1.5': getOdds(drawProb * cumulativePoisson(secondHalfTotalGoals, 1)),
        'Away & Over 1.5': getOdds(awayProb * (1 - cumulativePoisson(secondHalfTotalGoals, 1))),
        'Away & Under 1.5': getOdds(awayProb * cumulativePoisson(secondHalfTotalGoals, 1))
      },

      secondHalfCorrectScore: {
        '0-0': getOdds(secondHalfCorrectScoreProbs['0-0']),
        '1-0': getOdds(secondHalfCorrectScoreProbs['1-0']),
        '2-0': getOdds(secondHalfCorrectScoreProbs['2-0']),
        '2-1': getOdds(secondHalfCorrectScoreProbs['2-1']),
        '1-1': getOdds(secondHalfCorrectScoreProbs['1-1']),
        '0-1': getOdds(secondHalfCorrectScoreProbs['0-1']),
        '0-2': getOdds(secondHalfCorrectScoreProbs['0-2']),
        '1-2': getOdds(secondHalfCorrectScoreProbs['1-2'])
      },

      secondHalfDoubleChance: {
        '1X': getOdds(homeProb + drawProb),
        '12': getOdds(homeProb + awayProb),
        'X2': getOdds(drawProb + awayProb)
      },
      secondHalfDoubleChanceBtts: {
        '1X & Yes': getOdds((homeProb + drawProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        '1X & No': getOdds((homeProb + drawProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        '12 & Yes': getOdds((homeProb + awayProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        '12 & No': getOdds((homeProb + awayProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))),
        'X2 & Yes': getOdds((drawProb + awayProb) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'X2 & No': getOdds((drawProb + awayProb) * (1 - ((1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0)))))
      },

      secondHalfDrawNoBet: {
        'Home': getOdds(homeProb / (homeProb + awayProb)),
        'Away': getOdds(awayProb / (homeProb + awayProb))
      },

      secondHalfExactGoals: {
        '0 Goals': getOdds(poisson(secondHalfTotalGoals, 0)),
        '1 Goal': getOdds(poisson(secondHalfTotalGoals, 1)),
        '2 Goals': getOdds(poisson(secondHalfTotalGoals, 2)),
        '3 Goals': getOdds(poisson(secondHalfTotalGoals, 3)),
        '4 Goals': getOdds(poisson(secondHalfTotalGoals, 4))
      },

      secondHalfOverUnder: {
        'Over 0.5': ouSecondHalf(0).over,
        'Under 0.5': ouSecondHalf(0).under,
        'Over 1.5': ouSecondHalf(1).over,
        'Under 1.5': ouSecondHalf(1).under,
        'Over 2.5': ouSecondHalf(2).over,
        'Under 2.5': ouSecondHalf(2).under
      },

      bothHalvesBtts: {
        'Yes': getOdds((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0)) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))),
        'No': getOdds(1 - ((1 - poisson(halfHomeGoals, 0)) * (1 - poisson(halfAwayGoals, 0)) * (1 - poisson(secondHalfHomeGoals, 0)) * (1 - poisson(secondHalfAwayGoals, 0))))
      },
      bothHalvesOver1_5: {
        'Yes': getOdds((1 - cumulativePoisson(halfTotalGoals, 1)) * (1 - cumulativePoisson(secondHalfTotalGoals, 1))),
        'No': getOdds(1 - ((1 - cumulativePoisson(halfTotalGoals, 1)) * (1 - cumulativePoisson(secondHalfTotalGoals, 1))))
      },
      bothHalvesUnder1_5: {
        'Yes': getOdds(cumulativePoisson(halfTotalGoals, 1) * cumulativePoisson(secondHalfTotalGoals, 1)),
        'No': getOdds(1 - (cumulativePoisson(halfTotalGoals, 1) * cumulativePoisson(secondHalfTotalGoals, 1)))
      },

      tenMinute3Way: {
        'Home': 4.00,
        'Draw': 2.50,
        'Away': 5.00
      },

      overUnderBtts: {
        'Over 2.5 & Yes': getOdds((1 - cumulativePoisson(totalGoalsDist, 2)) * bttsYes),
        'Over 2.5 & No': getOdds((1 - cumulativePoisson(totalGoalsDist, 2)) * bttsNo),
        'Under 2.5 & Yes': getOdds(cumulativePoisson(totalGoalsDist, 2) * bttsYes),
        'Under 2.5 & No': getOdds(cumulativePoisson(totalGoalsDist, 2) * bttsNo)
      },

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

      cards: {
        'Over 2.5 Yellow': 1.70,
        'Under 2.5 Yellow': 2.10,
        'Red Card - Yes': 3.00,
        'Red Card - No': 1.30
      },

      penalty: {
        'Penalty Awarded': 2.50,
        'No Penalty': 1.50
      },

      playerMarkets: {
        'Anytime Goalscorer': 2.50,
        'First Goalscorer': 5.00,
        'Last Goalscorer': 5.50,
        'Player to Receive Card': 3.00,
        'Player to Assist': 3.50
      },

      specials: {
        'Clean Sheet - Home': getOdds(poisson(awayExpectedGoals, 0)),
        'Clean Sheet - Away': getOdds(poisson(homeExpectedGoals, 0)),
        'Win to Nil - Home': getOdds(homeProb * poisson(awayExpectedGoals, 0)),
        'Win to Nil - Away': getOdds(awayProb * poisson(homeExpectedGoals, 0)),
        'Both Halves Over 1.5': getOdds((1 - cumulativePoisson(halfTotalGoals, 1)) * (1 - cumulativePoisson(secondHalfTotalGoals, 1))),
        'Highest Scoring Half - 1st': 2.00,
        'Highest Scoring Half - 2nd': 2.00,
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
      firstHalfResult: { 'Home': 2.50, 'Draw': 2.00, 'Away': 3.00 },
      halfTimeFullTime: {
        'Home/Home': 2.50, 'Home/Draw': 15.00, 'Home/Away': 30.00,
        'Draw/Home': 5.00, 'Draw/Draw': 4.50, 'Draw/Away': 6.00,
        'Away/Home': 25.00, 'Away/Draw': 12.00, 'Away/Away': 3.50
      },
      firstHalfCorrectScore: {
        '0-0': 4.00, '1-0': 3.50, '2-0': 5.00, '2-1': 6.00,
        '3-0': 8.00, '3-1': 10.00, '3-2': 15.00, '1-1': 4.50,
        '2-2': 8.00, '0-1': 4.00, '0-2': 5.50, '1-2': 6.50,
        '0-3': 12.00
      },
      drawNoBet: { 'Home': 1.50, 'Away': 2.50 },
      oddEven: { 'Odd': 1.90, 'Even': 1.90 },
      firstHalfOddEven: { 'Odd': 1.90, 'Even': 1.90 },
      secondHalfOddEven: { 'Odd': 1.90, 'Even': 1.90 },
      homeOddEven: { 'Odd': 1.90, 'Even': 1.90 },
      awayOddEven: { 'Odd': 1.90, 'Even': 1.90 },
      firstHalfBtts: { 'Yes': 2.50, 'No': 1.50 },
      firstHalfTotalGoals: {
        'Over 0.5': 1.15, 'Under 0.5': 5.50,
        'Over 1.5': 1.50, 'Under 1.5': 2.50,
        'Over 2.5': 3.00, 'Under 2.5': 1.30,
        'Over 3.5': 5.00, 'Under 3.5': 1.10,
        'Over 4.5': 8.00, 'Under 4.5': 1.05
      },
      exactGoals: {
        '0 Goals': 8.00, '1 Goal': 4.50, '2 Goals': 3.50,
        '3 Goals': 4.00, '4 Goals': 7.00, '5+ Goals': 12.00
      },
      threeWayOverUnder: {
        'Home & Over 2.5': 3.50, 'Home & Under 2.5': 4.00,
        'Draw & Over 2.5': 6.00, 'Draw & Under 2.5': 5.00,
        'Away & Over 2.5': 4.50, 'Away & Under 2.5': 5.50
      },
      threeWayBtts: {
        'Home & Yes': 4.00, 'Home & No': 5.00,
        'Draw & Yes': 6.00, 'Draw & No': 7.00,
        'Away & Yes': 4.50, 'Away & No': 5.50
      },
      firstHalfHandicap: { 'Home -1': 3.00, 'Away +1': 1.50 },
      secondHalfHandicap: { 'Home -1': 3.00, 'Away +1': 1.50 },
      handicap: { 'Home -1': 1.50, 'Home -2': 2.50, 'Away +1': 2.00, 'Away +2': 1.80 },
      homeCleanSheet: { 'Yes': 2.00, 'No': 1.70 },
      awayCleanSheet: { 'Yes': 2.50, 'No': 1.50 },
      firstHalfHomeCleanSheet: { 'Yes': 2.50, 'No': 1.50 },
      firstHalfAwayCleanSheet: { 'Yes': 3.00, 'No': 1.30 },
      secondHalfHomeCleanSheet: { 'Yes': 2.50, 'No': 1.50 },
      secondHalfAwayCleanSheet: { 'Yes': 3.00, 'No': 1.30 },
      homeOverUnder: {
        'Over 0.5': 1.50, 'Under 0.5': 2.50,
        'Over 1.5': 2.50, 'Under 1.5': 1.50,
        'Over 2.5': 4.50, 'Under 2.5': 1.20
      },
      firstHalfHomeOverUnder: {
        'Over 0.5': 1.80, 'Under 0.5': 2.00,
        'Over 1.5': 3.00, 'Under 1.5': 1.30
      },
      secondHalfHomeOverUnder: {
        'Over 0.5': 1.80, 'Under 0.5': 2.00,
        'Over 1.5': 3.00, 'Under 1.5': 1.30
      },
      awayTotal: {
        'Over 0.5': 1.80, 'Under 0.5': 2.00,
        'Over 1.5': 3.50, 'Under 1.5': 1.30
      },
      firstHalfAwayOverUnder: {
        'Over 0.5': 2.00, 'Under 0.5': 1.80,
        'Over 1.5': 3.50, 'Under 1.5': 1.30
      },
      secondHalfAwayOverUnder: {
        'Over 0.5': 2.00, 'Under 0.5': 1.80,
        'Over 1.5': 3.50, 'Under 1.5': 1.30
      },
      homeExactGoals: {
        '0 Goals': 3.00, '1 Goal': 2.50, '2 Goals': 4.00,
        '3 Goals': 6.00, '4 Goals': 10.00
      },
      awayExactGoals: {
        '0 Goals': 2.50, '1 Goal': 2.00, '2 Goals': 4.50,
        '3 Goals': 8.00, '4 Goals': 14.00
      },
      goalRange: {
        '0 Goals': 8.00, '1 Goal': 4.50, '2 Goals': 3.50,
        '3 Goals': 4.00, '4 Goals': 7.00, '5+ Goals': 12.00
      },
      doubleChanceFirstHalfBtts: {
        '1X & Yes': 4.00, '1X & No': 5.00,
        '12 & Yes': 4.50, '12 & No': 5.50,
        'X2 & Yes': 5.00, 'X2 & No': 6.00
      },
      doubleChanceSecondHalfBtts: {
        '1X & Yes': 4.00, '1X & No': 5.00,
        '12 & Yes': 4.50, '12 & No': 5.50,
        'X2 & Yes': 5.00, 'X2 & No': 6.00
      },
      doubleChanceBtts: {
        '1X & Yes': 3.50, '1X & No': 4.50,
        '12 & Yes': 4.00, '12 & No': 5.00,
        'X2 & Yes': 4.50, 'X2 & No': 5.50
      },
      doubleChanceOverUnder: {
        '1X & Over 2.5': 4.00, '1X & Under 2.5': 3.50,
        '12 & Over 2.5': 4.50, '12 & Under 2.5': 4.00,
        'X2 & Over 2.5': 5.00, 'X2 & Under 2.5': 4.50
      },
      htFtFirstHalfOverUnder: {
        'Home/Home & Over 1.5': 6.00, 'Home/Home & Under 1.5': 7.00,
        'Draw/Home & Over 1.5': 8.00, 'Draw/Home & Under 1.5': 9.00,
        'Away/Away & Over 1.5': 7.00, 'Away/Away & Under 1.5': 8.00
      },
      htFtExactGoals: {
        'Home/Home & 1 Goal': 5.00, 'Home/Home & 2 Goals': 7.00,
        'Draw/Home & 1 Goal': 6.00, 'Draw/Home & 2 Goals': 8.00,
        'Away/Away & 1 Goal': 6.00, 'Away/Away & 2 Goals': 8.00
      },
      htFtOverUnder: {
        'Home/Home & Over 2.5': 5.50, 'Home/Home & Under 2.5': 6.50,
        'Draw/Home & Over 2.5': 7.00, 'Draw/Home & Under 2.5': 8.00,
        'Away/Away & Over 2.5': 6.00, 'Away/Away & Under 2.5': 7.00
      },
      htFtCorrectScore: {
        'Home/Home 1-0': 8.00, 'Home/Home 2-0': 12.00, 'Home/Home 2-1': 14.00,
        'Draw/Home 1-0': 10.00, 'Draw/Home 2-0': 15.00,
        'Away/Away 0-1': 9.00, 'Away/Away 0-2': 13.00
      },
      firstHalfDoubleChance: { '1X': 1.50, '12': 1.80, 'X2': 2.00 },
      secondHalfDoubleChance: { '1X': 1.50, '12': 1.80, 'X2': 2.00 },
      lastGoal: { 'Home': 1.90, 'Away': 1.90, 'No Goal': 10.00 },
      whichTeamToScore: {
        'Home Only': 3.00, 'Away Only': 3.50,
        'Both': 2.00, 'Neither': 8.00
      },
      oneGoal: { '0 Goals': 8.00, '1 Goal': 4.50, '2+ Goals': 2.50 },
      oneGoalAnd1x2: {
        'Home & 1 Goal': 6.00, 'Draw & 1 Goal': 8.00, 'Away & 1 Goal': 7.00
      },
      firstHalfOneGoal: { '0 Goals': 3.00, '1 Goal': 2.50, '2+ Goals': 3.50 },
      secondHalfOneGoal: { '0 Goals': 3.50, '1 Goal': 2.50, '2+ Goals': 3.00 },
      homeNoBet: { 'Yes': 1.80, 'No': 2.00 },
      awayNoBet: { 'Yes': 2.00, 'No': 1.80 },
      homeWinBothHalves: { 'Yes': 4.00, 'No': 1.20 },
      homeScoreBothHalves: { 'Yes': 3.00, 'No': 1.30 },
      awayScoreBothHalves: { 'Yes': 3.50, 'No': 1.20 },
      homeWinEitherHalf: { 'Yes': 2.00, 'No': 1.80 },
      awayWinEitherHalf: { 'Yes': 2.20, 'No': 1.70 },
      highestScoringHalf: { '1st Half': 2.00, '2nd Half': 2.00, 'Both Equal': 3.00 },
      homeHighestScoringHalf: { '1st Half': 2.50, '2nd Half': 2.50, 'Both Equal': 3.50 },
      awayHighestScoringHalf: { '1st Half': 2.50, '2nd Half': 2.50, 'Both Equal': 3.50 },
      firstHalf1x2Btts: {
        'Home & Yes': 5.00, 'Home & No': 6.00,
        'Draw & Yes': 7.00, 'Draw & No': 8.00,
        'Away & Yes': 5.50, 'Away & No': 6.50
      },
      firstHalf1x2OverUnder: {
        'Home & Over 1.5': 4.50, 'Home & Under 1.5': 5.50,
        'Draw & Over 1.5': 6.00, 'Draw & Under 1.5': 5.00,
        'Away & Over 1.5': 5.00, 'Away & Under 1.5': 6.00
      },
      secondHalfResult: { 'Home': 2.50, 'Draw': 2.00, 'Away': 3.00 },
      secondHalfBtts: { 'Yes': 2.50, 'No': 1.50 },
      secondHalf3WayBtts: {
        'Home & Yes': 4.50, 'Home & No': 5.50,
        'Draw & Yes': 6.00, 'Draw & No': 7.00,
        'Away & Yes': 5.00, 'Away & No': 6.00
      },
      secondHalf3WayOverUnder: {
        'Home & Over 1.5': 4.00, 'Home & Under 1.5': 5.00,
        'Draw & Over 1.5': 6.00, 'Draw & Under 1.5': 5.50,
        'Away & Over 1.5': 4.50, 'Away & Under 1.5': 5.50
      },
      secondHalfCorrectScore: {
        '0-0': 5.00, '1-0': 4.50, '2-0': 6.00, '2-1': 7.00,
        '1-1': 5.50, '0-1': 5.00, '0-2': 7.00, '1-2': 8.00
      },
      secondHalfDoubleChance: { '1X': 1.50, '12': 1.80, 'X2': 2.00 },
      secondHalfDoubleChanceBtts: {
        '1X & Yes': 4.00, '1X & No': 5.00,
        '12 & Yes': 4.50, '12 & No': 5.50,
        'X2 & Yes': 5.00, 'X2 & No': 6.00
      },
      secondHalfDrawNoBet: { 'Home': 1.80, 'Away': 2.20 },
      secondHalfExactGoals: {
        '0 Goals': 3.50, '1 Goal': 2.50, '2 Goals': 4.50,
        '3 Goals': 8.00, '4 Goals': 14.00
      },
      secondHalfOverUnder: {
        'Over 0.5': 1.50, 'Under 0.5': 2.50,
        'Over 1.5': 2.50, 'Under 1.5': 1.50,
        'Over 2.5': 4.50, 'Under 2.5': 1.20
      },
      bothHalvesBtts: { 'Yes': 3.00, 'No': 1.30 },
      bothHalvesOver1_5: { 'Yes': 3.50, 'No': 1.30 },
      bothHalvesUnder1_5: { 'Yes': 1.30, 'No': 3.50 },
      tenMinute3Way: { 'Home': 4.00, 'Draw': 2.50, 'Away': 5.00 },
      overUnderBtts: {
        'Over 2.5 & Yes': 3.50, 'Over 2.5 & No': 4.50,
        'Under 2.5 & Yes': 4.00, 'Under 2.5 & No': 3.00
      },
      corners: {
        'Over 8.5': 1.80, 'Under 8.5': 2.00,
        'Home Most': 2.00, 'Away Most': 2.20,
        'First Corner - Home': 1.90, 'First Corner - Away': 2.10,
        'Last Corner - Home': 2.00, 'Last Corner - Away': 2.00
      },
      cards: {
        'Over 2.5 Yellow': 1.70, 'Under 2.5 Yellow': 2.10,
        'Red Card - Yes': 3.00, 'Red Card - No': 1.30
      },
      penalty: { 'Penalty Awarded': 2.50, 'No Penalty': 1.50 },
      playerMarkets: {
        'Anytime Goalscorer': 2.50, 'First Goalscorer': 5.00,
        'Last Goalscorer': 5.50, 'Player to Receive Card': 3.00,
        'Player to Assist': 3.50
      },
      specials: {
        'Clean Sheet - Home': 2.00, 'Clean Sheet - Away': 2.50,
        'Win to Nil - Home': 3.00, 'Win to Nil - Away': 4.00,
        'Both Halves Over 1.5': 6.00,
        'Highest Scoring Half - 1st': 2.00,
        'Highest Scoring Half - 2nd': 2.20,
        'Odd Total Goals': 1.90, 'Even Total Goals': 1.90
      }
    };
  };

  // ============================================
  // ALL CLUBS BY LEAGUE (Full List)
  // ============================================
  const clubsByLeague = {
    'Premier League': [
      'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
      'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich Town',
      'Liverpool', 'Manchester City', 'Manchester United', 'Newcastle United',
      'Nottingham Forest', 'Sunderland', 'Tottenham Hotspur', 'Coventry City',
      'Hull City', 'Leicester City'
    ],
    'Championship': [
      'Blackburn Rovers', 'Bristol City', 'Burnley', 'Cardiff City', 'Derby County',
      'Huddersfield Town', 'Leeds United', 'Luton Town', 'Middlesbrough', 'Millwall',
      'Norwich City', 'Oxford United', 'Plymouth Argyle', 'Portsmouth', 'Preston North End',
      'Queens Park Rangers', 'Sheffield United', 'Sheffield Wednesday', 'Stoke City',
      'Swansea City', 'Watford', 'West Bromwich Albion', 'Wigan Athletic', 'Wrexham'
    ],
    'FA Cup': [
      'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
      'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Liverpool',
      'Manchester City', 'Manchester United', 'Newcastle United', 'Tottenham Hotspur',
      'West Ham United', 'Wolverhampton Wanderers'
    ],
    'EFL Cup': [
      'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
      'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Liverpool',
      'Manchester City', 'Manchester United', 'Newcastle United', 'Tottenham Hotspur'
    ],
    'Community Shield': [
      'Manchester City', 'Arsenal'
    ],
    'Bundesliga': [
      'Augsburg', 'Union Berlin', 'Werder Bremen', 'Borussia Dortmund',
      'SV Elversberg', 'Eintracht Frankfurt', 'Freiburg', 'Hamburger SV',
      'Hoffenheim', 'FC Köln', 'RB Leipzig', 'Bayer Leverkusen', 'Mainz',
      'Borussia Mönchengladbach', 'Bayern Munich', 'SC Paderborn', 'Schalke 04',
      'VfB Stuttgart'
    ],
    '2. Bundesliga': [
      'Darmstadt 98', 'Fortuna Düsseldorf', 'Greuther Fürth', 'Hannover 96',
      'Hertha BSC', 'Kaiserslautern', 'Karlsruher SC', 'Magdeburg', 'Nürnberg',
      'Preußen Münster', 'Regensburg', 'Sandhausen', 'St. Pauli', 'Ulm'
    ],
    'DFB-Pokal': [
      'Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen',
      'Eintracht Frankfurt', 'Freiburg', 'Union Berlin', 'VfB Stuttgart'
    ],
    'DFL-Supercup': [
      'Bayer Leverkusen', 'Bayern Munich'
    ],
    'Eredivisie': [
      'ADO Den Haag', 'Ajax', 'AZ Alkmaar', 'Excelsior', 'FC Groningen',
      'FC Twente', 'FC Utrecht', 'Feyenoord', 'Fortuna Sittard', 'Go Ahead Eagles',
      'NEC Nijmegen', 'PEC Zwolle', 'PSV Eindhoven', 'SC Cambuur', 'SC Heerenveen',
      'Sparta Rotterdam', 'Telstar', 'Willem II'
    ],
    'Eerste Divisie': [
      'De Graafschap', 'Dordrecht', 'Emmen', 'FC Eindhoven', 'FC Volendam',
      'Helmond Sport', 'Jong Ajax', 'Jong AZ', 'Jong PSV', 'Jong Utrecht',
      'MVV Maastricht', 'Roda JC', 'TOP Oss', 'VVV-Venlo'
    ],
    'KNVB Cup': [
      'Ajax', 'Feyenoord', 'PSV Eindhoven', 'AZ Alkmaar', 'FC Twente',
      'FC Utrecht', 'Groningen', 'Heerenveen'
    ],
    'Johan Cruyff Shield': [
      'PSV Eindhoven', 'Feyenoord'
    ],
    'La Liga': [
      'Athletic Bilbao', 'Atletico Madrid', 'Osasuna', 'Celta Vigo', 'Alaves',
      'Elche', 'Barcelona', 'Getafe', 'Levante', 'Malaga', 'Racing Santander',
      'Rayo Vallecano', 'Deportivo La Coruna', 'Espanyol', 'Real Betis',
      'Real Madrid', 'Real Sociedad', 'Sevilla', 'Valencia', 'Villarreal'
    ],
    'Segunda División': [
      'Albacete', 'Almería', 'Burgos', 'Cartagena', 'Castellón', 'Córdoba',
      'Eibar', 'Eldense', 'FC Andorra', 'Granada', 'Huesca', 'Leganés',
      'Mirandés', 'Oviedo', 'Real Zaragoza', 'Santander', 'Sporting Gijón', 'Tenerife'
    ],
    'Copa del Rey': [
      'Barcelona', 'Real Madrid', 'Atletico Madrid', 'Athletic Bilbao',
      'Real Sociedad', 'Sevilla', 'Valencia', 'Villarreal'
    ],
    'Supercopa de España': [
      'Real Madrid', 'Barcelona'
    ],
    'Liga Portugal': [
      'Estrela Amadora', 'Estoril', 'Famalicão', 'Gil Vicente', 'Rio Ave',
      'Marítimo', 'Casa Pia', 'Moreirense', 'Braga', 'Porto', 'Alverca',
      'Santa Clara', 'Nacional', 'Benfica', 'Académico de Viseu',
      'Vitória Guimarães', 'Arouca', 'Sporting CP'
    ],
    'Liga Portugal 2': [
      'Académico Viseu', 'Benfica B', 'Chaves', 'Feirense', 'Leixões',
      'Mafra', 'Paços Ferreira', 'Portimonense', 'Tondela', 'Torreense',
      'União Leiria', 'Vizela'
    ],
    'Taça de Portugal': [
      'Porto', 'Benfica', 'Sporting CP', 'Braga', 'Vitória Guimarães'
    ],
    'Supertaça Cândido de Oliveira': [
      'Sporting CP', 'Porto'
    ],
    'Ligue 1': [
      'Angers', 'Auxerre', 'Brest', 'Le Havre', 'Le Mans', 'Lens',
      'Lorient', 'Lille', 'Lyon', 'Marseille', 'Monaco', 'Nice',
      'Paris FC', 'PSG', 'Rennes', 'Strasbourg', 'Toulouse', 'Troyes'
    ],
    'Ligue 2': [
      'Amiens', 'Annecy', 'Bastia', 'Bordeaux', 'Caen', 'Clermont',
      'Dunkerque', 'Grenoble', 'Guingamp', 'Laval', 'Martigues', 'Metz',
      'Nancy', 'Nîmes', 'Quevilly-Rouen', 'Rodez', 'Saint-Étienne', 'Valenciennes'
    ],
    'Coupe de France': [
      'PSG', 'Marseille', 'Lyon', 'Lille', 'Monaco', 'Nice', 'Rennes', 'Lens'
    ],
    'Trophée des Champions': [
      'PSG', 'Toulouse'
    ],
    'Pro League': [
      'Anderlecht', 'Antwerp', 'Cercle Brugge', 'Charleroi', 'Club Brugge',
      'Genk', 'Gent', 'Kortrijk', 'Mechelen', 'Westerlo', 'Lommel',
      'OH Leuven', 'RAAL La Louvière', 'Sint-Truiden', 'SK Beveren',
      'Standard Liège', 'Union Saint-Gilloise', 'Zulte Waregem'
    ],
    'Challenger Pro League': [
      'Beerschot', 'Dender', 'Eupen', 'Francs Borains', 'Lierse',
      'Lokeren-Temse', 'Patro Eisden', 'RSCA Futures', 'Royal Antwerp B',
      'Seraing', 'Virton', 'Zulte Waregem B'
    ],
    'Belgian Cup': [
      'Club Brugge', 'Anderlecht', 'Genk', 'Gent', 'Antwerp', 'Standard Liège'
    ],
    'Belgian Super Cup': [
      'Club Brugge', 'Union Saint-Gilloise'
    ],
    'Serie A': [
      'AC Milan', 'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Fiorentina',
      'Frosinone', 'Genoa', 'Inter Milan', 'Juventus', 'Lazio', 'Lecce',
      'Monza', 'Napoli', 'Parma', 'Roma', 'Sassuolo', 'Torino', 'Udinese',
      'Venezia'
    ],
    'Serie B': [
      'Bari', 'Brescia', 'Carrarese', 'Catania', 'Cesena', 'Cittadella',
      'Cremonese', 'Crotone', 'Empoli', 'Modena', 'Palermo', 'Pisa',
      'Reggiana', 'Salernitana', 'Sampdoria', 'Spezia', 'Südtirol', 'Ternana'
    ],
    'Coppa Italia': [
      'Inter Milan', 'AC Milan', 'Juventus', 'Napoli', 'Roma', 'Lazio',
      'Atalanta', 'Fiorentina'
    ],
    'Supercoppa Italiana': [
      'Napoli', 'Inter Milan'
    ],
    'Allsvenskan': [
      'AIK', 'BK Häcken', 'Brommapojkarna', 'Degerfors', 'Djurgårdens IF',
      'Elfsborg', 'GAIS', 'Halmstad', 'Hammarby IF', 'IFK Göteborg',
      'Kalmar FF', 'Malmö FF', 'Mjällby AIF', 'Sirius', 'Västerås SK',
      'Örgryte IS'
    ],
    'Superettan': [
      'AFC Eskilstuna', 'Brage', 'Falkenberg', 'Gefle', 'Helsingborg',
      'Jönköpings Södra', 'Landskrona', 'Norrby', 'Oddevold', 'Sandviken',
      'Skövde', 'Trelleborg', 'Utsikten', 'Varbergs BoIS'
    ],
    'Svenska Cupen': [
      'Malmö FF', 'AIK', 'Djurgårdens IF', 'Hammarby IF', 'IFK Göteborg'
    ],
    'Svenska Supercupen': [
      'Malmö FF', 'Elfsborg'
    ],
    'Danish Superliga': [
      'AGF Aarhus', 'Brøndby IF', 'FC Copenhagen', 'FC Fredericia',
      'FC Midtjylland', 'FC Nordsjælland', 'Odense BK', 'Randers FC',
      'Silkeborg IF', 'Sønderjyske', 'Vejle BK', 'Viborg FF'
    ],
    '1st Division': [
      'AC Horsens', 'B.93', 'Esbjerg', 'FC Roskilde', 'HB Køge', 'Hillerød',
      'Hobro', 'Kolding IF', 'Næstved', 'Vendsyssel FF'
    ],
    'Danish Cup': [
      'FC Copenhagen', 'Brøndby IF', 'FC Midtjylland', 'AGF Aarhus'
    ],
    'Danish Super Cup': [
      'FC Midtjylland', 'FC Copenhagen'
    ],
    'Eliteserien': [
      'Bodø/Glimt', 'Viking', 'Tromsø', 'Lillestrøm', 'Molde', 'Sarpsborg 08',
      'Vålerenga', 'Brann', 'Rosenborg', 'HamKam', 'Sandefjord', 'Fredrikstad',
      'Aalesund', 'KFUM', 'Kristiansund', 'Start'
    ],
    'OBOS-ligaen': [
      'Bryne', 'Egersund', 'Hødd', 'Hønefoss', 'Kongsvinger', 'Mjøndalen',
      'Moss', 'Ranheim', 'Raufoss', 'Sogndal', 'Stabæk', 'Strømmen'
    ],
    'Norwegian Cup': [
      'Molde', 'Bodø/Glimt', 'Brann', 'Rosenborg', 'Vålerenga'
    ],
    'Mesterfinalen': [
      'Bodø/Glimt', 'Molde'
    ],
    'Swiss Super League': [
      'Grasshoppers', 'St. Gallen', 'FC Thun', 'Lausanne-Sport', 'Luzern',
      'Young Boys', 'Sion', 'FC Zürich', 'Lugano', 'Servette', 'FC Basel',
      'FC Vaduz'
    ],
    'Challenge League': [
      'Aarau', 'Baden', 'Bellinzona', 'Cham', 'Kriens', 'Neuchâtel Xamax',
      'Schaffhausen', 'Stade Nyonnais', 'Wil', 'Winterthur', 'Yverdon-Sport'
    ],
    'Swiss Cup': [
      'Young Boys', 'FC Basel', 'FC Zürich', 'Luzern', 'Servette'
    ],
    'Swiss Super Cup': [
      'Young Boys', 'FC Zürich'
    ],
    'Austrian Bundesliga': [
      'Red Bull Salzburg', 'Sturm Graz', 'Rapid Wien', 'Austria Wien',
      'Wolfsberger AC', 'TSV Hartberg', 'LASK', 'Austria Klagenfurt',
      'Blau-Weiß Linz', 'WSG Tirol', 'SCR Altach', 'SV Ried'
    ],
    '2. Liga': [
      'Amstetten', 'Bregenz', 'Dornbirn', 'FAC Wien', 'Floridsdorf',
      'Graz AK', 'Horn', 'Kapfenberg', 'Lafnitz', 'Leoben', 'Liefering',
      'Stripfing', 'St. Pölten', 'Voitsberg'
    ],
    'Austrian Cup': [
      'Red Bull Salzburg', 'Sturm Graz', 'Rapid Wien', 'Austria Wien'
    ],
    'Austrian Supercup': [
      'Red Bull Salzburg', 'Sturm Graz'
    ],
    'Super League Greece': [
      'AEK Athens', 'Aris', 'Asteras Tripolis', 'Kifisia', 'Atromitos',
      'Iraklis', 'Levadiakos', 'Kalamata', 'OFI Crete', 'Olympiacos',
      'Panathinaikos', 'Panetolikos', 'PAOK', 'Volos'
    ],
    'Super League Greece 2': [
      'Apollon Smyrnis', 'Chania', 'Diagoras', 'Egaleo', 'Ionikos',
      'Iraklis Larissa', 'Kallithea', 'Larissa', 'Niki Volos', 'Olympiacos B',
      'PAOK B', 'Panathinaikos B', 'PAS Giannina', 'Xanthi'
    ],
    'Greek Cup': [
      'Olympiacos', 'AEK Athens', 'Panathinaikos', 'PAOK', 'Aris'
    ],
    'Greek Super Cup': [
      'Olympiacos', 'AEK Athens'
    ],
    'Süper Lig': [
      'Amedspor', 'Antalyaspor', 'Alanyaspor', 'Başakşehir', 'Beşiktaş',
      'Çorum FK', 'Erzurumspor', 'Fenerbahçe', 'Galatasaray', 'Gaziantep FK',
      'Gençlerbirliği', 'Göztepe', 'Kayserispor', 'Kasımpaşa', 'Konyaspor',
      'Rizespor', 'Samsunspor', 'Trabzonspor'
    ],
    'TFF 1. Lig': [
      'Adanaspor', 'Boluspor', 'Eskişehirspor', 'Giresunspor', 'Keçiörengücü',
      'Manisa FK', 'MKE Ankaragücü', 'Osmangazi', 'Sakaryaspor', 'Sivasspor',
      'Şanlıurfaspor', 'Tuzlaspor', 'Ümraniyespor', 'Yeni Malatyaspor'
    ],
    'Turkish Cup': [
      'Galatasaray', 'Fenerbahçe', 'Beşiktaş', 'Trabzonspor', 'Başakşehir'
    ],
    'Turkish Super Cup': [
      'Galatasaray', 'Fenerbahçe'
    ],
    'Russian Premier League': [
      'Akhmat Grozny', 'Akron Togliatti', 'Baltika Kaliningrad', 'CSKA Moscow',
      'Dynamo Makhachkala', 'Dynamo Moscow', 'Krasnodar', 'Krylia Sovetov',
      'Lokomotiv Moscow', 'Orenburg', 'Pari Nizhny Novgorod', 'Rostov',
      'Rubin Kazan', 'Sochi', 'Spartak Moscow', 'Zenit'
    ],
    'Russian First League': [
      'Alania Vladikavkaz', 'Arsenal Tula', 'Chaika', 'Chernomorets Novorossiysk',
      'Enisey', 'KAMAZ', 'Khimki', 'Kuban Krasnodar', 'Moscow Torpedo',
      'Neftekhimik', 'Rodina Moscow', 'Shinnik', 'SKA-Khabarovsk', 'Tyumen',
      'Ufa', 'Veles Moscow'
    ],
    'Russian Cup': [
      'Zenit', 'Spartak Moscow', 'CSKA Moscow', 'Lokomotiv Moscow', 'Krasnodar'
    ],
    'Russian Super Cup': [
      'Zenit', 'CSKA Moscow'
    ],
    'Ukrainian Premier League': [
      'Bukovyna', 'Veres Rivne', 'Dynamo Kyiv', 'Epicentr', 'Zorya Luhansk',
      'Karpaty Lviv', 'Kolos Kovalivka', 'Kryvbas Kryvyi Rih', 'Kudrivka',
      'Livyi Bereh', 'LNZ Cherkasy', 'Obolon Kyiv', 'Polissya Zhytomyr',
      'Metalist 1925 Kharkiv', 'Chornomorets Odesa', 'Shakhtar Donetsk'
    ],
    'Ukrainian First League': [
      'Ahrobiznes Volochysk', 'Bukovyna', 'Chernihiv', 'Girnyk-Sport',
      'Inhulets', 'Kremin', 'Mariupol', 'Metalurh Zaporizhzhia',
      'Mykolaiv', 'Nyva Ternopil', 'Podillya Khmelnytskyi', 'Poltava',
      'Prykarpattia', 'Viktoriya Sumy', 'Vilkhivtsi'
    ],
    'Ukrainian Cup': [
      'Shakhtar Donetsk', 'Dynamo Kyiv', 'Zorya Luhansk', 'Dnipro-1'
    ],
    'Ukrainian Super Cup': [
      'Shakhtar Donetsk', 'Dynamo Kyiv'
    ],
    'Ekstraklasa': [
      'Zagłębie Lubin', 'Wisła Płock', 'Wisła Kraków', 'Górnik Zabrze',
      'Radomiak Radom', 'Legia Warsaw', 'Jagiellonia Białystok', 'Motor Lublin',
      'Widzew Łódź', 'Lech Poznań', 'Cracovia', 'Raków Częstochowa',
      'Śląsk Wrocław', 'GKS Katowice', 'Wieczysta Kraków', 'Korona Kielce',
      'Pogoń Szczecin', 'Piast Gliwice'
    ],
    'I Liga': [
      'Arka Gdynia', 'Bytovia', 'Chrobry Głogów', 'GKS Tychy', 'Górnik Łęczna',
      'Kotwica Kołobrzeg', 'Lechia Gdańsk', 'Miedź Legnica', 'Odra Opole',
      'Olimpia Grudziądz', 'Pogoń Siedlce', 'Polonia Warsaw', 'Resovia Rzeszów',
      'Ruch Chorzów', 'Stal Rzeszów', 'Znicz Pruszków', 'ŁKS Łódź'
    ],
    'Polish Cup': [
      'Legia Warsaw', 'Lech Poznań', 'Raków Częstochowa', 'Pogoń Szczecin'
    ],
    'Polish Super Cup': [
      'Raków Częstochowa', 'Legia Warsaw'
    ],
    'UEFA Champions League': [
      'Real Madrid', 'Barcelona', 'Bayern Munich', 'PSG', 'Manchester City',
      'Liverpool', 'Inter Milan', 'AC Milan', 'Arsenal', 'Chelsea',
      'Borussia Dortmund', 'Atletico Madrid', 'Juventus', 'Napoli',
      'Benfica', 'Porto', 'RB Leipzig', 'Lazio', 'Feyenoord', 'Celtic',
      'Red Star Belgrade', 'Shakhtar Donetsk', 'Galatasaray', 'Dynamo Kyiv'
    ],
    'UEFA Europa League': [
      'Sevilla', 'Roma', 'Bayer Leverkusen', 'Atalanta', 'Sporting CP',
      'Marseille', 'Tottenham', 'West Ham', 'Villarreal', 'Eintracht Frankfurt',
      'Real Sociedad', 'Betis', 'Olympiacos', 'Lyon', 'Rennes', 'Lille',
      'AZ Alkmaar', 'Genk', 'Midtjylland', 'Legia Warsaw'
    ],
    'UEFA Conference League': [
      'Fiorentina', 'Osasuna', 'Hearts', 'AZ Alkmaar', 'Gent',
      'Partizan', 'Slovan Bratislava', 'Sturm Graz', 'Lugano',
      'Bodø/Glimt', 'HJK Helsinki', 'Aston Villa', 'Rapid Wien',
      'Club Brugge', 'Basel', 'Djurgårdens IF', 'Lech Poznań'
    ]
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
  // ✅ FIXED: ADD ALL 82 MARKETS (Formula-Based)
  // ============================================
  const handleAddAllMarkets = () => {
    // Get current 1X2 odds from the form
    const homeOdds = parseFloat(formData.oddsHome) || 2.0;
    const drawOdds = parseFloat(formData.oddsDraw) || 3.5;
    const awayOdds = parseFloat(formData.oddsAway) || 2.5;
    
    // Validate odds
    if (homeOdds <= 0 || drawOdds <= 0 || awayOdds <= 0) {
      alert('⚠️ Please enter valid 1X2 odds first!');
      return;
    }
    
    // Generate all markets using the Poisson formula
    const allMarketsData = generateAllMarkets(homeOdds, drawOdds, awayOdds);
    
    // Count how many markets were generated
    const marketCount = Object.keys(allMarketsData).length;
    
    setFormData({
      ...formData,
      markets: allMarketsData
    });
    
    alert(`✅ ${marketCount} betting markets generated from odds: ${homeOdds.toFixed(2)} / ${drawOdds.toFixed(2)} / ${awayOdds.toFixed(2)}!`);
  };

  // ============================================
  // CLEAR ALL MARKETS
  // ============================================
  const handleClearAllMarkets = () => {
    if (!window.confirm('Are you sure you want to remove all markets?')) return;
    setFormData({
      ...formData,
      markets: {}
    });
    alert('✅ All markets cleared!');
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