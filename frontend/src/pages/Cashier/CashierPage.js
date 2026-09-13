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

  // Forms
  const [depositForm, setDepositForm] = useState({ username: '', amount: '', notes: '' });
  const [withdrawForm, setWithdrawForm] = useState({ username: '', amount: '', notes: '' });
  const [userForm, setUserForm] = useState({ username: '', email: '', phone: '', password: '', initialBalance: '' });
  const [report, setReport] = useState(null);
  const [reportRange, setReportRange] = useState({ startDate: '', endDate: '' });

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

  // === DEPOSIT ===
  const handleDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/cashier/deposit`, depositForm, authHeaders());
      if (res.data.success) {
        showMessage(res.data.message);
        setDepositForm({ username: '', amount: '', notes: '' });
      }
    } catch (err) {
      showMessage(err.response?.data?.message || 'Deposit failed', true);
    } finally { setLoading(false); }
  };

  // === WITHDRAW ===
  const handleWithdraw = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/cashier/withdraw`, withdrawForm, authHeaders());
      if (res.data.success) {
        showMessage(res.data.message);
        setWithdrawForm({ username: '', amount: '', notes: '' });
      }
    } catch (err) {
      showMessage(err.response?.data?.message || 'Withdrawal failed', true);
    } finally { setLoading(false); }
  };

  // === ADD USER ===
  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/cashier/add-user`, userForm, authHeaders());
      if (res.data.success) {
        showMessage(res.data.message);
        setUserForm({ username: '', email: '', phone: '', password: '', initialBalance: '' });
      }
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to create user', true);
    } finally { setLoading(false); }
  };

  // === REPORT ===
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
        <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>📊 Report</button>
      </div>

      {/* MESSAGES */}
      {message && <div className="cashier-msg success">{message}</div>}
      {error && <div className="cashier-msg error">{error}</div>}

      {/* CONTENT */}
      <div className="cashier-content">
        {tab === 'deposit' && (
          <form className="cashier-form" onSubmit={handleDeposit}>
            <h2>Deposit to User</h2>
            <input placeholder="Username" value={depositForm.username}
              onChange={e => setDepositForm({ ...depositForm, username: e.target.value })} required />
            <input type="number" placeholder="Amount (ETB)" value={depositForm.amount}
              onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })} required />
            <input placeholder="Notes (optional)" value={depositForm.notes}
              onChange={e => setDepositForm({ ...depositForm, notes: e.target.value })} />
            <button type="submit" disabled={loading}>{loading ? 'Processing...' : '💰 Deposit'}</button>
          </form>
        )}

        {tab === 'withdraw' && (
          <form className="cashier-form" onSubmit={handleWithdraw}>
            <h2>Withdraw from User</h2>
            <input placeholder="Username" value={withdrawForm.username}
              onChange={e => setWithdrawForm({ ...withdrawForm, username: e.target.value })} required />
            <input type="number" placeholder="Amount (ETB)" value={withdrawForm.amount}
              onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} required />
            <input placeholder="Notes (optional)" value={withdrawForm.notes}
              onChange={e => setWithdrawForm({ ...withdrawForm, notes: e.target.value })} />
            <button type="submit" disabled={loading}>{loading ? 'Processing...' : '💸 Withdraw'}</button>
          </form>
        )}

        {tab === 'addUser' && (
          <form className="cashier-form" onSubmit={handleAddUser}>
            <h2>Create New User</h2>
            <input placeholder="Username" value={userForm.username}
              onChange={e => setUserForm({ ...userForm, username: e.target.value })} required />
            <input type="email" placeholder="Email" value={userForm.email}
              onChange={e => setUserForm({ ...userForm, email: e.target.value })} required />
            <input placeholder="Phone (optional)" value={userForm.phone}
              onChange={e => setUserForm({ ...userForm, phone: e.target.value })} />
            <input type="password" placeholder="Password" value={userForm.password}
              onChange={e => setUserForm({ ...userForm, password: e.target.value })} required />
            <input type="number" placeholder="Initial Balance (optional)" value={userForm.initialBalance}
              onChange={e => setUserForm({ ...userForm, initialBalance: e.target.value })} />
            <button type="submit" disabled={loading}>{loading ? 'Creating...' : '➕ Create User'}</button>
          </form>
        )}

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