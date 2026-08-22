import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import './AdminLayout.css';

const AdminLayout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="admin-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <h2>Ashara<span>Bet</span></h2>
          </div>
          <p className="sidebar-subtitle">Admin Panel</p>
        </div>
        
        <nav className="sidebar-nav">
          <ul>
            <li>
              <Link to="/admin/dashboard" className="nav-link">
                <span className="icon">📊</span> Dashboard
              </Link>
            </li>
            <li>
              <Link to="/admin/users" className="nav-link">
                <span className="icon">👥</span> User Management
              </Link>
            </li>
            <li>
              <Link to="/admin/transactions" className="nav-link">
                <span className="icon">💰</span> Deposit Management
              </Link>
            </li>
            <li>
              <Link to="/admin/withdrawals" className="nav-link">
                <span className="icon">💸</span> Withdrawals
              </Link>
            </li>
            <li>
              <Link to="/admin/bets" className="nav-link">
                <span className="icon">📊</span> Bet Management
              </Link>
            </li>
            <li>
              <Link to="/admin/matches" className="nav-link">
                <span className="icon">⚽</span> Matches Management
              </Link>
            </li>
            <li>
              <Link to="/admin/odds" className="nav-link">
                <span className="icon">📈</span> Odds Management
              </Link>
            </li>

            <li>
  <Link to="/admin/aviator">
    <span>✈️</span> Aviator Management
  </Link>
</li>


            <li>
              <Link to="/admin/reports" className="nav-link">
                <span className="icon">📋</span> Reports
              </Link>
            </li>
            <li>
              <Link to="/admin/bonuses" className="nav-link">
                <span className="icon">🎁</span> Bonuses
              </Link>
            </li>
            <li>
              <Link to="/admin/content" className="nav-link">
                <span className="icon">📝</span> Content
              </Link>
            </li>
            <li>
              <Link to="/admin/settings" className="nav-link">
                <span className="icon">⚙️</span> Settings
              </Link>
            </li>
            <li>
              <Link to="/admin/support" className="nav-link">
                <span className="icon">🎧</span> Support
              </Link>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            <span className="icon">🚪</span> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="top-header">
          <div className="header-title">
            <h1>Admin Dashboard</h1>
          </div>
          <div className="header-user">
            <span className="user-name">Admin</span>
            <span className="user-avatar">👤</span>
          </div>
        </div>
        
        <div className="content-area">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;