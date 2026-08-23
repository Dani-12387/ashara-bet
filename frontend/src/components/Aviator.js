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

  const [bet1, setBet1] = useState({
    amount: 10,
    autoCashOut: 1.50,
    autoCashOutEnabled: false,
    isActive: false,
    isPending: false,
    placedAt: 0
  });

  const [bet2, setBet2] = useState({
    amount: 10,
    autoCashOut: 1.50,
    autoCashOutEnabled: false,
    isActive: false,
    isPending: false,
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

  const API_URL = process.env.REACT_APP_API_URL || 'https://ashara-bet.onrender.com';

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
        
        // ✅ Check if game just started - activate pending bets
        if (gameState.status === 'idle' && newState.status === 'active') {
          if (bet1.isPending) {
            setBet1(prev => ({ ...prev, isPending: false, isActive: true }));
            setMessage('✅ Bet 1 is now active!');
          }
          if (bet2.isPending) {
            setBet2(prev => ({ ...prev, isPending: false, isActive: true }));
            setMessage('✅ Bet 2 is now active!');
          }
          setTimeout(() => setMessage(''), 2000);
        }
        
        // ✅ Check if game crashed
        if (gameState.status === 'active' && newState.status === 'crashed') {
          const crashData = {
            roundNumber: newState.roundNumber || 0,
            crashPoint: newState.multiplier || 0,
            crashed: true,
            timestamp: new Date().toISOString()
          };
          
          setHistory(prev => {
            const newHistory = [crashData, ...prev];
            return newHistory.slice(0, 7);
          });
          
          if (bet1.isActive) {
            setBet1(prev => ({ ...prev, isActive: false, isPending: false }));
            setTotalBets(prev => prev + 1);
          }
          if (bet2.isActive) {
            setBet2(prev => ({ ...prev, isActive: false, isPending: false }));
            setTotalBets(prev => prev + 1);
          }
          
          fetchBalance();
          setError(`💥 Game crashed at ${newState.multiplier.toFixed(2)}x!`);
          setTimeout(() => setError(''), 3000);
        }
        
        // ✅ Auto Cash Out - Bet 1
        if (newState.status === 'active' && bet1.isActive && bet1.autoCashOutEnabled) {
          if (newState.multiplier >= bet1.autoCashOut) {
            handleAutoCashOut(1, newState.multiplier);
          }
        }
        
        // ✅ Auto Cash Out - Bet 2
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

  // ========== FETCH HISTORY ==========
  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.length > 0) {
        setHistory(response.data.slice(0, 7));
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      setHistory([]);
    }
  };

  // ========== POLLING ==========
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
        setBet(prev => ({ ...prev, isActive: false, isPending: false }));
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

  // ========== CANCEL PENDING BET ==========
  const cancelPendingBet = async (betNumber) => {
    const setBet = betNumber === 1 ? setBet1 : setBet2;
    const bet = betNumber === 1 ? bet1 : bet2;
    
    if (!bet.isPending) {
      setError('No pending bet to cancel!');
      setTimeout(() => setError(''), 2000);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/aviator/cancel-pending`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        // ✅ Refund balance
        const refundAmount = bet.amount;
        setBet(prev => ({ ...prev, isPending: false, isActive: false }));
        setBalance(prev => prev + refundAmount);
        setMessage(`✅ Bet ${betNumber} cancelled! Refunded ETB ${refundAmount.toFixed(2)}`);
        setTimeout(() => setMessage(''), 3000);
        fetchBalance();
      } else {
        setError('❌ ' + response.data.message);
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      console.error('Error cancelling bet:', error);
      setError('❌ Error cancelling bet');
      setTimeout(() => setError(''), 3000);
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
    
    if (gameState.status === 'crashed' || gameState.status === 'closed') {
      setError('⏳ Game is not available!');
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
      
      const requestData = {
        amount: betAmount,
        autoCashOut: bet.autoCashOutEnabled ? bet.autoCashOut : 0
      };
      
      console.log('📤 Sending bet request:', requestData);
      
      const response = await axios.post(`${API_URL}/api/aviator/bet`, 
        requestData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      console.log('📥 Bet response:', response.data);
      
      if (response.data.success) {
        // ✅ Safe balance update - use 0 if null
        const newBalance = response.data.newBalance !== null && response.data.newBalance !== undefined 
          ? response.data.newBalance 
          : balance - betAmount;
        
        setBalance(newBalance);
        
        if (response.data.status === 'active') {
          setBet(prev => ({ ...prev, isActive: true, isPending: false }));
          setMessage(`✅ Bet ${betNumber} placed! Active now!`);
        } else {
          setBet(prev => ({ ...prev, isActive: false, isPending: true }));
          setMessage(`✅ Bet ${betNumber} placed! Waiting for next round...`);
        }
        
        setTotalBets(prev => prev + 1);
        setTimeout(() => setMessage(''), 3000);
        fetchBalance();
      } else {
        setError('❌ ' + response.data.message);
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      const errorMsg = error.response?.data?.message || 'Error placing bet';
      setError('❌ ' + errorMsg);
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
        setBet(prev => ({ ...prev, isActive: false, isPending: false }));
        
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
    if (!bet.isActive && !bet.isPending) {
      setBet(prev => ({ ...prev, amount: amount }));
    }
  };

  // ========== TOGGLE AUTO CASH OUT ==========
  const toggleAutoCashOut = (betNumber) => {
    const setBet = betNumber === 1 ? setBet1 : setBet2;
    const bet = betNumber === 1 ? bet1 : bet2;
    if (!bet.isActive && !bet.isPending) {
      setBet(prev => ({ 
        ...prev, 
        autoCashOutEnabled: !prev.autoCashOutEnabled 
      }));
    }
  };

  // ========== FORMAT CURRENCY ==========
  const formatCurrency = (amount) => {
    return `ETB ${amount.toFixed(2)}`;
  };

  // ========== GET BUTTON CONFIG ==========
  const getButtonConfig = (betNumber) => {
    const bet = betNumber === 1 ? bet1 : bet2;
    
    // ✅ Show Cancel button for pending bets
    if (bet.isPending) {
      return {
        text: `🔴 Cancel`,
        class: 'cancel-btn',
        disabled: false,
        onClick: () => cancelPendingBet(betNumber)
      };
    }
    
    const isDisabled = loading || gameState.status === 'crashed' || balance <= 0;
    const isCashoutDisabled = loading || !bet.isActive || gameState.status !== 'active';
    
    if (bet.isActive && gameState.status === 'active') {
      const estimatedWin = (bet.amount * gameState.multiplier).toFixed(2);
      return {
        text: `💰 ${gameState.multiplier.toFixed(2)}x (${estimatedWin})`,
        class: 'cashout-btn',
        disabled: isCashoutDisabled,
        onClick: () => handleCashOut(betNumber)
      };
    } else {
      const canPlaceBet = gameState.status === 'idle' || gameState.status === 'waiting' || gameState.status === 'active';
      return {
        text: `📈 Bet ${betNumber}`,
        class: 'place-btn',
        disabled: isDisabled || bet.isActive || bet.isPending || !canPlaceBet,
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

      {/* ===== HISTORY - Horizontal (7 ROWS) ===== */}
      <div className="aviator-history-horizontal">
        <div className="history-list-horizontal">
          {history.length === 0 ? (
            <span className="no-history">⏳ No game history yet</span>
          ) : (
            history.slice(0, 7).map((item, index) => (
              <div 
                key={index} 
                className={`history-item-horizontal ${item.crashed ? 'crashed' : 'cashed'}`}
                title={`Round #${item.roundNumber || index + 1}`}
              >
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
      {message && <div className="bet-success">{message}</div>}
      {error && <div className="bet-error">{error}</div>}

      {/* ===== TWO BETS - SIDE BY SIDE ===== */}
      <div className="bets-horizontal">
        {/* ===== BET 1 ===== */}
        <div className="bet-section">
          <div className="bet-section-header">
            <span className="bet-number">🎯 Bet 1</span>
            {bet1.isActive && gameState.status === 'active' && (
              <span className="bet-active">🟢 Active</span>
            )}
            {bet1.isPending && (
              <span className="bet-pending">⏳ Pending</span>
            )}
          </div>
          
          <div className="bet-controls">
            <div className="control-group">
              <label>Amount</label>
              <div className="bet-input-group">
                <button onClick={() => setBet1(prev => ({ ...prev, amount: Math.max(1, prev.amount - 5) }))} disabled={bet1.isActive || bet1.isPending}>−</button>
                <input 
                  type="number" 
                  value={bet1.amount}
                  onChange={(e) => setBet1(prev => ({ ...prev, amount: Math.max(1, parseFloat(e.target.value) || 1) }))}
                  min="1"
                  step="1"
                  disabled={bet1.isActive || bet1.isPending}
                />
                <button onClick={() => setBet1(prev => ({ ...prev, amount: prev.amount + 5 }))} disabled={bet1.isActive || bet1.isPending}>+</button>
              </div>
              <div className="quick-bets">
                <button onClick={() => quickBet(1, 10)} disabled={bet1.isActive || bet1.isPending}>10</button>
                <button onClick={() => quickBet(1, 25)} disabled={bet1.isActive || bet1.isPending}>25</button>
                <button onClick={() => quickBet(1, 50)} disabled={bet1.isActive || bet1.isPending}>50</button>
                <button onClick={() => quickBet(1, 100)} disabled={bet1.isActive || bet1.isPending}>100</button>
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
                    disabled={bet1.isActive || bet1.isPending}
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
                      disabled={bet1.isActive || bet1.isPending}
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
            {bet2.isPending && (
              <span className="bet-pending">⏳ Pending</span>
            )}
          </div>
          
          <div className="bet-controls">
            <div className="control-group">
              <label>Amount</label>
              <div className="bet-input-group">
                <button onClick={() => setBet2(prev => ({ ...prev, amount: Math.max(1, prev.amount - 5) }))} disabled={bet2.isActive || bet2.isPending}>−</button>
                <input 
                  type="number" 
                  value={bet2.amount}
                  onChange={(e) => setBet2(prev => ({ ...prev, amount: Math.max(1, parseFloat(e.target.value) || 1) }))}
                  min="1"
                  step="1"
                  disabled={bet2.isActive || bet2.isPending}
                />
                <button onClick={() => setBet2(prev => ({ ...prev, amount: prev.amount + 5 }))} disabled={bet2.isActive || bet2.isPending}>+</button>
              </div>
              <div className="quick-bets">
                <button onClick={() => quickBet(2, 10)} disabled={bet2.isActive || bet2.isPending}>10</button>
                <button onClick={() => quickBet(2, 25)} disabled={bet2.isActive || bet2.isPending}>25</button>
                <button onClick={() => quickBet(2, 50)} disabled={bet2.isActive || bet2.isPending}>50</button>
                <button onClick={() => quickBet(2, 100)} disabled={bet2.isActive || bet2.isPending}>100</button>
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
                    disabled={bet2.isActive || bet2.isPending}
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
                      disabled={bet2.isActive || bet2.isPending}
                    />
                    <span>x</span>
                  </div>
                )}
              </div>
            </div>
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