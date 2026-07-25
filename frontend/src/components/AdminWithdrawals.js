import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminWithdrawals.css';

const AdminWithdrawals = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchWithdrawals();
  }, [filter]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let url = '/api/admin/withdrawals';
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWithdrawals(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      setLoading(false);
    }
  };

  const handleApprove = async (withdrawalId) => {
    if (!window.confirm('Approve this withdrawal? User will be notified.')) return;

    setProcessingId(withdrawalId);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/admin/withdrawals/${withdrawalId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('✅ Withdrawal approved! Ready for payment.');
        fetchWithdrawals();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to approve withdrawal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async (withdrawalId) => {
    if (!window.confirm('Mark this withdrawal as paid? This will deduct from user balance.')) return;

    setProcessingId(withdrawalId);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/admin/withdrawals/${withdrawalId}/complete`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('💰 Withdrawal completed! User balance updated.');
        fetchWithdrawals();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to complete withdrawal');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (withdrawalId) => {
    const reason = prompt('Enter reason for rejection:');
    if (!reason) return;

    setProcessingId(withdrawalId);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/admin/withdrawals/${withdrawalId}/reject`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('❌ Withdrawal rejected');
        fetchWithdrawals();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to reject withdrawal');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPhone = (phone) => {
    if (!phone) return 'Not provided';
    if (phone.length === 10) {
      return `${phone.slice(0,3)}-${phone.slice(3,6)}-${phone.slice(6)}`;
    }
    return phone;
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'status-pending', text: '⏳ Pending' },
      approved: { class: 'status-approved', text: '✅ Approved' },
      rejected: { class: 'status-rejected', text: '❌ Rejected' },
      completed: { class: 'status-completed', text: '💰 Completed' }
    };
    const badge = badges[status] || badges.pending;
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  if (loading) {
    return <div className="loading-spinner">Loading withdrawals...</div>;
  }

  return (
    <div className="admin-withdrawals">
      <div className="withdrawals-header">
        <h1>💸 Withdrawal Management</h1>
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            ⏳ Pending ({withdrawals.filter(w => w.status === 'pending').length})
          </button>
          <button 
            className={`filter-btn ${filter === 'approved' ? 'active' : ''}`}
            onClick={() => setFilter('approved')}
          >
            ✅ Approved
          </button>
          <button 
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            💰 Completed
          </button>
          <button 
            className={`filter-btn ${filter === 'rejected' ? 'active' : ''}`}
            onClick={() => setFilter('rejected')}
          >
            ❌ Rejected
          </button>
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            📋 All
          </button>
        </div>
      </div>

      {withdrawals.length === 0 ? (
        <div className="no-withdrawals">
          <p>No {filter} withdrawals found</p>
        </div>
      ) : (
        <div className="withdrawals-grid">
          {withdrawals.map(withdrawal => (
            <div key={withdrawal._id} className={`withdrawal-card ${withdrawal.status}`}>
              <div className="card-header">
                <div className="user-info">
                  <h3>{withdrawal.user?.username || 'Unknown User'}</h3>
                  <span className="withdrawal-id">ID: {withdrawal._id.slice(-6)}</span>
                </div>
              </div>
              
              <div className="card-body">
                {/* User Contact */}
                <div className="contact-section">
                  <h4>📞 User Contact</h4>
                  <div className="info-row">
                    <span className="label">Email:</span>
                    <span className="value email">{withdrawal.user?.email || 'Not provided'}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Phone:</span>
                    <span className="value phone">📱 {formatPhone(withdrawal.user?.phone)}</span>
                  </div>
                </div>

                {/* Withdrawal Details */}
                <div className="withdrawal-details">
                  <h4>💳 Withdrawal Details</h4>
                  <div className="info-row">
                    <span className="label">Amount:</span>
                    <span className="value amount">ETB {withdrawal.amount}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Method:</span>
                    <span className="value">{withdrawal.paymentMethod}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Account Name:</span>
                    <span className="value">{withdrawal.accountName}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Account Number:</span>
                    <span className="value">{withdrawal.accountNumber}</span>
                  </div>
                  {withdrawal.bankName && (
                    <div className="info-row">
                      <span className="label">Bank Name:</span>
                      <span className="value">{withdrawal.bankName}</span>
                    </div>
                  )}
                  {withdrawal.phoneNumber && (
                    <div className="info-row">
                      <span className="label">Phone:</span>
                      <span className="value">{withdrawal.phoneNumber}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="label">Date:</span>
                    <span className="value">{formatDate(withdrawal.createdAt)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Status:</span>
                    <span className="value">{getStatusBadge(withdrawal.status)}</span>
                  </div>
                  {withdrawal.rejectionReason && (
                    <div className="info-row rejection">
                      <span className="label">Reason:</span>
                      <span className="value">{withdrawal.rejectionReason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="card-actions">
                {withdrawal.status === 'pending' && (
                  <>
                    <button 
                      className="approve-btn"
                      onClick={() => handleApprove(withdrawal._id)}
                      disabled={processingId === withdrawal._id}
                    >
                      {processingId === withdrawal._id ? 'Processing...' : '✓ Approve'}
                    </button>
                    <button 
                      className="reject-btn"
                      onClick={() => handleReject(withdrawal._id)}
                      disabled={processingId === withdrawal._id}
                    >
                      ✗ Reject
                    </button>
                  </>
                )}
                {withdrawal.status === 'approved' && (
                  <button 
                    className="complete-btn"
                    onClick={() => handleComplete(withdrawal._id)}
                    disabled={processingId === withdrawal._id}
                  >
                    {processingId === withdrawal._id ? 'Processing...' : '💰 Mark as Paid'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminWithdrawals;