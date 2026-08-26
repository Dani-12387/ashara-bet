import React, { useState, useEffect } from 'react';
import './Aviator.css';

const Countdown = ({ seconds, onComplete }) => {
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    setCount(seconds);
  }, [seconds]);

  useEffect(() => {
    if (count <= 0) {
      if (onComplete) onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount(count - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  if (count <= 0) return null;

  return (
    <div className="countdown-overlay">
      <div className="countdown-number">{count}</div>
      <div className="countdown-label">Next round in</div>
    </div>
  );
};

export default Countdown;