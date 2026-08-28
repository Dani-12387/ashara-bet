import React from 'react';
import './Aviator.css';

const RecentRounds = ({ history }) => {
  // Ensure history is an array
  const rounds = Array.isArray(history) ? history : [];

  return (
    <div className="recent-rounds">
      <div className="recent-rounds-scroll">
        {rounds.length === 0 ? (
          <span className="no-history">No round history available</span>
        ) : (
          rounds.slice(0, 15).map((round, index) => {
            // Use crashPoint from API, fallback to crashMultiplier
            const multiplier = round.crashPoint || round.crashMultiplier || 0;
            const value = multiplier > 0 ? multiplier.toFixed(2) : '?';
            let className = 'round-result';
            if (multiplier > 5) className += ' high';
            else if (multiplier > 2) className += ' medium';
            else className += ' low';
            return (
              <div 
                key={round.roundId || round.roundNumber || index} 
                className={className}
                title={`Round ${round.roundNumber || index + 1}`}
              >
                {value}x
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RecentRounds;