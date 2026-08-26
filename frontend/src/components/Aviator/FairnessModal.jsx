import React, { useState } from 'react';
import './Aviator.css';

const FairnessModal = ({ isOpen, onClose, roundId, onVerify }) => {
  const [verificationData, setVerificationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleVerify = async () => {
    if (!roundId) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await onVerify(roundId);
      setVerificationData(result);
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fairness-modal-overlay" onClick={onClose}>
      <div className="fairness-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fairness-modal-header">
          <h3>🔐 Provably Fair</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="fairness-modal-body">
          <p className="fairness-description">
            Each round uses a cryptographically secure random seed to determine the crash point.
            You can verify the fairness of any round.
          </p>

          <div className="fairness-input">
            <label>Round ID</label>
            <input 
              type="text" 
              value={roundId || ''} 
              readOnly 
              className="round-id-input"
            />
          </div>

          <button 
            className="verify-btn"
            onClick={handleVerify}
            disabled={loading || !roundId}
          >
            {loading ? 'Verifying...' : '🔍 Verify Round'}
          </button>

          {error && (
            <div className="fairness-error">{error}</div>
          )}

          {verificationData && (
            <div className="fairness-result">
              <div className="result-row">
                <span>Server Seed Hash:</span>
                <code className="seed-hash">{verificationData.serverSeedHash}</code>
              </div>
              <div className="result-row">
                <span>Server Seed:</span>
                <code className="seed-value">{verificationData.serverSeed}</code>
              </div>
              <div className="result-row">
                <span>Client Seed:</span>
                <code className="seed-value">{verificationData.clientSeed}</code>
              </div>
              <div className="result-row">
                <span>Nonce:</span>
                <span>{verificationData.nonce}</span>
              </div>
              <div className="result-row">
                <span>Calculated Crash:</span>
                <span className="crash-value">{verificationData.calculatedCrash?.toFixed(2)}x</span>
              </div>
              <div className="result-row">
                <span>Actual Crash:</span>
                <span className="crash-value">{verificationData.actualCrash?.toFixed(2)}x</span>
              </div>
              <div className={`result-verification ${verificationData.verified ? 'verified' : 'failed'}`}>
                {verificationData.verified ? '✅ Verified - Fair' : '❌ Verification Failed'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FairnessModal;