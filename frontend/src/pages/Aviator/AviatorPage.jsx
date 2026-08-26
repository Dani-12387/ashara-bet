import React, { useState, useEffect } from 'react';
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
    fetchBalance,
    fetchHistory,
    fetchMyBets,
    fetchCurrentRound,
    fetchLivePlayers,
    bet1Ref,
    bet2Ref
  } = useAviatorGame();

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { state: { from: '/aviator' } });
    }
  }, [navigate]);

  // Handle countdown complete
  const handleCountdownComplete = () => {
    // Countdown finished, game should start
    fetchCurrentRound();
  };

  // Handle verify round
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
      {/* ===== HEADER ===== */}
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
        <div className="header-center">
          AVIATOR
        </div>
        <div className="header-right">
          <ConnectionStatus status={connectionStatus} />
          <div className="header-balance">
            Balance: <span className="amount">{balance.toFixed(2)} ETB</span>
          </div>
          <button className="header-btn deposit" onClick={() => navigate('/deposit')}>
            Deposit
          </button>
          <button className="header-btn withdraw" onClick={() => navigate('/withdraw')}>
            Withdraw
          </button>
          <button className="header-btn profile" onClick={() => navigate('/my-account')}>
            👤
          </button>
        </div>
      </header>

      {/* ===== RECENT ROUNDS ===== */}
      <RecentRounds history={history} />

      {/* ===== GAME AREA ===== */}
      <div className="game-area">
        <GameCanvas 
          multiplier={roundState.multiplier}
          status={roundState.status}
          crashMultiplier={roundState.crashMultiplier}
          roundId={roundState.roundId}
        />
        
        {roundState.status === 'WAITING' && roundState.countdown > 0 && (
          <Countdown 
            seconds={roundState.countdown} 
            onComplete={handleCountdownComplete}
          />
        )}
      </div>

      {/* ===== BETS LAYOUT ===== */}
      <div className="bets-layout">
        <BettingPanel 
          betSlot={1}
          balance={balance}
          roundState={roundState}
          betState={bet1State}
          onPlaceBet={(stake) => placeBet(1, stake)}
          onCashOut={() => cashOut(1)}
          onCancelBet={() => cancelBet(1)}
          onStakeChange={(stake) => setBetStake(1, stake)}
        />
        <BettingPanel 
          betSlot={2}
          balance={balance}
          roundState={roundState}
          betState={bet2State}
          onPlaceBet={(stake) => placeBet(2, stake)}
          onCashOut={() => cashOut(2)}
          onCancelBet={() => cancelBet(2)}
          onStakeChange={(stake) => setBetStake(2, stake)}
        />
      </div>

      {/* ===== LIVE PLAYERS ===== */}
      <LivePlayers players={livePlayers} roundState={roundState} />

      {/* ===== MY BETS ===== */}
      <MyBets bets={myBets} />

      {/* ===== FAIRNESS BUTTON ===== */}
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

      {/* ===== FAIRNESS MODAL ===== */}
      <FairnessModal 
        isOpen={showFairnessModal}
        onClose={() => setShowFairnessModal(false)}
        roundId={selectedRoundId}
        onVerify={handleVerifyRound}
      />

      {/* ===== ERROR DISPLAY ===== */}
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