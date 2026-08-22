import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Aviator.css';

const Aviator = () => {
  const [gameState, setGameState] = useState({
    status: 'idle', // idle, waiting, flying, crashed
    multiplier: 1.00,
    crashPoint: 0,
    history: [],
    balance: 0,
    betAmount: 10,
    cashOutMultiplier: 1.50,
    profit: 0,
    isAutoBet: false,
    autoCashOut: 0,
    isAnimating: false
  });

  const [bets, setBets] = useState([]);
  const [userBet, setUserBet] = useState({
    amount: 10,
    autoCashOut: 1.50,
    isActive: false
  });

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const multiplierRef = useRef(1.00);
  const isRunningRef = useRef(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth || 800;
    canvas.height = 400;

    // Draw the graph
    const drawGraph = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0a0e27');
      gradient.addColorStop(1, '#1a1a3e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
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

      // Multiplier labels
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      for (let i = 1; i <= 10; i++) {
        const y = canvas.height - (i / 10) * canvas.height;
        ctx.fillText(i + 'x', 35, y + 4);
      }

      // Draw history
      const history = gameState.history.slice(-20);
      if (history.length > 0) {
        const maxMultiplier = Math.max(...history.map(h => h.multiplier), 1);
        const scaleX = canvas.width / 20;
        const scaleY = canvas.height / Math.max(maxMultiplier, 1);

        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        history.forEach((point, index) => {
          const x = index * scaleX;
          const y = canvas.height - (point.multiplier * scaleY);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Points
        history.forEach((point, index) => {
          const x = index * scaleX;
          const y = canvas.height - (point.multiplier * scaleY);
          ctx.fillStyle = point.crashed ? '#ff4444' : '#00ff88';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Current multiplier curve
      if (gameState.status === 'flying' || gameState.status === 'crashed') {
        const points = 100;
        const maxX = canvas.width;
        const maxY = canvas.height;
        
        ctx.strokeStyle = gameState.status === 'crashed' ? '#ff4444' : '#00ff88';
        ctx.lineWidth = 3;
        ctx.shadowColor = gameState.status === 'crashed' ? '#ff4444' : '#00ff88';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        
        for (let i = 0; i <= points; i++) {
          const t = i / points;
          const x = t * maxX;
          const multiplier = gameState.multiplier * Math.pow(t, 1.5);
          const y = maxY - (multiplier / 10) * maxY;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Current multiplier display
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
          ctx.fillText('CRASHED!', displayX, displayY + 60);
        }
      }

      // Idle state
      if (gameState.status === 'idle' || gameState.status === 'waiting') {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gameState.status === 'waiting' ? 'Next round starting...' : 'Place your bet to start!', canvas.width / 2, canvas.height / 2);
      }
    };

    drawGraph();

    // Resize handler
    const handleResize = () => {
      canvas.width = canvas.offsetWidth || 800;
      canvas.height = 400;
      drawGraph();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameState]);

  // Game loop
  useEffect(() => {
    if (gameState.status === 'flying') {
      const startTime = Date.now();
      let lastMultiplier = 1.00;
      
      const gameLoop = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        // Exponential growth with random variation
        const baseMultiplier = 1 + Math.pow(elapsed, 1.5) * 0.15;
        const randomFactor = 1 + Math.sin(elapsed * 2.3) * 0.02;
        const currentMultiplier = baseMultiplier * randomFactor;
        
        // Check if it crashes
        const crashPoint = gameState.crashPoint || (2 + Math.random() * 8);
        if (currentMultiplier >= crashPoint) {
          // CRASH!
          setGameState(prev => ({
            ...prev,
            status: 'crashed',
            multiplier: crashPoint,
            crashPoint: crashPoint
          }));
          handleCrash(crashPoint);
          return;
        }

        // Check auto cash out
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
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [gameState.status, gameState.crashPoint, userBet.autoCashOut]);

  // Handle crash
  const handleCrash = (crashPoint) => {
    // Add to history
    setGameState(prev => ({
      ...prev,
      history: [
        { multiplier: crashPoint, crashed: true, timestamp: Date.now() },
        ...prev.history.slice(0, 49)
      ]
    }));

    // Check if user had a bet
    if (userBet.isActive) {
      // User lost their bet
      setUserBet(prev => ({ ...prev, isActive: false }));
      // Update balance
      setGameState(prev => ({
        ...prev,
        balance: prev.balance - prev.betAmount
      }));
    }

    // Reset after 3 seconds
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        status: 'idle',
        multiplier: 1.00,
        crashPoint: 0
      }));
    }, 3000);
  };

  // Handle cash out
  const handleCashOut = (multiplier) => {
    if (!userBet.isActive) return;
    
    const profit = gameState.betAmount * multiplier - gameState.betAmount;
    setGameState(prev => ({
      ...prev,
      balance: prev.balance + profit,
      profit: profit,
      status: 'idle'
    }));
    
    setUserBet(prev => ({ ...prev, isActive: false }));
    
    // Add to history
    setGameState(prev => ({
      ...prev,
      history: [
        { multiplier: multiplier, crashed: false, profit: profit, timestamp: Date.now() },
        ...prev.history.slice(0, 49)
      ]
    }));

    alert(`🎉 Cashed out at ${multiplier.toFixed(2)}x! Profit: $${profit.toFixed(2)}`);
  };

  // Place bet
  const placeBet = () => {
    if (gameState.status !== 'idle') {
      alert('Wait for the next round!');
      return;
    }

    if (gameState.balance < gameState.betAmount) {
      alert('Insufficient balance!');
      return;
    }

    // Generate random crash point (2x - 100x)
    const crashPoint = 2 + Math.random() * 98;
    
    setGameState(prev => ({
      ...prev,
      status: 'flying',
      crashPoint: crashPoint,
      multiplier: 1.00,
      betAmount: prev.betAmount
    }));

    setUserBet(prev => ({
      ...prev,
      isActive: true,
      amount: gameState.betAmount,
      autoCashOut: gameState.autoCashOut || 0
    }));
  };

  // Get user balance
  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/api/user/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGameState(prev => ({ ...prev, balance: response.data.balance || 1000 }));
    } catch (error) {
      console.error('Error fetching balance:', error);
      setGameState(prev => ({ ...prev, balance: 1000 }));
    }
  };

  return (
    <div className="aviator-container">
      <div className="aviator-header">
        <h1>✈️ Aviator</h1>
        <div className="aviator-balance">
          <span>Balance: </span>
          <span className="balance-amount">${gameState.balance.toFixed(2)}</span>
        </div>
      </div>

      <div className="aviator-game-area">
        <canvas 
          ref={canvasRef} 
          className="aviator-canvas"
          width="800"
          height="400"
        ></canvas>
        
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
              ${gameState.profit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="aviator-controls">
        <div className="control-group">
          <label>Bet Amount</label>
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
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: 5 }))}>$5</button>
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: 10 }))}>$10</button>
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: 25 }))}>$25</button>
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: 50 }))}>$50</button>
            <button onClick={() => setGameState(prev => ({ ...prev, betAmount: 100 }))}>$100</button>
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
            disabled={gameState.status === 'waiting' || gameState.status === 'crashed'}
          >
            {gameState.status === 'flying' && userBet.isActive ? '💰 Cash Out' : '📈 Place Bet'}
          </button>
        </div>
      </div>

      <div className="aviator-history">
        <h3>📊 History</h3>
        <div className="history-list">
          {gameState.history.slice(0, 20).map((item, index) => (
            <div key={index} className={`history-item ${item.crashed ? 'crashed' : 'cashed-out'}`}>
              <span className="history-multiplier">{item.multiplier.toFixed(2)}x</span>
              {item.profit && <span className="history-profit">+${item.profit.toFixed(2)}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Aviator;