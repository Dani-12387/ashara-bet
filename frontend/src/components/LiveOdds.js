import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LiveOdds.css';

const LiveOdds = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('soccer_epl');
  const [error, setError] = useState(null);
  const [sports, setSports] = useState([]);
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Sports options
  const sportOptions = [
    { id: 'soccer_epl', label: '⚽ Premier League' },
    { id: 'soccer_la_liga', label: '⚽ La Liga' },
    { id: 'soccer_bundesliga', label: '⚽ Bundesliga' },
    { id: 'soccer_serie_a', label: '⚽ Serie A' },
    { id: 'soccer_ligue_1', label: '⚽ Ligue 1' },
    { id: 'soccer_eredivisie', label: '⚽ Eredivisie' },
    { id: 'soccer_liga_portugal', label: '⚽ Liga Portugal' },
    { id: 'soccer_pro_league_belgium', label: '⚽ Pro League' },
    { id: 'basketball_nba', label: '🏀 NBA' },
    { id: 'tennis_atp', label: '🎾 Tennis ATP' },
    { id: 'cricket_t20_blast', label: '🏏 Cricket' },
  ];

  useEffect(() => {
    fetchOdds();
  }, [selectedSport]);

  const fetchOdds = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Please login to view odds');
        setLoading(false);
        return;
      }
      
      const response = await axios.get(
        `${API_URL}/api/odds/odds/${selectedSport}`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );
      
      if (response.data.success) {
        setMatches(response.data.matches || []);
        if (response.data.matches.length === 0) {
          setError('No matches available for this league');
        }
      } else {
        setError(response.data.message || 'Failed to fetch odds');
      }
    } catch (error) {
      console.error('Error fetching odds:', error);
      if (error.response?.status === 401) {
        setError('Please login to view odds');
      } else {
        setError('Failed to load odds. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatOdds = (odds) => {
    if (!odds || odds <= 0) return 'N/A';
    return odds.toFixed(2);
  };

  const addToBetSlip = (match, betType, odds) => {
    // This will connect to your existing bet slip system
    alert(`Added ${match.homeTeam} vs ${match.awayTeam} - ${betType} @ ${odds}`);
  };

  if (loading) {
    return (
      <div className="live-odds-container">
        <div className="odds-header">
          <h2>⚡ Live Odds</h2>
          <div className="header-controls">
            <select 
              value={selectedSport} 
              onChange={(e) => setSelectedSport(e.target.value)}
              className="sport-select"
              disabled={loading}
            >
              {sportOptions.map((sport) => (
                <option key={sport.id} value={sport.id}>{sport.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading odds...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-odds-container">
      <div className="odds-header">
        <h2>⚡ Live Odds</h2>
        <div className="header-controls">
          <select 
            value={selectedSport} 
            onChange={(e) => setSelectedSport(e.target.value)}
            className="sport-select"
          >
            {sportOptions.map((sport) => (
              <option key={sport.id} value={sport.id}>{sport.label}</option>
            ))}
          </select>
          <button className="refresh-btn" onClick={fetchOdds} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="error-message">
          <span>⚠️</span> {error}
        </div>
      ) : matches.length === 0 ? (
        <div className="no-matches">
          <p>No matches available for this league</p>
          <p className="sub-text">Check back later for upcoming matches</p>
        </div>
      ) : (
        <div className="matches-list">
          {matches.map((match) => (
            <div key={match.id} className="match-card">
              <div className="match-info">
                <div className="teams">
                  <span className="home-team" title={match.homeTeam}>
                    {match.homeTeam}
                  </span>
                  <span className="vs">vs</span>
                  <span className="away-team" title={match.awayTeam}>
                    {match.awayTeam}
                  </span>
                </div>
                <div className="match-meta">
                  <span className="match-time">📅 {formatDate(match.commenceTime)}</span>
                  <span className="match-bookmaker">📊 {match.bookmaker}</span>
                </div>
              </div>
              <div className="match-odds">
                <button 
                  className="odd-btn home-odd"
                  onClick={() => addToBetSlip(match, 'Home', match.odds.home)}
                  disabled={!match.odds.home || match.odds.home <= 0}
                >
                  <span className="odd-label">1</span>
                  <span className="odd-value">{formatOdds(match.odds.home)}</span>
                </button>
                <button 
                  className="odd-btn draw-odd"
                  onClick={() => addToBetSlip(match, 'Draw', match.odds.draw)}
                  disabled={!match.odds.draw || match.odds.draw <= 0}
                >
                  <span className="odd-label">X</span>
                  <span className="odd-value">{formatOdds(match.odds.draw)}</span>
                </button>
                <button 
                  className="odd-btn away-odd"
                  onClick={() => addToBetSlip(match, 'Away', match.odds.away)}
                  disabled={!match.odds.away || match.odds.away <= 0}
                >
                  <span className="odd-label">2</span>
                  <span className="odd-value">{formatOdds(match.odds.away)}</span>
                </button>
              </div>
              {match.totals && match.totals.length > 0 && (
                <div className="match-totals">
                  {match.totals.map((total, idx) => (
                    <span key={idx} className="total-odd">
                      {total.name}: {formatOdds(total.price)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveOdds;