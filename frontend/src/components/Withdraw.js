import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Withdraw.css';

// Import logos (same as deposit page)
import telebirrLogo from '../assets/telebirr-logo.png';
import cbebirrLogo from '../assets/cbebirr-logo.jpg';
import cbeLogo from '../assets/cbe-logo.jpg';

const Withdraw = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState({
    balance: 0,
    bonusBalance: 0,
    lockedBalance: 0
  });
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'TELE_BIRR',
    accountName: '',
    accountNumber: '',
    bankName: '',
    phoneNumber: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [recentWithdrawals, setRecentWithdrawals] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);

  // Payment methods with logos - TeleBirr FIRST (Recommended)
  const paymentMethods = [
    {
      id: 'TELE_BIRR',
      name: 'Tele Birr',
      logo: telebirrLogo,
      color: '#e65100',
      bgColor: '#fff3e0',
      recommended: true,
      icon: '📱'
    },
    {
      id: 'BANK_TRANSFER',
      name: ' CBE Bank Transfer',
      logo: cbeLogo,
      color: '#1a5c3a',
      bgColor: '#e8f5e9',
      recommended: false,
      icon: '🏦'
    },
    {
      id: 'MOBILE_MONEY',
      name: 'CBE Birr',
      logo: cbebirrLogo,
      color: '#0d47a1',
      bgColor: '#e3f2fd',
      recommended: false,
      icon: '📱'
    }
  ];

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(userData));
    fetchWalletBalance();
    fetchRecentWithdrawals();
  }, [navigate]);

  const fetchWalletBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/user/wallet', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWallet(response.data);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const fetchRecentWithdrawals = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/withdrawals/recent', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentWithdrawals(response.data || []);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSelectMethod = (method) => {
    setSelectedMethod(method);
    setFormData({
      ...formData,
      paymentMethod: method.id
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const amount = parseFloat(formData.amount);
    if (!amount || amount < 50) {
      setErrorMessage('Minimum withdrawal amount is ETB 50');
      setLoading(false);
      return;
    }

    if (amount > wallet.balance) {
      setErrorMessage(`Insufficient balance. Available: ETB ${wallet.balance.toFixed(2)}`);
      setLoading(false);
      return;
    }

    if (!formData.accountName || !formData.accountNumber) {
      setErrorMessage('Account name and number are required');
      setLoading(false);
      return;
    }

    if (formData.paymentMethod === 'BANK_TRANSFER' && !formData.bankName) {
      setErrorMessage('Bank name is required for bank transfer');
      setLoading(false);
      return;
    }

    if (formData.paymentMethod === 'TELE_BIRR' && !formData.phoneNumber) {
      setErrorMessage('Phone number is required for Tele Birr');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/withdrawals/create', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccessMessage('✅ Withdrawal request submitted successfully!');
        setFormData({
          amount: '',
          paymentMethod: 'TELE_BIRR',
          accountName: '',
          accountNumber: '',
          bankName: '',
          phoneNumber: '',
          notes: ''
        });
        setSelectedMethod(null);
        fetchWalletBalance();
        fetchRecentWithdrawals();
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to submit withdrawal request');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'status-pending', text: '⏳ Pending' },
      approved: { class: 'status-approved', text: '✅ Approved' },
      rejected: { class: 'status-rejected', text: '❌ Rejected' },
      completed: { class: 'status-completed', text: '💰 Completed' }
    };
    const badge = badges[status] || badges.pending;
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  return (
    <div className="withdraw-container">
      {/* Header */}
      <div className="withdraw-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            ← Back
          </button>
          <h1>💳 Withdraw Funds</h1>
        </div>
        <div className="header-right">
          <span className="balance-display">
            Balance: <strong>ETB {wallet.balance?.toFixed(2) || '0.00'}</strong>
          </span>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}

      <div className="withdraw-content">
        {/* Step 1: Select Payment Method */}
        <div className="step-section">
          <div className="step-header">
            <span className="step-number">1</span>
            <h3>Select Withdrawal Method</h3>
          </div>
          <div className="method-grid">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`method-card ${selectedMethod?.id === method.id ? 'selected' : ''} ${method.recommended ? 'recommended' : ''}`}
                onClick={() => handleSelectMethod(method)}
                style={{ 
                  borderColor: selectedMethod?.id === method.id ? method.color : '#e0e0e0'
                }}
              >
                {method.recommended && (
                  <div className="recommended-badge">
                    ⭐ Recommended
                  </div>
                )}
                <div className="method-logo-wrapper" style={{ background: method.bgColor }}>
                  <img src={method.logo} alt={method.name} className="method-logo-img" />
                </div>
                <h4>{method.name}</h4>
                {selectedMethod?.id === method.id && (
                  <span className="selected-check">✓ Selected</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 2: Enter Details */}
        <div className="step-section form-section">
          <div className="step-header">
            <span className="step-number">2</span>
            <h3>Enter Withdrawal Details</h3>
          </div>

          <form onSubmit={handleSubmit} className="withdraw-form">
            <div className="form-row">
              <div className="form-group">
                <label>Amount (ETB) *</label>
                <div className="input-with-icon">
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder={`Min. ETB 50`}
                    min="50"
                    max={wallet.balance}
                    step="1"
                    required
                  />
                </div>
                <small>Available: ETB {wallet.balance?.toFixed(2) || '0.00'} | Minimum: ETB 50</small>
              </div>

              <div className="form-group">
                <label>Payment Method *</label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                  required
                >
                  <option value="TELE_BIRR">📱 Tele Birr (Recommended)</option>
                  <option value="BANK_TRANSFER">🏦 CBE Bank Transfer</option>
                  <option value="MOBILE_MONEY">📱 CBE Birr</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Account Holder Name *</label>
                <input
                  type="text"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleInputChange}
                  placeholder="Enter account holder name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Account Number *</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  placeholder="Enter account number"
                  required
                />
              </div>
            </div>

            {formData.paymentMethod === 'BANK_TRANSFER' && (
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Bank Name *</label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleInputChange}
                    placeholder="Enter bank name"
                    required
                  />
                </div>
              </div>
            )}

            {formData.paymentMethod === 'TELE_BIRR' && (
              <div className="form-row">
                <div className="form-group full-width">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="09XXXXXXXX"
                    maxLength="10"
                    required
                  />
                  <small>Enter the Tele Birr registered phone number</small>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group full-width">
                <label>Additional Notes (Optional)</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Any additional information for admin"
                  rows="3"
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading || wallet.balance < 50}>
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                '📤 Request Withdrawal'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Recent Withdrawals */}
      {recentWithdrawals.length > 0 && (
        <div className="recent-withdrawals">
          <div className="recent-header">
            <h3>📊 Recent Withdrawal Requests</h3>
            <span className="recent-count">{recentWithdrawals.length} requests</span>
          </div>
          <div className="withdrawals-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentWithdrawals.map((withdrawal) => (
                  <tr key={withdrawal._id}>
                    <td>{formatDate(withdrawal.createdAt)}</td>
                    <td><strong>ETB {withdrawal.amount}</strong></td>
                    <td>{withdrawal.paymentMethod}</td>
                    <td>{getStatusBadge(withdrawal.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Withdraw;