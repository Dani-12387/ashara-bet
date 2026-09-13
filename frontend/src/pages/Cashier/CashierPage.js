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

  // ===== FORMS (Deposit & Withdraw now use EMAIL + agentCode) =====
  const [depositForm, setDepositForm] = useState({
    email: '',
    amount: '',
    notes: ''   // ✅ Agent Code goes here
  });
  const [withdrawForm, setWithdrawForm] = useState({
    email: '',
    amount: '',
    notes: ''   // ✅ Agent Code goes here
  });
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    initialBalance: '',
    agentCode: ''   // ✅ Agent Code for Add User
  });
  const [report, setReport] = useState(null);
  const [reportRange, setReportRange] = useState({ startDate: '', endDate: '' });

  // ===== REFERRAL STATE =====
  const [referral, setReferral] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [copied, setCopied] = useState(false);

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
    setTimeout(() => { setMessage(''); setError(''); }, 4000);
  };

  // ===== DEPOSIT =====
  const handleDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/cashier/deposit`, depositForm, authHeaders());
      if (res.data.success) {
        showMessage(res.data.message);
        setDepositForm({ email: '', amount: '', notes: '' });
      }
    } catch (err) {
      showMessage(err.response?.data?.message || 'Deposit failed', true);
    } finally { setLoading(false); }
  };

  // ===== WITHDRAW =====
  const handleWithdraw = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/cashier/withdraw`, withdrawForm, authHeaders());
      if (res.data.success) {
        showMessage(res.data.message);
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

  // Load referral data when those tabs are opened
  useEffect(() => {
    if (tab === 'invite' && !referral) loadReferralLink();
    if (tab === 'referrals' && !referrals) loadReferrals();
  }, [tab]);

  if (!user) return null;

  return (
    <div className="cashier-page">
      {/* HEADER */}
      <header className="cashier-header">
        <div className="cashier-logo">💰 AsharaBet Cashier</div>
        <div className="cashier-user">
          <span>👤 {user.username}</span>
          <button onClick={() => navigate('/')} className="btn-home">Home</button>
        </div>
      </header>

      {/* TABS */}
      <div className="cashier-tabs">
        <button className={tab === 'deposit' ? 'active' : ''} onClick={() => setTab('deposit')}>💵 Deposit</button>
        <button className={tab === 'withdraw' ? 'active' : ''} onClick={() => setTab('withdraw')}>💸 Withdraw</button>
        <button className={tab === 'addUser' ? 'active' : ''} onClick={() => setTab('addUser')}>➕ Add User</button>
        <button className={tab === 'invite' ? 'active' : ''} onClick={() => setTab('invite')}>🔗 Invite</button>
        <button className={tab === 'referrals' ? 'active' : ''} onClick={() => setTab('referrals')}>👥 My Referrals</button>
        <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>📊 Report</button>
      </div>

      {/* MESSAGES */}
      {message && <div className="cashier-msg success">{message}</div>}
      {error && <div className="cashier-msg error">{error}</div>}

      {/* CONTENT */}
      <div className="cashier-content">

        {/* ===== DEPOSIT TAB ===== */}
        {tab === 'deposit' && (
          <form className="cashier-form" onSubmit={handleDeposit}>
            <h2>💵 Deposit to User</h2>

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

            {/* ✅ Notes → Agent Code */}
            <label>Enter Agent Code</label>
            <input
              type="text"
              placeholder="Enter agent code"
              value={depositForm.notes}
              onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })}
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : '💰 Deposit'}
            </button>
          </form>
        )}

        {/* ===== WITHDRAW TAB ===== */}
        {tab === 'withdraw' && (
          <form className="cashier-form" onSubmit={handleWithdraw}>
            <h2>💸 Withdraw from User</h2>

            <label>User Email</label>
            <input
              type="email"
              placeholder="user@example.com"
              value={withdrawForm.email}
              onChange={e => setWithdrawForm({ ...withdrawForm, email: e.target.value })}
              required
            />

            <label>Amount (ETB)</label>
            <input
              type="number"
              placeholder="Amount in ETB"
              value={withdrawForm.amount}
              onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
              required
            />

            {/* ✅ Notes → Agent Code */}
            <label>Enter Agent Code</label>
            <input
              type="text"
              placeholder="Enter agent code"
              value={withdrawForm.notes}
              onChange={e => setWithdrawForm({ ...withdrawForm, notes: e.target.value })}
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : '💸 Withdraw'}
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

            {/* ✅ Agent Code */}
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
              Share this link. Anyone who registers with it becomes your referral.
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
                {/* Summary Cards */}
                <div className="referral-summary">
                  <div className="summary-card blue">
                    <div className="summary-label">Total Referrals</div>
                    <div className="summary-value">{referrals.referralCount}</div>
                  </div>
                  <div className="summary-card green">
                    <div className="summary-label">Total Deposits</div>
                    <div className="summary-value">ETB {referrals.grandTotalDeposits.toFixed(2)}</div>
                  </div>
                  <div className="summary-card red">
                    <div className="summary-label">Total Withdrawals</div>
                    <div className="summary-value">ETB {referrals.grandTotalWithdrawals.toFixed(2)}</div>
                  </div>
                  <div className="summary-card orange">
                    <div className="summary-label">Total Balance</div>
                    <div className="summary-value">ETB {referrals.grandTotalBalance.toFixed(2)}</div>
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
                            <td className="cell-deposit">
                              ETB {u.totalDeposits.toFixed(2)}
                              <small> ({u.depositCount})</small>
                            </td>
                            <td className="cell-withdraw">
                              ETB {u.totalWithdrawals.toFixed(2)}
                              <small> ({u.withdrawalCount})</small>
                            </td>
                            <td>
                              <span className={`status-badge status-${u.status}`}>
                                {u.status}
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
                  <p>ETB {report.totalWithdrawals.toFixed(2)}</p>
                  <small>{report.totalWithdrawalCount} transactions</small>
                </div>
                <div className="report-card blue">
                  <h3>Net Flow</h3>
                  <p>ETB {report.netFlow.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierPage;