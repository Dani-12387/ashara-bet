import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import Dashboard from './components/Dashboard';
import UserManagement from './components/UserManagement';
import HomePage from './components/HomePage';
import AboutPage from './components/AboutPage'; // ← ADD THIS
import Login from './components/Login';
import Register from './components/Register';
import MyAccount from './components/MyAccount';
import Deposit from './components/Deposit';
import Withdraw from './components/Withdraw';
import AdminTransactions from './components/AdminTransactions';
import AdminWithdrawals from './components/AdminWithdrawals';
import MatchesManagement from './components/MatchesManagement';
import AdminBets from './components/AdminBets';
import BetHistory from './components/BetHistory';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Admin Route Component
const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} /> {/* ← ADD THIS ROUTE */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected User Routes */}
        <Route path="/MyAccount" element={
          <ProtectedRoute>
            <MyAccount />
          </ProtectedRoute>
        } />
        
        <Route path="/deposit" element={
          <ProtectedRoute>
            <Deposit />
          </ProtectedRoute>
        } />

        <Route path="/withdraw" element={
          <ProtectedRoute>
            <Withdraw />
          </ProtectedRoute>
        } />

        <Route path="/bet-history" element={
          <ProtectedRoute>
            <BetHistory />
          </ProtectedRoute>
        } />

        <Route path="/matches" element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        } />
        
        {/* Admin Routes - Protected */}
        <Route path="/admin" element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
          <Route path="bets" element={<AdminBets />} />
          <Route path="matches" element={<MatchesManagement />} />
          <Route path="odds" element={<div style={{ padding: '20px', color: '#fff' }}>Odds Management Page</div>} />
          <Route path="reports" element={<div style={{ padding: '20px', color: '#fff' }}>Reports Page</div>} />
          <Route path="bonuses" element={<div style={{ padding: '20px', color: '#fff' }}>Bonuses Page</div>} />
          <Route path="content" element={<div style={{ padding: '20px', color: '#fff' }}>Content Page</div>} />
          <Route path="settings" element={<div style={{ padding: '20px', color: '#fff' }}>Settings Page</div>} />
          <Route path="support" element={<div style={{ padding: '20px', color: '#fff' }}>Support Page</div>} />
        </Route>

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;