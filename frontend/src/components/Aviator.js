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
    autoCashOutEnabled: false,
    isActive: false
  });

  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [profit, setProfit] = useState(0);
  const [totalBets, setTotalBets] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
          setMessage('');
        }
        
        // Auto Cash Out - check if enabled and multiplier reached
        if (newState.status === 'active' && userBet.isActive && userBet.autoCashOutEnabled) {
          if (newState.multiplier >= userBet.autoCashOut) {
            // Auto cash out
            handleAutoCashOut(newState.multiplier);
          }
        }
        
        setGameState(newState);
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  // ========== FETCH REAL HISTORY ==========
  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.length > 0) {
        setHistory(response.data);
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

    // Refresh history every 30 seconds
    const historyInterval = setInterval(() => {
      fetchHistory();
    }, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(historyInterval);
    };
  }, []);

  // ========== AUTO CASH OUT ==========
  const handleAutoCashOut = async (multiplier) => {
    if (!userBet.isActive) return;
    
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
        
        setMessage(`🤖 Auto Cashed out at ${multiplier.toFixed(2)}x! +ETB ${profitAmount.toFixed(2)}`);
        setTimeout(() => setMessage(''), 4000);
        fetchBalance();
      }
    } catch (error) {
      console.error('Error auto cashing out:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========== PLACE BET ==========
  const placeBet = async () => {
    setError('');
    setMessage('');
    
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
          autoCashOut: userBet.autoCashOutEnabled ? userBet.autoCashOut : 0
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
        setMessage('✅ Bet placed!');
        setTimeout(() => setMessage(''), 1500);
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
    setMessage('');
    
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
        
        setMessage(`🎉 Cashed out at ${gameState.multiplier.toFixed(2)}x! +ETB ${profitAmount.toFixed(2)}`);
        setTimeout(() => setMessage(''), 3000);
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

  // ========== TOGGLE AUTO CASH OUT ==========
  const toggleAutoCashOut = () => {
    if (!userBet.isActive) {
      setUserBet(prev => ({ 
        ...prev, 
        autoCashOutEnabled: !prev.autoCashOutEnabled 
      }));
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

      {/* ===== HISTORY - Horizontal ===== */}
      <div className="aviator-history-horizontal">
        <div className="history-list-horizontal">
          {history.length === 0 ? (
            <span className="no-history">No history yet</span>
          ) : (
            history.slice(0, 20).map((item, index) => (
              <div key={index} className={`history-item-horizontal ${item.crashed ? 'crashed' : 'cashed'}`}>
                <span className="history-multiplier-horizontal">
                  {item.crashPoint?.toFixed(2) || 'N/A'}x
                </span>
              </div>
            ))
          )}
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

      {/* ===== MESSAGES ===== */}
      {message && (
        <div className="bet-success">{message}</div>
      )}
      {error && (
        <div className="bet-error">{error}</div>
      )}

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
          <div className="auto-cashout-control">
            <div className="auto-cashout-toggle">
              <button 
                className={`toggle-btn ${userBet.autoCashOutEnabled ? 'active' : ''}`}
                onClick={toggleAutoCashOut}
                disabled={userBet.isActive}
              >
                {userBet.autoCashOutEnabled ? 'ON' : 'OFF'}
              </button>
              <span className="toggle-label">Auto Cash Out</span>
            </div>
            {userBet.autoCashOutEnabled && (
              <div className="auto-cashout-input">
                <input 
                  type="number" 
                  value={userBet.autoCashOut}
                  onChange={(e) => setUserBet(prev => ({ ...prev, autoCashOut: parseFloat(e.target.value) || 1.01 }))}
                  min="1.01"
                  step="0.1"
                  disabled={userBet.isActive}
                />
                <span>x</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== ACTION BUTTONS - Two Buttons ===== */}
      <div className="aviator-actions">
        <button 
          className="bet-btn place-btn"
          onClick={placeBet}
          disabled={isBetDisabled}
        >
          📈 Place Bet
        </button>
        
        <button 
          className={`bet-btn ${userBet.isActive && gameState.status === 'active' ? 'cashout-btn' : 'cashout-disabled'}`}
          onClick={handleCashOut}
          disabled={isCashoutDisabled}
        >
          {userBet.isActive && gameState.status === 'active' 
            ? `💰 Cash Out (${gameState.multiplier.toFixed(2)}x)` 
            : '💰 Cash Out'}
        </button>
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