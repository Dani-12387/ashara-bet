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
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { username, email, phone, password, confirmPassword } = formData;

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

    // Simple password validation - just minimum 6 characters
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
      const response = await axios.post('/api/auth/register', {
        username,
        email,
        phone,  // Include phone number in registration
        password
      });

      if (response.data.success) {
        setSuccess('Registration successful! Redirecting to login...');
        
        // Clear form
        setFormData({
          username: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: ''
        });

        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goToHome = () => {
    navigate('/');
  };

  // Format phone number as user types
  const formatPhoneNumber = (value) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');
    // Limit to 10 digits
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
        {/* Home Button */}
        <button className="home-button" onClick={goToHome}>
          ← Back to Home
        </button>

        {/* Logo */}
        <div className="register-logo" onClick={goToHome}>
          AsharaBet
        </div>

        <h2>Create Account</h2>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="success-message">
            <span className="success-icon">✅</span>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username Field */}
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

          {/* Email Field */}
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

          {/* Phone Number Field - NEW */}
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

          {/* Password Field */}
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
            {/* Simple password length indicator */}
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

          {/* Confirm Password Field */}
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

          {/* Simple Password Requirements */}
          <div className="simple-requirements">
            <ul>
              <li className={password.length >= 6 ? 'met' : ''}>
                <span>{password.length >= 6 ? '✓' : '○'}</span>
                Password At least 6 characters
              </li>
            </ul>
          </div>

          {/* Submit Button */}
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

          {/* Login Link */}
          <p className="login-link">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>

          {/* Terms */}
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