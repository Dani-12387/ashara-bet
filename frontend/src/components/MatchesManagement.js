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

  // All 20 betting markets configuration for admin
  const allMarkets = {
    result: { label: 'Result', key: 'result' },
    doubleChance: { label: 'Double Chance', key: 'doubleChance' },
    drawNoBet: { label: 'Draw No Bet', key: 'drawNoBet' },
    btts: { label: 'Both Teams to Score', key: 'btts' },
    totalGoals: { label: 'Total Goals', key: 'totalGoals' },
    exactGoals: { label: 'Exact Goals', key: 'exactGoals' },
    correctScore: { label: 'Correct Score', key: 'correctScore' },
    halfTimeResult: { label: 'Half-Time Result', key: 'halfTimeResult' },
    halfTimeFullTime: { label: 'HT/FT', key: 'halfTimeFullTime' },
    firstTeamScore: { label: 'First Team to Score', key: 'firstTeamScore' },
    lastTeamScore: { label: 'Last Team to Score', key: 'lastTeamScore' },
    firstGoalTime: { label: 'First Goal Time', key: 'firstGoalTime' },
    teamGoalsHome: { label: 'Home Team Goals', key: 'teamGoalsHome' },
    teamGoalsAway: { label: 'Away Team Goals', key: 'teamGoalsAway' },
    handicap: { label: 'Handicap', key: 'handicap' },
    asianHandicap: { label: 'Asian Handicap', key: 'asianHandicap' },
    corners: { label: 'Corners', key: 'corners' },
    cards: { label: 'Cards', key: 'cards' },
    penalty: { label: 'Penalty', key: 'penalty' },
    playerMarkets: { label: 'Player Markets', key: 'playerMarkets' },
    specials: { label: 'Specials', key: 'specials' }
  };

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
    specials: { 'Clean Sheet - Home': 2.0, 'Clean Sheet - Away': 2.5, 'Win to Nil - Home': 3.0, 'Win to Nil - Away': 4.0, 'Both Halves Over 1.5': 6.0, 'Highest Scoring Half - 1st': 2.0, 'Highest Scoring Half - 2nd': 2.2, 'Odd Total Goals': 1.9, 'Even Total Goals': 1.9 }
  };

  const [formData, setFormData] = useState({
    sport: 'FOOTBALL',
    league: '',
    country: '',
    homeTeam: '',
    awayTeam: '',
    date: '',
    oddsHome: '',
    oddsDraw: '',
    oddsAway: '',
    markets: {}
  });

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

      const response = await axios.get(`http://localhost:5000/api/admin/matches?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMatches(response.data.matches || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
      alert('Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (matchId) => {
    if (!window.confirm('Are you sure you want to delete this match?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/admin/matches/${matchId}`, {
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
      
      // Clean up markets - remove empty ones
      const cleanedMarkets = {};
      Object.keys(formData.markets || {}).forEach(key => {
        const marketData = formData.markets[key];
        // Only include markets that have at least one option with a value
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

      console.log('Saving match with markets:', data.markets);

      if (editingMatch) {
        await axios.put(`http://localhost:5000/api/admin/matches/${editingMatch._id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Match updated successfully');
      } else {
        await axios.post('http://localhost:5000/api/admin/matches', data, {
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

  const handleBulkMarketAdd = (marketKey) => {
    const options = defaultOdds[marketKey] || {};
    const newMarkets = { ...formData.markets };
    newMarkets[marketKey] = options;
    
    setFormData({
      ...formData,
      markets: newMarkets
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingMatch(null);
    setFormData({
      sport: 'FOOTBALL',
      league: '',
      country: '',
      homeTeam: '',
      awayTeam: '',
      date: '',
      oddsHome: '',
      oddsDraw: '',
      oddsAway: '',
      markets: {}
    });
  };

  const editMatch = (match) => {
    setEditingMatch(match);
    setFormData({
      sport: match.sport,
      league: match.league,
      country: match.country,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      date: new Date(match.date).toISOString().slice(0, 16),
      oddsHome: match.odds?.home?.toString() || '',
      oddsDraw: match.odds?.draw?.toString() || '',
      oddsAway: match.odds?.away?.toString() || '',
      markets: match.markets || {}
    });
    setShowForm(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="admin-matches-page">
      <div className="admin-header">
        <h2>⚽ Match Management</h2>
        <button onClick={() => setShowForm(true)} className="btn-add">+ Add New Match</button>
      </div>

      {/* Filters */}
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

      {/* Modal Form */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingMatch ? '✏️ Edit Match' : '➕ Add New Match'}</h3>
            <form onSubmit={handleSubmit} className="match-form">
              {/* Basic Info */}
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
                  <label>League</label>
                  <input type="text" placeholder="e.g., Premier League" value={formData.league} onChange={(e) => setFormData({ ...formData, league: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <input type="text" placeholder="e.g., England" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Date & Time</label>
                  <input type="datetime-local" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Home Team</label>
                  <input type="text" placeholder="Home Team" value={formData.homeTeam} onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Away Team</label>
                  <input type="text" placeholder="Away Team" value={formData.awayTeam} onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })} required />
                </div>
              </div>

              {/* 1X2 Odds */}
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

              {/* All 20 Markets */}
              <div className="markets-section">
                <h4>All Betting Markets</h4>
                <div className="markets-grid-admin">
                  {Object.entries(allMarkets).map(([key, market]) => (
                    <div key={key} className="market-group-admin">
                      <div className="market-header-admin">
                        <h5>{market.label}</h5>
                        <button 
                          type="button" 
                          className="btn-add-market"
                          onClick={() => handleBulkMarketAdd(key)}
                        >
                          + Add All
                        </button>
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

      {/* Matches Table */}
      {loading ? (
        <div className="loading">Loading matches...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
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