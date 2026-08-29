import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAviatorGame from '../../hooks/useAviatorGame';
import ConnectionStatus from '../../components/Aviator/ConnectionStatus';
import RecentRounds from '../../components/Aviator/RecentRounds';
import GameCanvas from '../../components/Aviator/GameCanvas';
import BettingPanel from '../../components/Aviator/BettingPanel';
import LivePlayers from '../../components/Aviator/LivePlayers';
import MyBets from '../../components/Aviator/MyBets';
import FairnessModal from '../../components/Aviator/FairnessModal';
import Countdown from '../../components/Aviator/Countdown';
import './AviatorPage.css';

const AviatorPage = () => {
  const navigate = useNavigate();
  const [showFairnessModal, setShowFairnessModal] = useState(false);
  const [selectedRoundId, setSelectedRoundId] = useState(null);

  const {
    roundState,
    balance,
    history,
    myBets,
    livePlayers,
    connectionStatus,
    loading,
    error,
    placeBet,
    cashOut,
    cancelBet,
    getBetState,
    setBetStake,
    setAutoCashOut,
    fetchCurrentRound,
    fetchLivePlayers
  } = useAviatorGame();

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { state: { from: '/aviator' } });
    }
  }, [navigate]);

  const handleCountdownComplete = () => {
    fetchCurrentRound();
  };

  const handleVerifyRound = async (roundId) => {
    try {
      const aviatorApi = (await import('../../services/aviatorApi')).default;
      const response = await aviatorApi.verifyRound(roundId);
      return response.data;
    } catch (error) {
      console.error('Error verifying round:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="aviator-page">
        <div className="loading-state">
          <div className="loading-spinner">✈️</div>
          <p>Loading Aviator...</p>
        </div>
      </div>
    );
  }

  const bet1State = getBetState(1);
  const bet2State = getBetState(2);

  return (
    <div className="aviator-page">
      {/* Header */}
      <header className="aviator-header">
        <div className="header-left">
          <div className="header-logo">
            <span>✈️</span> AsharaBet
          </div>
          <nav className="header-nav">
            <a href="/">Sportsbook</a>
            <a href="/aviator" className="active">Aviator</a>
          </nav>
        </div>
        <div className="header-center">AVIATOR</div>
        <div className="header-right">
          <ConnectionStatus status={connectionStatus} />
          <div className="header-balance">
            Balance: <span className="amount">{balance.toFixed(2)} ETB</span>
          </div>
          <button className="header-btn deposit" onClick={() => navigate('/deposit')}>Deposit</button>
          <button className="header-btn profile" onClick={() => navigate('/my-account')}>👤</button>
        </div>
      </header>

      {/* Recent Rounds */}
      <RecentRounds history={history} />

      {/* Game Area */}
      <div className="game-area">
        <GameCanvas
          multiplier={roundState.multiplier}
          status={roundState.status}
          crashMultiplier={roundState.crashMultiplier}
          roundId={roundState.roundId}
        />
        {roundState.status === 'WAITING' && roundState.countdown > 0 && (
          <Countdown seconds={roundState.countdown} onComplete={handleCountdownComplete} />
        )}
      </div>

      {/* Bets Layout */}
      <div className="bets-layout">
        <BettingPanel
          betSlot={1}
          balance={balance}
          roundState={roundState}
          betState={bet1State}
          onPlaceBet={(stake) => placeBet(1, stake)}
          onCashOut={() => cashOut(1)}          // ✅ Manual cashout
          onCancelBet={() => cancelBet(1)}
          onStakeChange={(stake) => setBetStake(1, stake)}
          onAutoCashOutChange={(enabled, value) => setAutoCashOut(1, enabled, value)}
        />
        <BettingPanel
          betSlot={2}
          balance={balance}
          roundState={roundState}
          betState={bet2State}
          onPlaceBet={(stake) => placeBet(2, stake)}
          onCashOut={() => cashOut(2)}          // ✅ Manual cashout
          onCancelBet={() => cancelBet(2)}
          onStakeChange={(stake) => setBetStake(2, stake)}
          onAutoCashOutChange={(enabled, value) => setAutoCashOut(2, enabled, value)}
        />
      </div>

      {/* Live Players & My Bets */}
      <LivePlayers players={livePlayers} roundState={roundState} />
      <MyBets bets={myBets} />

      {/* Fairness */}
      <div className="fairness-footer">
        <button
          className="fairness-btn"
          onClick={() => {
            setSelectedRoundId(roundState.roundId);
            setShowFairnessModal(true);
          }}
        >
          🔐 Provably Fair
        </button>
      </div>

      <FairnessModal
        isOpen={showFairnessModal}
        onClose={() => setShowFairnessModal(false)}
        roundId={selectedRoundId}
        onVerify={handleVerifyRound}
      />

      {error && (
        <div className="error-toast">
          {error}
          <button className="error-close" onClick={() => {}}>×</button>
        </div>
      )}
    </div>
  );
};

export default AviatorPage;