import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: ''  // ✅ NEW – added
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const { username, email, phone, password, confirmPassword, referralCode } = formData;

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear errors when user starts typing
    setError('');
  };

  const validateForm = () => {
    if (!username || !email || !phone || !password || !confirmPassword) {
      setError('All fields are required');
      return false;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }

    if (username.length > 20) {
      setError('Username must be less than 20 characters');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Phone validation - Ethiopian phone numbers
    const phoneRegex = /^(09|07)\d{8}$/;
    if (!phoneRegex.test(phone)) {
      setError('Please enter a valid Ethiopian phone number (09xxxxxxxx or 07xxxxxxxx)');
      return false;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // ✅ Send referralCode if provided
      const payload = {
        username,
        email,
        phone,
        password,
        referralCode: referralCode.trim() || undefined
      };

      const response = await axios.post(`${API_URL}/api/auth/register`, payload);

      if (response.data.success) {
        setSuccess('Registration successful! Redirecting to login...');
        
        setFormData({
          username: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: '',
          referralCode: ''
        });

        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goToHome = () => {
    navigate('/');
  };

  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.slice(0, 10);
    return limited;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({
      ...formData,
      phone: formatted
    });
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <button className="home-button" onClick={goToHome}>
          ← Back to Home
        </button>

        <div className="register-logo" onClick={goToHome}>
          AsharaBet
        </div>

        <h2>Create Account</h2>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <span className="success-icon">✅</span>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div className="form-group">
            <label htmlFor="username">
              <span className="label-icon">👤</span>
              Username
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="username"
                name="username"
                value={username}
                onChange={handleChange}
                placeholder="Enter your username"
                className={error && !username ? 'error' : ''}
                disabled={loading}
              />
              {username && username.length >= 3 && (
                <span className="input-valid">✓</span>
              )}
            </div>
            {username && username.length > 0 && username.length < 3 && (
              <div className="input-hint">Username must be at least 3 characters</div>
            )}
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">
              <span className="label-icon">📧</span>
              Email
            </label>
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={handleChange}
                placeholder="Enter your email"
                className={error && !email ? 'error' : ''}
                disabled={loading}
              />
              {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                <span className="input-valid">✓</span>
              )}
            </div>
            {email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
              <div className="input-hint">Please enter a valid email</div>
            )}
          </div>

          {/* Phone */}
          <div className="form-group">
            <label htmlFor="phone">
              <span className="label-icon">📱</span>
              Phone Number
            </label>
            <div className="input-wrapper">
              <input
                type="tel"
                id="phone"
                name="phone"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="09xxxxxxxx or 07xxxxxxxx"
                className={error && !phone ? 'error' : ''}
                disabled={loading}
                maxLength="10"
              />
              {phone && phone.length === 10 && /^(09|07)\d{8}$/.test(phone) && (
                <span className="input-valid">✓</span>
              )}
            </div>
            {phone && phone.length > 0 && phone.length < 10 && (
              <div className="input-hint">{phone.length}/10 digits</div>
            )}
            {phone && phone.length === 10 && !/^(09|07)\d{8}$/.test(phone) && (
              <div className="input-hint">Must start with 09 or 07</div>
            )}
            <small className="phone-hint">Ethiopian phone number (09 or 07 followed by 8 digits)</small>
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">
              <span className="label-icon">🔒</span>
              Password
            </label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={password}
                onChange={handleChange}
                placeholder="Enter your password (min. 6 characters)"
                className={error && !password ? 'error' : ''}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {password && (
              <div className={`password-length ${password.length >= 6 ? 'valid' : 'invalid'}`}>
                <div className="length-bar">
                  <div 
                    className="length-fill" 
                    style={{ width: `${Math.min((password.length / 6) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="length-text">
                  {password.length >= 6 
                    ? '✓ Password length ok' 
                    : `${password.length}/6 characters`}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="confirmPassword">
              <span className="label-icon">🔒</span>
              Confirm Password
            </label>
            <div className="input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                className={error && !confirmPassword ? 'error' : ''}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex="-1"
              >
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <div className="password-match-error">✗ Passwords do not match</div>
            )}
            {confirmPassword && password === confirmPassword && password.length >= 6 && (
              <div className="password-match-success">✓ Passwords match</div>
            )}
          </div>

          {/* ✅ REFERRAL CODE FIELD - ADDED (nothing removed) */}
          <div className="form-group">
            <label htmlFor="referralCode">
              <span className="label-icon">🎁</span>
              Referral Code <span style={{ fontWeight: 'normal', color: '#888', fontSize: '0.8rem' }}>(optional)</span>
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="referralCode"
                name="referralCode"
                value={referralCode}
                onChange={handleChange}
                placeholder="Enter referral code if you have one"
                className={error && !referralCode ? 'error' : ''}
                disabled={loading}
              />
            </div>
            <small className="phone-hint">Enter the code of the person who referred you</small>
          </div>

          <div className="simple-requirements">
            <ul>
              <li className={password.length >= 6 ? 'met' : ''}>
                <span>{password.length >= 6 ? '✓' : '○'}</span>
                Password At least 6 characters
              </li>
            </ul>
          </div>

          <button 
            type="submit" 
            className="register-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>

          <p className="login-link">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>

          <p className="terms-text">
            By creating an account, you agree to our{' '}
            <a href="/terms" onClick={(e) => { e.preventDefault(); alert('Terms of Service - Coming soon'); }}>Terms of Service</a> and{' '}
            <a href="/privacy" onClick={(e) => { e.preventDefault(); alert('Privacy Policy - Coming soon'); }}>Privacy Policy</a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;