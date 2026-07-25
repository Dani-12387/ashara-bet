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

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setUser(response.data.user);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
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
      const response = await axios.post('/api/user/change-password', {
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
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to change password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  if (loading) {
    return <div className="simple-loading">Loading...</div>;
  }

  return (
    <div className="simple-account-container">
      {/* Header */}
      <div className="simple-header">
        <h1>My Account</h1>
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

      {/* Account Info Card */}
      <div className="simple-info-card">
        <div className="simple-avatar">
          {user?.username?.charAt(0).toUpperCase()}
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