import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://ashara-bet.onrender.com';

const aviatorApi = {
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
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
      throw error;
    }
  },

  // Get user balance
  getBalance: async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/user/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }
};

export default aviatorApi;