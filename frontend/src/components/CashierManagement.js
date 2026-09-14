import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CashierManagement.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const CashierManagement = () => {
  const navigate = useNavigate();
  const [cashiers, setCashiers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');

  const getHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([
        axios.get(`${API_URL}/api/cashier/admin/cashiers`, getHeaders()),
        axios.get(`${API_URL}/api/cashier/admin/candidates`, getHeaders())
      ]);
      setCashiers(c.data.cashiers || []);
      setCandidates(u.data.users || []);
    } catch (err) {
      console.error('Fetch cashiers error:', err);
      showMessage(err.response?.data?.message || 'Failed to load cashiers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const showMessage = (text, type = 'success') => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(''), 3500);
  };

  const assign = async (userId) => {
    try {
      const r = await axios.post(
        `${API_URL}/api/cashier/admin/assign`,
        { userId },
        getHeaders()
      );
      showMessage(r.data.message, 'success');
      fetchAll();
    } catch (e) {
      showMessage(e.response?.data?.message || 'Failed to assign cashier', 'error');
    }
  };

  const remove = async (userId) => {
    if (!window.confirm('Remove cashier role from this user?')) return;
    try {
      const r = await axios.post(
        `${API_URL}/api/cashier/admin/remove`,
        { userId },
        getHeaders()
      );
      showMessage(r.data.message, 'success');
      fetchAll();
    } catch (e) {
      showMessage(e.response?.data?.message || 'Failed to remove cashier', 'error');
    }
  };

  const filtered = candidates.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="cashier-mgmt">
      <div className="cashier-mgmt-header">
        <h2>💰 Cashier Management</h2>
        <p className="subtitle">
          Assign or remove the Cashier role from users. Cashiers can process deposits,
          withdrawals, add users, and generate reports.
        </p>
      </div>

      {msg && (
        <div className={`mgmt-msg ${msgType === 'error' ? 'mgmt-msg-error' : 'mgmt-msg-success'}`}>
          {msg}
        </div>
      )}

      {/* ====== CURRENT CASHIERS ====== */}
      <div className="mgmt-section">
        <div className="mgmt-section-header">
          <h3>✅ Active Cashiers ({cashiers.length})</h3>
          <button className="btn-refresh" onClick={fetchAll} disabled={loading}>
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <p className="mgmt-loading">Loading cashiers...</p>
        ) : cashiers.length === 0 ? (
          <p className="mgmt-empty">No cashiers yet. Assign one from the list below.</p>
        ) : (
          <div className="mgmt-grid">
            {cashiers.map((c) => (
              <div key={c._id} className="mgmt-card cashier">
                <div className="card-header">
                  <div className="card-avatar">
                    {c.username?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div>
                    <div className="card-name">{c.username}</div>
                    <div className="card-small">{c.email}</div>
                  </div>
                </div>

                <div className="card-body">
                  <div className="card-small">📞 {c.phone || 'N/A'}</div>
                  <div className="card-small">
                    💰 ETB {c.wallet?.balance?.toFixed(2) || '0.00'}
                  </div>
                  <div className="card-small">
                    📅 Joined: {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                  {c.referralCode && (
                    <div className="card-small">
                      🎁 Code: <strong>{c.referralCode}</strong>
                    </div>
                  )}
                </div>

                {/* ✅ VIEW DETAILS BUTTON — opens cashier history page */}
                <button
                  className="btn-view-history"
                  onClick={() => navigate(`/admin/cashier/${c._id}`)}
                >
                  📊 View Details
                </button>

                <button className="btn-remove" onClick={() => remove(c._id)}>
                  ❌ Remove Cashier
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ====== CANDIDATE USERS ====== */}
      <div className="mgmt-section">
        <div className="mgmt-section-header">
          <h3>👥 Users (Assign as Cashier)</h3>
          <span className="mgmt-count">{filtered.length} users</span>
        </div>

        <input
          type="text"
          className="mgmt-search"
          placeholder="🔍 Search user by username or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <p className="mgmt-loading">Loading users...</p>
        ) : filtered.length === 0 ? (
          <p className="mgmt-empty">No users found.</p>
        ) : (
          <div className="mgmt-grid">
            {filtered.slice(0, 60).map((u) => (
              <div key={u._id} className="mgmt-card">
                <div className="card-header">
                  <div className="card-avatar user">
                    {u.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="card-name">{u.username}</div>
                    <div className="card-small">{u.email}</div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="card-small">📞 {u.phone || 'N/A'}</div>
                  <div className="card-small">
                    💰 ETB {u.wallet?.balance?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <button className="btn-assign" onClick={() => assign(u._id)}>
                  ⭐ Make Cashier
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CashierManagement;