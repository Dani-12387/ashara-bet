import React from 'react';
import './Aviator.css';

const ConnectionStatus = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return { icon: '🟢', text: 'LIVE', className: 'status-connected' };
      case 'connecting':
        return { icon: '🟡', text: 'CONNECTING...', className: 'status-connecting' };
      case 'reconnecting':
        return { icon: '🟡', text: 'RECONNECTING...', className: 'status-reconnecting' };
      default:
        return { icon: '🔴', text: 'CONNECTION LOST', className: 'status-disconnected' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`connection-status ${config.className}`}>
      <span className="status-icon">{config.icon}</span>
      <span className="status-text">{config.text}</span>
    </div>
  );
};

export default ConnectionStatus;