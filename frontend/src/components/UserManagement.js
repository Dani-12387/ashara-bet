import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserManagement.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState(''); // 'add', 'edit', 'view', 'balance'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyType, setHistoryType] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Balance form state
  const [balanceData, setBalanceData] = useState({
    balance: 0,
    bonusBalance: 0,
    lockedBalance: 0,
    action: 'add' // 'add', 'deduct', 'set'
  });

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    role: 'user',
    status: 'active',
    profile: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      address: {
        street: '',
        city: '',
        state: '',
        country: '',
        zipCode: ''
      }
    }
  });

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch all users from database
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetched users:', response.data);
      setUsers(response.data.users || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setErrorMessage('Failed to fetch users');
      setLoading(false);
    }
  };

  // Clear messages
  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Handle input change for forms
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      const parts = name.split('.');
      if (parts[0] === 'profile') {
        if (parts[1] === 'address') {
          setFormData({
            ...formData,
            profile: {
              ...formData.profile,
              address: {
                ...formData.profile.address,
                [parts[2]]: value
              }
            }
          });
        } else {
          setFormData({
            ...formData,
            profile: {
              ...formData.profile,
              [parts[1]]: value
            }
          });
        }
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    clearMessages();
  };

  // Handle balance input change
  const handleBalanceChange = (e) => {
    const { name, value } = e.target;
    setBalanceData({
      ...balanceData,
      [name]: name === 'action' ? value : parseFloat(value) || 0
    });
    clearMessages();
  };

  // Add new user
  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');

      if (!formData.username || !formData.email || !formData.phone || !formData.password) {
        setErrorMessage('Username, Email, Phone and Password are required');
        return;
      }

      const response = await axios.post(`${API_URL}/api/admin/users`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccessMessage('User created successfully');
        setShowModal(false);
        resetForm();
        fetchUsers();
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to create user');
    }
  };

  // Update user
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');

      const updateData = { ...formData };
      if (!updateData.password) {
        delete updateData.password;
      }

      const response = await axios.put(`${API_URL}/api/admin/users/${selectedUser._id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccessMessage('User updated successfully');
        setShowModal(false);
        resetForm();
        fetchUsers();
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to update user');
    }
  };

  // Update user balance
  const handleUpdateBalance = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_URL}/api/admin/users/${selectedUser._id}/balance`,
        balanceData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setSuccessMessage(`Balance updated! New balance: ETB ${response.data.user.wallet.balance}`);
        setShowModal(false);
        resetForm();
        fetchUsers();
      }
    } catch (error) {
      console.error('Error updating balance:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to update balance');
    }
  };

  // Delete user
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccessMessage('User deleted');
        fetchUsers();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to delete user');
    }
  };

  // Suspend/Activate user
  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API_URL}/api/admin/users/${userId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setSuccessMessage(`User ${newStatus}`);
        fetchUsers();
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to update user status');
    }
  };

  // Reset user password
  const handleResetPassword = async (userId) => {
    if (!window.confirm('Are you sure you want to reset this user\'s password?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/admin/users/${userId}/reset-password`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        alert(`Password reset successfully. Temporary password: ${response.data.temporaryPassword}`);
        setSuccessMessage('Password reset');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to reset password');
    }
  };

  // Verify KYC
  const handleVerifyKYC = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API_URL}/api/admin/users/${userId}/verify-kyc`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccessMessage('KYC verified');
        fetchUsers();
      }
    } catch (error) {
      console.error('Error verifying KYC:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to verify KYC');
    }
  };

  // View user history
  const handleViewHistory = async (userId, type) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/admin/users/${userId}/history?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setHistoryData(response.data);
      setHistoryType(type);
      setShowHistory(true);
    } catch (error) {
      console.error('Error fetching history:', error);
      setErrorMessage('Failed to fetch history');
    }
  };

  // Open modal for different actions
  const openModal = (mode, user = null) => {
    clearMessages();
    setModalMode(mode);
    if (user) {
      setSelectedUser(user);
      if (mode === 'balance') {
        setBalanceData({
          balance: 0,
          bonusBalance: 0,
          lockedBalance: 0,
          action: 'add'
        });
      } else {
        setFormData({
          username: user.username || '',
          email: user.email || '',
          phone: user.phone || '',
          password: '',
          role: user.role || 'user',
          status: user.status || 'active',
          profile: {
            firstName: user.profile?.firstName || '',
            lastName: user.profile?.lastName || '',
            dateOfBirth: user.profile?.dateOfBirth ? user.profile.dateOfBirth.split('T')[0] : '',
            address: {
              street: user.profile?.address?.street || '',
              city: user.profile?.address?.city || '',
              state: user.profile?.address?.state || '',
              country: user.profile?.address?.country || '',
              zipCode: user.profile?.address?.zipCode || ''
            }
          }
        });
      }
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      phone: '',
      password: '',
      role: 'user',
      status: 'active',
      profile: {
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        address: {
          street: '',
          city: '',
          state: '',
          country: '',
          zipCode: ''
        }
      }
    });
    setBalanceData({
      balance: 0,
      bonusBalance: 0,
      lockedBalance: 0,
      action: 'add'
    });
    setSelectedUser(null);
    clearMessages();
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.profile?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.profile?.lastName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Format phone number for display
  const formatPhone = (phone) => {
    if (!phone) return 'No phone';
    if (phone.length === 10) {
      return `${phone.slice(0,3)}-${phone.slice(3,6)}-${phone.slice(6)}`;
    }
    return phone;
  };

  // Format ETB currency
  const formatETB = (amount) => {
    return `ETB ${amount?.toFixed(2) || '0.00'}`;
  };

  if (loading) {
    return <div className="loading-spinner">Loading users...</div>;
  }

  return (
    <div className="user-management">
      {/* Header */}
      <div className="um-header">
        <h1>👥 User Management</h1>
        <button className="um-btn-primary" onClick={() => openModal('add')}>
          + Add New User
        </button>
      </div>

      {/* Messages */}
      {errorMessage && <div className="um-error-message">{errorMessage}</div>}
      {successMessage && <div className="um-success-message">{successMessage}</div>}

      {/* Filters */}
      <div className="um-filters">
        <input
          type="text"
          className="um-search-input"
          placeholder="Search by name, email or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="um-filter-select"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="support">Support</option>
        </select>
        <select
          className="um-filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="um-table-container">
        <table className="um-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Contact</th>
              <th>Role</th>
              <th>Status</th>
              <th>KYC</th>
              <th>Wallet</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <tr key={user._id}>
                  <td>
                    <div className="um-user-info">
                      <div className="um-user-avatar">👤</div>
                      <div>
                        <div className="um-user-name">{user.username}</div>
                        <div className="um-user-fullname">
                          {user.profile?.firstName} {user.profile?.lastName}
                        </div>
                        {/* ✅ Show referral code if present */}
                        {user.referralCode && (
                          <div className="um-user-referral">🔑 {user.referralCode}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{user.email}</div>
                    <div className="um-user-phone">
                      📱 {user.phone ? formatPhone(user.phone) : 'No phone'}
                    </div>
                  </td>
                  <td>
                    <span className={`um-role-badge ${user.role}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`um-status-badge ${user.status}`}>
                      {user.status}
                    </span>
                  </td>
                  <td>
                    <span className={`um-kyc-badge ${user.kyc?.status || 'not_submitted'}`}>
                      {user.kyc?.status || 'Not Submitted'}
                    </span>
                    {user.kyc?.status === 'pending' && (
                      <button
                        className="um-verify-btn"
                        onClick={() => handleVerifyKYC(user._id)}
                      >
                        Verify
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="wallet-info">
                      <span className="wallet-balance">{formatETB(user.wallet?.balance)}</span>
                      <span className="wallet-bonus">Bonus: {formatETB(user.wallet?.bonusBalance)}</span>
                    </div>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="um-action-buttons">
                      <button
                        className="um-action-btn view"
                        onClick={() => openModal('view', user)}
                        title="View Details"
                      >
                        View
                      </button>
                      <button
                        className="um-action-btn edit"
                        onClick={() => openModal('edit', user)}
                        title="Edit User"
                      >
                        Edit
                      </button>
                      <button
                        className="um-action-btn balance"
                        onClick={() => openModal('balance', user)}
                        title="Manage Balance"
                      >
                        Balance
                      </button>
                      <button
                        className="um-action-btn history"
                        onClick={() => handleViewHistory(user._id, 'betting')}
                        title="Betting History"
                      >
                        Bets
                      </button>
                      <button
                        className="um-action-btn history"
                        onClick={() => handleViewHistory(user._id, 'transaction')}
                        title="Transaction History"
                      >
                        Trans
                      </button>
                      <button
                        className="um-action-btn reset"
                        onClick={() => handleResetPassword(user._id)}
                        title="Reset Password"
                      >
                        Reset
                      </button>
                      <button
                        className={`um-action-btn ${user.status === 'active' ? 'suspend' : 'activate'}`}
                        onClick={() => handleToggleStatus(user._id, user.status)}
                        title={user.status === 'active' ? 'Suspend User' : 'Activate User'}
                      >
                        {user.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        className="um-action-btn delete"
                        onClick={() => handleDeleteUser(user._id)}
                        title="Delete User"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="um-no-data">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="um-modal-overlay">
          <div className="um-modal">
            <div className="um-modal-header">
              <h2>
                {modalMode === 'add' ? 'Add New User' :
                 modalMode === 'edit' ? 'Edit User' :
                 modalMode === 'view' ? 'User Details' :
                 modalMode === 'balance' ? 'Manage Balance' : ''}
              </h2>
              <button className="um-modal-close" onClick={() => setShowModal(false)}>✖</button>
            </div>

            {modalMode === 'view' ? (
              // ---------- VIEW MODE ----------
              <div className="um-view-details">
                <div className="um-detail-section">
                  <h3>Account Information</h3>
                  <p><strong>Username:</strong> {selectedUser?.username}</p>
                  <p><strong>Email:</strong> {selectedUser?.email}</p>
                  <p><strong>Phone:</strong> {selectedUser?.phone ? formatPhone(selectedUser.phone) : 'Not provided'}</p>
                  <p><strong>Role:</strong> {selectedUser?.role}</p>
                  <p><strong>Status:</strong> {selectedUser?.status}</p>
                  <p><strong>Referral Code:</strong> {selectedUser?.referralCode || 'Not generated'}</p>
                </div>
                <div className="um-detail-section">
                  <h3>Personal Information</h3>
                  <p><strong>First Name:</strong> {selectedUser?.profile?.firstName || 'Not provided'}</p>
                  <p><strong>Last Name:</strong> {selectedUser?.profile?.lastName || 'Not provided'}</p>
                  <p><strong>Date of Birth:</strong> {selectedUser?.profile?.dateOfBirth ? new Date(selectedUser.profile.dateOfBirth).toLocaleDateString() : 'Not provided'}</p>
                </div>
                <div className="um-detail-section">
                  <h3>Address</h3>
                  <p><strong>Street:</strong> {selectedUser?.profile?.address?.street || 'Not provided'}</p>
                  <p><strong>City:</strong> {selectedUser?.profile?.address?.city || 'Not provided'}</p>
                  <p><strong>State:</strong> {selectedUser?.profile?.address?.state || 'Not provided'}</p>
                  <p><strong>Country:</strong> {selectedUser?.profile?.address?.country || 'Not provided'}</p>
                  <p><strong>Zip Code:</strong> {selectedUser?.profile?.address?.zipCode || 'Not provided'}</p>
                </div>
                <div className="um-detail-section">
                  <h3>Wallet</h3>
                  <p><strong>Balance:</strong> {formatETB(selectedUser?.wallet?.balance)}</p>
                  <p><strong>Bonus:</strong> {formatETB(selectedUser?.wallet?.bonusBalance)}</p>
                  <p><strong>Locked:</strong> {formatETB(selectedUser?.wallet?.lockedBalance)}</p>
                </div>
              </div>
            ) : modalMode === 'balance' ? (
              // ---------- BALANCE MODE ----------
              <form onSubmit={handleUpdateBalance}>
                <div className="um-balance-form">
                  <div className="um-current-balance">
                    <h3>Current Balance</h3>
                    <p>Balance: {formatETB(selectedUser?.wallet?.balance)}</p>
                    <p>Bonus: {formatETB(selectedUser?.wallet?.bonusBalance)}</p>
                    <p>Locked: {formatETB(selectedUser?.wallet?.lockedBalance)}</p>
                  </div>

                  <div className="um-form-group">
                    <label>Action</label>
                    <select name="action" value={balanceData.action} onChange={handleBalanceChange}>
                      <option value="add">Add to Balance</option>
                      <option value="deduct">Deduct from Balance</option>
                      <option value="set">Set Exact Balance</option>
                    </select>
                  </div>

                  <div className="um-form-group">
                    <label>Amount</label>
                    <input
                      type="number"
                      name="balance"
                      value={balanceData.balance}
                      onChange={handleBalanceChange}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="um-form-group">
                    <label>Bonus Amount (Optional)</label>
                    <input
                      type="number"
                      name="bonusBalance"
                      value={balanceData.bonusBalance}
                      onChange={handleBalanceChange}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="um-form-group">
                    <label>Locked Amount (Optional)</label>
                    <input
                      type="number"
                      name="lockedBalance"
                      value={balanceData.lockedBalance}
                      onChange={handleBalanceChange}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="um-preview">
                    <h4>Preview</h4>
                    {balanceData.action === 'add' && (
                      <p>New Balance: {formatETB((selectedUser?.wallet?.balance || 0) + balanceData.balance)}</p>
                    )}
                    {balanceData.action === 'deduct' && (
                      <p>New Balance: {formatETB(Math.max(0, (selectedUser?.wallet?.balance || 0) - balanceData.balance))}</p>
                    )}
                    {balanceData.action === 'set' && (
                      <p>New Balance: {formatETB(balanceData.balance)}</p>
                    )}
                  </div>
                </div>
                <div className="um-modal-footer">
                  <button type="button" className="um-btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="um-btn-primary">
                    Update Balance
                  </button>
                </div>
              </form>
            ) : (
              // ---------- ADD / EDIT MODE ----------
              <form onSubmit={modalMode === 'add' ? handleAddUser : handleUpdateUser}>
                <div className="um-form-grid">
                  <div className="um-form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="um-form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="um-form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="09XXXXXXXX"
                      required
                      maxLength="10"
                    />
                    <small className="um-hint">Ethiopian phone number (09 or 07 + 8 digits)</small>
                  </div>
                  {modalMode === 'add' && (
                    <div className="um-form-group">
                      <label>Password *</label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  )}
                  <div className="um-form-group">
                    <label>Role</label>
                    <select name="role" value={formData.role} onChange={handleInputChange}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="support">Support</option>
                    </select>
                  </div>
                  <div className="um-form-group">
                    <label>Status</label>
                    <select name="status" value={formData.status} onChange={handleInputChange}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div className="um-form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      name="profile.firstName"
                      value={formData.profile.firstName}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="um-form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      name="profile.lastName"
                      value={formData.profile.lastName}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="um-form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      name="profile.dateOfBirth"
                      value={formData.profile.dateOfBirth}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="um-form-group full-width">
                    <label>Street Address</label>
                    <input
                      type="text"
                      name="profile.address.street"
                      value={formData.profile.address.street}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="um-form-group">
                    <label>City</label>
                    <input
                      type="text"
                      name="profile.address.city"
                      value={formData.profile.address.city}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="um-form-group">
                    <label>State</label>
                    <input
                      type="text"
                      name="profile.address.state"
                      value={formData.profile.address.state}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="um-form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      name="profile.address.country"
                      value={formData.profile.address.country}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="um-form-group">
                    <label>Zip Code</label>
                    <input
                      type="text"
                      name="profile.address.zipCode"
                      value={formData.profile.address.zipCode}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="um-modal-footer">
                  <button type="button" className="um-btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="um-btn-primary">
                    {modalMode === 'add' ? 'Create User' : 'Update User'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===== HISTORY MODAL ===== */}
      {showHistory && (
        <div className="um-modal-overlay">
          <div className="um-modal um-history-modal">
            <div className="um-modal-header">
              <h2>
                {historyType === 'betting' ? 'Betting History' : 'Transaction History'}
              </h2>
              <button className="um-modal-close" onClick={() => setShowHistory(false)}>✖</button>
            </div>
            <div className="um-modal-body">
              {historyData.length > 0 ? (
                <table className="um-history-table">
                  <thead>
                    <tr>
                      {historyType === 'betting' ? (
                        <>
                          <th>Date</th>
                          <th>Event</th>
                          <th>Amount</th>
                          <th>Odds</th>
                          <th>Status</th>
                          <th>Winnings</th>
                        </>
                      ) : (
                        <>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Method</th>
                          <th>Status</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((item, index) => (
                      <tr key={index}>
                        {historyType === 'betting' ? (
                          <>
                            <td>{new Date(item.date).toLocaleDateString()}</td>
                            <td>{item.event}</td>
                            <td>{formatETB(item.amount)}</td>
                            <td>{item.odds}</td>
                            <td><span className={`um-status-badge ${item.status}`}>{item.status}</span></td>
                            <td>{formatETB(item.winnings || 0)}</td>
                          </>
                        ) : (
                          <>
                            <td>{new Date(item.date).toLocaleDateString()}</td>
                            <td><span className={`um-badge ${item.type}`}>{item.type}</span></td>
                            <td>{formatETB(item.amount)}</td>
                            <td>{item.method}</td>
                            <td><span className={`um-status-badge ${item.status}`}>{item.status}</span></td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="um-no-data">No history found</p>
              )}
            </div>
            <div className="um-modal-footer">
              <button className="um-btn-secondary" onClick={() => setShowHistory(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;