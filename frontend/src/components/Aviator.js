import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Aviator.css';

const Aviator = () => {
  const [gameState, setGameState] = useState({
    status: 'idle', // idle, waiting, active, crashed
    multiplier: 1.00,
    crashPoint: 0,
    roundNumber: 0,
    oddCounter: 1.00 // ✅ ADDED: Real-time odd counter
  });

  const [userBet, setUserBet] = useState({
    amount: 10,
    autoCashOut: 1.50,
    isActive: false,
    placedAt: 0
  });

  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [profit, setProfit] = useState(0);
  const [totalBets, setTotalBets] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [loading, setLoading] = useState(false);

  const canvasRef = useRef(null);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // ========== FETCH USER DATA ==========
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

  // ========== REAL-TIME GAME STATE ==========
  const fetchGameState = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/state`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        const newState = response.data;
        
        // Check if game just crashed
        if (gameState.status === 'active' && newState.status === 'crashed') {
          if (userBet.isActive) {
            setUserBet(prev => ({ ...prev, isActive: false }));
            setTotalBets(prev => prev + 1);
            fetchBalance();
          }
        }
        
        // Check if game just started
        if (gameState.status === 'idle' && newState.status === 'active') {
          setProfit(0);
        }
        
        // ✅ Update game state with odd counter
        setGameState(prev => ({
          ...prev,
          ...newState,
          oddCounter: newState.multiplier || newState.oddCounter || 1.00
        }));
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  // ========== POLL GAME STATE ==========
  useEffect(() => {
    fetchBalance();
    fetchHistory();
    fetchGameState();

    const interval = setInterval(() => {
      fetchGameState();
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // ========== PLACE BET ==========
  const placeBet = async () => {
    if (gameState.status !== 'idle' && gameState.status !== 'waiting') {
      alert('⏳ Wait for the next round!');
      return;
    }

    const betAmount = parseFloat(userBet.amount);
    if (isNaN(betAmount) || betAmount <= 0) {
      alert('Please enter a valid bet amount');
      return;
    }

    if (betAmount > balance) {
      alert(`❌ Insufficient balance! Your balance is ETB ${balance.toFixed(2)}`);
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
          isActive: true,
          placedAt: Date.now()
        }));
        setTotalBets(prev => prev + 1);
        alert('✅ Bet placed! Waiting for the game to start...');
      } else {
        alert('❌ Failed to place bet: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('❌ Error placing bet: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // ========== CASH OUT ==========
  const handleCashOut = async () => {
    if (!userBet.isActive) {
      alert('You have no active bet!');
      return;
    }

    if (gameState.status !== 'active') {
      alert('❌ Game is not active!');
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
        
        alert(`🎉 Cashed out at ${gameState.oddCounter.toFixed(2)}x! Profit: ETB ${profitAmount.toFixed(2)}`);
        fetchBalance();
      } else {
        alert('❌ Failed to cash out: ' + response.data.message);
      }
    } catch (error) {
      console.error('Error cashing out:', error);
      alert('❌ Error cashing out: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // ========== FORMATTING ==========
  const formatCurrency = (amount) => {
    return `ETB ${amount.toFixed(2)}`;
  };

  // ========== RENDER ==========
  return (
    <div className="aviator-container">
      <div className="aviator-header">
        <h1>✈️ Aviator</h1>
        <div className="aviator-balance">
          <span>Balance: </span>
          <span className="balance-amount">{formatCurrency(balance)}</span>
        </div>
      </div>

      <div className="aviator-game-area">
        <div className="aviator-odd-display">
          {/* ✅ ODD COUNTER - PROMINENT DISPLAY */}
          <div className="odd-counter-user">
            <span className="odd-label">📊 Current Odd</span>
            <span className={`odd-number-user ${gameState.status === 'active' ? 'pulse-odd' : ''}`}>
              {gameState.oddCounter.toFixed(2)}x
            </span>
            <span className="odd-status">
              {gameState.status === 'idle' && '⏸️ Waiting'}
              {gameState.status === 'waiting' && '⏳ Starting...'}
              {gameState.status === 'active' && '🟢 Live'}
              {gameState.status === 'crashed' && '💥 Crashed'}
            </span>
          </div>
        </div>

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
      </div>

      <div className="aviator-controls">
        <div className="control-group">
          <label>Bet Amount (ETB)</label>
          <div className="bet-input-group">
            <button onClick={() => setUserBet(prev => ({ ...prev, amount: Math.max(1, prev.amount - 5) }))}>-</button>
            <input 
              type="number" 
              value={userBet.amount}
              onChange={(e) => setUserBet(prev => ({ ...prev, amount: Math.max(1, parseFloat(e.target.value) || 1) }))}
              min="1"
              step="1"
              disabled={userBet.isActive}
            />
            <button onClick={() => setUserBet(prev => ({ ...prev, amount: prev.amount + 5 }))}>+</button>
          </div>
          <div className="quick-bets">
            <button onClick={() => setUserBet(prev => ({ ...prev, amount: 10 }))} disabled={userBet.isActive}>10</button>
            <button onClick={() => setUserBet(prev => ({ ...prev, amount: 25 }))} disabled={userBet.isActive}>25</button>
            <button onClick={() => setUserBet(prev => ({ ...prev, amount: 50 }))} disabled={userBet.isActive}>50</button>
            <button onClick={() => setUserBet(prev => ({ ...prev, amount: 100 }))} disabled={userBet.isActive}>100</button>
            <button onClick={() => setUserBet(prev => ({ ...prev, amount: 500 }))} disabled={userBet.isActive}>500</button>
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

        <div className="control-group">
          <button 
            className={`bet-btn ${userBet.isActive && gameState.status === 'active' ? 'cashout-btn' : 'place-btn'}`}
            onClick={userBet.isActive && gameState.status === 'active' ? handleCashOut : placeBet}
            disabled={
              loading || 
              gameState.status === 'crashed' || 
              balance <= 0 ||
              (userBet.isActive && gameState.status !== 'active')
            }
          >
            {userBet.isActive && gameState.status === 'active' 
              ? `💰 Cash Out (${gameState.oddCounter.toFixed(2)}x)` 
              : '📈 Place Bet'}
          </button>
          {balance <= 0 && gameState.status === 'idle' && (
            <p style={{ color: '#ff4444', fontSize: '12px', marginTop: '5px' }}>
              ⚠️ Insufficient balance. Please deposit.
            </p>
          )}
          {userBet.isActive && gameState.status !== 'active' && (
            <p style={{ color: '#ffc107', fontSize: '12px', marginTop: '5px' }}>
              ⏳ Waiting for game to start...
            </p>
          )}
        </div>
      </div>

      <div className="aviator-history">
        <h3>📊 History</h3>
        <div className="history-list">
          {history.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '10px' }}>
              No history yet
            </p>
          ) : (
            history.map((item, index) => (
              <div key={index} className={`history-item ${item.crashed ? 'crashed' : 'cashed'}`}>
                <span className="history-round">#{item.roundNumber}</span>
                <span className="history-multiplier">{item.crashPoint?.toFixed(2) || 'N/A'}x</span>
                <span className="history-players">{item.playersActive || 0} players</span>
              </div>
            ))
          )}
        </div>
      </div>

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