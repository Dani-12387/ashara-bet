import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://ashara-bet.onrender.com';

const aviatorApi = {
  // Get user balance
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
      return { success: false, balance: 0 };
    }
  },

  // Place a bet
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
      return { success: false, message: error.response?.data?.message || 'Error placing bet' };
    }
  },

  // Cash out
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
      return { success: false, message: error.response?.data?.message || 'Error cashing out' };
    }
  },

  // Cancel pending bet
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
      return { success: false, message: error.response?.data?.message || 'Error cancelling bet' };
    }
  },

  // Get game state
  getGameState: async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/state`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting game state:', error);
      return { status: 'idle', multiplier: 1.00 };
    }
  },

  // Get history
  getHistory: async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/aviator/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting history:', error);
      return [];
    }
  }
};

export default aviatorApi;