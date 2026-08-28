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

  // Extract bet status
  const isActive = betState?.isActive || false;
  const isPending = betState?.isPending || false;
  const isCashed = betState?.status === 'cashed' || betState?.status === 'CASHED_OUT';
  const isCancelled = betState?.status === 'cancelled';

  // Determine button state
  const getButtonState = () => {
    // If bet is cashed or cancelled, show disabled message
    if (isCashed) {
      return { text: '✅ CASHED OUT', disabled: true, action: null };
    }
    if (isCancelled) {
      return { text: '❌ CANCELLED', disabled: true, action: null };
    }

    // If bet is pending (placed but round not started)
    if (isPending) {
      return { 
        text: '🔴 CANCEL', 
        disabled: false, 
        action: () => onCancelBet(),
        style: 'cancel-btn'
      };
    }

    // If bet is active and round is running
    if (isActive && roundState.status === 'RUNNING') {
      const multiplier = roundState.multiplier || 1;
      const estimatedWin = (stake * multiplier).toFixed(2);
      return { 
        text: `💰 CASH OUT (${multiplier.toFixed(2)}x)`, 
        disabled: false, 
        action: () => onCashOut(),
        style: 'cashout-btn'
      };
    }

    // If bet is active but round not running (shouldn't happen, but fallback)
    if (isActive) {
      return { text: '⏳ WAITING...', disabled: true, action: null };
    }

    // No bet placed - check if betting is allowed
    // Allow betting in WAITING, BETTING_OPEN, and RUNNING (for next round)
    const canBet = roundState.status === 'WAITING' || 
                   roundState.status === 'BETTING_OPEN' || 
                   roundState.status === 'RUNNING';
    const insufficientBalance = stake > balance;
    const disabled = !canBet || insufficientBalance || isSubmitting;

    // Show different messages based on state
    let buttonText = '📈 PLACE BET';
    if (roundState.status === 'RUNNING') {
      buttonText = '📈 PLACE BET (Next Round)';
    } else if (roundState.status === 'CRASHED' || roundState.status === 'CLOSED') {
      buttonText = '⏳ BETTING CLOSED';
    } else if (roundState.status === 'WAITING' || roundState.status === 'BETTING_OPEN') {
      buttonText = '📈 PLACE BET';
    }

    return { 
      text: buttonText, 
      disabled: disabled,
      action: () => onPlaceBet(stake),
      style: 'place-bet-btn'
    };
  };

  const buttonState = getButtonState();

  const handleStakeChange = (value) => {
    const newStake = Math.max(1, Math.min(value, balance || 10000));
    setStake(newStake);
    if (onStakeChange) {
      onStakeChange(newStake);
    }
  };

  const handleQuickAmount = (amount) => {
    handleStakeChange(amount);
  };

  const handleAction = async () => {
    if (isSubmitting || !buttonState.action) return;
    setIsSubmitting(true);
    try {
      await buttonState.action();
    } catch (error) {
      console.error('Action error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`betting-panel bet-panel-${betSlot}`}>
      <div className="bet-panel-header">
        <span className="bet-panel-title">🎯 BET {betSlot}</span>
        {isActive && roundState.status === 'RUNNING' && (
          <span className="bet-status active">🟢 ACTIVE</span>
        )}
        {isPending && (
          <span className="bet-status pending">⏳ PENDING</span>
        )}
        {isCashed && (
          <span className="bet-status cashed">✅ CASHED</span>
        )}
        {isCancelled && (
          <span className="bet-status cancelled">❌ CANCELLED</span>
        )}
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
              disabled={isActive || isPending || isCashed || isCancelled}
            >
              −
            </button>
            <input 
              type="number" 
              className="stake-input"
              value={stake}
              onChange={(e) => handleStakeChange(parseFloat(e.target.value) || 0)}
              disabled={isActive || isPending || isCashed || isCancelled}
              min="1"
              step="1"
            />
            <button 
              className="stake-btn" 
              onClick={() => handleStakeChange(stake + 5)}
              disabled={isActive || isPending || isCashed || isCancelled}
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
              disabled={isActive || isPending || isCashed || isCancelled}
            >
              {amount}
            </button>
          ))}
        </div>

        <div className="bet-actions">
          <button 
            className={`bet-action-btn ${buttonState.style || 'place-bet-btn'}`}
            onClick={handleAction}
            disabled={buttonState.disabled || isSubmitting}
          >
            {isSubmitting ? '⏳...' : buttonState.text}
          </button>
          {buttonState.disabled && !isSubmitting && roundState.status === 'CRASHED' && (
            <div className="bet-status-message">💥 Round crashed, wait for next</div>
          )}
          {buttonState.disabled && !isSubmitting && roundState.status === 'CLOSED' && (
            <div className="bet-status-message">🔒 Game closed</div>
          )}
          {buttonState.disabled && stake > balance && !isActive && !isPending && (
            <div className="bet-status-message error">⚠️ Insufficient balance</div>
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