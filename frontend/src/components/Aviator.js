import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Aviator.css';

const Aviator = () => {
  const [gameState, setGameState] = useState({
    status: 'idle',
    multiplier: 1.00,
    crashPoint: 0,
    roundNumber: 0
  });

  const [userBet, setUserBet] = useState({
    amount: 10,
    autoCashOut: 1.50,
    isActive: false
  });

  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [profit, setProfit] = useState(0);
  const [totalBets, setTotalBets] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // ========== FETCH BALANCE ==========
  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/api/user/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setBalance(response.data.balance || 0);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  // ========== FETCH GAME STATE ==========
  const fetchGameState = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/state`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        const newState = response.data;
        
        // Check if game crashed while user had active bet
        if (gameState.status === 'active' && newState.status === 'crashed' && userBet.isActive) {
          setUserBet(prev => ({ ...prev, isActive: false }));
          setTotalBets(prev => prev + 1);
          fetchBalance();
          setError('💥 Game crashed! Bet lost.');
          setTimeout(() => setError(''), 3000);
        }
        
        // Check if game just started
        if (gameState.status === 'idle' && newState.status === 'active') {
          setProfit(0);
          setError('');
        }
        
        setGameState(newState);
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  // ========== FETCH HISTORY ==========
  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setHistory(response.data.slice(0, 20));
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  // ========== POLL GAME STATE ==========
  useEffect(() => {
    fetchBalance();
    fetchHistory();
    fetchGameState();

    const interval = setInterval(() => {
      fetchGameState();
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // ========== PLACE BET ==========
  const placeBet = async () => {
    setError('');
    
    if (gameState.status !== 'idle' && gameState.status !== 'waiting') {
      setError('⏳ Wait for the next round!');
      setTimeout(() => setError(''), 2000);
      return;
    }

    const betAmount = parseFloat(userBet.amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      setError('Please enter a valid bet amount');
      setTimeout(() => setError(''), 2000);
      return;
    }

    if (betAmount > balance) {
      setError(`❌ Insufficient balance! Balance: ETB ${balance.toFixed(2)}`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post(`${API_URL}/api/aviator/bet`, 
        { 
          amount: betAmount,
          autoCashOut: userBet.autoCashOut || 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setBalance(prev => prev - betAmount);
        setUserBet(prev => ({
          ...prev,
          isActive: true
        }));
        setTotalBets(prev => prev + 1);
        setError('✅ Bet placed!');
        setTimeout(() => setError(''), 1500);
      } else {
        setError('❌ ' + response.data.message);
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      setError('❌ Error placing bet');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // ========== CASH OUT ==========
  const handleCashOut = async () => {
    setError('');
    
    if (!userBet.isActive) {
      setError('You have no active bet!');
      setTimeout(() => setError(''), 2000);
      return;
    }

    if (gameState.status !== 'active') {
      setError('❌ Game is not active!');
      setTimeout(() => setError(''), 2000);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/aviator/cashout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        const winAmount = response.data.winAmount || 0;
        const profitAmount = winAmount - userBet.amount;
        
        setBalance(prev => prev + winAmount);
        setProfit(profitAmount);
        setTotalWins(prev => prev + 1);
        setUserBet(prev => ({ ...prev, isActive: false }));
        
        setError(`🎉 Cashed out at ${gameState.multiplier.toFixed(2)}x! +ETB ${profitAmount.toFixed(2)}`);
        setTimeout(() => setError(''), 3000);
        fetchBalance();
      } else {
        setError('❌ ' + response.data.message);
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      console.error('Error cashing out:', error);
      setError('❌ Error cashing out');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // ========== QUICK BET ==========
  const quickBet = (amount) => {
    if (!userBet.isActive) {
      setUserBet(prev => ({ ...prev, amount: amount }));
    }
  };

  // ========== FORMATTING ==========
  const formatCurrency = (amount) => {
    return `ETB ${amount.toFixed(2)}`;
  };

  // ========== RENDER ==========
  const isBetDisabled = loading || gameState.status === 'crashed' || balance <= 0 || userBet.isActive;
  const isCashoutDisabled = loading || !userBet.isActive || gameState.status !== 'active';

  return (
    <div className="aviator-container">
      {/* ===== HEADER ===== */}
      <div className="aviator-header">
        <h1><span>✈️</span> Aviator</h1>
        <div className="aviator-balance">
          Balance: <span className="balance-amount">{formatCurrency(balance)}</span>
        </div>
      </div>

      {/* ===== ODD DISPLAY ===== */}
      <div className="aviator-odd-display">
        <span className="odd-label">📊 Current Odd</span>
        <span className={`odd-number-user ${gameState.status === 'active' ? 'pulse-odd' : ''}`}>
          {gameState.multiplier.toFixed(2)}x
        </span>
        <span className={`odd-status ${gameState.status}`}>
          {gameState.status === 'idle' && '⏸️ Waiting'}
          {gameState.status === 'waiting' && '⏳ Starting...'}
          {gameState.status === 'active' && '🟢 Live'}
          {gameState.status === 'crashed' && '💥 Crashed!'}
        </span>
      </div>

      {/* ===== STATS ===== */}
      <div className="aviator-stats">
        <div className="stat">
          <span>Round</span>
          <span className="stat-value">#{gameState.roundNumber || 0}</span>
        </div>
        <div className="stat">
          <span>Multiplier</span>
          <span className="stat-value">{gameState.multiplier.toFixed(2)}x</span>
        </div>
        <div className="stat">
          <span>Profit</span>
          <span className={`stat-value ${profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
            {formatCurrency(profit)}
          </span>
        </div>
      </div>

      {/* ===== BET CONTROLS ===== */}
      <div className="aviator-controls">
        <div className="control-group">
          <label>Bet Amount</label>
          <div className="bet-input-group">
            <button onClick={() => setUserBet(prev => ({ ...prev, amount: Math.max(1, prev.amount - 5) }))} disabled={userBet.isActive}>−</button>
            <input 
              type="number" 
              value={userBet.amount}
              onChange={(e) => setUserBet(prev => ({ ...prev, amount: Math.max(1, parseFloat(e.target.value) || 1) }))}
              min="1"
              step="1"
              disabled={userBet.isActive}
            />
            <button onClick={() => setUserBet(prev => ({ ...prev, amount: prev.amount + 5 }))} disabled={userBet.isActive}>+</button>
          </div>
          <div className="quick-bets">
            <button onClick={() => quickBet(10)} disabled={userBet.isActive}>10</button>
            <button onClick={() => quickBet(25)} disabled={userBet.isActive}>25</button>
            <button onClick={() => quickBet(50)} disabled={userBet.isActive}>50</button>
            <button onClick={() => quickBet(100)} disabled={userBet.isActive}>100</button>
            <button onClick={() => quickBet(500)} disabled={userBet.isActive}>500</button>
          </div>
        </div>

        <div className="control-group">
          <label>Auto Cash Out</label>
          <div className="auto-cashout-input">
            <input 
              type="number" 
              value={userBet.autoCashOut}
              onChange={(e) => setUserBet(prev => ({ ...prev, autoCashOut: parseFloat(e.target.value) || 0 }))}
              min="1.01"
              step="0.1"
              placeholder="1.5x"
              disabled={userBet.isActive}
            />
            <span>x</span>
          </div>
        </div>
      </div>

      {/* ===== ERROR MESSAGE ===== */}
      {error && (
        <div className="bet-error">{error}</div>
      )}

      {/* ===== ACTION BUTTONS ===== */}
      <div className="aviator-actions">
        <button 
          className={`bet-btn ${userBet.isActive && gameState.status === 'active' ? 'cashout-btn' : 'place-btn'}`}
          onClick={userBet.isActive && gameState.status === 'active' ? handleCashOut : placeBet}
          disabled={userBet.isActive && gameState.status === 'active' ? isCashoutDisabled : isBetDisabled}
        >
          {userBet.isActive && gameState.status === 'active' 
            ? `💰 Cash Out (${gameState.multiplier.toFixed(2)}x)` 
            : '📈 Place Bet'}
        </button>
        
        <button 
          className="bet-btn place-btn"
          onClick={() => {
            setUserBet(prev => ({ ...prev, amount: balance > 0 ? Math.min(balance, 100) : 10 }));
          }}
          disabled={userBet.isActive || balance <= 0}
          style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff' }}
        >
          Max Bet
        </button>
      </div>

      {/* ===== HISTORY ===== */}
      <div className="aviator-history">
        <h3>📊 History</h3>
        <div className="history-list">
          {history.length === 0 ? (
            <span style={{ color: '#666', fontSize: '0.7rem' }}>No history yet</span>
          ) : (
            history.map((item, index) => (
              <div key={index} className={`history-item ${item.crashed ? 'crashed' : 'cashed'}`}>
                <span className="history-round">#{item.roundNumber}</span>
                <span className="history-multiplier">{item.crashPoint?.toFixed(2) || 'N/A'}x</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== BOTTOM STATS ===== */}
      <div className="aviator-stats-bottom">
        <div className="stat-small">
          <span>Total Bets</span>
          <strong>{totalBets}</strong>
        </div>
        <div className="stat-small">
          <span>Total Wins</span>
          <strong>{totalWins}</strong>
        </div>
        <div className="stat-small">
          <span>Win Rate</span>
          <strong>
            {totalBets > 0 
              ? ((totalWins / totalBets) * 100).toFixed(1) + '%'
              : '0%'}
          </strong>
        </div>
      </div>
    </div>
  );
};

export default Aviator;