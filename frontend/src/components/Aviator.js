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

  // ===== TWO INDEPENDENT BETS =====
  const [bet1, setBet1] = useState({
    amount: 10,
    autoCashOut: 1.50,
    autoCashOutEnabled: false,
    isActive: false,
    placedAt: 0
  });

  const [bet2, setBet2] = useState({
    amount: 10,
    autoCashOut: 1.50,
    autoCashOutEnabled: false,
    isActive: false,
    placedAt: 0
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
        
        // Check if game just crashed
        if (gameState.status === 'active' && newState.status === 'crashed') {
          // Register new crash in history
          const crashData = {
            roundNumber: newState.roundNumber || 0,
            crashPoint: newState.multiplier || 0,
            crashed: true,
            timestamp: new Date().toISOString()
          };
          
          setHistory(prev => {
            const newHistory = [crashData, ...prev];
            return newHistory.slice(0, 10);
          });
          
          if (bet1.isActive) {
            setBet1(prev => ({ ...prev, isActive: false }));
            setTotalBets(prev => prev + 1);
          }
          if (bet2.isActive) {
            setBet2(prev => ({ ...prev, isActive: false }));
            setTotalBets(prev => prev + 1);
          }
          
          fetchBalance();
          setError(`💥 Game crashed at ${newState.multiplier.toFixed(2)}x!`);
          setTimeout(() => setError(''), 3000);
        }
        
        if (gameState.status === 'idle' && newState.status === 'active') {
          setProfit(0);
          setError('');
          setMessage('');
        }
        
        // Auto Cash Out
        if (newState.status === 'active' && bet1.isActive && bet1.autoCashOutEnabled) {
          if (newState.multiplier >= bet1.autoCashOut) {
            handleAutoCashOut(1, newState.multiplier);
          }
        }
        
        if (newState.status === 'active' && bet2.isActive && bet2.autoCashOutEnabled) {
          if (newState.multiplier >= bet2.autoCashOut) {
            handleAutoCashOut(2, newState.multiplier);
          }
        }
        
        setGameState(newState);
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  // ========== FETCH REAL GAME HISTORY ==========
  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.length > 0) {
        setHistory(response.data.slice(0, 10));
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setHistory([]);
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

    const historyInterval = setInterval(() => {
      fetchHistory();
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(historyInterval);
    };
  }, []);

  // ========== AUTO CASH OUT ==========
  const handleAutoCashOut = async (betNumber, multiplier) => {
    const bet = betNumber === 1 ? bet1 : bet2;
    const setBet = betNumber === 1 ? setBet1 : setBet2;
    
    if (!bet.isActive) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/aviator/cashout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        const winAmount = response.data.winAmount || 0;
        const profitAmount = winAmount - bet.amount;
        
        setBalance(prev => prev + winAmount);
        setProfit(profitAmount);
        setTotalWins(prev => prev + 1);
        setBet(prev => ({ ...prev, isActive: false }));
        
        setMessage(`🤖 Bet ${betNumber} Auto Cashed at ${multiplier.toFixed(2)}x! +ETB ${profitAmount.toFixed(2)}`);
        setTimeout(() => setMessage(''), 4000);
        fetchBalance();
        fetchHistory();
      }
    } catch (error) {
      console.error('Error auto cashing out:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========== PLACE BET ==========
  const placeBet = async (betNumber) => {
    setError('');
    setMessage('');
    
    const bet = betNumber === 1 ? bet1 : bet2;
    const setBet = betNumber === 1 ? setBet1 : setBet2;
    
    if (gameState.status !== 'idle' && gameState.status !== 'waiting') {
      setError('⏳ Wait for the next round!');
      setTimeout(() => setError(''), 2000);
      return;
    }

    const betAmount = parseFloat(bet.amount);
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
          autoCashOut: bet.autoCashOutEnabled ? bet.autoCashOut : 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setBalance(prev => prev - betAmount);
        setBet(prev => ({
          ...prev,
          isActive: true,
          placedAt: Date.now()
        }));
        setTotalBets(prev => prev + 1);
        setMessage(`✅ Bet ${betNumber} placed!`);
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
  const handleCashOut = async (betNumber) => {
    setError('');
    setMessage('');
    
    const bet = betNumber === 1 ? bet1 : bet2;
    const setBet = betNumber === 1 ? setBet1 : setBet2;
    
    if (!bet.isActive) {
      setError(`Bet ${betNumber} has no active bet!`);
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
        const profitAmount = winAmount - bet.amount;
        
        setBalance(prev => prev + winAmount);
        setProfit(profitAmount);
        setTotalWins(prev => prev + 1);
        setBet(prev => ({ ...prev, isActive: false }));
        
        setMessage(`🎉 Bet ${betNumber} Cashed at ${gameState.multiplier.toFixed(2)}x! +ETB ${profitAmount.toFixed(2)}`);
        setTimeout(() => setMessage(''), 3000);
        fetchBalance();
        fetchHistory();
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
  const quickBet = (betNumber, amount) => {
    const setBet = betNumber === 1 ? setBet1 : setBet2;
    const bet = betNumber === 1 ? bet1 : bet2;
    if (!bet.isActive) {
      setBet(prev => ({ ...prev, amount: amount }));
    }
  };

  // ========== TOGGLE AUTO CASH OUT ==========
  const toggleAutoCashOut = (betNumber) => {
    const setBet = betNumber === 1 ? setBet1 : setBet2;
    const bet = betNumber === 1 ? bet1 : bet2;
    if (!bet.isActive) {
      setBet(prev => ({ 
        ...prev, 
        autoCashOutEnabled: !prev.autoCashOutEnabled 
      }));
    }
  };

  // ========== FORMATTING ==========
  const formatCurrency = (amount) => {
    return `ETB ${amount.toFixed(2)}`;
  };

  // ========== GET BUTTON CONFIG ==========
  const getButtonConfig = (betNumber) => {
    const bet = betNumber === 1 ? bet1 : bet2;
    
    const isDisabled = loading || gameState.status === 'crashed' || balance <= 0;
    const isCashoutDisabled = loading || !bet.isActive || gameState.status !== 'active';
    
    if (bet.isActive && gameState.status === 'active') {
      return {
        text: `💰 ${gameState.multiplier.toFixed(2)}x`,
        class: 'cashout-btn',
        disabled: isCashoutDisabled,
        onClick: () => handleCashOut(betNumber)
      };
    } else {
      return {
        text: `📈 Bet ${betNumber}`,
        class: 'place-btn',
        disabled: isDisabled || bet.isActive,
        onClick: () => placeBet(betNumber)
      };
    }
  };

  const button1Config = getButtonConfig(1);
  const button2Config = getButtonConfig(2);

  return (
    <div className="aviator-container">
      {/* ===== HEADER ===== */}
      <div className="aviator-header">
        <h1><span>✈️</span> Aviator</h1>
        <div className="aviator-balance">
          Balance: <span className="balance-amount">{formatCurrency(balance)}</span>
        </div>
      </div>

      {/* ===== MAIN CONTENT - Side by Side ===== */}
      <div className="main-content">
        {/* ===== LEFT SIDE - Game Area ===== */}
        <div className="game-area">
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

          {/* ===== TWO BETS - SIDE BY SIDE ===== */}
          <div className="bets-horizontal">
            {/* ===== BET 1 ===== */}
            <div className="bet-section">
              <div className="bet-section-header">
                <span className="bet-number">🎯 Bet 1</span>
                {bet1.isActive && gameState.status === 'active' && (
                  <span className="bet-active">🟢 Active</span>
                )}
                {bet1.isActive && gameState.status !== 'active' && (
                  <span className="bet-waiting">⏳ Waiting</span>
                )}
              </div>
              
              <div className="bet-controls">
                <div className="control-group">
                  <label>Amount</label>
                  <div className="bet-input-group">
                    <button onClick={() => setBet1(prev => ({ ...prev, amount: Math.max(1, prev.amount - 5) }))} disabled={bet1.isActive}>−</button>
                    <input 
                      type="number" 
                      value={bet1.amount}
                      onChange={(e) => setBet1(prev => ({ ...prev, amount: Math.max(1, parseFloat(e.target.value) || 1) }))}
                      min="1"
                      step="1"
                      disabled={bet1.isActive}
                    />
                    <button onClick={() => setBet1(prev => ({ ...prev, amount: prev.amount + 5 }))} disabled={bet1.isActive}>+</button>
                  </div>
                  <div className="quick-bets">
                    <button onClick={() => quickBet(1, 10)} disabled={bet1.isActive}>10</button>
                    <button onClick={() => quickBet(1, 25)} disabled={bet1.isActive}>25</button>
                    <button onClick={() => quickBet(1, 50)} disabled={bet1.isActive}>50</button>
                    <button onClick={() => quickBet(1, 100)} disabled={bet1.isActive}>100</button>
                  </div>
                </div>

                <button 
                  className={`bet-btn ${button1Config.class}`}
                  onClick={button1Config.onClick}
                  disabled={button1Config.disabled}
                >
                  {button1Config.text}
                </button>

                <div className="control-group">
                  <label>Auto Cash</label>
                  <div className="auto-cashout-control">
                    <div className="auto-cashout-toggle">
                      <button 
                        className={`toggle-btn ${bet1.autoCashOutEnabled ? 'active' : ''}`}
                        onClick={() => toggleAutoCashOut(1)}
                        disabled={bet1.isActive}
                      >
                        {bet1.autoCashOutEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {bet1.autoCashOutEnabled && (
                      <div className="auto-cashout-input">
                        <input 
                          type="number" 
                          value={bet1.autoCashOut}
                          onChange={(e) => setBet1(prev => ({ ...prev, autoCashOut: parseFloat(e.target.value) || 1.01 }))}
                          min="1.01"
                          step="0.1"
                          disabled={bet1.isActive}
                        />
                        <span>x</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== BET 2 ===== */}
            <div className="bet-section">
              <div className="bet-section-header">
                <span className="bet-number">🎯 Bet 2</span>
                {bet2.isActive && gameState.status === 'active' && (
                  <span className="bet-active">🟢 Active</span>
                )}
                {bet2.isActive && gameState.status !== 'active' && (
                  <span className="bet-waiting">⏳ Waiting</span>
                )}
              </div>
              
              <div className="bet-controls">
                <div className="control-group">
                  <label>Amount</label>
                  <div className="bet-input-group">
                    <button onClick={() => setBet2(prev => ({ ...prev, amount: Math.max(1, prev.amount - 5) }))} disabled={bet2.isActive}>−</button>
                    <input 
                      type="number" 
                      value={bet2.amount}
                      onChange={(e) => setBet2(prev => ({ ...prev, amount: Math.max(1, parseFloat(e.target.value) || 1) }))}
                      min="1"
                      step="1"
                      disabled={bet2.isActive}
                    />
                    <button onClick={() => setBet2(prev => ({ ...prev, amount: prev.amount + 5 }))} disabled={bet2.isActive}>+</button>
                  </div>
                  <div className="quick-bets">
                    <button onClick={() => quickBet(2, 10)} disabled={bet2.isActive}>10</button>
                    <button onClick={() => quickBet(2, 25)} disabled={bet2.isActive}>25</button>
                    <button onClick={() => quickBet(2, 50)} disabled={bet2.isActive}>50</button>
                    <button onClick={() => quickBet(2, 100)} disabled={bet2.isActive}>100</button>
                  </div>
                </div>

                <button 
                  className={`bet-btn ${button2Config.class}`}
                  onClick={button2Config.onClick}
                  disabled={button2Config.disabled}
                >
                  {button2Config.text}
                </button>

                <div className="control-group">
                  <label>Auto Cash</label>
                  <div className="auto-cashout-control">
                    <div className="auto-cashout-toggle">
                      <button 
                        className={`toggle-btn ${bet2.autoCashOutEnabled ? 'active' : ''}`}
                        onClick={() => toggleAutoCashOut(2)}
                        disabled={bet2.isActive}
                      >
                        {bet2.autoCashOutEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {bet2.autoCashOutEnabled && (
                      <div className="auto-cashout-input">
                        <input 
                          type="number" 
                          value={bet2.autoCashOut}
                          onChange={(e) => setBet2(prev => ({ ...prev, autoCashOut: parseFloat(e.target.value) || 1.01 }))}
                          min="1.01"
                          step="0.1"
                          disabled={bet2.isActive}
                        />
                        <span>x</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== RIGHT SIDE - History Sidebar ===== */}
        <div className="history-sidebar">
          <div className="history-title">📊 Game History</div>
          <div className="history-list-vertical">
            {history.length === 0 ? (
              <span className="no-history-vertical">⏳ No history yet</span>
            ) : (
              history.slice(0, 10).map((item, index) => (
                <div 
                  key={index} 
                  className={`history-item-vertical ${item.crashed ? 'crashed' : 'cashed'}`}
                >
                  <span className="history-number">#{item.roundNumber || index + 1}</span>
                  <span className="history-multiplier-vertical">
                    {item.crashPoint?.toFixed(2) || 'N/A'}x
                  </span>
                </div>
              ))
            )}
          </div>
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