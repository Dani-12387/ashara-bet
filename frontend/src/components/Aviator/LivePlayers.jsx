import React from 'react';
import './Aviator.css';

const LivePlayers = ({ players, roundState }) => {
  if (!players || players.length === 0) {
    return (
      <div className="live-players">
        <h4>👥 Live Players</h4>
        <div className="no-players">No players active</div>
      </div>
    );
  }

  return (
    <div className="live-players">
      <h4>👥 Live Players ({players.length})</h4>
      <div className="players-list">
        <div className="players-header">
          <span>Player</span>
          <span>Bet</span>
          <span>Multiplier</span>
          <span>Status</span>
        </div>
        {players.map((player, index) => (
          <div key={index} className="player-item">
            <span className="player-name">{player.displayName || 'User***'}</span>
            <span className="player-stake">{player.stake?.toFixed(2) || '0'} ETB</span>
            <span className="player-multiplier">
              {player.multiplier?.toFixed(2) || '1.00'}x
            </span>
            <span className={`player-status ${player.status === 'ACTIVE' ? 'active' : 'cashed'}`}>
              {player.status === 'ACTIVE' ? '🟢 ACTIVE' : '✅ CASHED'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LivePlayers;