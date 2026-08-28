import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://ashara-bet.onrender.com';

const aviatorApi = {
  // Get user balance - with multiple fallbacks
  getBalance: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ No token found for balance request');
        return { success: false, message: 'No token' };
      }
      const response = await axios.get(`${API_URL}/api/user/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('📊 Balance API raw response:', response.data);
      
      // Check if balance exists in response
      if (response.data && typeof response.data.balance === 'number') {
        return { success: true, balance: response.data.balance };
      }
      
      // If response has data in different format
      if (response.data && typeof response.data.data?.balance === 'number') {
        return { success: true, balance: response.data.data.balance };
      }
      
      console.warn('⚠️ Balance not found in API response, checking localStorage');
      // Fallback to localStorage
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user && typeof user.balance === 'number') {
            return { success: true, balance: user.balance };
          }
        } catch (e) {}
      }
      
      return { success: false, balance: 0 };
    } catch (error) {
      console.error('❌ Error fetching balance:', error);
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

  // Get current round
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

  // Get history
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

  // Get my bets
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

  // Get live players
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

  // Place bet
  placeBet: async (roundId, stake, betSlot = 1) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/aviator/bet`, 
        { roundId, stake, betSlot },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error placing bet:', error);
      return { success: false, error: error.response?.data?.error || { message: error.message } };
    }
  },

  // Cash out
  cashOut: async (betId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/aviator/cashout`,
        { betId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error cashing out:', error);
      return { success: false, error: error.response?.data?.error || { message: error.message } };
    }
  },

  // Cancel pending bet
  cancelPendingBet: async (betId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/aviator/cancel-pending`,
        { betId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error cancelling bet:', error);
      return { success: false, error: error.response?.data?.error || { message: error.message } };
    }
  },

  // Verify round
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