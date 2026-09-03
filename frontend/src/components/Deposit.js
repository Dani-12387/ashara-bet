import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Deposit.css';

// Import logos
import telebirrLogo from '../assets/telebirr-logo.png';
import cbebirrLogo from '../assets/cbebirr-logo.jpg';

const Deposit = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'TELE_BIRR', // default
    transactionReference: '',
    notes: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [recentDeposits, setRecentDeposits] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [showBankDetails, setShowBankDetails] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // All payment methods – 4 Tele Birr + 1 CBE Birr
  const bankDetails = [
    {
      id: 1,
      bank: 'Tele Birr – Abate',
      logo: telebirrLogo,
      accountName: 'Abate',
      accountNumber: '0943419247',
      branch: 'Mobile Money',
      color: '#e65100',
      bgColor: '#fff3e0',
      recommended: true,
      paymentMethod: 'TELE_BIRR'
    },
    {
      id: 2,
      bank: 'Tele Birr – Abebe',
      logo: telebirrLogo,
      accountName: 'Abebe',
      accountNumber: '0911111111',
      branch: 'Mobile Money',
      color: '#2e7d32',
      bgColor: '#e8f5e9',
      recommended: false,
      paymentMethod: 'TELE_BIRR'
    },
    {
      id: 3,
      bank: 'Tele Birr – Selam',
      logo: telebirrLogo,
      accountName: 'Selam',
      accountNumber: '0934343434',
      branch: 'Mobile Money',
      color: '#6a1b9a',
      bgColor: '#f3e5f5',
      recommended: false,
      paymentMethod: 'TELE_BIRR'
    },
    {
      id: 4,
      bank: 'Tele Birr – Ali',
      logo: telebirrLogo,
      accountName: 'Ali',
      accountNumber: '0978899087',
      branch: 'Mobile Money',
      color: '#c62828',
      bgColor: '#ffebee',
      recommended: false,
      paymentMethod: 'TELE_BIRR'
    },
    {
      id: 5,
      bank: 'CBE Birr – Daniel',
      logo: cbebirrLogo,
      accountName: 'Daniel yirga',
      accountNumber: '0939271009',
      branch: 'Head Office',
      color: '#0d47a1',
      bgColor: '#e3f2fd',
      recommended: false,
      paymentMethod: 'MOBILE_MONEY'
    }
  ];

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(userData));
    fetchRecentDeposits();
  }, [navigate]);

  const fetchRecentDeposits = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/deposits/recent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentDeposits(response.data || []);
    } catch (error) {
      console.error('Error fetching deposits:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('File size must be less than 5MB');
        return;
      }
      if (!file.type.match('image.*')) {
        setErrorMessage('Please upload an image file');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage('');
    }
  };

  const handleSelectBank = (bank) => {
    setSelectedBank(bank);
    // Set payment method based on selected bank
    setFormData(prev => ({ ...prev, paymentMethod: bank.paymentMethod }));
    setShowBankDetails(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (!formData.amount || parseFloat(formData.amount) < 50) {
      setErrorMessage('Minimum deposit amount is ETB 50');
      setLoading(false);
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Please upload a payment screenshot');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const formDataToSend = new FormData();
      formDataToSend.append('amount', formData.amount);
      formDataToSend.append('paymentMethod', formData.paymentMethod);
      formDataToSend.append('transactionReference', formData.transactionReference);
      formDataToSend.append('notes', formData.notes);
      formDataToSend.append('screenshot', selectedFile);

      const response = await axios.post(`${API_URL}/api/deposits/create`, formDataToSend, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setSuccessMessage('✅ Deposit request submitted successfully!');
        setFormData({
          amount: '',
          paymentMethod: 'TELE_BIRR',
          transactionReference: '',
          notes: ''
        });
        setSelectedFile(null);
        setPreviewUrl(null);
        setSelectedBank(null);
        setShowBankDetails(false);
        fetchRecentDeposits();
      }
    } catch (error) {
      console.error('Deposit error:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to submit deposit request');
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
      pending: { class: 'status-pending', text: '⏳ Pending', icon: '⏳' },
      approved: { class: 'status-approved', text: '✅ Approved', icon: '✅' },
      rejected: { class: 'status-rejected', text: '❌ Rejected', icon: '❌' }
    };
    const badge = badges[status] || badges.pending;
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  return (
    <div className="deposit-container">
      {/* Header */}
      <div className="deposit-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            ← Back
          </button>
          <h1>💰 Deposit Funds</h1>
        </div>
        <div className="header-right">
          <span className="balance-display">
            Balance: <strong>ETB {user?.wallet?.balance?.toFixed(2) || '0.00'}</strong>
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

      <div className="deposit-content">
        {/* Step 1: Select Payment Method */}
        <div className="step-section">
          <div className="step-header">
            <span className="step-number">1</span>
            <h3>Select Payment Method</h3>
          </div>
          <div className="bank-grid">
            {bankDetails.map((bank) => (
              <div
                key={bank.id}
                className={`bank-card ${selectedBank?.id === bank.id ? 'selected' : ''} ${bank.recommended ? 'recommended' : ''}`}
                onClick={() => handleSelectBank(bank)}
                style={{ 
                  borderColor: selectedBank?.id === bank.id ? bank.color : '#e0e0e0',
                  borderWidth: bank.recommended && selectedBank?.id !== bank.id ? '2px' : '2px'
                }}
              >
                {bank.recommended && (
                  <div className="recommended-badge">
                    ⭐ Recommended
                  </div>
                )}
                <div className="bank-logo-wrapper" style={{ background: bank.bgColor }}>
                  <img src={bank.logo} alt={bank.bank} className="bank-logo-img" />
                </div>
                <h4>{bank.bank}</h4>
                <p className="account-number-short">{bank.accountNumber}</p>
                {selectedBank?.id === bank.id && (
                  <span className="selected-check">✓ Selected</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 2: Account Details */}
        {showBankDetails && selectedBank && (
          <div className="step-section bank-details-section">
            <div className="step-header">
              <span className="step-number">2</span>
              <h3>Account Details</h3>
            </div>
            <div className="bank-details-card" style={{ borderColor: selectedBank.color }}>
              <div className="bank-details-header">
                <img src={selectedBank.logo} alt={selectedBank.bank} className="bank-detail-logo" />
                <div>
                  <h4>{selectedBank.bank}</h4>
                  <p className="branch-text">🏦 {selectedBank.branch}</p>
                  {selectedBank.recommended && (
                    <span className="recommended-tag">⭐ Recommended</span>
                  )}
                </div>
              </div>
              <div className="bank-details-body">
                <div className="detail-row">
                  <span className="detail-label">Account Name</span>
                  <span className="detail-value">{selectedBank.accountName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Account Number</span>
                  <div className="account-number-wrapper">
                    <span className="detail-value account-number">{selectedBank.accountNumber}</span>
                    <button
                      className="copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedBank.accountNumber);
                        setSuccessMessage('✅ Account number copied!');
                        setTimeout(() => setSuccessMessage(''), 3000);
                      }}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>
              <div className="bank-details-footer">
                <p>💡 Send the exact amount and use your username as reference</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Submit Form */}
        <div className="step-section form-section">
          <div className="step-header">
            <span className="step-number">3</span>
            <h3>Submit Deposit Request</h3>
          </div>

          <form onSubmit={handleSubmit} className="deposit-form">
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
                    step="1"
                    required
                  />
                </div>
                <small>Minimum deposit: ETB 50</small>
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                  required
                >
                  <option value="TELE_BIRR">📱 Tele Birr</option>
                  <option value="MOBILE_MONEY">📱 Mobile Money (CBE Birr)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Transaction ID</label>
                <input
                  type="text"
                  name="transactionReference"
                  value={formData.transactionReference}
                  onChange={handleInputChange}
                  placeholder="Enter Transaction ID"
                />
              </div>

              <div className="form-group">
                <label>Additional Notes</label>
                <input
                  type="text"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="form-group full-width">
              <label>Upload Payment Screenshot *</label>
              <div className="file-upload-area">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="file-input"
                  required
                />
                <div className="upload-content">
                  <span className="upload-icon">📸</span>
                  <p>Click or drag to upload screenshot</p>
                  <small>JPG, PNG, GIF (max 5MB)</small>
                </div>
              </div>
              {previewUrl && (
                <div className="image-preview-wrapper">
                  <div className="image-preview">
                    <img src={previewUrl} alt="Preview" />
                    <button
                      type="button"
                      className="remove-image"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                    >
                      ✖
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                '📤 Submit Deposit Request'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Recent Deposits */}
      {recentDeposits.length > 0 && (
        <div className="recent-deposits">
          <div className="recent-header">
            <h3>📊 Recent Deposit Requests</h3>
            <span className="recent-count">{recentDeposits.length} requests</span>
          </div>
          <div className="deposits-table-wrapper">
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
                {recentDeposits.map((deposit) => (
                  <tr key={deposit._id}>
                    <td>{formatDate(deposit.createdAt)}</td>
                    <td><strong>ETB {deposit.amount}</strong></td>
                    <td>{deposit.paymentMethod}</td>
                    <td>{getStatusBadge(deposit.status)}</td>
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

export default Deposit;