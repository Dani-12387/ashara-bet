import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [groupedMatches, setGroupedMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedSport, setSelectedSport] = useState('FOOTBALL');
  const [betSlip, setBetSlip] = useState([]);
  const [balance, setBalance] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showBetSlip, setShowBetSlip] = useState(true);
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedLeague, setSelectedLeague] = useState('');
  const [leagues, setLeagues] = useState([]);
  const [liveMatches, setLiveMatches] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedMatch, setExpandedMatch] = useState(null);
  const [totalStake, setTotalStake] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [showTelegramPopup, setShowTelegramPopup] = useState(false);
  const dropdownRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const sports = [
    { id: 'FOOTBALL', name: 'Football', icon: '⚽' },
    { id: 'BASKETBALL', name: 'Basketball', icon: '🏀' },
    { id: 'TENNIS', name: 'Tennis', icon: '🎾' },
    { id: 'CRICKET', name: 'Cricket', icon: '🏏' }
  ];

  const allMarkets = {
    result: { label: 'Result', icon: '🏆' },
    doubleChance: { label: 'Double Chance', icon: '🔄' },
    drawNoBet: { label: 'Draw No Bet', icon: '⏳' },
    btts: { label: 'Both Teams to Score', icon: '⚽' },
    totalGoals: { label: 'Total Goals', icon: '📊' },
    exactGoals: { label: 'Exact Goals', icon: '🎯' },
    correctScore: { label: 'Correct Score', icon: '📝' },
    halfTimeResult: { label: 'Half-Time Result', icon: '⏰' },
    halfTimeFullTime: { label: 'HT/FT', icon: '🔄' },
    firstTeamScore: { label: 'First Team to Score', icon: '🥇' },
    lastTeamScore: { label: 'Last Team to Score', icon: '🥈' },
    firstGoalTime: { label: 'First Goal Time', icon: '⏱️' },
    teamGoalsHome: { label: 'Home Team Goals', icon: '🏠' },
    teamGoalsAway: { label: 'Away Team Goals', icon: '✈️' },
    handicap: { label: 'Handicap', icon: '📈' },
    asianHandicap: { label: 'Asian Handicap', icon: '🌏' },
    corners: { label: 'Corners', icon: '🔄' },
    cards: { label: 'Cards', icon: '🟨' },
    penalty: { label: 'Penalty', icon: '⚪' },
    playerMarkets: { label: 'Player Markets', icon: '👤' },
    specials: { label: 'Specials', icon: '⭐' }
  };

  // ✅ FIXED: 12-HOUR TIME FORMAT WITH AM/PM
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    let hours = date.getHours();
    const minutes = date.getMinutes();
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    
    const localDate = new Date(year, month, day, hours, minutes);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const matchDate = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate());
    
    const timeStr = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ' ' + ampm;
    
    if (matchDate.getTime() === today.getTime()) {
      return `Today, ${timeStr}`;
    } else if (matchDate.getTime() === tomorrow.getTime()) {
      return `Tomorrow, ${timeStr}`;
    } else {
      const dateStr = String(month + 1).padStart(2, '0') + '/' + String(day).padStart(2, '0') + '/' + String(year);
      return `${dateStr}, ${timeStr}`;
    }
  };

  // ✅ Check if match has started
  const hasMatchStarted = (dateString) => {
    if (!dateString) return true;
    const matchDate = new Date(dateString);
    const now = new Date();
    return matchDate <= now;
  };

  // ✅ Get time left with 12-hour calculation
  const getTimeLeft = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const matchDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes()
    );
    
    const now = new Date();
    const diffMs = matchDate - now;
    
    if (diffMs < 0) return 'Started';
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    } else {
      return `${diffMins}m`;
    }
  };

  // Get day name
  const getDayName = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const localDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffDays = Math.floor((localDate - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === 2) return 'In 2 Days';
    if (diffDays === -1) return 'Yesterday';
    
    return localDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  // Sort matches by date
  const sortMatchesByDate = (matchesArray) => {
    return [...matchesArray].sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });
  };

  // Group matches by day
  const groupMatchesByDay = (matchesArray) => {
    const groups = {};
    matchesArray.forEach(match => {
      const dayKey = getDayName(match.date);
      if (!groups[dayKey]) {
        groups[dayKey] = [];
      }
      groups[dayKey].push(match);
    });
    return groups;
  };

  // Generate random 10-digit ticket ID
  const generateTicketId = () => {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
  };

  // Print ticket function
  const printTicket = (betData) => {
    const ticketId = betData.ticketId || generateTicketId();
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Betting Ticket</title>
        <style>
          @page {
            size: 80mm 100mm;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
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
          .header h2 {
            font-size: 14px;
            font-weight: bold;
            margin: 0;
            color: #1a1a2e;
          }
          .header .sub {
            font-size: 9px;
            color: #666;
          }
          .ticket-id {
            text-align: center;
            font-size: 12px;
            font-weight: bold;
            background: #f0f0f0;
            padding: 4px;
            margin-bottom: 6px;
            border-radius: 4px;
          }
          .ticket-id span {
            color: #6c5ce7;
          }
          .match-item {
            border-bottom: 1px dotted #ccc;
            padding: 4px 0;
            font-size: 10px;
          }
          .match-item .teams {
            font-weight: bold;
            font-size: 11px;
          }
          .match-item .detail {
            color: #555;
            font-size: 9px;
          }
          .match-item .status {
            float: right;
            font-weight: bold;
          }
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
          .summary-row .label {
            color: #666;
          }
          .summary-row .value {
            font-weight: bold;
          }
          .total-row {
            border-top: 2px solid #333;
            margin-top: 4px;
            padding-top: 4px;
            font-size: 12px;
          }
          .total-row .value {
            color: #2ea043;
            font-size: 14px;
          }
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
          @media print {
            body { margin: 0; padding: 0; }
          }
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
            ${new Date().toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })}
          </div>

          <div style="margin: 6px 0;">
            ${betData.selections.map((sel, idx) => `
              <div class="match-item">
                <div class="teams">${idx + 1}. ${sel.match}</div>
                <div class="detail">
                  ${sel.market}: ${sel.betType} ${sel.odds}
                  <span class="status status-pending">⏳ PENDING</span>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="summary">
            <div class="summary-row">
              <span class="label">Total Selections</span>
              <span class="value">${betData.selections.length}</span>
            </div>
            <div class="summary-row">
              <span class="label">Total Stake</span>
              <span class="value">ETB ${betData.totalStake.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span class="label">Total Odds</span>
              <span class="value">${betData.totalOdds}</span>
            </div>
            <div class="total-row">
              <div class="summary-row">
                <span class="label" style="font-weight:bold;">Potential Win</span>
                <span class="value" style="color:#2ea043;font-size:16px;">
                  ETB ${betData.potentialWin.toFixed(2)}
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

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await axios.get(`${API_URL}/api/user/balance`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBalance(response.data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  }, [API_URL]);

  // Fetch matches
  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('sport', selectedSport);
      if (selectedLeague) params.append('league', selectedLeague);
      if (dateFilter !== 'all') params.append('date', dateFilter);

      const response = await axios.get(`${API_URL}/api/matches?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      let matchesData = response.data.matches || [];
      
      // ✅ FILTER: Remove matches that have already started
      const upcomingMatches = matchesData.filter(match => {
        if (match.status === 'LIVE' || match.status === 'live') {
          return true; // Keep live matches
        }
        if (match.status === 'FINISHED' || match.status === 'finished') {
          return false; // Remove finished matches
        }
        // Remove matches that have started (date is in the past)
        return !hasMatchStarted(match.date);
      });
      
      matchesData = sortMatchesByDate(upcomingMatches);
      setMatches(matchesData);
      
      const dayGroups = groupMatchesByDay(matchesData);
      
      const groupedByDay = Object.keys(dayGroups).map(day => ({
        day: day,
        matches: sortMatchesByDate(dayGroups[day])
      }));
      
      const dayOrder = ['Today', 'Tomorrow', 'In 2 Days'];
      groupedByDay.sort((a, b) => {
        const aIndex = dayOrder.indexOf(a.day);
        const bIndex = dayOrder.indexOf(b.day);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.day.localeCompare(b.day);
      });
      
      setGroupedMatches(groupedByDay);
      setLeagues(response.data.filters?.leagues || []);
      
      const live = matchesData.filter(m => m.status === 'LIVE' || m.status === 'live');
      setLiveMatches(live);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching matches:', error);
      setLoading(false);
    }
  }, [selectedSport, selectedLeague, dateFilter, API_URL]);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        fetchBalance();
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    fetchMatches();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [fetchMatches, fetchBalance]);

  useEffect(() => {
    localStorage.setItem('betSlip', JSON.stringify(betSlip));
  }, [betSlip]);

  useEffect(() => {
    const savedBetSlip = localStorage.getItem('betSlip');
    if (savedBetSlip) {
      try {
        setBetSlip(JSON.parse(savedBetSlip));
      } catch (e) {}
    }
  }, []);

  // Add to bet slip
  const addToBetSlip = (match, betType, odds, market) => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (match.status === 'FINISHED' || match.status === 'finished') {
      alert('This match has already finished!');
      return;
    }

    // ✅ Check if match has started
    if (hasMatchStarted(match.date)) {
      alert('This match has already started!');
      return;
    }

    const existingMatchIndex = betSlip.findIndex(b => b.matchId === match._id);

    if (existingMatchIndex !== -1) {
      const existingBet = betSlip[existingMatchIndex];
      if (existingBet.betType === betType && existingBet.market === market) {
        setBetSlip(betSlip.filter((_, index) => index !== existingMatchIndex));
      } else {
        const updated = [...betSlip];
        updated[existingMatchIndex] = {
          matchId: match._id,
          match: `${match.homeTeam} vs ${match.awayTeam}`,
          league: match.league || 'Unknown',
          date: match.date,
          betType,
          odds,
          market
        };
        setBetSlip(updated);
      }
    } else {
      setBetSlip([...betSlip, {
        matchId: match._id,
        match: `${match.homeTeam} vs ${match.awayTeam}`,
        league: match.league || 'Unknown',
        date: match.date,
        betType,
        odds,
        market
      }]);
    }
  };

  // Remove from bet slip
  const removeFromBetSlip = (index) => {
    setBetSlip(betSlip.filter((_, i) => i !== index));
  };

  // Update total stake
  const updateTotalStake = (value) => {
    setTotalStake(parseFloat(value) || 0);
  };

  // Calculate totals
  const calculateTotalOdds = () => {
    if (betSlip.length === 0) return 1;
    return betSlip.reduce((total, bet) => total * bet.odds, 1).toFixed(2);
  };

  const calculatePotentialWinnings = () => {
    const stake = parseFloat(totalStake) || 0;
    const odds = parseFloat(calculateTotalOdds());
    return (stake * odds).toFixed(2);
  };

  // Place bets
  const placeBets = async () => {
    if (betSlip.length === 0) {
      alert('Your bet slip is empty!');
      return;
    }
    
    if (!totalStake || totalStake <= 0) {
      alert('Please enter a stake amount');
      return;
    }

    if (totalStake > balance) {
      alert(`Insufficient balance! Your balance is ETB ${balance.toFixed(2)}`);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/bets/place`, {
        bets: betSlip,
        totalStake: totalStake,
        totalOdds: parseFloat(calculateTotalOdds())
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const ticketId = response.data.ticketId || generateTicketId();
        
        const betData = {
          selections: betSlip.map(b => ({
            match: b.match,
            market: b.market,
            betType: b.betType,
            odds: b.odds
          })),
          totalStake: totalStake,
          totalOdds: parseFloat(calculateTotalOdds()),
          potentialWin: parseFloat(calculatePotentialWinnings()),
          ticketId: ticketId
        };

        printTicket(betData);
        alert('🎉 Bets placed successfully!');
        setBetSlip([]);
        setTotalStake(0);
        fetchBalance();
      } else {
        alert(response.data.message || 'Failed to place bets');
      }
    } catch (error) {
      console.error('Error placing bets:', error);
      alert(error.response?.data?.message || 'Failed to place bets');
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('betSlip');
    localStorage.removeItem('loginTimestamp');
    localStorage.removeItem('hasJoinedTelegram');
    setUser(null);
    setBalance(0);
    setShowDropdown(false);
    navigate('/');
  };

  // Handle Telegram join
  const handleJoinTelegram = () => {
    window.open('https://t.me/wetatochm', '_blank');
    localStorage.setItem('hasJoinedTelegram', 'true');
    setShowTelegramPopup(false);
  };

  const handleSkipTelegram = () => {
    localStorage.setItem('hasJoinedTelegram', 'skipped');
    setShowTelegramPopup(false);
  };

  const formatCurrency = (amount) => `ETB ${parseFloat(amount).toFixed(2)}`;

  const toggleMatchExpand = (matchId) => {
    setExpandedMatch(expandedMatch === matchId ? null : matchId);
  };

  const getStatusBadge = (status) => {
    if (status === 'LIVE' || status === 'live') {
      return <span className="badge-live">🔴 LIVE</span>;
    } else if (status === 'FINISHED' || status === 'finished') {
      return <span className="badge-finished">✅ Finished</span>;
    } else {
      return <span className="badge-upcoming">⏳ Upcoming</span>;
    }
  };

  const getAvailableMarkets = (match) => {
    if (!match || !match.markets) return [];
    if (typeof match.markets !== 'object' || Array.isArray(match.markets)) return [];
    
    return Object.keys(match.markets).filter(key => {
      const marketData = match.markets[key];
      return marketData && typeof marketData === 'object' && Object.keys(marketData).length > 0;
    });
  };

  const getMarketOdds = (match, marketKey) => {
    if (match.markets && match.markets[marketKey]) {
      return match.markets[marketKey];
    }
    return null;
  };

  const toggleBetSlip = () => {
    if (window.innerWidth <= 1024) {
      setShowBetSlip(!showBetSlip);
    }
  };

  const isInBetSlip = (matchId, betType, market) => {
    return betSlip.some(b => b.matchId === matchId && b.betType === betType && b.market === market);
  };

  // Bottom Navigation
  const bottomNavItems = [
    { id: 'home', label: 'HOME', icon: '🏠', path: '/' },
    { id: 'about', label: 'ABOUT', icon: 'ℹ️', path: '/about' },
    { id: 'betslip', label: 'BET SLIP', icon: '🎫', action: 'betslip' },
    { id: 'deposit', label: 'DEPOSIT', icon: '💰', path: '/deposit' },
    { id: 'my', label: 'MY', icon: '👤', path: '/MyAccount' }
  ];

  return (
    <div className="homepage-pro">
      <header className="header-pro">
        <div className="header-inner-pro">
          <div className="header-left-pro">
            <div className="logo-pro" onClick={() => navigate('/')}>
              <span className="logo-icon-pro">⚡</span>
              <span className="logo-text-pro">Ashara<span>Bet</span></span>
            </div>
            <nav className="nav-pro">
              <button className={`nav-link-pro ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>Home</button>
              <button className={`nav-link-pro ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Live</button>
              <button className="nav-link-pro" onClick={() => navigate('/matches')}>Matches</button>
            </nav>
          </div>

          <div className="header-right-pro">
            <div className="live-indicator-pro">
              <span className="live-dot-pro"></span>
              <span>{liveMatches.length} LIVE</span>
            </div>
            {user ? (
              <>
                <div className="balance-pro">
                  <span className="balance-icon-pro">💰</span>
                  <span className="balance-value-pro">{formatCurrency(balance)}</span>
                </div>
                <button className="deposit-btn-pro" onClick={() => navigate('/deposit')}>Deposit</button>
                <div className="profile-pro" ref={dropdownRef}>
                  <button className="profile-btn-pro" onClick={() => setShowDropdown(!showDropdown)}>
                    <div className="profile-avatar-pro">{user.username?.charAt(0).toUpperCase() || 'U'}</div>
                    <span className="profile-name-pro">{user.username}</span>
                    <svg className={`profile-arrow-pro ${showDropdown ? 'rotate' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showDropdown && (
                    <div className="dropdown-pro">
                      <div className="dropdown-items-pro">
                        <button onClick={() => navigate('/MyAccount')}>👤 My Account</button>
                        <button onClick={() => navigate('/deposit')}>💰 Deposit</button>
                        <button onClick={() => navigate('/withdraw')}>💸 Withdraw</button>
                        <button onClick={() => navigate('/bet-history')}>📊 Bet History</button>
                        {user.role === 'admin' && (
                          <button onClick={() => navigate('/admin/dashboard')} className="admin-link-pro">⚙️ Admin</button>
                        )}
                        <button className="logout-btn-pro" onClick={handleLogout}>🚪 Logout</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="auth-pro">
                <button className="login-btn-pro" onClick={() => navigate('/login')}>Login</button>
                <button className="register-btn-pro" onClick={() => navigate('/register')}>Register</button>
              </div>
            )}
            <button className="mobile-toggle-pro" onClick={() => setShowMobileMenu(!showMobileMenu)}>☰</button>
          </div>
        </div>
      </header>

      {showMobileMenu && (
        <div className="mobile-overlay-pro" onClick={() => setShowMobileMenu(false)}>
          <div className="mobile-nav-pro" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-header-pro">
              <span>⚡ AsharaBet</span>
              <button className="mobile-close-pro" onClick={() => setShowMobileMenu(false)}>✕</button>
            </div>
            <div className="mobile-items-pro">
              <button className="mobile-link-pro active" onClick={() => { setActiveTab('all'); setShowMobileMenu(false); }}>🏠 Home</button>
              <button className="mobile-link-pro" onClick={() => { setActiveTab('live'); setShowMobileMenu(false); }}>🔴 Live</button>
              <button className="mobile-link-pro" onClick={() => { navigate('/matches'); setShowMobileMenu(false); }}>⚽ Matches</button>
              <button className="mobile-link-pro" onClick={() => { navigate('/deposit'); setShowMobileMenu(false); }}>💰 Deposit</button>
              <button className="mobile-link-pro" onClick={() => { navigate('/withdraw'); setShowMobileMenu(false); }}>💸 Withdraw</button>
              {user?.role === 'admin' && (
                <button className="mobile-link-pro admin" onClick={() => { navigate('/admin/dashboard'); setShowMobileMenu(false); }}>⚙️ Admin</button>
              )}
              <button className="mobile-link-pro logout" onClick={() => { handleLogout(); setShowMobileMenu(false); }}>🚪 Logout</button>
            </div>
          </div>
        </div>
      )}

      <div className="main-pro">
        <div className="main-content-pro">
          <div className="sports-tabs-pro">
            {sports.map(sport => (
              <button
                key={sport.id}
                className={`sport-tab-pro ${selectedSport === sport.id ? 'active' : ''}`}
                onClick={() => setSelectedSport(sport.id)}
              >
                {sport.icon} {sport.name}
              </button>
            ))}
          </div>

          <div className="matches-pro">
            {loading ? (
              <div className="loading-pro">
                <div className="spinner-pro"></div>
                <p>Loading matches...</p>
              </div>
            ) : groupedMatches.length > 0 ? (
              groupedMatches.map((group) => (
                <div key={group.day} className="league-group-pro">
                  <div className="league-header-pro">
                    <span className="league-icon-pro">📅</span>
                    <h3>{group.day}</h3>
                    <span className="match-count-pro">{group.matches.length} matches</span>
                  </div>

                  {group.matches.map((match) => {
                    const isExpanded = expandedMatch === match._id;
                    const availableMarkets = getAvailableMarkets(match);
                    const timeLeft = getTimeLeft(match.date);
                    
                    return (
                      <div key={match._id} className={`match-card-pro ${isExpanded ? 'expanded' : ''}`}>
                        <div className="match-row-pro">
                          <div className="match-info-pro">
                            <div className="match-teams-pro">
                              <span className="team-home-pro" title={match.homeTeam}>{match.homeTeam}</span>
                              <span className="team-vs-pro">vs</span>
                              <span className="team-away-pro" title={match.awayTeam}>{match.awayTeam}</span>
                            </div>
                            <div className="match-meta-pro">
                              <span className="match-date-pro">{formatDate(match.date)}</span>
                              {getStatusBadge(match.status)}
                              {match.status !== 'LIVE' && match.status !== 'FINISHED' && timeLeft && (
                                <span className="time-left-badge">⏱️ {timeLeft}</span>
                              )}
                            </div>
                          </div>
                          <button className="expand-btn-pro" onClick={() => toggleMatchExpand(match._id)}>
                            {isExpanded ? '▲' : '▼'}
                            <span className="expand-count">{availableMarkets.length > 0 ? `(${availableMarkets.length})` : ''}</span>
                          </button>
                        </div>

                        <div className="result-odds-pro">
                          <button 
                            className={`result-odd-btn ${isInBetSlip(match._id, '1', 'Result') ? 'selected' : ''}`}
                            onClick={() => addToBetSlip(match, '1', match.odds?.home || 'N/A', 'Result')}
                            disabled={match.status === 'FINISHED' || match.status === 'finished' || hasMatchStarted(match.date)}
                          >
                            <span className="result-label">1</span>
                            <span className="result-odd">{match.odds?.home || 'N/A'}</span>
                          </button>
                          <button 
                            className={`result-odd-btn ${isInBetSlip(match._id, 'X', 'Result') ? 'selected' : ''}`}
                            onClick={() => addToBetSlip(match, 'X', match.odds?.draw || 'N/A', 'Result')}
                            disabled={match.status === 'FINISHED' || match.status === 'finished' || hasMatchStarted(match.date)}
                          >
                            <span className="result-label">X</span>
                            <span className="result-odd">{match.odds?.draw || 'N/A'}</span>
                          </button>
                          <button 
                            className={`result-odd-btn ${isInBetSlip(match._id, '2', 'Result') ? 'selected' : ''}`}
                            onClick={() => addToBetSlip(match, '2', match.odds?.away || 'N/A', 'Result')}
                            disabled={match.status === 'FINISHED' || match.status === 'finished' || hasMatchStarted(match.date)}
                          >
                            <span className="result-label">2</span>
                            <span className="result-odd">{match.odds?.away || 'N/A'}</span>
                          </button>
                        </div>

                        {isExpanded && availableMarkets.length > 0 && (
                          <div className="all-markets-pro">
                            <div className="markets-grid-pro">
                              {availableMarkets.map((marketKey) => {
                                const marketOdds = getMarketOdds(match, marketKey);
                                const marketDisplay = allMarkets[marketKey]?.label || marketKey;
                                const marketIcon = allMarkets[marketKey]?.icon || '📊';
                                
                                if (!marketOdds) return null;
                                        
                                return (
                                  <div key={marketKey} className="market-section-pro">
                                    <div className="market-header-pro">
                                      <span className="market-icon">{marketIcon}</span>
                                      <h4>{marketDisplay}</h4>
                                    </div>
                                    <div className="market-options-pro">
                                      {Object.entries(marketOdds).map(([label, odds]) => {
                                        const isSelected = isInBetSlip(match._id, label, marketDisplay);
                                        return (
                                          <button 
                                            key={label} 
                                            className={`market-option-pro ${isSelected ? 'selected' : ''}`}
                                            onClick={() => addToBetSlip(match, label, odds, marketDisplay)}
                                          >
                                            <span className="option-label">{label}</span>
                                            <span className="option-odds">{odds}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="empty-pro">
                <div className="empty-icon-pro">⚽</div>
                <h3>No Upcoming Matches Available</h3>
                <p>Check back later for upcoming matches</p>
              </div>
            )}
          </div>
        </div>

        <div className={`sidebar-pro ${!showBetSlip ? 'hidden' : ''}`}>
          <div className="sidebar-header-pro">
            <h3>🎫 BET SLIP</h3>
            <span className="sidebar-count-pro">{betSlip.length}</span>
            <button className="sidebar-close-pro" onClick={toggleBetSlip}>✕</button>
          </div>

          <div className="sidebar-body-pro">
            {betSlip.length === 0 ? (
              user ? (
                <div className="telegram-join-betslip">
                  <div className="telegram-join-icon">📢</div>
                  <h4>Join Our Telegram Channel!</h4>
                  <p>Get live updates, promotions &amp; betting tips</p>
                  <button className="telegram-join-btn-betslip" onClick={handleJoinTelegram}>
                    📱 Join Telegram
                  </button>
                  <button className="telegram-skip-btn-betslip" onClick={handleSkipTelegram}>
                    Maybe Later
                  </button>
                </div>
              ) : (
                <div className="empty-betslip-pro">
                  <div className="empty-icon-betslip-pro">📋</div>
                  <p>No selections</p>
                  <span>Click odds to add</span>
                </div>
              )
            ) : (
              <>
                <div className="betslip-list-pro">
                  {betSlip.map((bet, index) => (
                    <div key={index} className="betslip-item-pro">
                      <div className="betslip-header-pro">
                        <div className="betslip-match-pro">
                          <p className="betslip-match-name-pro">{bet.match}</p>
                          <span className="betslip-league-pro">{bet.league}</span>
                          <span className="betslip-market-pro">{bet.market}</span>
                        </div>
                        <button className="betslip-remove-pro" onClick={() => removeFromBetSlip(index)}>✕</button>
                      </div>
                      <div className="betslip-body-pro">
                        <span className="betslip-selection-pro">{bet.betType}    ..................... {bet.odds}  odd</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="betslip-total-stake-pro">
                  <label>Total Stake</label>
                  <input
                    type="number"
                    className="betslip-stake-input-pro"
                    placeholder="Enter total stake"
                    value={totalStake || ''}
                    onChange={(e) => updateTotalStake(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="betslip-summary-pro">
                  <div className="summary-row-pro">
                    <span>Total Stake</span>
                    <strong>{formatCurrency(parseFloat(totalStake) || 0)}</strong>
                  </div>
                  <div className="summary-row-pro">
                    <span>Total Odds</span>
                    <strong>{calculateTotalOdds()}</strong>
                  </div>
                  <div className="summary-row-pro potential">
                    <span>Potential Win</span>
                    <strong>{formatCurrency(parseFloat(calculatePotentialWinnings()) || 0)}</strong>
                  </div>
                </div>

                <button className="place-bet-pro" onClick={placeBets}>
                  Place Bet
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {isMobile && (
        <div className="bottom-nav">
          {bottomNavItems.map((item) => (
            <button
              key={item.id}
              className="bottom-nav-item"
              onClick={() => {
                if (item.action === 'betslip') {
                  toggleBetSlip();
                } else if (item.path) {
                  navigate(item.path);
                }
              }}
            >
              <span className="bottom-nav-icon">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
              {item.id === 'betslip' && betSlip.length > 0 && (
                <span className="bottom-nav-badge">{betSlip.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {betSlip.length > 0 && !showBetSlip && isMobile && (
        <button className="mobile-betslip-pro" onClick={toggleBetSlip}>
          🎫 {betSlip.length}
        </button>
      )}

      {showTelegramPopup && (
        <div className="telegram-popup-overlay" onClick={handleSkipTelegram}>
          <div className="telegram-popup-simple" onClick={(e) => e.stopPropagation()}>
            <div className="telegram-popup-icon-simple">📢</div>
            <h2>Join Our Telegram Channel!</h2>
            <p>Stay updated with live odds, promotions, and exclusive betting tips!</p>
            <div className="telegram-buttons">
              <button className="telegram-join-btn-simple" onClick={handleJoinTelegram}>
                📱 Join Now
              </button>
              <button className="telegram-skip-btn-simple" onClick={handleSkipTelegram}>
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;