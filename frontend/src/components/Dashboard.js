import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingDeposits: 0,
    approvedDeposits: 0,
    totalDepositAmount: 0,
    totalWithdrawalAmount: 0,
    todayDeposits: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [error, setError] = useState(null);

  // ✅ ADD THIS - API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      
      // ✅ FIXED: Use API_URL
      let totalUsers = 0;
      try {
        const usersResponse = await axios.get(`${API_URL}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (Array.isArray(usersResponse.data)) {
          totalUsers = usersResponse.data.length;
        } else if (usersResponse.data && Array.isArray(usersResponse.data.users)) {
          totalUsers = usersResponse.data.users.length;
        } else if (usersResponse.data && usersResponse.data.data && Array.isArray(usersResponse.data.data)) {
          totalUsers = usersResponse.data.data.length;
        } else if (typeof usersResponse.data === 'object' && usersResponse.data !== null) {
          const userKeys = ['users', 'data', 'results', 'items'];
          for (const key of userKeys) {
            if (usersResponse.data[key] && Array.isArray(usersResponse.data[key])) {
              totalUsers = usersResponse.data[key].length;
              break;
            }
          }
        }
        
        console.log('Total users found:', totalUsers);
      } catch (e) {
        console.log('Users API not available:', e.message);
      }

      // ✅ FIXED: Use API_URL
      let transactionsData = [];
      try {
        const transactionsResponse = await axios.get(`${API_URL}/api/admin/transactions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (Array.isArray(transactionsResponse.data)) {
          transactionsData = transactionsResponse.data;
        } else if (transactionsResponse.data && Array.isArray(transactionsResponse.data.transactions)) {
          transactionsData = transactionsResponse.data.transactions;
        } else if (transactionsResponse.data && transactionsResponse.data.data && Array.isArray(transactionsResponse.data.data)) {
          transactionsData = transactionsResponse.data.data;
        }
        
        console.log('Transactions found:', transactionsData.length);
      } catch (e) {
        console.log('Transactions API not available:', e.message);
      }

      const deposits = transactionsData.filter(t => 
        t.paymentMethod || t.type === 'deposit' || t.type === 'DEPOSIT' || t.type === 'Deposit'
      );
      
      const withdrawals = transactionsData.filter(t => 
        t.type === 'withdrawal' || t.type === 'WITHDRAWAL' || t.type === 'Withdrawal'
      );
      
      const pendingDeposits = deposits.filter(t => 
        t.status === 'pending' || t.status === 'PENDING'
      ).length;
      
      const approvedDeposits = deposits.filter(t => 
        t.status === 'approved' || t.status === 'APPROVED' || t.status === 'completed' || t.status === 'COMPLETED'
      ).length;
      
      const totalDepositAmount = deposits
        .filter(t => t.status === 'approved' || t.status === 'APPROVED' || t.status === 'completed' || t.status === 'COMPLETED')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      
      const totalWithdrawalAmount = withdrawals
        .filter(t => t.status === 'approved' || t.status === 'APPROVED' || t.status === 'completed' || t.status === 'COMPLETED')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const today = new Date().toDateString();
      const todayDeposits = deposits.filter(t => {
        const date = new Date(t.createdAt);
        return date.toDateString() === today;
      }).length;

      setStats({
        totalUsers: totalUsers || 0,
        totalDeposits: deposits.length || 0,
        totalWithdrawals: withdrawals.length || 0,
        pendingDeposits: pendingDeposits || 0,
        approvedDeposits: approvedDeposits || 0,
        totalDepositAmount: totalDepositAmount || 0,
        totalWithdrawalAmount: totalWithdrawalAmount || 0,
        todayDeposits: todayDeposits || 0
      });
      
      setRecentTransactions(transactionsData.slice(0, 10));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { class: 'status pending', text: '⏳ Pending' },
      approved: { class: 'status won', text: '✅ Approved' },
      completed: { class: 'status won', text: '✅ Completed' },
      rejected: { class: 'status lost', text: '❌ Rejected' },
      cancelled: { class: 'status cancelled', text: '❌ Cancelled' }
    };
    const s = statusMap[status?.toLowerCase()] || statusMap.pending;
    return <span className={s.class}>{s.text}</span>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>⚠️ {error}</p>
        <button onClick={fetchDashboardData} className="retry-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Admin Dashboard</h1>
      
      <div className="stats-container">
        <div className="stat-card">
          <h3>Total Users</h3>
          <p className="stat-number">{formatNumber(stats.totalUsers)}</p>
          <p className="stat-label">Registered users</p>
        </div>
        
        <div className="stat-card">
          <h3>Total Deposits</h3>
          <p className="stat-number">{formatNumber(stats.totalDeposits)}</p>
          <p className="stat-label">All deposit requests</p>
        </div>
        
        <div className="stat-card">
          <h3>Pending Deposits</h3>
          <p className="stat-number">{formatNumber(stats.pendingDeposits)}</p>
          <p className="stat-label">Awaiting approval</p>
        </div>
        
        <div className="stat-card">
          <h3>Total Revenue</h3>
          <p className="stat-number">{formatCurrency(stats.totalDepositAmount)}</p>
          <p className="stat-label">Approved deposits</p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-small">
          <span>Approved Deposits:</span>
          <strong>{formatNumber(stats.approvedDeposits)}</strong>
        </div>
        <div className="stat-small">
          <span>Total Withdrawals:</span>
          <strong>{formatNumber(stats.totalWithdrawals)}</strong>
        </div>
        <div className="stat-small">
          <span>Today's Deposits:</span>
          <strong>{formatNumber(stats.todayDeposits)}</strong>
        </div>
      </div>

      <div className="section">
        <h2>Recent Transactions</h2>
        {recentTransactions.length === 0 ? (
          <p className="no-data">No recent transactions found</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx) => (
                <tr key={tx._id}>
                  <td>{tx.user?.username || tx.user?.email || tx.userId?.username || 'Unknown'}</td>
                  <td>{tx.paymentMethod ? 'Deposit' : tx.type || 'Transaction'}</td>
                  <td>{formatCurrency(tx.amount)}</td>
                  <td>{tx.paymentMethod || 'N/A'}</td>
                  <td>{getStatusBadge(tx.status)}</td>
                  <td>{formatDate(tx.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;