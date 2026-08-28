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
  onStakeChange,
  onAutoCashOutChange
}) => {
  const [stake, setStake] = useState(10);
  const [autoCashOutEnabled, setAutoCashOutEnabled] = useState(false);
  const [autoCashOutValue, setAutoCashOutValue] = useState(1.50);
  const [quickAmounts] = useState([10, 25, 50, 100, 250, 500, 1000]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync with betState
  useEffect(() => {
    if (betState) {
      setStake(betState.stake || 10);
      setAutoCashOutEnabled(betState.autoCashOutEnabled || false);
      setAutoCashOutValue(betState.autoCashOut || 1.50);
    }
  }, [betState]);

  const status = betState?.status || 'idle';
  const isActive = status === 'active';
  const isPending = status === 'pending';
  const isCashed = status === 'cashed';
  const isCancelled = status === 'cancelled';
  const isLost = status === 'lost';
  const isIdle = status === 'idle' || status === 'cancelled';

  // Determine button state
  const getButtonState = () => {
    if (isCashed) return { text: '✅ CASHED OUT', disabled: true, action: null };
    if (isCancelled) return { text: '❌ CANCELLED', disabled: true, action: null };
    if (isLost) return { text: '💥 LOST', disabled: true, action: null };

    if (isPending) {
      return {
        text: '🔴 CANCEL',
        disabled: false,
        action: onCancelBet,
        style: 'cancel-btn'
      };
    }

    if (isActive && roundState.status === 'RUNNING') {
      const multiplier = roundState.multiplier || 1;
      const estimatedWin = (stake * multiplier).toFixed(2);
      return {
        text: `💰 CASH OUT (${multiplier.toFixed(2)}x)`,
        disabled: false,
        action: onCashOut,
        style: 'cashout-btn'
      };
    }

    if (isActive) {
      return { text: '⏳ WAITING...', disabled: true, action: null };
    }

    // No bet placed – allow only when WAITING or BETTING_OPEN
    const canBet = roundState.status === 'WAITING' || roundState.status === 'BETTING_OPEN';
    const hasEnoughBalance = balance > 0 && stake <= balance;
    const noBalance = balance <= 0;
    const insufficientBalance = !hasEnoughBalance && balance > 0;

    let disabled = !canBet || isSubmitting || noBalance || insufficientBalance;
    let buttonText = '📈 PLACE BET';
    let buttonStyle = 'place-bet-btn';

    if (!canBet) {
      if (roundState.status === 'RUNNING') {
        buttonText = '⏳ ROUND IN PROGRESS';
      } else if (roundState.status === 'CRASHED') {
        buttonText = '💥 ROUND CRASHED';
      } else {
        buttonText = '⏳ WAITING FOR ROUND';
      }
      disabled = true;
    } else if (noBalance) {
      buttonText = '⚠️ NO BALANCE';
      disabled = true;
    } else if (insufficientBalance) {
      buttonText = `⚠️ NEED ${(stake - balance).toFixed(2)} MORE`;
      disabled = true;
    } else if (roundState.status === 'WAITING') {
      buttonText = '📈 PLACE BET (Next Round)';
    } else if (roundState.status === 'BETTING_OPEN') {
      buttonText = '📈 PLACE BET';
    }

    return {
      text: buttonText,
      disabled: disabled,
      action: () => onPlaceBet(stake),
      style: buttonStyle,
      noBalance,
      insufficientBalance
    };
  };

  const buttonState = getButtonState();

  const handleStakeChange = (value) => {
    const newStake = Math.max(1, Math.min(value, 10000));
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

  const handleAutoCashOutToggle = () => {
    if (isIdle) {
      const newState = !autoCashOutEnabled;
      setAutoCashOutEnabled(newState);
      if (onAutoCashOutChange) {
        onAutoCashOutChange(newState, autoCashOutValue);
      }
    }
  };

  const handleAutoCashOutValueChange = (e) => {
    const val = parseFloat(e.target.value) || 0;
    setAutoCashOutValue(val);
    if (onAutoCashOutChange) {
      onAutoCashOutChange(autoCashOutEnabled, val);
    }
  };

  return (
    <div className={`betting-panel bet-panel-${betSlot}`}>
      <div className="bet-panel-header">
        <span className="bet-panel-title">🎯 BET {betSlot}</span>
        {isActive && roundState.status === 'RUNNING' && (
          <span className="bet-status active">🟢 ACTIVE</span>
        )}
        {isPending && <span className="bet-status pending">⏳ PENDING</span>}
        {isCashed && <span className="bet-status cashed">✅ CASHED</span>}
        {isCancelled && <span className="bet-status cancelled">❌ CANCELLED</span>}
        {isLost && <span className="bet-status lost">💥 LOST</span>}
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
              disabled={!isIdle}
            >
              −
            </button>
            <input
              type="number"
              className="stake-input"
              value={stake}
              onChange={(e) => handleStakeChange(parseFloat(e.target.value) || 0)}
              disabled={!isIdle}
              min="1"
              step="1"
            />
            <button
              className="stake-btn"
              onClick={() => handleStakeChange(stake + 5)}
              disabled={!isIdle}
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
              disabled={!isIdle}
            >
              {amount}
            </button>
          ))}
        </div>

        <div className="auto-cashout-control">
          <label>Auto Cash Out</label>
          <div className="auto-cashout-toggle">
            <button
              className={`toggle-btn ${autoCashOutEnabled ? 'active' : ''}`}
              onClick={handleAutoCashOutToggle}
              disabled={!isIdle}
            >
              {autoCashOutEnabled ? 'ON' : 'OFF'}
            </button>
            {autoCashOutEnabled && (
              <div className="auto-cashout-input">
                <input
                  type="number"
                  value={autoCashOutValue}
                  onChange={handleAutoCashOutValueChange}
                  disabled={!isIdle}
                  min="1.01"
                  step="0.1"
                />
                <span>x</span>
              </div>
            )}
          </div>
        </div>

        <div className="bet-actions">
          <button
            className={`bet-action-btn ${buttonState.style || 'place-bet-btn'}`}
            onClick={handleAction}
            disabled={buttonState.disabled || isSubmitting}
          >
            {isSubmitting ? '⏳...' : buttonState.text}
          </button>
          {buttonState.insufficientBalance && (
            <div className="bet-status-message error">
              ⚠️ Insufficient balance! Need {(stake - balance).toFixed(2)} more ETB
            </div>
          )}
          {buttonState.noBalance && (
            <div className="bet-status-message error">
              ⚠️ No balance! Please deposit to play
            </div>
          )}
          {!buttonState.noBalance && !buttonState.insufficientBalance && buttonState.disabled && !isSubmitting && (
            <div className="bet-status-message">
              {roundState.status === 'RUNNING' ? '⏳ Round in progress' :
               roundState.status === 'CRASHED' ? '💥 Round crashed' :
               '⏳ Waiting for round to start'}
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