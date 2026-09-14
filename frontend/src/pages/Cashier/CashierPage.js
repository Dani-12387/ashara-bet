import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CashierPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CashierPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('deposit');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ===== FORMS =====
  const [depositForm, setDepositForm] = useState({
    email: '',
    amount: '',
    notes: ''
  });
  const [withdrawForm, setWithdrawForm] = useState({
    email: '',
    amount: '',
    notes: ''
  });
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    initialBalance: '',
    agentCode: ''
  });
  const [report, setReport] = useState(null);
  const [reportRange, setReportRange] = useState({ startDate: '', endDate: '' });

  // ===== REFERRAL STATE =====
  const [referral, setReferral] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [copied, setCopied] = useState(false);

  // ===== HISTORY MODAL STATE =====
  const [historyModal, setHistoryModal] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'deposit' | 'withdrawal'

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) return navigate('/login');
    const parsed = JSON.parse(userData);
    if (parsed.role !== 'cashier' && parsed.role !== 'admin') {
      alert('Access denied. Cashier only.');
      return navigate('/');
    }
    setUser(parsed);
  }, [navigate]);

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const showMessage = (msg, isError = false) => {
    if (isError) setError(msg); else setMessage(msg);
    setTimeout(() => { setMessage(''); setError(''); }, 5000);
  };

  // ===== DEPOSIT =====
  const handleDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/cashier/deposit`, depositForm, authHeaders());
      if (res.data.success) {
        showMessage(res.data.message || '✅ Deposit request sent to admin for approval');
        setDepositForm({ email: '', amount: '', notes: '' });
      }
    } catch (err) {
      showMessage(err.response?.data?.message || 'Deposit failed', true);
    } finally { setLoading(false); }
  };

  // ===== WITHDRAW (min 50) =====
  const handleWithdraw = async (e) => {
    e.preventDefault();

    if (Number(withdrawForm.amount) < 50) {
      showMessage('Minimum withdrawal amount is ETB 50', true);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/cashier/withdraw`, withdrawForm, authHeaders());
      if (res.data.success) {
        showMessage(res.data.message || '✅ Withdraw request sent to admin for approval');
        setWithdrawForm({ email: '', amount: '', notes: '' });
      }
    } catch (err) {
      showMessage(err.response?.data?.message || 'Withdrawal failed', true);
    } finally { setLoading(false); }
  };

  // ===== ADD USER =====
  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/cashier/add-user`, userForm, authHeaders());
      if (res.data.success) {
        showMessage(res.data.message);
        setUserForm({ username: '', email: '', phone: '', password: '', initialBalance: '', agentCode: '' });
      }
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to create user', true);
    } finally { setLoading(false); }
  };

  // ===== REPORT =====
  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportRange.startDate) params.append('startDate', reportRange.startDate);
      if (reportRange.endDate) params.append('endDate', reportRange.endDate);

      const res = await axios.get(`${API_URL}/api/cashier/report?${params}`, authHeaders());
      setReport(res.data.data);
    } catch (err) {
      showMessage(err.response?.data?.message || 'Report failed', true);
    } finally { setLoading(false); }
  };

  // ===== REFERRAL LINK =====
  const loadReferralLink = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/cashier/referral-link`, authHeaders());
      if (res.data.success) setReferral(res.data.data);
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to load referral link', true);
    } finally { setLoading(false); }
  };

  // ===== MY REFERRALS =====
  const loadReferrals = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/cashier/my-referrals`, authHeaders());
      if (res.data.success) setReferrals(res.data.data);
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to load referrals', true);
    } finally { setLoading(false); }
  };

  // ===== COPY REFERRAL LINK =====
  const copyReferralLink = () => {
    if (!referral) return;
    navigator.clipboard.writeText(referral.referralLink).then(() => {
      setCopied(true);
      showMessage('✅ Referral link copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    });
  };

  // ===== LOAD USER HISTORY =====
  const openUserHistory = async (userId, username) => {
    setHistoryModal({ userId, username });
    setHistoryFilter('all');
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const res = await axios.get(
        `${API_URL}/api/cashier/referral-history/${userId}?type=all`,
        authHeaders()
      );
      if (res.data.success) setHistoryData(res.data.data);
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to load history', true);
      setHistoryModal(null);
    } finally { setHistoryLoading(false); }
  };

  // Load referral data when those tabs are opened
  useEffect(() => {
    if (tab === 'invite' && !referral) loadReferralLink();
    if (tab === 'referrals' && !referrals) loadReferrals();
  }, [tab]);

  if (!user) return null;

  // Helper to get filtered history
  const getFilteredHistory = () => {
    if (!historyData) return [];
    if (historyFilter === 'deposit') return historyData.deposits || [];
    if (historyFilter === 'withdrawal') return historyData.withdrawals || [];
    return historyData.combined || [];
  };

  return (
    <div className="cashier-page">
      {/* ===== HEADER ===== */}
      <header className="cashier-header">
        <div className="cashier-logo">💰 AsharaBet Cashier</div>
        <div className="cashier-user">
          <span>👤 {user.username}</span>
          <button onClick={() => navigate('/')} className="btn-home">Home</button>
        </div>
      </header>

      {/* ===== TABS ===== */}
      <div className="cashier-tabs">
        <button className={tab === 'deposit' ? 'active' : ''} onClick={() => setTab('deposit')}>💵 Deposit</button>
        <button className={tab === 'withdraw' ? 'active' : ''} onClick={() => setTab('withdraw')}>💸 Withdraw</button>
        <button className={tab === 'addUser' ? 'active' : ''} onClick={() => setTab('addUser')}>➕ Add User</button>
        <button className={tab === 'invite' ? 'active' : ''} onClick={() => setTab('invite')}>🔗 Invite</button>
        <button className={tab === 'referrals' ? 'active' : ''} onClick={() => setTab('referrals')}>👥 My Referrals</button>
        <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>📊 Report</button>
      </div>

      {/* ===== MESSAGES ===== */}
      {message && <div className="cashier-msg success">{message}</div>}
      {error && <div className="cashier-msg error">{error}</div>}

      {/* ===== CONTENT ===== */}
      <div className="cashier-content">

        {/* ===== DEPOSIT TAB ===== */}
        {tab === 'deposit' && (
          <form className="cashier-form" onSubmit={handleDeposit}>
            <h2>💵 Deposit Request</h2>
            <p className="form-note">
              ⚠️ Deposit request will be sent to admin for approval. User balance updates only after admin approves.
            </p>

            <label>User Email</label>
            <input
              type="email"
              placeholder="user@example.com"
              value={depositForm.email}
              onChange={e => setDepositForm({ ...depositForm, email: e.target.value })}
              required
            />

            <label>Amount (ETB)</label>
            <input
              type="number"
              placeholder="Amount in ETB"
              value={depositForm.amount}
              onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
              required
            />

            <label>Enter Agent Code</label>
            <input
              type="text"
              placeholder="Enter agent code"
              value={depositForm.notes}
              onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })}
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : '📤 Send Deposit Request'}
            </button>
          </form>
        )}

        {/* ===== WITHDRAW TAB ===== */}
        {tab === 'withdraw' && (
          <form className="cashier-form" onSubmit={handleWithdraw}>
            <h2>💸 Withdraw Request</h2>
            <p className="form-note">
              ⚠️ Minimum withdrawal: ETB 50. Request will be sent to admin for approval.
            </p>

            <label>User Email</label>
            <input
              type="email"
              placeholder="user@example.com"
              value={withdrawForm.email}
              onChange={e => setWithdrawForm({ ...withdrawForm, email: e.target.value })}
              required
            />

            <label>Amount (ETB) — Minimum 50</label>
            <input
              type="number"
              placeholder="Min ETB 50"
              value={withdrawForm.amount}
              onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
              min="50"
              required
            />

            <label>Enter Agent Code</label>
            <input
              type="text"
              placeholder="Enter agent code"
              value={withdrawForm.notes}
              onChange={e => setWithdrawForm({ ...withdrawForm, notes: e.target.value })}
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Sending...' : '📤 Send Withdraw Request'}
            </button>
          </form>
        )}

        {/* ===== ADD USER TAB ===== */}
        {tab === 'addUser' && (
          <form className="cashier-form" onSubmit={handleAddUser}>
            <h2>➕ Create New User</h2>

            <label>Username</label>
            <input
              type="text"
              placeholder="Username"
              value={userForm.username}
              onChange={e => setUserForm({ ...userForm, username: e.target.value })}
              required
            />

            <label>Email</label>
            <input
              type="email"
              placeholder="user@example.com"
              value={userForm.email}
              onChange={e => setUserForm({ ...userForm, email: e.target.value })}
              required
            />

            <label>Phone (optional)</label>
            <input
              type="text"
              placeholder="09XXXXXXXX"
              value={userForm.phone}
              onChange={e => setUserForm({ ...userForm, phone: e.target.value })}
            />

            <label>Password</label>
            <input
              type="password"
              placeholder="Password"
              value={userForm.password}
              onChange={e => setUserForm({ ...userForm, password: e.target.value })}
              required
            />

            <label>Initial Balance (optional)</label>
            <input
              type="number"
              placeholder="Initial balance in ETB"
              value={userForm.initialBalance}
              onChange={e => setUserForm({ ...userForm, initialBalance: e.target.value })}
            />

            <label>Enter Agent Code</label>
            <input
              type="text"
              placeholder="Enter agent code"
              value={userForm.agentCode}
              onChange={e => setUserForm({ ...userForm, agentCode: e.target.value })}
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : '➕ Create User'}
            </button>
          </form>
        )}

        {/* ===== INVITE TAB ===== */}
        {tab === 'invite' && (
          <div className="cashier-invite">
            <h2>🔗 Your Invitation Link</h2>
            <p className="invite-subtitle">
              Share this link. Anyone who registers with it becomes your referral and appears in "My Referrals".
            </p>

            {!referral && loading && <p>Loading your link...</p>}

            {referral && (
              <>
                <div className="invite-box">
                  <label>Referral Code</label>
                  <div className="invite-code">{referral.referralCode}</div>
                </div>

                <div className="invite-box">
                  <label>Referral Link</label>
                  <div className="invite-link-row">
                    <input
                      type="text"
                      value={referral.referralLink}
                      readOnly
                      onFocus={e => e.target.select()}
                    />
                    <button className="btn-copy" onClick={copyReferralLink}>
                      {copied ? '✅ Copied' : '📋 Copy'}
                    </button>
                  </div>
                </div>

                <div className="invite-share-buttons">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent('Join AsharaBet and start winning! Use my link: ' + referral.referralLink)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-share whatsapp"
                  >
                    📱 Share on WhatsApp
                  </a>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(referral.referralLink)}&text=${encodeURIComponent('Join AsharaBet!')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-share telegram"
                  >
                    📢 Share on Telegram
                  </a>
                </div>

                <div className="invite-stats">
                  <button className="btn-refresh" onClick={loadReferralLink}>🔄 Refresh</button>
                  <button className="btn-refresh" onClick={() => { setTab('referrals'); }}>
                    👥 View Referrals
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== MY REFERRALS TAB ===== */}
        {tab === 'referrals' && (
          <div className="cashier-referrals">
            <div className="referrals-header">
              <h2>👥 Users Registered with Your Link</h2>
              <button className="btn-refresh" onClick={loadReferrals} disabled={loading}>
                🔄 Refresh
              </button>
            </div>

            {loading && !referrals && <p>Loading referrals...</p>}

            {referrals && (
              <>
                {/* Summary Cards — Real values only */}
                <div className="referral-summary">
                  <div className="summary-card blue">
                    <div className="summary-label">Total Referrals</div>
                    <div className="summary-value">{referrals.referralCount}</div>
                  </div>

                  <div className="summary-card green">
                    <div className="summary-label">Total Deposits</div>
                    <div className="summary-value">
                      ETB {referrals.grandTotalDeposits.toFixed(2)}
                    </div>
                  </div>

                  <div className="summary-card red">
                    <div className="summary-label">Total Withdrawals</div>
                    <div className="summary-value">
                      -ETB {referrals.grandTotalWithdrawals.toFixed(2)}
                    </div>
                  </div>

                  <div className="summary-card orange">
                    <div className="summary-label">Net Flow</div>
                    <div className="summary-value">
                      {(() => {
                        const net = referrals.grandTotalDeposits - referrals.grandTotalWithdrawals;
                        return net >= 0
                          ? `ETB ${net.toFixed(2)}`
                          : `-ETB ${Math.abs(net).toFixed(2)}`;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Users Table */}
                {referrals.users.length === 0 ? (
                  <div className="no-referrals">
                    <p>No users have registered with your referral link yet.</p>
                    <button onClick={() => setTab('invite')} className="btn-goto-invite">
                      🔗 Get Your Invitation Link
                    </button>
                  </div>
                ) : (
                  <div className="referrals-table-wrapper">
                    <table className="referrals-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Username</th>
                          <th>Email</th>
                          <th>Joined</th>
                          <th>Balance</th>
                          <th>Deposits</th>
                          <th>Withdrawals</th>
                          <th>Status</th>
                          <th>History</th>
                        </tr>
                      </thead>
                      <tbody>
                        {referrals.users.map((u, idx) => (
                          <tr key={u._id}>
                            <td>{idx + 1}</td>
                            <td className="cell-username">{u.username}</td>
                            <td className="cell-email">{u.email}</td>
                            <td>{new Date(u.joinedAt).toLocaleDateString()}</td>
                            <td className="cell-balance">
                              ETB {u.balance.toFixed(2)}
                            </td>

                            {/* Deposits — real value */}
                            <td className="cell-deposit">
                              <span className="amount-positive">
                                ETB {u.totalDeposits.toFixed(2)}
                              </span>
                              <small> ({u.depositCount})</small>
                            </td>

                            {/* Withdrawals — real minus */}
                            <td className="cell-withdraw">
                              <span className="amount-negative">
                                -ETB {u.totalWithdrawals.toFixed(2)}
                              </span>
                              <small> ({u.withdrawalCount})</small>
                            </td>

                            <td>
                              <span className={`status-badge status-${u.status}`}>
                                {u.status}
                              </span>
                            </td>

                            <td>
                              <button
                                className="history-view-btn"
                                onClick={() => openUserHistory(u._id, u.username)}
                                title="View full history"
                              >
                                📋 View
                              </button>
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
        )}

        {/* ===== REPORT TAB ===== */}
        {tab === 'report' && (
          <div className="cashier-report">
            <h2>Generate Report</h2>
            <div className="report-range">
              <label>From: <input type="date" value={reportRange.startDate}
                onChange={e => setReportRange({ ...reportRange, startDate: e.target.value })} /></label>
              <label>To: <input type="date" value={reportRange.endDate}
                onChange={e => setReportRange({ ...reportRange, endDate: e.target.value })} /></label>
              <button onClick={handleGenerateReport} disabled={loading}>
                {loading ? 'Generating...' : '📊 Generate'}
              </button>
            </div>

            {report && (
              <div className="report-cards">
                <div className="report-card green">
                  <h3>Total Deposits</h3>
                  <p>ETB {report.totalDeposits.toFixed(2)}</p>
                  <small>{report.totalDepositCount} transactions</small>
                </div>
                <div className="report-card red">
                  <h3>Total Withdrawals</h3>
                  <p>-ETB {report.totalWithdrawals.toFixed(2)}</p>
                  <small>{report.totalWithdrawalCount} transactions</small>
                </div>
                <div className="report-card blue">
                  <h3>Net Flow</h3>
                  <p>
                    {(() => {
                      const net = report.totalDeposits - report.totalWithdrawals;
                      return net >= 0
                        ? `ETB ${net.toFixed(2)}`
                        : `-ETB ${Math.abs(net).toFixed(2)}`;
                    })()}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== HISTORY MODAL ===== */}
      {historyModal && (
        <div className="history-modal-overlay" onClick={() => setHistoryModal(null)}>
          <div className="history-modal" onClick={e => e.stopPropagation()}>
            <div className="history-modal-header">
              <h3>
                📋 Full History — <span className="history-user">{historyModal.username}</span>
              </h3>
              <button className="modal-close" onClick={() => setHistoryModal(null)}>✕</button>
            </div>

            {historyLoading && <p className="history-loading">Loading history...</p>}

            {historyData && (
              <>
                {/* Summary Cards — Real values */}
                <div className="history-summary">
                  <div className="hs-card green">
                    <small>Total Deposits</small>
                    <strong>ETB {historyData.totalDeposits.toFixed(2)}</strong>
                  </div>
                  <div className="hs-card red">
                    <small>Total Withdrawals</small>
                    <strong>-ETB {historyData.totalWithdrawals.toFixed(2)}</strong>
                  </div>
                  <div className="hs-card blue">
                    <small>Current Balance</small>
                    <strong>ETB {historyData.user.balance.toFixed(2)}</strong>
                  </div>
                  <div className="hs-card orange">
                    <small>Net Flow</small>
                    <strong>
                      {(() => {
                        const net = historyData.totalDeposits - historyData.totalWithdrawals;
                        return net >= 0
                          ? `ETB ${net.toFixed(2)}`
                          : `-ETB ${Math.abs(net).toFixed(2)}`;
                      })()}
                    </strong>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="history-filters">
                  <button
                    className={historyFilter === 'all' ? 'active' : ''}
                    onClick={() => setHistoryFilter('all')}
                  >
                    All ({(historyData.combined || []).length})
                  </button>
                  <button
                    className={historyFilter === 'deposit' ? 'active' : ''}
                    onClick={() => setHistoryFilter('deposit')}
                  >
                    💵 Deposits ({(historyData.deposits || []).length})
                  </button>
                  <button
                    className={historyFilter === 'withdrawal' ? 'active' : ''}
                    onClick={() => setHistoryFilter('withdrawal')}
                  >
                    💸 Withdrawals ({(historyData.withdrawals || []).length})
                  </button>
                </div>

                {/* History Table */}
                {getFilteredHistory().length === 0 ? (
                  <p className="no-history">No records found.</p>
                ) : (
                  <div className="history-table-wrapper">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Email</th>
                          <th>By</th>
                          <th>Agent Code</th>
                          <th>Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFilteredHistory().map((h, i) => (
                          <tr key={h._id}>
                            <td>{i + 1}</td>
                            <td>
                              {h.transactionType === 'deposit' ? (
                                <span className="type-badge deposit-badge">💵 Deposit</span>
                              ) : (
                                <span className="type-badge withdraw-badge">💸 Withdraw</span>
                              )}
                            </td>
                            <td className={`cell-amount ${h.transactionType === 'deposit' ? 'positive' : 'negative'}`}>
                              {h.transactionType === 'deposit'
                                ? `ETB ${Number(h.amount).toFixed(2)}`
                                : `-ETB ${Number(h.amount).toFixed(2)}`}
                            </td>
                            <td className="cell-email">{h.email}</td>
                            <td>
                              <span className={`by-badge ${h.createdBy === 'Cashier' ? 'by-cashier' : 'by-self'}`}>
                                {h.createdBy || 'Self'}
                              </span>
                            </td>
                            <td className="cell-notes">{h.agentCode || 'N/A'}</td>
                            <td>{new Date(h.date).toLocaleString()}</td>
                            <td>
                              <span className={`status-badge status-${h.status}`}>{h.status}</span>
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
      )}
    </div>
  );
};

export default CashierPage;