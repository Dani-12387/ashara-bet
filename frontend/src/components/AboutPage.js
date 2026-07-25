import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AboutPage.css';

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <div className="about-page">
      {/* Header */}
      <header className="about-header">
        <div className="about-header-inner">
          <div className="about-logo" onClick={() => navigate('/')}>
            <span className="about-logo-icon">⚡</span>
            <span className="about-logo-text">Ashara<span>Bet</span></span>
          </div>
          <button className="about-back-btn" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="about-hero">
        <div className="about-hero-content">
          <h1>About AsharaBet</h1>
          <p>Your Premier Betting Platform in Ethiopia</p>
        </div>
      </section>

      {/* Main Content */}
      <div className="about-container">
        {/* Our Story */}
        <div className="about-section">
          <div className="about-section-icon">📖</div>
          
        </div>

        {/* Our Mission */}
       

        {/* What We Offer */}
        <div className="about-section">
          <div className="about-section-icon">⚽</div>
          <h2>What We Offer</h2>
          <div className="about-features-grid">
            <div className="about-feature-card">
              <span className="about-feature-icon">🏆</span>
              <h4>Wide Range of Sports</h4>
              <p>Football, Basketball, Tennis, Cricket & more</p>
            </div>
            <div className="about-feature-card">
              <span className="about-feature-icon">📊</span>
              <h4>Competitive Odds</h4>
              <p>Best odds in the market for maximum returns</p>
            </div>
            <div className="about-feature-card">
              <span className="about-feature-icon">🔒</span>
              <h4>Secure Platform</h4>
              <p>Your data and transactions are always safe</p>
            </div>
            <div className="about-feature-card">
              <span className="about-feature-icon">📱</span>
              <h4>Mobile Friendly</h4>
              <p>Bet anytime, anywhere on any device</p>
            </div>
            <div className="about-feature-card">
              <span className="about-feature-icon">⚡</span>
              <h4>Live Betting</h4>
              <p>Real-time odds on live matches</p>
            </div>
            <div className="about-feature-card">
              <span className="about-feature-icon">💰</span>
              <h4>Quick Withdrawals</h4>
              <p>Fast and hassle-free withdrawals</p>
            </div>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="about-section">
          <div className="about-section-icon">⭐</div>
          <h2>Why Choose AsharaBet?</h2>
          <ul className="about-list">
            <li>
              <span className="about-list-icon">✅</span>
              <div>
                <strong>Licensed & Regulated</strong>
                <p>Operating under Ethiopian laws and regulations</p>
              </div>
            </li>
            <li>
              <span className="about-list-icon">✅</span>
              <div>
                <strong>Local Support</strong>
                <p>Dedicated customer support in Amharic and English</p>
              </div>
            </li>
            <li>
              <span className="about-list-icon">✅</span>
              <div>
                <strong>Ethiopian Payment Methods</strong>
                <p>Easy deposits and withdrawals with local banks</p>
              </div>
            </li>
            <li>
              <span className="about-list-icon">✅</span>
              <div>
                <strong>Responsible Gambling</strong>
                <p>We promote safe and responsible betting practices</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Our Values */}
        <div className="about-section">
          <div className="about-section-icon">💎</div>
          <h2>Our Core Values</h2>
          <div className="about-values-grid">
            <div className="about-value-item">
              <span className="about-value-number">01</span>
              <h4>Integrity</h4>
              <p>We operate with honesty and transparency</p>
            </div>
            <div className="about-value-item">
              <span className="about-value-number">02</span>
              <h4>Innovation</h4>
              <p>Constantly improving our platform</p>
            </div>
            <div className="about-value-item">
              <span className="about-value-number">03</span>
              <h4>Customer First</h4>
              <p>Your satisfaction is our priority</p>
            </div>
            <div className="about-value-item">
              <span className="about-value-number">04</span>
              <h4>Community</h4>
              <p>Building a strong betting community</p>
            </div>
          </div>
        </div>

        {/* Join Us */}
        <div className="about-section about-join">
          <div className="about-section-icon">🤝</div>
          <h2>Join the AsharaBet Community</h2>
          <p>
            Whether you're a seasoned bettor or just starting out, AsharaBet is the perfect place 
            to enjoy sports betting. Join thousands of satisfied users and experience the best 
            betting platform Ethiopia has to offer.
          </p>
          <div className="about-join-buttons">
            <button className="about-join-btn" onClick={() => navigate('/register')}>
              Create Account
            </button>
            <button className="about-learn-btn" onClick={() => navigate('/')}>
              Start Betting
            </button>
          </div>
        </div>

        {/* Contact */}
        <div className="about-section about-contact">
          <div className="about-section-icon">📞</div>
          <h2>Get in Touch</h2>
          <p>Have questions or need support? We're here to help!</p>
          <div className="about-contact-info">
            {/* ✅ Email - Opens email client */}
            

            {/* ✅ Phone - Opens dialer */}
            <a href="tel:+251943419247" className="about-contact-link">
              <div className="about-contact-item">
                <span>📱</span>
                <span>+251 94 341 9247</span>
              </div>
            </a>

            {/* ✅ Telegram - Opens Telegram app */}
            <a href="https://t.me/Asharabetsupport" target="_blank" rel="noopener noreferrer" className="about-contact-link">
              <div className="about-contact-item">
                <span>💬</span>
                <span>@Asharabetsupport</span>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="about-footer">
        <div className="about-footer-content">
          <div className="about-footer-brand">
            <span className="about-footer-logo">⚡ AsharaBet</span>
            <p>© 2026 AsharaBet. All rights reserved.</p>
          </div>
          <div className="about-footer-links">
            <a href="#">Terms & Conditions</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Responsible Gambling</a>
            <a href="#">Contact Us</a>
          </div>
          <div className="about-footer-social">
            <span className="about-social-icon">📱</span>
            <span className="about-social-icon">🐦</span>
            <span className="about-social-icon">📘</span>
            <span className="about-social-icon">📷</span>
          </div>
        </div>
        <div className="about-footer-disclaimer">
          <p>⚠️ 18+ Only | Bet Responsibly | For entertainment purposes only</p>
        </div>
      </footer>
    </div>
  );
};

export default AboutPage;