import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://ashara-bet.onrender.com';

const aviatorApi = {
  // ==================== BALANCE ====================
  getBalance: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, message: 'No token' };
      }
      const response = await axios.get(`${API_URL}/api/user/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching balance:', error);
      // Fallback to localStorage
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          if (user && typeof user.balance === 'number') {
            return { success: true, balance: user.balance };
          }
        }
      } catch (e) {}
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
      return response.data;
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
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error placing bet:', error);
      return {
        success: false,
        error: error.response?.data?.error || { message: error.message }
      };
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
      return {
        success: false,
        error: error.response?.data?.error || { message: error.message }
      };
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
      console.error('Error cancelling bet:', error);
      return {
        success: false,
        error: error.response?.data?.error || { message: error.message }
      };
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