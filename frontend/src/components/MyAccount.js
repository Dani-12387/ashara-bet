import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './MyAccount.css';

const MyAccount = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // ✅ API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // ✅ FIXED: Use API_URL and handle response format
  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching profile with token:', token ? 'Token exists' : 'No token');
      
      const response = await axios.get(`${API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Profile response:', response.data);
      
      if (response.data.success) {
        setUser(response.data.user);
      } else {
        // If success is false but user data might be in a different format
        if (response.data.user) {
          setUser(response.data.user);
        } else {
          // Try to get user from response directly
          setUser(response.data);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      
      // Try to get user from localStorage as fallback
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          setUser(JSON.parse(userData));
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }
      
      setLoading(false);
    }
  };

  // ✅ FIXED: Use API_URL
  const fetchWalletBalance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/user/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Balance response:', response.data);
      
      // Handle different response formats
      let balanceData = response.data;
      if (response.data.success) {
        balanceData = response.data;
      }
      
      setUser(prevUser => ({
        ...prevUser,
        wallet: {
          balance: balanceData.balance || 0,
          bonusBalance: balanceData.bonusBalance || 0,
          lockedBalance: balanceData.lockedBalance || 0
        }
      }));
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords({
      ...showPasswords,
      [field]: !showPasswords[field]
    });
  };

  // ✅ FIXED: Use API_URL
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    // Validation
    if (passwordData.newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/user/change-password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccessMessage('Password changed successfully!');
        setShowChangePassword(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(response.data.message || 'Failed to change password');
      }
    } catch (error) {
      console.error('Password change error:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to change password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const formatCurrency = (amount) => {
    return `ETB ${parseFloat(amount || 0).toFixed(2)}`;
  };

  if (loading) {
    return <div className="simple-loading">Loading...</div>;
  }

  return (
    <div className="simple-account-container">
      {/* Header */}
      <div className="simple-header">
        <h1>👤 My Account</h1>
        <button className="simple-home-btn" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="simple-success">
          <span>✅</span> {successMessage}
        </div>
      )}
      
      {errorMessage && (
        <div className="simple-error">
          <span>⚠️</span> {errorMessage}
        </div>
      )}

      {/* Balance Card */}
      <div className="simple-balance-card">
        <div className="balance-header">
          <span className="balance-icon">💰</span>
          <span className="balance-label">Your Balance</span>
        </div>
        <div className="balance-amount">{formatCurrency(user?.wallet?.balance || 0)}</div>
        <div className="balance-details">
          <div className="balance-detail-item">
            <span className="detail-label">Bonus Balance</span>
            <span className="detail-value">{formatCurrency(user?.wallet?.bonusBalance || 0)}</span>
          </div>
          <div className="balance-detail-item">
            <span className="detail-label">Locked Balance</span>
            <span className="detail-value">{formatCurrency(user?.wallet?.lockedBalance || 0)}</span>
          </div>
        </div>
        <button 
          className="simple-refresh-balance-btn"
          onClick={fetchWalletBalance}
        >
          🔄 Refresh Balance
        </button>
      </div>

      {/* Account Info Card */}
      <div className="simple-info-card">
        <div className="simple-avatar">
          {user?.username?.charAt(0).toUpperCase() || '?'}
        </div>
        
        <div className="simple-details">
          <div className="simple-row">
            <span className="simple-label">Username:</span>
            <span className="simple-value">{user?.username || 'Not set'}</span>
          </div>
          
          <div className="simple-row">
            <span className="simple-label">Email:</span>
            <span className="simple-value">{user?.email || 'Not set'}</span>
          </div>
          
          <div className="simple-row">
            <span className="simple-label">Phone:</span>
            <span className="simple-value">{user?.phone || 'Not set'}</span>
          </div>

          <div className="simple-row">
            <span className="simple-label">Role:</span>
            <span className="simple-value role-badge">{user?.role || 'User'}</span>
          </div>
        </div>

        <div className="simple-actions">
          <button 
            className="simple-change-password-btn"
            onClick={() => setShowChangePassword(!showChangePassword)}
          >
            🔒 {showChangePassword ? 'Cancel' : 'Change Password'}
          </button>
          
          <button className="simple-logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Change Password Form */}
      {showChangePassword && (
        <div className="simple-password-card">
          <h3>Change Password</h3>
          
          <form onSubmit={handleChangePassword}>
            {/* Current Password */}
            <div className="simple-form-group">
              <label>Current Password</label>
              <div className="simple-password-input">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  className="simple-toggle-password"
                  onClick={() => togglePasswordVisibility('current')}
                >
                  {showPasswords.current ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="simple-form-group">
              <label>New Password</label>
              <div className="simple-password-input">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  required
                  placeholder="Enter new password (min. 6 characters)"
                />
                <button
                  type="button"
                  className="simple-toggle-password"
                  onClick={() => togglePasswordVisibility('new')}
                >
                  {showPasswords.new ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {passwordData.newPassword && passwordData.newPassword.length < 6 && (
                <small className="simple-hint">Password must be at least 6 characters</small>
              )}
            </div>

            {/* Confirm Password */}
            <div className="simple-form-group">
              <label>Confirm New Password</label>
              <div className="simple-password-input">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  className="simple-toggle-password"
                  onClick={() => togglePasswordVisibility('confirm')}
                >
                  {showPasswords.confirm ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                <small className="simple-hint error">Passwords do not match</small>
              )}
            </div>

            <div className="simple-form-actions">
              <button type="submit" className="simple-submit-btn">
                Update Password
              </button>
              <button 
                type="button" 
                className="simple-cancel-btn"
                onClick={() => setShowChangePassword(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default MyAccount;