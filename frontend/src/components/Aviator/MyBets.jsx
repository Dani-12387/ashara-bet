import React, { useState } from 'react';
import './Aviator.css';

const MyBets = ({ bets, onLoadMore }) => {
  const [expanded, setExpanded] = useState(false);
  const displayBets = expanded ? bets : bets.slice(0, 5);

  if (!bets || bets.length === 0) {
    return (
      <div className="my-bets">
        <h4>📊 My Bets</h4>
        <div className="no-bets">You have not placed any bets yet.</div>
      </div>
    );
  }

  return (
    <div className="my-bets">
      <h4>📊 My Bets ({bets.length})</h4>
      <div className="bets-table-wrapper">
        <table className="bets-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Stake</th>
              <th>Cashout</th>
              <th>Payout</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {displayBets.map((bet, index) => (
              <tr key={index} className={`bet-row ${bet.result === 'WON' ? 'won' : bet.result === 'LOST' ? 'lost' : ''}`}>
                <td>{bet.roundId || 'N/A'}</td>
                <td>{bet.stake?.toFixed(2) || '0'} ETB</td>
                <td>{bet.cashoutMultiplier ? `${bet.cashoutMultiplier.toFixed(2)}x` : '—'}</td>
                <td>{bet.payout ? `${bet.payout.toFixed(2)} ETB` : '0'}</td>
                <td className={`result-${bet.result?.toLowerCase() || 'pending'}`}>
                  {bet.result === 'WON' ? '✅ WON' : 
                   bet.result === 'LOST' ? '❌ LOST' : '⏳ PENDING'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bets.length > 5 && (
          <button className="load-more-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
    </div>
  );
};

export default MyBets;