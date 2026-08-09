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

  // ✅ API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
      name: 'CBE Bank Transfer',
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

  // ✅ FIXED: Use API_URL
  const fetchWalletBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found');
        return;
      }
      const response = await axios.get(`${API_URL}/api/user/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Wallet response:', response.data);
      setWallet({
        balance: response.data.balance || 0,
        bonusBalance: response.data.bonusBalance || 0,
        lockedBalance: response.data.lockedBalance || 0
      });
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  // ✅ FIXED: Use API_URL
  const fetchRecentWithdrawals = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found');
        return;
      }
      const response = await axios.get(`${API_URL}/api/withdrawals/recent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Recent withdrawals:', response.data);
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

  // ✅ COMPLETE WORKING handleSubmit with debug logs
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🚀🚀🚀 FORM SUBMITTED! 🚀🚀🚀');
    console.log('📦 Form Data:', formData);
    console.log('💰 Wallet Balance:', wallet.balance);
    
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const amount = parseFloat(formData.amount);
    console.log('💵 Parsed Amount:', amount);

    // Validation
    if (!amount || amount < 50) {
      console.log('❌ Amount validation failed - amount:', amount);
      setErrorMessage('Minimum withdrawal amount is ETB 50');
      setLoading(false);
      return;
    }

    if (amount > wallet.balance) {
      console.log('❌ Insufficient balance - amount:', amount, 'balance:', wallet.balance);
      setErrorMessage(`Insufficient balance. Available: ETB ${wallet.balance.toFixed(2)}`);
      setLoading(false);
      return;
    }

    if (!formData.accountName || !formData.accountNumber) {
      console.log('❌ Account name or number missing - name:', formData.accountName, 'number:', formData.accountNumber);
      setErrorMessage('Account name and number are required');
      setLoading(false);
      return;
    }

    if (formData.paymentMethod === 'BANK_TRANSFER' && !formData.bankName) {
      console.log('❌ Bank name missing');
      setErrorMessage('Bank name is required for bank transfer');
      setLoading(false);
      return;
    }

    if (formData.paymentMethod === 'TELE_BIRR' && !formData.phoneNumber) {
      console.log('❌ Phone number missing for TeleBirr');
      setErrorMessage('Phone number is required for Tele Birr');
      setLoading(false);
      return;
    }

    console.log('✅ All validations passed!');

    try {
      const token = localStorage.getItem('token');
      console.log('🔑 Token exists:', !!token);
      
      if (!token) {
        console.log('❌ No token found');
        setErrorMessage('Please login again');
        setLoading(false);
        return;
      }

      const requestData = {
        amount: formData.amount,
        paymentMethod: formData.paymentMethod,
        accountName: formData.accountName,
        accountNumber: formData.accountNumber,
        bankName: formData.bankName,
        phoneNumber: formData.phoneNumber,
        notes: formData.notes
      };

      console.log('📤 Sending to:', `${API_URL}/api/withdrawals/create`);
      console.log('📤 Data:', requestData);

      const response = await axios.post(
        `${API_URL}/api/withdrawals/create`,
        requestData,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ API Response:', response.data);

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
      } else {
        setErrorMessage(response.data.message || 'Failed to submit withdrawal request');
      }
    } catch (error) {
      console.error('❌❌❌ WITHDRAWAL ERROR:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error data:', error.response?.data);
      
      if (error.response?.status === 401) {
        setErrorMessage('Please login again');
      } else if (error.response?.data?.message) {
        setErrorMessage(error.response.data.message);
      } else if (error.response?.data?.msg) {
        setErrorMessage(error.response.data.msg);
      } else {
        setErrorMessage('Failed to submit withdrawal request. Please try again.');
      }
    } finally {
      setLoading(false);
      console.log('🏁 Form submission completed');
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
                    placeholder="Min. ETB 50"
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

            {/* ✅ BUTTON - Always clickable (only disabled when loading) */}
            <button 
              type="submit" 
              className="submit-btn" 
              disabled={loading}
              onClick={() => console.log('🖱️ Button clicked!')}
            >
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