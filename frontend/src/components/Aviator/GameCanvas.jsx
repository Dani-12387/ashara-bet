import React, { useEffect, useRef, useState } from 'react';
import './Aviator.css';

const GameCanvas = ({ multiplier, status, crashMultiplier, roundId }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [trajectoryPoints, setTrajectoryPoints] = useState([]);

  // Normalise status to check conditions
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

      // Multiplier labels
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      for (let i = 1; i <= 10; i++) {
        const y = height - (i / 10) * height * 0.85 - 20;
        ctx.fillText(i + 'x', 40, y + 4);
      }

      // Draw trajectory
      const maxMultiplier = Math.max(multiplier, 1.5);
      const points = trajectoryPoints;
      
      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(60, height - 20);
        
        for (let i = 0; i < points.length; i++) {
          const x = 60 + (i / (points.length - 1)) * (width - 80);
          const y = height - 20 - (points[i] / maxMultiplier) * (height * 0.85 - 30);
          ctx.lineTo(x, y);
        }
        
        const isCrashedNow = isCrashed;
        const gradientLine = ctx.createLinearGradient(0, 0, width, 0);
        if (isCrashedNow) {
          gradientLine.addColorStop(0, '#ff6b6b');
          gradientLine.addColorStop(1, '#dc3545');
        } else {
          gradientLine.addColorStop(0, '#4ecdc4');
          gradientLine.addColorStop(1, '#44bd9e');
        }
        ctx.strokeStyle = gradientLine;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.shadowColor = isCrashedNow ? 'rgba(220,53,69,0.3)' : 'rgba(78,205,196,0.3)';
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Aircraft
      const currentMultiplier = multiplier || 1;
      const xPos = 60 + ((currentMultiplier - 1) / (Math.max(multiplier, crashMultiplier || 2) || 2)) * (width - 80);
      const yPos = height - 20 - (currentMultiplier / Math.max(multiplier, crashMultiplier || 2)) * (height * 0.85 - 30);
      
      const clampedX = Math.min(Math.max(xPos, 60), width - 30);
      const clampedY = Math.min(Math.max(yPos, 30), height - 20);

      // Draw aircraft
      if (!isCrashed) {
        ctx.save();
        ctx.translate(clampedX, clampedY);
        ctx.rotate(-Math.PI / 6);
        
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffed4a';
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
        
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.moveTo(-18, -3);
        ctx.lineTo(-25, -6);
        ctx.lineTo(-25, 6);
        ctx.lineTo(-18, 3);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#4ecdc4';
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

  // Update trajectory points
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
        <span className="multiplier-display">
          {isRunning ? `${(multiplier || 1).toFixed(2)}x` : ''}
          {isCrashed ? `${(crashMultiplier || multiplier || 1).toFixed(2)}x` : ''}
          {isWaiting ? '1.00x' : ''}
        </span>
        <span className="round-status">
          {isRunning && '🟢 LIVE'}
          {isCrashed && '💥 CRASHED'}
          {isWaiting && '⏸️ WAITING'}
        </span>
      </div>
    </div>
  );
};

export default GameCanvas;