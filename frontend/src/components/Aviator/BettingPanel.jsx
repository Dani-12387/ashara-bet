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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickAmounts] = useState([10, 25, 50, 100, 250, 500, 1000]);

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
  const isCashed = status === 'cashed' || status === 'CASHED_OUT';
  const isCancelled = status === 'cancelled';
  const isLost = status === 'lost';
  const isIdle = status === 'idle' || status === 'cancelled';

  // ---------- Determine button state ----------
  const getButtonState = () => {
    // Cashed out
    if (isCashed) {
      const multiplier = betState?.cashoutMultiplier || '?';
      return {
        text: `CASHED OUT ${multiplier}x`,
        disabled: true,
        action: null,
        style: 'cashed-btn'
      };
    }

    // Cancelled or Lost
    if (isCancelled || isLost) {
      return {
        text: isCancelled ? 'CANCELLED' : 'LOST',
        disabled: true,
        action: null,
        style: 'cancelled-btn'
      };
    }

    // Pending (bet placed, waiting for round)
    if (isPending) {
      return {
        text: 'WAITING FOR ROUND',
        disabled: true,
        action: null,
        style: 'waiting-btn'
      };
    }

    // Active (round running, can cash out)
    if (isActive && roundState.status === 'RUNNING') {
      const multiplier = roundState.multiplier || 1;
      const estimatedWin = (stake * multiplier).toFixed(2);
      return {
        text: `CASH OUT ${multiplier.toFixed(2)}× (${estimatedWin})`,
        disabled: false,
        action: onCashOut,
        style: 'cashout-btn'
      };
    }

    // Active but round not running (shouldn't happen)
    if (isActive) {
      return {
        text: 'WAITING FOR ROUND',
        disabled: true,
        action: null,
        style: 'waiting-btn'
      };
    }

    // No bet placed – determine betting availability
    const canBet = roundState.status === 'WAITING' || roundState.status === 'BETTING_OPEN';
    const hasEnoughBalance = balance > 0 && stake <= balance;
    const noBalance = balance <= 0;
    const insufficientBalance = !hasEnoughBalance && balance > 0;

    if (!canBet) {
      if (roundState.status === 'RUNNING') {
        return {
          text: 'BETTING CLOSED',
          disabled: true,
          action: null,
          style: 'closed-btn'
        };
      } else if (roundState.status === 'CRASHED') {
        return {
          text: 'ROUND CRASHED',
          disabled: true,
          action: null,
          style: 'crashed-btn'
        };
      } else {
        return {
          text: 'WAITING FOR ROUND',
          disabled: true,
          action: null,
          style: 'waiting-btn'
        };
      }
    }

    if (noBalance) {
      return {
        text: 'NO BALANCE',
        disabled: true,
        action: null,
        style: 'no-balance-btn'
      };
    }
    if (insufficientBalance) {
      return {
        text: `NEED ${(stake - balance).toFixed(2)} MORE`,
        disabled: true,
        action: null,
        style: 'insufficient-btn'
      };
    }

    if (isSubmitting) {
      return {
        text: 'PLACING BET...',
        disabled: true,
        action: null,
        style: 'processing-btn'
      };
    }

    // Ready to place bet
    return {
      text: 'PLACE BET',
      disabled: false,
      action: () => handlePlaceBet(),
      style: 'place-bet-btn'
    };
  };

  const buttonState = getButtonState();

  // ---------- Wrapper for place bet ----------
  const handlePlaceBet = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onPlaceBet(stake);
    } catch (error) {
      console.error('Place bet error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------- Handlers ----------
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

  // ---------- Render ----------
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
        {/* Balance */}
        <div className="bet-balance">
          <span className="label">Balance</span>
          <span className="value">{balance.toFixed(2)} ETB</span>
        </div>

        {/* Stake */}
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

        {/* Quick amounts */}
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

        {/* MAIN ACTION BUTTON */}
        <div className="bet-actions">
          <button
            className={`bet-action-btn ${buttonState.style || 'place-bet-btn'}`}
            onClick={buttonState.action || undefined}
            disabled={buttonState.disabled || isSubmitting}
          >
            {isSubmitting ? '⏳...' : buttonState.text}
          </button>

          {/* Only show essential balance-related errors */}
          {buttonState.text === 'NO BALANCE' && (
            <div className="bet-status-message error">⚠️ No balance – please deposit</div>
          )}
          {buttonState.text.startsWith('NEED') && (
            <div className="bet-status-message error">⚠️ Insufficient balance</div>
          )}
        </div>

        {/* Auto Cash Out */}
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

        {/* Payout preview when active */}
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