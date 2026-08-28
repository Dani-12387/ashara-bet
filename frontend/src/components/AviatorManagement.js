import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getAviatorSocket } from '../services/aviatorSocket';
import './AviatorManagement.css';

const AviatorManagement = () => {
  const [gameState, setGameState] = useState({
    status: 'idle',       // idle, waiting, active, crashed, closed
    multiplier: 1.00,
    crashPoint: 0,
    nextCrashPoint: 0,
    roundNumber: 0,
    totalBets: 0,
    totalAmount: 0,
    playersActive: 0,
    autoStart: false,
    autoStartDelay: 10,
    minBet: 1,
    maxBet: 1000,
    houseEdge: 5
  });

  const [history, setHistory] = useState([]);
  const [activeBets, setActiveBets] = useState([]);
  const [settings, setSettings] = useState({
    autoStart: false,
    autoStartDelay: 10,
    minBet: 1,
    maxBet: 1000,
    houseEdge: 5
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  const API_URL = process.env.REACT_APP_API_URL || 'https://ashara-bet.onrender.com';

  // ===== SOCKET.IO SETUP =====
  useEffect(() => {
    // Initial data fetch
    fetchGameState();
    fetchHistory();
    fetchActiveBets();

    // Connect to Socket.IO for real-time updates
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found – admin socket will not connect');
      return;
    }

    const socket = getAviatorSocket();
    socket.connect(token);

    // Listen to round state changes
    socket.on('round:state', (data) => {
      console.log('📡 Admin: round:state', data);
      setGameState(prev => ({
        ...prev,
        status: data.status || prev.status,
        multiplier: data.multiplier !== undefined ? data.multiplier : prev.multiplier,
        roundNumber: data.roundNumber !== undefined ? data.roundNumber : prev.roundNumber,
        crashPoint: data.crashPoint !== undefined ? data.crashPoint : prev.crashPoint,
        playersActive: data.playersActive !== undefined ? data.playersActive : prev.playersActive,
        totalBets: data.totalBets !== undefined ? data.totalBets : prev.totalBets,
        totalAmount: data.totalAmount !== undefined ? data.totalAmount : prev.totalAmount
      }));

      // ✅ If crash occurs, refresh history, active bets, and game state immediately
      if (data.status === 'CRASHED' || data.status === 'crashed') {
        fetchHistory();
        fetchActiveBets();
        fetchGameState();
      }
    });

    socket.on('round:countdown', (data) => {
      console.log('📡 Admin: round:countdown', data);
      // Optionally display countdown in admin panel
    });

    socket.on('bet:placed', () => {
      fetchActiveBets();
      fetchGameState();
    });

    socket.on('bet:cashed_out', () => {
      fetchActiveBets();
      fetchGameState();
    });

    socket.on('connection:reconnected', () => {
      // Refresh data after reconnection
      fetchGameState();
      fetchHistory();
      fetchActiveBets();
    });

    return () => {
      socket.off('round:state');
      socket.off('round:countdown');
      socket.off('bet:placed');
      socket.off('bet:cashed_out');
      socket.off('connection:reconnected');
      // Do not disconnect the socket globally, as other components may use it.
      // The socket service manages its own lifecycle.
    };
  }, []);

  // ===== API CALLS =====

  const fetchGameState = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/state`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setGameState(prev => ({
          ...prev,
          ...response.data,
          multiplier: response.data.multiplier || 1.00,
          status: response.data.status || 'idle',
        }));
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && Array.isArray(response.data)) {
        setHistory(response.data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchActiveBets = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/active-bets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && Array.isArray(response.data)) {
        setActiveBets(response.data);
      }
    } catch (error) {
      console.error('Error fetching active bets:', error);
    }
  };

  // ===== ADMIN ACTIONS =====

  const startGame = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/aviator/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        showMessage(`✅ Game started! Round ${gameState.roundNumber + 1}`, 'success');
        await fetchGameState();
        await fetchActiveBets();
      } else {
        showMessage('❌ Failed to start game: ' + response.data.message, 'error');
      }
    } catch (error) {
      console.error('Error starting game:', error);
      showMessage('❌ Error starting game: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const stopGame = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/aviator/stop`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        showMessage(`✅ Round ${gameState.roundNumber} stopped at ${gameState.multiplier.toFixed(2)}x!`, 'success');
        await fetchGameState();
        await fetchHistory();
        await fetchActiveBets();
      } else {
        showMessage('❌ Failed to stop game: ' + response.data.message, 'error');
      }
    } catch (error) {
      console.error('Error stopping game:', error);
      showMessage('❌ Error stopping game: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const closeGame = async () => {
    if (!window.confirm('⚠️ Are you sure you want to close the game? All active bets will be cancelled and refunded.')) {
      return;
    }
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/aviator/close`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        showMessage('✅ Game closed successfully! All bets cancelled.', 'success');
        await fetchGameState();
        await fetchHistory();
        await fetchActiveBets();
      } else {
        showMessage('❌ Failed to close game: ' + response.data.message, 'error');
      }
    } catch (error) {
      console.error('Error closing game:', error);
      showMessage('❌ Error closing game: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/aviator/settings`,
        settings,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        showMessage('✅ Settings updated successfully!', 'success');
        setGameState(prev => ({ ...prev, ...settings }));
      } else {
        showMessage('❌ Failed to update settings: ' + response.data.message, 'error');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      showMessage('❌ Error updating settings: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  const setNextCrashPoint = async () => {
    try {
      const crashPoint = parseFloat(document.getElementById('nextCrashPoint')?.value);
      if (!crashPoint || crashPoint < 1.01) {
        showMessage('⚠️ Please enter a valid crash point (minimum 1.01)', 'error');
        return;
      }
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/aviator/set-crash`,
        { crashPoint },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        showMessage(`✅ Next crash point set to ${crashPoint.toFixed(2)}x!`, 'success');
        setGameState(prev => ({ ...prev, nextCrashPoint: crashPoint }));
      } else {
        showMessage('❌ Failed to set crash point: ' + response.data.message, 'error');
      }
    } catch (error) {
      console.error('Error setting crash point:', error);
      showMessage('❌ Error setting crash point: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // ===== UI HELPERS =====

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      idle: { class: 'status-badge idle', text: '⏸️ Idle (Waiting for Admin)' },
      waiting: { class: 'status-badge waiting', text: '⏳ Waiting' },
      active: { class: 'status-badge active', text: '▶️ Active' },
      crashed: { class: 'status-badge crashed', text: '💥 Crashed' },
      closed: { class: 'status-badge closed', text: '🔒 Closed' }
    };
    return statusMap[status] || statusMap.idle;
  };

  const getStatusClass = (status) => {
    return `game-status ${status}`;
  };

  // ===== RENDER =====

  return (
    <div className="aviator-management">
      <h1>✈️ Aviator Management</h1>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      <div className="management-grid">
        {/* ===== GAME CONTROLS ===== */}
        <div className="management-card game-controls">
          <h2>🎮 Game Controls</h2>

          <div className="game-status-display">
            <div className="status-indicator">
              <span>Current Status:</span>
              <span className={getStatusClass(gameState.status)}>
                {getStatusBadge(gameState.status).text}
              </span>
            </div>

            <div className="odd-counter-admin">
              <span className="odd-label">📊 Current Odd</span>
              <span className={`odd-number-admin ${gameState.status === 'active' ? 'pulse-odd' : ''}`}>
                {gameState.multiplier.toFixed(2)}x
              </span>
              {gameState.status === 'active' && (
                <span className="odd-counter-running">⏱️ Live</span>
              )}
              {gameState.status === 'crashed' && (
                <span className="odd-counter-crashed">💥 Crashed!</span>
              )}
            </div>

            <div className="game-stats">
              <div className="stat-item">
                <label>Round</label>
                <span>#{gameState.roundNumber || 0}</span>
              </div>
              <div className="stat-item">
                <label>Active Players</label>
                <span>{gameState.playersActive || 0}</span>
              </div>
              <div className="stat-item">
                <label>Total Bets</label>
                <span>{gameState.totalBets || 0}</span>
              </div>
              <div className="stat-item">
                <label>Total Amount</label>
                <span>${gameState.totalAmount?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          <div className="control-buttons">
            <button
              className={`btn-start ${gameState.status === 'active' ? 'disabled' : ''}`}
              onClick={startGame}
              disabled={gameState.status === 'active' || loading}
            >
              {loading ? '⏳ Loading...' : `🚀 Start Round ${gameState.roundNumber + 1}`}
            </button>

            <button
              className={`btn-stop ${gameState.status !== 'active' ? 'disabled' : ''}`}
              onClick={stopGame}
              disabled={gameState.status !== 'active' || loading}
            >
              {loading ? '⏳ Loading...' : `🛑 Stop at ${gameState.multiplier.toFixed(2)}x`}
            </button>

            <button
              className="btn-close"
              onClick={closeGame}
              disabled={loading}
            >
              {loading ? '⏳ Loading...' : '🔒 Close Game'}
            </button>
          </div>
        </div>

        {/* ===== SET NEXT CRASH POINT ===== */}
        <div className="management-card crash-control">
          <h2>🎯 Set Next Crash Point</h2>
          <p className="hint">Set the multiplier where the game will crash in the next round</p>

          <div className="crash-input-group">
            <input
              type="number"
              id="nextCrashPoint"
              placeholder="e.g., 2.50"
              step="0.01"
              min="1.01"
              max="100"
              defaultValue={gameState.nextCrashPoint || 2}
            />
            <span className="multiplier-suffix">x</span>
            <button
              className="btn-set-crash"
              onClick={setNextCrashPoint}
              disabled={loading}
            >
              Set Crash Point
            </button>
          </div>

          <div className="crash-presets">
            <span>Quick Set:</span>
            <button onClick={() => {
              document.getElementById('nextCrashPoint').value = '1.5';
            }}>1.5x</button>
            <button onClick={() => {
              document.getElementById('nextCrashPoint').value = '2.0';
            }}>2.0x</button>
            <button onClick={() => {
              document.getElementById('nextCrashPoint').value = '3.0';
            }}>3.0x</button>
            <button onClick={() => {
              document.getElementById('nextCrashPoint').value = '5.0';
            }}>5.0x</button>
            <button onClick={() => {
              document.getElementById('nextCrashPoint').value = '10.0';
            }}>10.0x</button>
            <button onClick={() => {
              document.getElementById('nextCrashPoint').value = '50.0';
            }}>50.0x</button>
          </div>
        </div>

        {/* ===== GAME SETTINGS ===== */}
        <div className="management-card game-settings">
          <h2>⚙️ Game Settings</h2>

          <div className="settings-grid">
            <div className="setting-group">
              <label>Auto Start</label>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.autoStart}
                  onChange={(e) => {
                    setSettings({ ...settings, autoStart: e.target.checked });
                    if (e.target.checked) {
                      showMessage('⚠️ Auto-start enabled! Game will start automatically after crash.', 'warning');
                    }
                  }}
                />
                <span className="toggle-slider"></span>
              </div>
              <small style={{ color: '#888', fontSize: '0.7rem' }}>
                {settings.autoStart ? '⚠️ Auto-start ON' : '✅ Manual start only'}
              </small>
            </div>

            <div className="setting-group">
              <label>Auto Start Delay (seconds)</label>
              <input
                type="number"
                value={settings.autoStartDelay}
                onChange={(e) => setSettings({ ...settings, autoStartDelay: parseInt(e.target.value) || 10 })}
                min="3"
                max="60"
                disabled={!settings.autoStart}
              />
            </div>

            <div className="setting-group">
              <label>Minimum Bet ($)</label>
              <input
                type="number"
                value={settings.minBet}
                onChange={(e) => setSettings({ ...settings, minBet: parseFloat(e.target.value) || 1 })}
                min="0.01"
                step="0.01"
              />
            </div>

            <div className="setting-group">
              <label>Maximum Bet ($)</label>
              <input
                type="number"
                value={settings.maxBet}
                onChange={(e) => setSettings({ ...settings, maxBet: parseFloat(e.target.value) || 1000 })}
                min="1"
                step="1"
              />
            </div>

            <div className="setting-group">
              <label>House Edge (%)</label>
              <input
                type="number"
                value={settings.houseEdge}
                onChange={(e) => setSettings({ ...settings, houseEdge: parseFloat(e.target.value) || 5 })}
                min="0"
                max="20"
                step="0.5"
              />
            </div>
          </div>

          <button
            className="btn-save-settings"
            onClick={updateSettings}
            disabled={loading}
          >
            💾 Save Settings
          </button>
        </div>

        {/* ===== LIVE BETS ===== */}
        <div className="management-card live-bets">
          <h2>📊 Live Bets ({activeBets.length})</h2>
          <div className="bets-table-wrapper">
            {activeBets.length === 0 ? (
              <p className="no-data">No active bets</p>
            ) : (
              <table className="bets-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Bet Amount</th>
                    <th>Cash Out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBets.map((bet) => (
                    <tr key={bet._id || bet.betId}>
                      <td>{bet.user?.username || bet.displayName || 'Unknown'}</td>
                      <td>${(bet.amount || bet.stake)?.toFixed(2)}</td>
                      <td>{bet.autoCashOut ? bet.autoCashOut + 'x' : 'Manual'}</td>
                      <td>
                        <span className={`bet-status ${bet.status}`}>
                          {bet.status === 'active' ? '🟢 Active' :
                           bet.status === 'cashed' ? '✅ Cashed' :
                           bet.status === 'lost' ? '❌ Lost' : '⏳'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ===== GAME HISTORY ===== */}
        <div className="management-card game-history">
          <h2>📜 Game History ({history.length})</h2>
          <div className="history-wrapper">
            {history.length === 0 ? (
              <p className="no-data">No game history</p>
            ) : (
              <div className="history-list">
                {history.slice(0, 20).map((game, index) => (
                  <div key={index} className={`history-item ${game.crashed ? 'crashed' : 'cashed'}`}>
                    <span className="history-round">#{game.roundNumber}</span>
                    <span className="history-multiplier">{game.crashPoint?.toFixed(2) || game.crashMultiplier?.toFixed(2) || 'N/A'}x</span>
                    <span className="history-players">{game.playersActive || 0} players</span>
                    <span className="history-time">{game.endTime ? new Date(game.endTime).toLocaleTimeString() : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AviatorManagement;