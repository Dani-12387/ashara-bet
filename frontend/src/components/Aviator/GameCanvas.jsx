import React, { useEffect, useRef, useState } from 'react';
import './Aviator.css';

const GameCanvas = ({ multiplier, status, crashMultiplier, roundId }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [trajectoryPoints, setTrajectoryPoints] = useState([]);

  const isRunning = status === 'RUNNING' || status === 'active';
  const isCrashed = status === 'CRASHED' || status === 'crashed';
  const isWaiting = status === 'WAITING' || status === 'idle' || status === 'BETTING_OPEN';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth || 800;
    const height = canvas.parentElement.clientHeight || 450;
    
    canvas.width = width;
    canvas.height = height;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#0a0e27');
      gradient.addColorStop(0.5, '#1a1a3e');
      gradient.addColorStop(1, '#0a0e27');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 60) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 60) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Multiplier labels on the Y-axis
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      for (let i = 1; i <= 10; i++) {
        const y = height - (i / 10) * height * 0.85 - 20;
        ctx.fillText(i + 'x', 40, y + 4);
      }

      // Aircraft position
      const currentMultiplier = multiplier || 1;
      const maxMult = Math.max(multiplier, crashMultiplier || 2) || 2;
      const xPos = 60 + ((currentMultiplier - 1) / maxMult) * (width - 80);
      const yPos = height - 20 - (currentMultiplier / maxMult) * (height * 0.85 - 30);
      
      const clampedX = Math.min(Math.max(xPos, 60), width - 30);
      const clampedY = Math.min(Math.max(yPos, 30), height - 20);

      // Draw aircraft – RED
      if (!isCrashed) {
        ctx.save();
        ctx.translate(clampedX, clampedY);
        ctx.rotate(-Math.PI / 6);
        
        ctx.fillStyle = '#e74c3c';
        ctx.shadowColor = 'rgba(231, 76, 60, 0.5)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff6b6b';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(-5, -12);
        ctx.lineTo(5, -12);
        ctx.lineTo(0, -20);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-5, 12);
        ctx.lineTo(5, 12);
        ctx.lineTo(0, 20);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(-18, -3);
        ctx.lineTo(-25, -6);
        ctx.lineTo(-25, 6);
        ctx.lineTo(-18, 3);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#3498db';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(8, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      } else {
        // Crash explosion
        ctx.save();
        ctx.translate(clampedX, clampedY);
        
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 10 + Math.random() * 30;
          const size = 3 + Math.random() * 6;
          ctx.fillStyle = `rgba(255, ${Math.floor(Math.random() * 100)}, 0, ${0.3 + Math.random() * 0.5})`;
          ctx.beginPath();
          ctx.arc(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            size,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        
        ctx.restore();
      }
    };

    draw();

    const handleResize = () => {
      draw();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [multiplier, status, crashMultiplier, isCrashed]);

  // Store trajectory points (kept for possible future use)
  useEffect(() => {
    if (isRunning) {
      setTrajectoryPoints(prev => {
        const newPoints = [...prev, multiplier];
        if (newPoints.length > 100) {
          return newPoints.slice(-100);
        }
        return newPoints;
      });
    } else if (isCrashed) {
      setTrajectoryPoints(prev => {
        if (prev.length > 0 && prev[prev.length - 1] !== crashMultiplier) {
          return [...prev, crashMultiplier || multiplier];
        }
        return prev;
      });
    } else if (isWaiting) {
      setTrajectoryPoints([1.00]);
    }
  }, [multiplier, isRunning, isCrashed, isWaiting, crashMultiplier]);

  return (
    <div className="game-canvas-container">
      <canvas ref={canvasRef} className="game-canvas" />
      <div className="multiplier-overlay">
        {/* ⬇️ BIG MULTIPLIER TEXT – inline styles for size */}
        <span 
          className="multiplier-display"
          style={{
            fontSize: '60px',
            fontWeight: 'bold',
            color: isCrashed ? '#ff4444' : '#ffffff',
            textShadow: '0 0 30px rgba(255,255,255,0.3), 0 0 60px rgba(78,205,196,0.2)',
            letterSpacing: '2px'
          }}
        >
          {isRunning ? `${(multiplier || 1).toFixed(2)}x` : ''}
          {isCrashed ? `${(crashMultiplier || multiplier || 1).toFixed(2)}x` : ''}
          {isWaiting ? '1.00x' : ''}
        </span>
        <span 
          className="round-status"
          style={{
            fontSize: '16px',
            fontWeight: '600',
            color: isRunning ? '#4ecdc4' : isCrashed ? '#ff4444' : '#888',
            marginTop: '4px'
          }}
        >
          {isRunning && '🟢 LIVE'}
          {isCrashed && '💥 CRASHED'}
          {isWaiting && '⏸️ WAITING'}
        </span>
      </div>
    </div>
  );
};

export default GameCanvas;