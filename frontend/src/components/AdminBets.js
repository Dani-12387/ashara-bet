import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminBets.css';

const AdminBets = () => {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    won: 0,
    lost: 0,
    cancelled: 0,
    totalStake: 0,
    totalWon: 0,
    totalLost: 0,
    profit: 0
  });
  const [processingId, setProcessingId] = useState(null);
  const [expandedBets, setExpandedBets] = useState({});
  const [ticketSearch, setTicketSearch] = useState('');

  // ✅ API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchBets();
    fetchStats();
  }, [filter]);

  // ✅ FIXED: Use API_URL
  const fetchBets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const url = filter === 'all' 
        ? `${API_URL}/api/bets/admin/all` 
        : `${API_URL}/api/bets/admin/all?status=${filter}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBets(response.data.bets || []);
    } catch (error) {
      console.error('Error fetching bets:', error);
      alert('Failed to fetch bets');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: Use API_URL
  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/bets/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data.stats || {
        total: 0,
        pending: 0,
        won: 0,
        lost: 0,
        cancelled: 0,
        totalStake: 0,
        totalWon: 0,
        totalLost: 0,
        profit: 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Get ticket ID - Use from database or generate from _id
  const getTicketId = (bet) => {
    if (bet.ticketId) {
      return bet.ticketId;
    }
    if (bet._id) {
      const idStr = bet._id.toString();
      const numbers = idStr.replace(/[^0-9]/g, '');
      if (numbers.length >= 10) {
        return numbers.slice(0, 10);
      }
      return numbers.padStart(10, '0');
    }
    return 'N/A';
  };

  // Filter bets by ticket ID
  const filteredBets = bets.filter(bet => {
    if (!ticketSearch) return true;
    const ticketId = getTicketId(bet);
    return ticketId.toLowerCase().includes(ticketSearch.toLowerCase());
  });

  // ✅ FIXED: Use API_URL
  const handleSelectionStatus = async (betId, selectionIndex, status) => {
    const confirmMsg = status === 'won' 
      ? `✅ Mark selection as WON?`
      : `❌ Mark selection as LOST?`;
    
    if (!window.confirm(confirmMsg)) return;

    setProcessingId(`${betId}-${selectionIndex}`);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/api/bets/admin/${betId}/selection/${selectionIndex}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(response.data.message);
        fetchBets();
        fetchStats();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update selection');
    } finally {
      setProcessingId(null);
    }
  };

  const toggleExpand = (betId) => {
    setExpandedBets(prev => ({
      ...prev,
      [betId]: !prev[betId]
    }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => `ETB ${parseFloat(amount).toFixed(2)}`;

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'status-pending', text: '⏳ Pending' },
      won: { class: 'status-won', text: '🏆 Won' },
      lost: { class: 'status-lost', text: '❌ Lost' },
      cancelled: { class: 'status-cancelled', text: '🚫 Cancelled' }
    };
    const badge = badges[status] || badges.pending;
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  const getSelectionStatusBadge = (status) => {
    if (status === 'won') {
      return <span className="sel-badge sel-won">🏆 Won</span>;
    } else if (status === 'lost') {
      return <span className="sel-badge sel-lost">❌ Lost</span>;
    } else {
      return <span className="sel-badge sel-pending">⏳ Pending</span>;
    }
  };

  const getPendingCount = () => {
    return bets.filter(b => b.status === 'pending').length;
  };

  const hasPendingSelections = (bet) => {
    return bet.selections?.some(s => s.status === 'pending') || false;
  };

  if (loading) {
    return <div className="loading-spinner">Loading bets...</div>;
  }

  return (
    <div className="admin-bets">
      <div className="bets-header">
        <h1>📊 Bet Management</h1>
        <div className="header-actions">
          <span className="pending-count">Pending Bets: {getPendingCount()}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card total">
          <h3>Total Bets</h3>
          <p className="stat-number">{stats.total}</p>
        </div>
        <div className="stat-card pending">
          <h3>Pending</h3>
          <p className="stat-number">{stats.pending}</p>
        </div>
        <div className="stat-card won">
          <h3>Won</h3>
          <p className="stat-number">{stats.won}</p>
        </div>
        <div className="stat-card lost">
          <h3>Lost</h3>
          <p className="stat-number">{stats.lost}</p>
        </div>
        <div className="stat-card profit">
          <h3>Total Stake</h3>
          <p className="stat-number">{formatCurrency(stats.totalStake)}</p>
        </div>
        <div className="stat-card profit">
          <h3>Profit/Loss</h3>
          <p className={`stat-number ${stats.profit >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(stats.profit)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            📋 All ({stats.total})
          </button>
          <button 
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            ⏳ Pending ({stats.pending})
          </button>
          <button 
            className={`filter-btn ${filter === 'won' ? 'active' : ''}`}
            onClick={() => setFilter('won')}
          >
            🏆 Won ({stats.won})
          </button>
          <button 
            className={`filter-btn ${filter === 'lost' ? 'active' : ''}`}
            onClick={() => setFilter('lost')}
          >
            ❌ Lost ({stats.lost})
          </button>
          <button 
            className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setFilter('cancelled')}
          >
            🚫 Cancelled ({stats.cancelled})
          </button>
        </div>
        
        {/* Ticket ID Search */}
        <div className="ticket-search">
          <input
            type="text"
            placeholder="🔍 Search by Ticket ID..."
            value={ticketSearch}
            onChange={(e) => setTicketSearch(e.target.value)}
            className="ticket-search-input"
          />
        </div>
      </div>

      {/* Bets Table */}
      <div className="bets-table-container">
        <table className="bets-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Ticket ID</th>
              <th>Selections</th>
              <th>Total Stake</th>
              <th>Total Odds</th>
              <th>Potential Win</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBets.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">
                  {ticketSearch ? 'No bets found for this ticket ID' : 'No bets found'}
                </td>
              </tr>
            ) : (
              filteredBets.map(bet => {
                const isExpanded = expandedBets[bet._id];
                const hasPending = hasPendingSelections(bet);
                const ticketId = getTicketId(bet);
                
                return (
                  <React.Fragment key={bet._id}>
                    <tr className={`bet-row ${bet.status}`}>
                      <td>
                        <div className="user-info">
                          <span className="username">{bet.user?.username || 'Unknown'}</span>
                          <span className="user-email">{bet.user?.email || 'No email'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="ticket-id-display">
                          <span className="ticket-id">#{ticketId}</span>
                        </div>
                      </td>
                      <td>
                        <div className="selections-summary">
                          <span className="sel-count">{bet.selections?.length || 0} selections</span>
                          {hasPending && (
                            <span className="pending-badge">⏳ Pending</span>
                          )}
                          <button 
                            className="expand-btn"
                            onClick={() => toggleExpand(bet._id)}
                          >
                            {isExpanded ? '▲ Hide' : '▼ View Details'}
                          </button>
                        </div>
                      </td>
                      <td><strong>{formatCurrency(bet.totalStake)}</strong></td>
                      <td>{bet.totalOdds}</td>
                      <td><strong className="potential-win">{formatCurrency(bet.potentialWin)}</strong></td>
                      <td>{getStatusBadge(bet.status)}</td>
                      <td>{formatDate(bet.createdAt)}</td>
                      <td>
                        {bet.status === 'pending' && hasPending && (
                          <span className="pending-text">Mark selections below</span>
                        )}
                        {bet.status !== 'pending' && (
                          <span className="settled-info">
                            Settled: {bet.settledAt ? formatDate(bet.settledAt) : 'N/A'}
                          </span>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded Row */}
                    {isExpanded && (
                      <tr className="expanded-row">
                        <td colSpan="9">
                          <div className="expanded-selections">
                            <h4>🎯 Selections Details - Ticket #{ticketId}</h4>
                            <div className="selections-grid">
                              {bet.selections?.map((sel, idx) => (
                                <div key={idx} className="selection-card">
                                  <div className="selection-header">
                                    <span className="selection-number">#{idx + 1}</span>
                                    {getSelectionStatusBadge(sel.status)}
                                  </div>
                                  <div className="selection-body">
                                    <p className="sel-match-name">{sel.match}</p>
                                    <p className="sel-detail">
                                      <span className="sel-market">{sel.market}</span>
                                      <span className="sel-bet-type">{sel.betType}</span>
                                      <span className="sel-odds"> {sel.odds}</span>
                                    </p>
                                  </div>
                                  {sel.status === 'pending' && bet.status === 'pending' && (
                                    <div className="selection-actions">
                                      <button 
                                        className="sel-btn-won"
                                        onClick={() => handleSelectionStatus(bet._id, idx, 'won')}
                                        disabled={processingId === `${bet._id}-${idx}`}
                                      >
                                        🏆 Won
                                      </button>
                                      <button 
                                        className="sel-btn-lost"
                                        onClick={() => handleSelectionStatus(bet._id, idx, 'lost')}
                                        disabled={processingId === `${bet._id}-${idx}`}
                                      >
                                        ❌ Lost
                                      </button>
                                    </div>
                                  )}
                                  {sel.status !== 'pending' && (
                                    <div className="selection-result">
                                      {sel.status === 'won' ? '🏆 Won' : '❌ Lost'}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminBets;