import React from 'react';
import './Aviator.css';

const RecentRounds = ({ history }) => {
  return (
    <div className="recent-rounds">
      <div className="recent-rounds-scroll">
        {history.length === 0 ? (
          <span className="no-history">No round history available</span>
        ) : (
          history.slice(0, 15).map((round, index) => (
            <div 
              key={index} 
              className={`round-result ${round.crashMultiplier > 5 ? 'high' : round.crashMultiplier > 2 ? 'medium' : 'low'}`}
              title={`Round ${round.roundId || index + 1}`}
            >
              {round.crashMultiplier ? `${round.crashMultiplier.toFixed(2)}x` : '?'}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentRounds;