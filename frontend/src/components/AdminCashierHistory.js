import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminCashierHistory.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AdminCashierHistory = () => {
  const { cashierId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('users');

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  useEffect(() => {
    if (cashierId) fetchCashierDetails();
  }, [cashierId]);

  const fetchCashierDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(
        `${API_URL}/api/cashier/admin/cashier/${cashierId}/referrals`,
        authHeaders()
      );
      if (res.data.success) {
        console.log('📊 Cashier details loaded:', res.data.data);
        setData(res.data.data);
      } else {
        setError(res.data.message || 'Failed to load cashier details');
      }
    } catch (err) {
      console.error('Fetch cashier details error:', err);
      setError(err.response?.data?.message || 'Failed to load cashier details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="cashier-history-loading">
        <div className="spinner-large"></div>
        <p>Loading cashier details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="cashier-history-error">
        <p>❌ {error || 'No data available'}</p>
        <button onClick={() => navigate('/admin/cashiers')}>
          ← Back to Cashier Management
        </button>
      </div>
    );
  }

  // ✅ NORMALIZE DATA — handle both old and new backend response shapes
  const cashier = data.cashier || {};
  const users = data.users || [];

  // If backend sent summary, use it; otherwise compute from users array
  const summary = data.summary || (() => {
    const grandTotalDeposits = users.reduce((s, u) => s + Number(u.totalDeposits || 0), 0);
    const grandTotalWithdrawals = users.reduce((s, u) => s + Number(u.totalWithdrawals || 0), 0);
    const grandTotalBalance = users.reduce((s, u) => s + Number(u.balance || 0), 0);

    return {
      totalReferrals: users.length,
      grandTotalDeposits,
      grandTotalWithdrawals,
      grandTotalBalance,
      netFlow: grandTotalDeposits - grandTotalWithdrawals,
      totalDepositsProcessed: users.reduce((s, u) => s + Number(u.depositCount || 0), 0),
      totalWithdrawalsProcessed: users.reduce((s, u) => s + Number(u.withdrawalCount || 0), 0)
    };
  })();

  // ✅ These may be missing on old backend — default to []
  const deposits = data.deposits || [];
  const withdrawals = data.withdrawals || [];

  // Add computed netFlow to each user if missing
  const usersWithNetFlow = users.map(u => ({
    ...u,
    netFlow: u.netFlow !== undefined
      ? u.netFlow
      : (Number(u.totalDeposits || 0) - Number(u.totalWithdrawals || 0))
  }));

  return (
    <div className="admin-cashier-history">
      <div className="history-page-header">
        <button className="back-btn" onClick={() => navigate('/admin/cashiers')}>
          ← Back
        </button>
        <h1>💰 Cashier Details</h1>
      </div>

      {/* Profile Card */}
      <div className="cashier-profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {cashier.username?.charAt(0).toUpperCase() || 'C'}
          </div>
          <div className="profile-info">
            <h2>{cashier.username || 'Unknown'}</h2>
            <p className="profile-email">📧 {cashier.email || 'N/A'}</p>
            <p className="profile-phone">📱 {cashier.phone || 'N/A'}</p>
            <div className="profile-badges">
              <span className="badge role-badge">
                {cashier.role === 'admin' ? '👑 Admin' : '💰 Cashier'}
              </span>
              <span className={`badge status-${cashier.status || 'active'}`}>
                {cashier.status || 'active'}
              </span>
              <span className="badge code-badge">
                🎁 {cashier.referralCode || 'N/A'}
              </span>
            </div>
          </div>
          <div className="profile-right">
            <div className="cashier-balance">
              <small>Cashier Balance</small>
              <strong>ETB {Number(cashier.balance || 0).toFixed(2)}</strong>
            </div>
            <div className="cashier-joined">
              <small>Joined</small>
              <strong>{formatDateShort(cashier.joinedAt)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="summary-grid">
        <div className="stat-card blue">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <small>Total Referrals</small>
            <strong>{summary.totalReferrals}</strong>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <small>Total Deposits</small>
            <strong>ETB {Number(summary.grandTotalDeposits || 0).toFixed(2)}</strong>
          </div>
        </div>

        <div className="stat-card red">
          <div className="stat-icon">💸</div>
          <div className="stat-content">
            <small>Total Withdrawals</small>
            <strong>-ETB {Number(summary.grandTotalWithdrawals || 0).toFixed(2)}</strong>
          </div>
        </div>

        <div className="stat-card orange">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <small>Net Flow</small>
            <strong>
              {(() => {
                const net = Number(summary.netFlow || 0);
                return net >= 0
                  ? `ETB ${net.toFixed(2)}`
                  : `-ETB ${Math.abs(net).toFixed(2)}`;
              })()}
            </strong>
          </div>
        </div>

        <div className="stat-card purple">
          <div className="stat-icon">💼</div>
          <div className="stat-content">
            <small>Total Balance</small>
            <strong>ETB {Number(summary.grandTotalBalance || 0).toFixed(2)}</strong>
          </div>
        </div>

        <div className="stat-card teal">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <small>Processed</small>
            <strong>
              {summary.totalDepositsProcessed || 0} dep / {summary.totalWithdrawalsProcessed || 0} wd
            </strong>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="history-tabs">
        <button
          className={tab === 'users' ? 'active' : ''}
          onClick={() => setTab('users')}
        >
          👥 Referred Users ({usersWithNetFlow.length})
        </button>
        <button
          className={tab === 'deposits' ? 'active' : ''}
          onClick={() => setTab('deposits')}
        >
          💵 Deposits Created ({deposits.length})
        </button>
        <button
          className={tab === 'withdrawals' ? 'active' : ''}
          onClick={() => setTab('withdrawals')}
        >
          💸 Withdrawals Created ({withdrawals.length})
        </button>
      </div>

      <div className="history-tab-content">

        {/* REFERRED USERS */}
        {tab === 'users' && (
          <>
            {usersWithNetFlow.length === 0 ? (
              <div className="empty-state">
                <p>No users have registered with this cashier's referral link yet.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Joined</th>
                      <th>Balance</th>
                      <th>Deposits</th>
                      <th>Withdrawals</th>
                      <th>Net Flow</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersWithNetFlow.map((u, i) => (
                      <tr key={u._id}>
                        <td>{i + 1}</td>
                        <td className="cell-username">{u.username}</td>
                        <td className="cell-email">{u.email}</td>
                        <td>{u.phone || 'N/A'}</td>
                        <td>{formatDateShort(u.joinedAt)}</td>
                        <td className="cell-balance">ETB {Number(u.balance || 0).toFixed(2)}</td>
                        <td className="cell-deposit">
                          ETB {Number(u.totalDeposits || 0).toFixed(2)}
                          <small> ({u.depositCount || 0})</small>
                        </td>
                        <td className="cell-withdraw">
                          -ETB {Number(u.totalWithdrawals || 0).toFixed(2)}
                          <small> ({u.withdrawalCount || 0})</small>
                        </td>
                        <td className={`cell-netflow ${u.netFlow >= 0 ? 'positive' : 'negative'}`}>
                          {u.netFlow >= 0
                            ? `ETB ${u.netFlow.toFixed(2)}`
                            : `-ETB ${Math.abs(u.netFlow).toFixed(2)}`}
                        </td>
                        <td>
                          <span className={`status-badge status-${u.status || 'active'}`}>
                            {u.status || 'active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* DEPOSITS */}
        {tab === 'deposits' && (
          <>
            {deposits.length === 0 ? (
              <div className="empty-state">
                <p>
                  {data.deposits === undefined
                    ? 'Deposit history is not available for this backend version.'
                    : 'This cashier hasn\'t created any deposits yet.'}
                </p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>User</th>
                      <th>Email</th>
                      <th>Amount</th>
                      <th>Reference</th>
                      <th>Agent Code</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((d, i) => (
                      <tr key={d._id}>
                        <td>{i + 1}</td>
                        <td className="cell-username">{d.user?.username || 'N/A'}</td>
                        <td className="cell-email">{d.user?.email || 'N/A'}</td>
                        <td className="cell-deposit">ETB {Number(d.amount).toFixed(2)}</td>
                        <td className="cell-ref">{d.transactionReference || 'N/A'}</td>
                        <td className="cell-notes">
                          {d.notes ? d.notes.replace('Agent Code: ', '').split(' | ')[0] : 'N/A'}
                        </td>
                        <td>{formatDate(d.createdAt)}</td>
                        <td>
                          <span className={`status-badge status-${d.status}`}>{d.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* WITHDRAWALS */}
        {tab === 'withdrawals' && (
          <>
            {withdrawals.length === 0 ? (
              <div className="empty-state">
                <p>
                  {data.withdrawals === undefined
                    ? 'Withdrawal history is not available for this backend version.'
                    : 'This cashier hasn\'t created any withdrawals yet.'}
                </p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>User</th>
                      <th>Email</th>
                      <th>Amount</th>
                      <th>Agent Code</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w, i) => (
                      <tr key={w._id}>
                        <td>{i + 1}</td>
                        <td className="cell-username">{w.user?.username || 'N/A'}</td>
                        <td className="cell-email">{w.user?.email || 'N/A'}</td>
                        <td className="cell-withdraw">-ETB {Number(w.amount).toFixed(2)}</td>
                        <td className="cell-notes">
                          {w.notes ? w.notes.replace('Agent Code: ', '').split(' | ')[0] : 'N/A'}
                        </td>
                        <td>{formatDate(w.createdAt)}</td>
                        <td>
                          <span className={`status-badge status-${w.status}`}>{w.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminCashierHistory;