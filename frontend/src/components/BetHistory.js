import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './BetHistory.css';

const BetHistory = () => {
  const navigate = useNavigate();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedBet, setExpandedBet] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');

  useEffect(() => {
    fetchBetHistory();
  }, [filter]);

  const fetchBetHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const url = filter === 'all' 
        ? 'http://localhost:5000/api/bets/history' 
        : `http://localhost:5000/api/bets/history?status=${filter}`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBets(response.data.bets || []);
    } catch (error) {
      console.error('Error fetching bet history:', error);
      alert('Failed to fetch bet history');
    } finally {
      setLoading(false);
    }
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
      won: { class: 'status-won', text: '✅ Won' },
      lost: { class: 'status-lost', text: '❌ Lost' },
      cancelled: { class: 'status-cancelled', text: '🚫 Cancelled' }
    };
    const badge = badges[status] || badges.pending;
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  const getSelectionStatus = (status) => {
    if (status === 'won') {
      return <span className="sel-status sel-won">✅ Won</span>;
    } else if (status === 'lost') {
      return <span className="sel-status sel-lost">❌ Lost</span>;
    } else {
      return <span className="sel-status sel-pending">⏳ Pending</span>;
    }
  };

  const toggleExpand = (betId) => {
    setExpandedBet(expandedBet === betId ? null : betId);
  };

  const getPendingSelections = (bet) => {
    return bet.selections?.filter(s => s.status === 'pending').length || 0;
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
    // Status filter
    if (filter !== 'all' && bet.status !== filter) {
      return false;
    }
    // Ticket ID search filter
    if (ticketSearch) {
      const ticketId = getTicketId(bet);
      return ticketId.toLowerCase().includes(ticketSearch.toLowerCase());
    }
    return true;
  });

  // Print existing ticket
  const printExistingTicket = (bet) => {
    const ticketId = bet.ticketId || getTicketId(bet);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Betting Ticket #${ticketId}</title>
        <style>
          @page {
            size: 80mm 100mm;
            margin: 0;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            background: white;
            padding: 8px;
            width: 80mm;
            min-height: 100mm;
          }
          .ticket {
            width: 100%;
            border: 2px dashed #333;
            padding: 8px;
            background: white;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }
          .header h2 { font-size: 14px; font-weight: bold; margin: 0; color: #1a1a2e; }
          .header .sub { font-size: 9px; color: #666; }
          .ticket-id {
            text-align: center;
            font-size: 12px;
            font-weight: bold;
            background: #f0f0f0;
            padding: 4px;
            margin-bottom: 6px;
            border-radius: 4px;
          }
          .ticket-id span { color: #6c5ce7; }
          .match-item {
            border-bottom: 1px dotted #ccc;
            padding: 4px 0;
            font-size: 10px;
          }
          .match-item .teams { font-weight: bold; font-size: 11px; }
          .match-item .detail { color: #555; font-size: 9px; }
          .match-item .status { float: right; font-weight: bold; }
          .status-won { color: #2ea043; }
          .status-lost { color: #f85149; }
          .status-pending { color: #f59f00; }
          .summary {
            margin-top: 6px;
            padding-top: 6px;
            border-top: 2px solid #333;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            padding: 2px 0;
          }
          .summary-row .label { color: #666; }
          .summary-row .value { font-weight: bold; }
          .total-row {
            border-top: 2px solid #333;
            margin-top: 4px;
            padding-top: 4px;
            font-size: 12px;
          }
          .total-row .value { color: #2ea043; font-size: 14px; }
          .footer {
            text-align: center;
            font-size: 8px;
            color: #999;
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px dotted #ccc;
          }
          .date-time {
            font-size: 8px;
            color: #999;
            text-align: center;
            margin-top: 4px;
          }
          @media print { body { margin: 0; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <h2>⚡ AsharaBet</h2>
            <div class="sub">Betting Ticket</div>
          </div>
          
          <div class="ticket-id">
            🎫 Ticket #<span>${ticketId}</span>
          </div>
          
          <div class="date-time">
            ${formatDate(bet.createdAt)}
          </div>

          <div style="margin: 6px 0;">
            ${bet.selections.map((sel, idx) => `
              <div class="match-item">
                <div class="teams">${idx + 1}. ${sel.match}</div>
                <div class="detail">
                  ${sel.market}: ${sel.betType} @ ${sel.odds}
                  <span class="status ${sel.status === 'won' ? 'status-won' : sel.status === 'lost' ? 'status-lost' : 'status-pending'}">
                    ${sel.status === 'won' ? '✅ WON' : sel.status === 'lost' ? '❌ LOST' : '⏳ PENDING'}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="summary">
            <div class="summary-row">
              <span class="label">Total Selections</span>
              <span class="value">${bet.selections?.length || 0}</span>
            </div>
            <div class="summary-row">
              <span class="label">Total Stake</span>
              <span class="value">ETB ${bet.totalStake?.toFixed(2) || '0.00'}</span>
            </div>
            <div class="summary-row">
              <span class="label">Total Odds</span>
              <span class="value">${bet.totalOdds || 0}</span>
            </div>
            <div class="summary-row">
              <span class="label">Status</span>
              <span class="value">${bet.status?.toUpperCase() || 'PENDING'}</span>
            </div>
            <div class="total-row">
              <div class="summary-row">
                <span class="label" style="font-weight:bold;">Potential Win</span>
                <span class="value" style="color:#2ea043;font-size:16px;">
                  ETB ${bet.potentialWin?.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          </div>

          <div class="footer">
            <div>🎯 Good Luck!</div>
            <div style="margin-top:2px;">Bet ID: ${ticketId}</div>
            <div style="margin-top:2px;">18+ | Play Responsibly</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=300,height=400');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  if (loading) {
    return <div className="loading-spinner">Loading bets...</div>;
  }

  return (
    <div className="bet-history">
      {/* Header with Back Button */}
      <div className="bet-history-header">
        <div className="header-left">
          <button className="back-home-btn" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
          <h1>📊 Bet History</h1>
        </div>
        <span className="total-bets">Total: {filteredBets.length} bets</span>
      </div>

      {/* Filters Row */}
      <div className="filters-row">
        {/* Status Filters */}
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            📋 All
          </button>
          <button 
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            ⏳ Pending
          </button>
          <button 
            className={`filter-btn ${filter === 'won' ? 'active' : ''}`}
            onClick={() => setFilter('won')}
          >
            ✅ Won
          </button>
          <button 
            className={`filter-btn ${filter === 'lost' ? 'active' : ''}`}
            onClick={() => setFilter('lost')}
          >
            ❌ Lost
          </button>
        </div>

        {/* Ticket ID Search */}
        <div className="ticket-search-container">
          <input
            type="text"
            placeholder="🔍 Search by Ticket ID..."
            value={ticketSearch}
            onChange={(e) => setTicketSearch(e.target.value)}
            className="ticket-search-input"
          />
          {ticketSearch && (
            <button 
              className="clear-search-btn"
              onClick={() => setTicketSearch('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      {filteredBets.length > 0 && ticketSearch && (
        <div className="search-results-info">
          Found {filteredBets.length} bet{filteredBets.length > 1 ? 's' : ''} for ticket ID "{ticketSearch}"
        </div>
      )}

      {/* Bets List */}
      {filteredBets.length === 0 ? (
        <div className="no-bets">
          <div className="no-bets-icon">🎫</div>
          <p>{ticketSearch ? `No bets found for ticket ID "${ticketSearch}"` : 'No bets found'}</p>
          <span>{ticketSearch ? 'Try a different ticket ID' : 'Start betting on your favorite matches!'}</span>
        </div>
      ) : (
        <div className="bets-list">
          {filteredBets.map(bet => {
            const isExpanded = expandedBet === bet._id;
            const pendingSelections = getPendingSelections(bet);
            const hasPending = pendingSelections > 0;
            const ticketId = getTicketId(bet);

            return (
              <div key={bet._id} className={`bet-card ${bet.status}`}>
                {/* Bet Card Header */}
                <div className="bet-card-header">
                  <div className="bet-left">
                    <div className="bet-date">📅 {formatDate(bet.createdAt)}</div>
                    <div className="bet-ticket-id">🎫 Ticket #{ticketId}</div>
                  </div>
                  <div className="bet-right">
                    <button 
                      className="print-ticket-btn"
                      onClick={() => printExistingTicket(bet)}
                      title="Print Ticket"
                    >
                      🖨️
                    </button>
                    {getStatusBadge(bet.status)}
                  </div>
                </div>

                {/* Selections Summary */}
                <div className="bet-selections-summary">
                  <div className="selections-count">
                    {bet.selections?.length || 0} selections
                    {hasPending && (
                      <span className="pending-selections-badge">
                        ⏳ {pendingSelections} pending
                      </span>
                    )}
                  </div>
                  <button 
                    className="expand-toggle"
                    onClick={() => toggleExpand(bet._id)}
                  >
                    {isExpanded ? '▲ Hide Details' : '▼ Show Details'}
                  </button>
                </div>

                {/* Expanded Selections */}
                {isExpanded && (
                  <div className="selections-details">
                    {bet.selections?.map((sel, idx) => (
                      <div key={idx} className="selection-detail-item">
                        <div className="selection-detail-match">
                          <span className="match-name">{sel.match}</span>
                          <span className="match-market">
                            {sel.market}: {sel.betType} ....................................................................... {sel.odds}
                          </span>
                        </div>
                        <div className="selection-detail-status">
                          {getSelectionStatus(sel.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bet Summary */}
                <div className="bet-summary">
                  <div className="summary-item">
                    <span className="summary-label">Total Stake</span>
                    <strong className="summary-value">{formatCurrency(bet.totalStake)}</strong>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Odds</span>
                    <strong className="summary-value">{bet.totalOdds}</strong>
                  </div>
                  <div className="summary-item potential">
                    <span className="summary-label">Potential Win</span>
                    <strong className="summary-value">{formatCurrency(bet.potentialWin)}</strong>
                  </div>
                </div>

                {/* Admin Notes */}
                {bet.adminNotes && (
                  <div className="admin-notes">
                    <span className="notes-label">📝 Admin Note:</span>
                    <span className="notes-text">{bet.adminNotes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BetHistory; 