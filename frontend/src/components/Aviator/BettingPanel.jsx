import React, { useState, useEffect } from 'react';
import './Aviator.css';

const BettingPanel = ({ 
  betSlot, 
  balance, 
  roundState, 
  betState, 
  onPlaceBet, 
  onCashOut, 
  onCancelBet,
  onStakeChange 
}) => {
  const [stake, setStake] = useState(10);
  const [quickAmounts] = useState([10, 25, 50, 100, 250, 500, 1000]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isActive = betState?.isActive || false;
  const isPending = betState?.isPending || false;
  const isCashed = betState?.status === 'cashed';
  const canPlaceBet = roundState.status === 'BETTING_OPEN' && !isActive && !isPending && !isCashed;
  const canCashOut = isActive && roundState.status === 'RUNNING';
  const canCancel = isPending && (roundState.status === 'WAITING' || roundState.status === 'BETTING_OPEN');

  // ✅ Show Place Bet button even when game is waiting
  const canPlaceBetWaiting = roundState.status === 'WAITING' && !isActive && !isPending && !isCashed;

  useEffect(() => {
    if (betState?.stake) {
      setStake(betState.stake);
    }
  }, [betState]);

  const handleStakeChange = (value) => {
    const newStake = Math.max(1, Math.min(value, balance));
    setStake(newStake);
    if (onStakeChange) {
      onStakeChange(newStake);
    }
  };

  const handleQuickAmount = (amount) => {
    handleStakeChange(amount);
  };

  const handlePlaceBet = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onPlaceBet(stake);
    } catch (error) {
      console.error('Error placing bet:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCashOut = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCashOut();
    } catch (error) {
      console.error('Error cashing out:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCancelBet();
    } catch (error) {
      console.error('Error cancelling bet:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`betting-panel bet-panel-${betSlot}`}>
      <div className="bet-panel-header">
        <span className="bet-panel-title">🎯 BET {betSlot}</span>
        {isActive && <span className="bet-status active">🟢 ACTIVE</span>}
        {isPending && <span className="bet-status pending">⏳ PENDING</span>}
        {isCashed && <span className="bet-status cashed">✅ CASHED</span>}
      </div>

      <div className="bet-panel-body">
        <div className="bet-balance">
          <span className="label">Balance</span>
          <span className="value">{balance.toFixed(2)} ETB</span>
        </div>

        <div className="bet-stake">
          <span className="label">Stake</span>
          <div className="stake-controls">
            <button 
              className="stake-btn" 
              onClick={() => handleStakeChange(stake - 5)}
              disabled={isActive || isPending || isCashed}
            >
              −
            </button>
            <input 
              type="number" 
              className="stake-input"
              value={stake}
              onChange={(e) => handleStakeChange(parseFloat(e.target.value) || 0)}
              disabled={isActive || isPending || isCashed}
              min="1"
              step="1"
            />
            <button 
              className="stake-btn" 
              onClick={() => handleStakeChange(stake + 5)}
              disabled={isActive || isPending || isCashed}
            >
              +
            </button>
          </div>
        </div>

        <div className="quick-amounts">
          {quickAmounts.map(amount => (
            <button 
              key={amount}
              className="quick-amount-btn"
              onClick={() => handleQuickAmount(amount)}
              disabled={isActive || isPending || isCashed}
            >
              {amount}
            </button>
          ))}
        </div>

        <div className="bet-actions">
          {canPlaceBet && (
            <button 
              className="bet-action-btn place-bet-btn"
              onClick={handlePlaceBet}
              disabled={isSubmitting || stake <= 0 || stake > balance}
            >
              {isSubmitting ? '⏳...' : '📈 BET'}
            </button>
          )}

          {canPlaceBetWaiting && (
            <button 
              className="bet-action-btn place-bet-btn"
              onClick={handlePlaceBet}
              disabled={isSubmitting || stake <= 0 || stake > balance}
            >
              {isSubmitting ? '⏳...' : '📈 PLACE BET'}
            </button>
          )}

          {canCashOut && (
            <button 
              className="bet-action-btn cashout-btn"
              onClick={handleCashOut}
              disabled={isSubmitting}
            >
              {isSubmitting ? '⏳...' : `💰 CASH OUT (${(roundState.multiplier || 1).toFixed(2)}x)`}
            </button>
          )}

          {canCancel && (
            <button 
              className="bet-action-btn cancel-btn"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {isSubmitting ? '⏳...' : '🔴 CANCEL'}
            </button>
          )}

          {!canPlaceBet && !canPlaceBetWaiting && !canCashOut && !canCancel && (
            <div className="bet-status-message">
              {roundState.status === 'BETTING_CLOSED' && '🔒 Bets Closed'}
              {roundState.status === 'CRASHED' && '💥 Round Crashed'}
              {isCashed && '✅ Already Cashed Out'}
              {(isActive || isPending) && '⏳ Waiting for round...'}
            </div>
          )}
        </div>

        {isActive && roundState.status === 'RUNNING' && (
          <div className="bet-payout-preview">
            <span className="label">Current Payout</span>
            <span className="value">
              {(stake * (roundState.multiplier || 1)).toFixed(2)} ETB
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BettingPanel;