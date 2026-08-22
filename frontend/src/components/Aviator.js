import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Aviator.css';

const Aviator = () => {
  const [gameState, setGameState] = useState({
    status: 'idle', // idle, flying, crashed
    multiplier: 1.00,
    crashPoint: 0,
    history: [],
    balance: 0,
    betAmount: 10,
    profit: 0,
    autoCashOut: 0,
    totalBets: 0,
    totalWins: 0
  });

  const [userBet, setUserBet] = useState({
    amount: 10,
    autoCashOut: 1.50,
    isActive: false
  });

  const [user, setUser] = useState(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Get user data
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    fetchBalance();
  }, []);

  // Fetch real balance from backend
  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found');
        return;
      }
      
      const response = await axios.get(`${API_URL}/api/user/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('💰 Balance fetched:', response.data.balance);
      setGameState(prev => ({ 
        ...prev, 
        balance: response.data.balance || 0 
      }));
    } catch (error) {
      console.error('Error fetching balance:', error);
      // Don't set a default balance - show 0 if error
      setGameState(prev => ({ ...prev, balance: 0 }));
    }
  };

  // Update balance after bet
  const updateBalance = async (newBalance) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Update local state
      setGameState(prev => ({ ...prev, balance: newBalance }));
      
      // Also update the user object in localStorage
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          parsedUser.balance = newBalance;
          localStorage.setItem('user', JSON.stringify(parsedUser));
        } catch (e) {}
      }
    } catch (error) {
      console.error('Error updating balance:', error);
    }
  };

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    canvas.width = canvas.offsetWidth || 800;
    canvas.height = 400;

    const drawGraph = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0a0e27');
      gradient.addColorStop(1, '#1a1a3e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      for (let i = 1; i <= 10; i++) {
        const y = canvas.height - (i / 10) * canvas.height;
        ctx.fillText(i + 'x', 35, y + 4);
      }

      if (gameState.status === 'flying' || gameState.status === 'crashed') {
        ctx.fillStyle = gameState.status === 'crashed' ? '#ff4444' : '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayX = canvas.width / 2;
        const displayY = canvas.height / 2 - 40;
        ctx.fillText(gameState.multiplier.toFixed(2) + 'x', displayX, displayY);

        if (gameState.status === 'crashed') {
          ctx.fillStyle = '#ff4444';
          ctx.font = 'bold 24px Arial';
          ctx.fillText('💥 CRASHED!', displayX, displayY + 60);
        }
      }

      if (gameState.status === 'idle') {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✈️ Place your bet to start!', canvas.width / 2, canvas.height / 2);
      }
    };

    drawGraph();

    const handleResize = () => {
      canvas.width = canvas.offsetWidth || 800;
      canvas.height = 400;
      drawGraph();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gameState]);

  // Game loop
  useEffect(() => {
    if (gameState.status === 'flying') {
      const startTime = Date.now();
      
      const gameLoop = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentMultiplier = 1 + Math.pow(elapsed, 1.5) * 0.15;
        
        const crashPoint = gameState.crashPoint || (2 + Math.random() * 8);
        if (currentMultiplier >= crashPoint) {
          setGameState(prev => ({
            ...prev,
            status: 'crashed',
            multiplier: crashPoint
          }));
          handleCrash(crashPoint);
          return;
        }

        if (userBet.autoCashOut > 0 && currentMultiplier >= userBet.autoCashOut) {
          handleCashOut(currentMultiplier);
          return;
        }

        setGameState(prev => ({
          ...prev,
          multiplier: currentMultiplier
        }));

        animationRef.current = requestAnimationFrame(gameLoop);
      };

      animationRef.current = requestAnimationFrame(gameLoop);
      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    }
  }, [gameState.status]);

  const handleCrash = (crashPoint) => {
    setGameState(prev => ({
      ...prev,
      history: [
        { multiplier: crashPoint, crashed: true, timestamp: Date.now() },
        ...prev.history.slice(0, 49)
      ],
      totalBets: prev.totalBets + 1
    }));

    if (userBet.isActive) {
      // User lost their bet - deduct from balance (already deducted when placing bet)
      setUserBet(prev => ({ ...prev, isActive: false }));
      // Refresh balance to ensure it's correct
      fetchBalance();
    }

    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        status: 'idle',
        multiplier: 1.00,
        crashPoint: 0
      }));
    }, 3000);
  };

  const handleCashOut = (multiplier) => {
    if (!userBet.isActive) return;
    
    const winAmount = gameState.betAmount * multiplier;
    const profit = winAmount - gameState.betAmount;
    
    // Update balance
    const newBalance = gameState.balance + profit;
    
    setGameState(prev => ({
      ...prev,
      balance: newBalance,
      profit: profit,
      status: 'idle',
      totalWins: prev.totalWins + 1,
      history: [
        { multiplier: multiplier, crashed: false, profit: profit, timestamp: Date.now() },
        ...prev.history.slice(0, 49)
      ]
    }));
    
    setUserBet(prev => ({ ...prev, isActive: false }));
    
    // Update balance in backend
    updateBalance(newBalance);
    
    alert(`🎉 Cashed out at ${multiplier.toFixed(2)}x! Profit: ETB ${profit.toFixed(2)}`);
  };

  const placeBet = () => {
    if (gameState.status !== 'idle') {
      alert('⏳ Wait for the next round!');
      return;
    }

    const betAmount = parseFloat(gameState.betAmount);
    if (isNaN(betAmount) || betAmount <= 0) {
      alert('Please enter a valid bet amount');
      return;
    }

    if (betAmount > gameState.balance) {
      alert(`❌ Insufficient balance! Your balance is ETB ${gameState.balance.toFixed(2)}`);
      return;
    }

    // Deduct bet amount from balance
    const newBalance = gameState.balance - betAmount;
    updateBalance(newBalance);

    // Generate random crash point (2x - 100x)
    const crashPoint = 2 + Math.random() * 98;
    
    setGameState(prev => ({
      ...prev,
      status: 'flying',
      crashPoint: crashPoint,
      multiplier: 1.00,
      betAmount: betAmount,
      balance: newBalance
    }));

    setUserBet(prev => ({
      ...prev,
      isActive: true,
      amount: betAmount,
      autoCashOut: gameState.autoCashOut || 0
    }));

    // Set a timeout to auto-cash out if user doesn't manually cash out
    // The game loop handles auto cash out via the userBet.autoCashOut value
  };

  const formatCurrency = (amount) => {
    return `ETB ${amount.toFixed(2)}`;
  };

  return (
    <div className="aviator-container">
      <div className="aviator-header">
        <h1>✈️ Aviator</h1>
        <div className="aviator-balance">
          <span>Balance: </span>
          <span className="balance-amount">{formatCurrency(gameState.balance)}</span>
        </div>
      </div>

      <div className="aviator-game-area">
        <canvas ref={canvasRef} className="aviator-canvas" width="800" height="400"></canvas>
        
        <div className="aviator-stats">
          <div className="stat">
            <span>Multiplier</span>
            <span className="stat-value">{gameState.multiplier.toFixed(2)}x</span>
          </div>
          <div className="stat">
            <span>Crash Point</span>
            <span className="stat-value">{gameState.crashPoint ? gameState.crashPoint.toFixed(2) + 'x' : '??'}</span>
          </div>
          <div className="stat">
            <span>Profit</span>
            <span className={`stat-value ${gameState.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
              {formatCurrency(gameState.profit)}
            </span>
          </div>
        </div>
      </div>

      <div className="aviator-controls">
        <div className="control-group">
          <label>Bet Amount (ETB)</label>
          <div className="bet-input-group">
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: Math.max(1, prev.betAmount - 5) }))}>-</button>
            <input 
              type="number" 
              value={gameState.betAmount}
              onChange={(e) => setGameState(prev => ({ ...prev, betAmount: Math.max(1, parseFloat(e.target.value) || 1) }))}
              min="1"
              step="1"
            />
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: prev.betAmount + 5 }))}>+</button>
          </div>
          <div className="quick-bets">
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: 10 }))}>10</button>
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: 25 }))}>25</button>
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: 50 }))}>50</button>
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: 100 }))}>100</button>
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: 500 }))}>500</button>
          </div>
        </div>

        <div className="control-group">
          <label>Auto Cash Out</label>
          <div className="auto-cashout-input">
            <input 
              type="number" 
              value={gameState.autoCashOut}
              onChange={(e) => setGameState(prev => ({ ...prev, autoCashOut: parseFloat(e.target.value) || 0 }))}
              min="1.01"
              step="0.1"
              placeholder="1.5x"
            />
            <span>x</span>
          </div>
        </div>

        <div className="control-group">
          <button 
            className={`bet-btn ${gameState.status === 'flying' ? 'cashout-btn' : 'place-btn'}`}
            onClick={gameState.status === 'flying' && userBet.isActive ? () => handleCashOut(gameState.multiplier) : placeBet}
            disabled={gameState.status === 'crashed' || gameState.balance <= 0}
          >
            {gameState.status === 'flying' && userBet.isActive ? '💰 Cash Out' : '📈 Place Bet'}
          </button>
          {gameState.balance <= 0 && gameState.status === 'idle' && (
            <p style={{ color: '#ff4444', fontSize: '12px', marginTop: '5px' }}>
              ⚠️ Insufficient balance. Please deposit.
            </p>
          )}
        </div>
      </div>

      <div className="aviator-history">
        <h3>📊 History</h3>
        <div className="history-list">
          {gameState.history.slice(0, 20).map((item, index) => (
            <div key={index} className={`history-item ${item.crashed ? 'crashed' : 'cashed-out'}`}>
              <span className="history-multiplier">{item.multiplier.toFixed(2)}x</span>
              {item.profit !== undefined && (
                <span className="history-profit">
                  {item.profit >= 0 ? '+' : ''}{formatCurrency(item.profit)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="aviator-stats-bottom">
        <div className="stat-small">
          <span>Total Bets</span>
          <strong>{gameState.totalBets}</strong>
        </div>
        <div className="stat-small">
          <span>Total Wins</span>
          <strong>{gameState.totalWins}</strong>
        </div>
        <div className="stat-small">
          <span>Win Rate</span>
          <strong>
            {gameState.totalBets > 0 
              ? ((gameState.totalWins / gameState.totalBets) * 100).toFixed(1) + '%'
              : '0%'}
          </strong>
        </div>
      </div>
    </div>
  );
};

export default Aviator;