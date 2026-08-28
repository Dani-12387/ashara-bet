import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://ashara-bet.onrender.com';

// ---------- Helpers for localStorage balance ----------
function getBalanceFromLocalStorage() {
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user && typeof user.balance === 'number') {
        return { success: true, balance: user.balance };
      }
    }
  } catch (e) {
    console.error('Error reading user from localStorage:', e);
  }
  return { success: false, balance: 0 };
}

function updateLocalStorageBalance(balance) {
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      user.balance = balance;
      localStorage.setItem('user', JSON.stringify(user));
    }
  } catch (e) {
    console.error('Error updating localStorage user balance:', e);
  }
}

const aviatorApi = {
  // ==================== BALANCE ====================
  getBalance: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found – returning localStorage balance');
        return getBalanceFromLocalStorage();
      }

      const response = await axios.get(`${API_URL}/api/user/balance`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000
      });

      console.log('📊 Balance API response:', response.data);

      if (response.data && typeof response.data.balance === 'number') {
        const balance = response.data.balance;
        updateLocalStorageBalance(balance);
        return { success: true, balance };
      }

      if (response.data && response.data.data && typeof response.data.data.balance === 'number') {
        const balance = response.data.data.balance;
        updateLocalStorageBalance(balance);
        return { success: true, balance };
      }

      console.warn('Unexpected balance response format, using localStorage');
      return getBalanceFromLocalStorage();
    } catch (error) {
      console.error('Error fetching balance from API:', error);
      const local = getBalanceFromLocalStorage();
      if (local.success) {
        console.log('Using fallback balance from localStorage:', local.balance);
        return local;
      }
      return { success: false, balance: 0 };
    }
  },

  // ==================== ROUND ====================
  getCurrentRound: async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/current-round`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting current round:', error);
      return { success: false };
    }
  },

  // ==================== HISTORY ====================
  getHistory: async (limit = 20) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/history?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(response.data)) {
        return { success: true, data: response.data };
      }
      if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        return response.data;
      }
      return { success: true, data: [] };
    } catch (error) {
      console.error('Error getting history:', error);
      return { success: false, data: [] };
    }
  },

  // ==================== MY BETS ====================
  getMyBets: async (limit = 20, offset = 0) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/my-bets?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting my bets:', error);
      return { success: false, data: { bets: [], total: 0 } };
    }
  },

  // ==================== LIVE PLAYERS ====================
  getLivePlayers: async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/live-players`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting live players:', error);
      return { success: false, data: [] };
    }
  },

  // ==================== PLACE BET ====================
  placeBet: async (amount, autoCashOut = 0) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/aviator/bet`,
        { amount, autoCashOut },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000 // 10 second timeout
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error placing bet:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        return {
          success: false,
          error: error.response.data?.error || { message: error.response.data?.message || error.message },
          status: error.response.status
        };
      } else if (error.request) {
        // The request was made but no response was received
        return {
          success: false,
          error: { message: 'Server not responding – please try again later' }
        };
      } else {
        // Something happened in setting up the request
        return {
          success: false,
          error: { message: error.message || 'Failed to place bet' }
        };
      }
    }
  },

  // ==================== CASH OUT ====================
  cashOut: async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/aviator/cashout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error cashing out:', error);
      if (error.response) {
        return {
          success: false,
          error: error.response.data?.error || { message: error.response.data?.message || error.message },
          status: error.response.status
        };
      } else if (error.request) {
        return {
          success: false,
          error: { message: 'Server not responding – please try again later' }
        };
      } else {
        return {
          success: false,
          error: { message: error.message || 'Failed to cash out' }
        };
      }
    }
  },

  // ==================== CANCEL PENDING BET ====================
  cancelPendingBet: async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/aviator/cancel-pending`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error cancelling pending bet:', error);
      if (error.response) {
        return {
          success: false,
          error: error.response.data?.error || { message: error.response.data?.message || error.message },
          status: error.response.status
        };
      } else if (error.request) {
        return {
          success: false,
          error: { message: 'Server not responding – please try again later' }
        };
      } else {
        return {
          success: false,
          error: { message: error.message || 'Failed to cancel bet' }
        };
      }
    }
  },

  // ==================== VERIFY ROUND ====================
  verifyRound: async (roundId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/verify/${roundId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error verifying round:', error);
      return { success: false };
    }
  }
};

export default aviatorApi;