import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminTransactions.css';

const AdminTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);

  // ✅ API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  // ✅ FIXED: Use API_URL
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let url = `${API_URL}/api/admin/transactions`;
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(response.data.transactions || response.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setLoading(false);
    }
  };

  // ✅ FIXED: Use API_URL
  const handleApprove = async (transactionId) => {
    if (!window.confirm('Are you sure you want to approve this deposit? User balance will be updated.')) {
      return;
    }

    setProcessingId(transactionId);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/admin/transactions/${transactionId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('✅ Deposit approved! User balance updated.');
        fetchTransactions();
      }
    } catch (error) {
      console.error('Approve error:', error);
      alert(error.response?.data?.message || 'Failed to approve deposit');
    } finally {
      setProcessingId(null);
    }
  };

  // ✅ FIXED: Use API_URL
  const handleReject = async (transactionId) => {
    const reason = prompt('Please enter reason for rejection:');
    if (!reason) return;

    setProcessingId(transactionId);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/admin/transactions/${transactionId}/reject`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('❌ Deposit rejected');
        fetchTransactions();
      }
    } catch (error) {
      console.error('Reject error:', error);
      alert(error.response?.data?.message || 'Failed to reject deposit');
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
      rejected: { class: 'status-rejected', text: '❌ Rejected' }
    };
    const badge = badges[status] || badges.pending;
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  if (loading) {
    return <div className="loading-spinner">Loading transactions...</div>;
  }

  return (
    <div className="admin-transactions">
      <div className="transactions-header">
        <h1>💰 Deposit Management</h1>
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            ⏳ Pending ({transactions.filter(t => t.status === 'pending').length})
          </button>
          <button 
            className={`filter-btn ${filter === 'approved' ? 'active' : ''}`}
            onClick={() => setFilter('approved')}
          >
            ✅ Approved
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

      {transactions.length === 0 ? (
        <div className="no-transactions">
          <p>No {filter} transactions found</p>
        </div>
      ) : (
        <div className="transactions-grid">
          {transactions.map(transaction => (
            <div key={transaction._id} className={`transaction-card ${transaction.status}`}>
              <div className="card-header">
                <div className="user-info">
                  <h3>{transaction.user?.username || 'Unknown User'}</h3>
                  <span className="transaction-id">ID: {transaction._id.slice(-6)}</span>
                </div>
              </div>
              
              <div className="card-body">
                {/* Contact Information Section */}
                <div className="contact-section">
                  <h4>📞 User Contact</h4>
                  <div className="info-row">
                    <span className="label">Email:</span>
                    <span className="value email">{transaction.user?.email || 'Not provided'}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Phone:</span>
                    <span className="value phone">📱 {formatPhone(transaction.user?.phone)}</span>
                  </div>
                </div>

                {/* Transaction Details Section */}
                <div className="transaction-details">
                  <h4>💳 Transaction Details</h4>
                  <div className="info-row">
                    <span className="label">Amount:</span>
                    <span className="value amount">ETB {transaction.amount}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Method:</span>
                    <span className="value">{transaction.paymentMethod}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Reference:</span>
                    <span className="value">{transaction.transactionReference || 'N/A'}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Date:</span>
                    <span className="value">{formatDate(transaction.createdAt)}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Status:</span>
                    <span className="value">{getStatusBadge(transaction.status)}</span>
                  </div>
                  {transaction.rejectionReason && (
                    <div className="info-row rejection">
                      <span className="label">Reason:</span>
                      <span className="value">{transaction.rejectionReason}</span>
                    </div>
                  )}
                </div>
              </div>

              {transaction.screenshot && (
                <div className="screenshot-section">
                  <button 
                    className="view-screenshot-btn"
                    onClick={() => setSelectedImage(transaction.screenshot)}
                  >
                    📸 View Screenshot
                  </button>
                </div>
              )}

              {transaction.status === 'pending' && (
                <div className="card-actions">
                  <button 
                    className="approve-btn"
                    onClick={() => handleApprove(transaction._id)}
                    disabled={processingId === transaction._id}
                  >
                    {processingId === transaction._id ? 'Processing...' : '✓ Approve'}
                  </button>
                  <button 
                    className="reject-btn"
                    onClick={() => handleReject(transaction._id)}
                    disabled={processingId === transaction._id}
                  >
                    ✗ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Transaction Screenshot</h3>
              <button className="close-btn" onClick={() => setSelectedImage(null)}>✖</button>
            </div>
            <div className="modal-body">
              <div className="screenshot-info">
                <p><strong>User:</strong> {transactions.find(t => t.screenshot === selectedImage)?.user?.username}</p>
                <p><strong>Amount:</strong> ETB {transactions.find(t => t.screenshot === selectedImage)?.amount}</p>
              </div>
              <img 
                src={`${API_URL}/uploads/${selectedImage}`} 
                alt="Transaction Screenshot"
                className="screenshot-image"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found';
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTransactions;