import { useState, useEffect, useCallback, useRef } from 'react';
import aviatorApi from '../services/aviatorApi';
import getAviatorSocket from '../services/aviatorSocket';

// ---------- Helpers (same as in api, but we keep them here for consistency) ----------
function getBalanceFromLocalStorage() {
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

function updateLocalStorageBalance(balance) {
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      user.balance = balance;
      localStorage.setItem('user', JSON.stringify(user));
    }
  } catch (e) {}
}

export const useAviatorGame = () => {
  const [roundState, setRoundState] = useState({
    roundId: null,
    status: 'WAITING',
    multiplier: 1.00,
    crashMultiplier: 0,
    countdown: 0,
    serverTime: Date.now()
  });

  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [myBets, setMyBets] = useState([]);
  const [livePlayers, setLivePlayers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);

  const bet1Ref = useRef({
    stake: 10,
    betId: null,
    status: 'idle',
    autoCashOut: 0,
    autoCashOutEnabled: false
  });
  const bet2Ref = useRef({
    stake: 10,
    betId: null,
    status: 'idle',
    autoCashOut: 0,
    autoCashOutEnabled: false
  });

  // ========== FETCH BALANCE ==========
  const fetchBalance = useCallback(async () => {
    try {
      console.log('🔄 Fetching balance...');
      const response = await aviatorApi.getBalance();
      console.log('📊 Balance response:', response);
      if (response.success && typeof response.balance === 'number') {
        setBalance(response.balance);
        updateLocalStorageBalance(response.balance);
      } else {
        // If API failed, try localStorage
        const local = getBalanceFromLocalStorage();
        if (local.success) {
          setBalance(local.balance);
        } else {
          setBalance(0);
        }
      }
    } catch (error) {
      console.error('Error in fetchBalance:', error);
      const local = getBalanceFromLocalStorage();
      setBalance(local.success ? local.balance : 0);
    }
  }, []);

  // ========== FETCH HISTORY ==========
  const fetchHistory = useCallback(async () => {
    try {
      const response = await aviatorApi.getHistory(20);
      let historyData = [];
      if (Array.isArray(response)) {
        historyData = response;
      } else if (response.data && Array.isArray(response.data)) {
        historyData = response.data;
      } else if (response.success && Array.isArray(response.data)) {
        historyData = response.data;
      }
      setHistory(historyData);
    } catch (error) {
      console.error('Error fetching history:', error);
      setHistory([]);
    }
  }, []);

  // ========== FETCH MY BETS ==========
  const fetchMyBets = useCallback(async () => {
    try {
      const response = await aviatorApi.getMyBets(20, 0);
      if (response.success) {
        setMyBets(response.data?.bets || []);
      }
    } catch (error) {
      console.error('Error fetching my bets:', error);
    }
  }, []);

  // ========== FETCH CURRENT ROUND ==========
  const fetchCurrentRound = useCallback(async () => {
    try {
      const response = await aviatorApi.getCurrentRound();
      if (response.success) {
        setRoundState(prev => ({
          ...prev,
          roundId: response.data.roundId,
          status: response.data.status || 'WAITING',
          multiplier: response.data.multiplier || 1.00,
          crashMultiplier: response.data.crashMultiplier || 0,
          serverTime: response.data.serverTime || Date.now()
        }));
      }
    } catch (error) {
      console.error('Error fetching current round:', error);
    }
  }, []);

  // ========== FETCH LIVE PLAYERS ==========
  const fetchLivePlayers = useCallback(async () => {
    try {
      const response = await aviatorApi.getLivePlayers();
      if (response.success) {
        setLivePlayers(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching live players:', error);
    }
  }, []);

  // ========== INITIALIZE ==========
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please login to play');
          setLoading(false);
          return;
        }

        // Fetch balance first
        await fetchBalance();

        // Then fetch other data
        await Promise.all([
          fetchHistory(),
          fetchMyBets(),
          fetchCurrentRound(),
          fetchLivePlayers()
        ]);

        connectSocket(token);
        setLoading(false);
      } catch (error) {
        console.error('Error initializing:', error);
        setError('Failed to load game');
        setLoading(false);
      }
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [fetchBalance, fetchHistory, fetchMyBets, fetchCurrentRound, fetchLivePlayers]);

  // ========== SOCKET CONNECTION ==========
  const connectSocket = (token) => {
    const socket = getAviatorSocket();
    socketRef.current = socket;
    socket.connect(token);
    setConnectionStatus('connecting');

    socket.on('connection:connected', () => {
      setConnectionStatus('connected');
      fetchBalance();
    });

    socket.on('connection:disconnected', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connection:reconnecting', () => {
      setConnectionStatus('reconnecting');
    });

    socket.on('connection:reconnected', () => {
      setConnectionStatus('connected');
      fetchCurrentRound();
      fetchBalance();
    });

    socket.on('round:state', (data) => {
      setRoundState(prev => ({
        ...prev,
        roundId: data.roundId || prev.roundId,
        status: data.status || prev.status,
        multiplier: data.multiplier !== undefined ? data.multiplier : prev.multiplier,
        crashMultiplier: data.crashMultiplier || 0,
        serverTime: data.serverTime || Date.now()
      }));

      if (data.status === 'CRASHED' || data.status === 'crashed') {
        if (bet1Ref.current.status === 'active') {
          bet1Ref.current.status = 'lost';
        }
        if (bet2Ref.current.status === 'active') {
          bet2Ref.current.status = 'lost';
        }
        fetchHistory();
        fetchMyBets();
        fetchBalance();
      }
    });

    socket.on('round:countdown', (data) => {
      setRoundState(prev => ({ ...prev, countdown: data.countdown }));
    });

    socket.on('round:multiplier', (data) => {
      setRoundState(prev => ({
        ...prev,
        multiplier: data.multiplier,
        serverTime: data.serverTime || Date.now()
      }));
    });

    socket.on('bet:accepted', (data) => {
      setBalance(data.balance);
      fetchMyBets();
    });

    socket.on('bet:rejected', (data) => {
      setError(data.error?.message || 'Bet rejected');
      setTimeout(() => setError(null), 3000);
    });

    socket.on('cashout:success', (data) => {
      setBalance(data.balance);
      fetchMyBets();
      if (data.betId === bet1Ref.current.betId) {
        bet1Ref.current.status = 'cashed';
      }
      if (data.betId === bet2Ref.current.betId) {
        bet2Ref.current.status = 'cashed';
      }
    });

    socket.on('bet:placed', () => { fetchLivePlayers(); });
    socket.on('bet:cashed_out', () => { fetchLivePlayers(); });
    socket.on('wallet:updated', (data) => {
      setBalance(data.balance || data.newBalance);
    });
    socket.on('system:error', (data) => {
      setError(data.message || 'System error');
      setTimeout(() => setError(null), 3000);
    });
  };

  // ========== PLACE BET ==========
  const placeBet = useCallback(async (betSlot, stake) => {
    try {
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to bet');
        return { success: false, message: 'Please login' };
      }

      if (roundState.status !== 'WAITING' && roundState.status !== 'BETTING_OPEN') {
        setError('Betting is only available before the round starts');
        return { success: false, message: 'Betting not available' };
      }

      if (stake > balance) {
        setError(`Insufficient balance! Balance: ${balance.toFixed(2)} ETB`);
        return { success: false, message: 'Insufficient balance' };
      }

      const betRef = betSlot === 1 ? bet1Ref : bet2Ref;
      if (betRef.current.status === 'pending' || betRef.current.status === 'active') {
        setError('Bet already placed');
        return { success: false, message: 'Bet already placed' };
      }

      const autoCashOut = betRef.current.autoCashOutEnabled ? betRef.current.autoCashOut : 0;

      const response = await aviatorApi.placeBet(stake, autoCashOut);

      if (response.success) {
        const betData = response.data.bet;
        betRef.current.betId = betData.betId;
        betRef.current.stake = stake;
        betRef.current.status = betData.status === 'ACTIVE' ? 'active' : 'pending';
        if (response.data.newBalance !== undefined) {
          setBalance(response.data.newBalance);
        } else {
          fetchBalance();
        }
        fetchMyBets();
        return { success: true, bet: betData };
      } else {
        setError(response.error?.message || 'Failed to place bet');
        return { success: false, message: response.error?.message };
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      setError(error.message || 'Failed to place bet');
      return { success: false, message: error.message };
    }
  }, [roundState, balance, fetchBalance, fetchMyBets]);

  // ========== CASH OUT ==========
  const cashOut = useCallback(async (betSlot) => {
    try {
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to cash out');
        return { success: false, message: 'Please login' };
      }

      if (roundState.status !== 'RUNNING') {
        setError('Round is not running');
        return { success: false, message: 'Round is not running' };
      }

      const betRef = betSlot === 1 ? bet1Ref : bet2Ref;
      if (betRef.current.status !== 'active') {
        setError('No active bet found');
        return { success: false, message: 'No active bet found' };
      }

      const response = await aviatorApi.cashOut();

      if (response.success) {
        const data = response.data;
        betRef.current.status = 'cashed';
        if (data.newBalance !== undefined) {
          setBalance(data.newBalance);
        } else {
          fetchBalance();
        }
        fetchMyBets();
        return {
          success: true,
          payout: data.winAmount || data.payout,
          profit: data.profit,
          multiplier: data.multiplier
        };
      } else {
        setError(response.error?.message || 'Failed to cash out');
        return { success: false, message: response.error?.message };
      }
    } catch (error) {
      console.error('Error cashing out:', error);
      setError(error.message || 'Failed to cash out');
      return { success: false, message: error.message };
    }
  }, [roundState, fetchBalance, fetchMyBets]);

  // ========== CANCEL PENDING BET ==========
  const cancelBet = useCallback(async (betSlot) => {
    try {
      setError(null);

      const betRef = betSlot === 1 ? bet1Ref : bet2Ref;
      if (betRef.current.status !== 'pending') {
        setError('No pending bet to cancel');
        return { success: false, message: 'No pending bet to cancel' };
      }

      const response = await aviatorApi.cancelPendingBet();

      if (response.success) {
        betRef.current.status = 'cancelled';
        if (response.data.newBalance !== undefined) {
          setBalance(response.data.newBalance);
        } else {
          fetchBalance();
        }
        fetchMyBets();
        return { success: true, message: 'Bet cancelled' };
      } else {
        setError(response.error?.message || 'Failed to cancel bet');
        return { success: false, message: response.error?.message };
      }
    } catch (error) {
      console.error('Error cancelling bet:', error);
      setError(error.message || 'Failed to cancel bet');
      return { success: false, message: error.message };
    }
  }, [fetchBalance, fetchMyBets]);

  // ========== GET BET STATE ==========
  const getBetState = useCallback((betSlot) => {
    const betRef = betSlot === 1 ? bet1Ref : bet2Ref;
    return {
      betId: betRef.current.betId,
      stake: betRef.current.stake,
      status: betRef.current.status,
      autoCashOut: betRef.current.autoCashOut,
      autoCashOutEnabled: betRef.current.autoCashOutEnabled
    };
  }, []);

  // ========== SET BET STAKE ==========
  const setBetStake = useCallback((betSlot, stake) => {
    const betRef = betSlot === 1 ? bet1Ref : bet2Ref;
    if (betRef.current.status === 'idle' || betRef.current.status === 'cancelled') {
      betRef.current.stake = stake;
    }
  }, []);

  // ========== SET AUTO CASH OUT ==========
  const setAutoCashOut = useCallback((betSlot, enabled, value) => {
    const betRef = betSlot === 1 ? bet1Ref : bet2Ref;
    if (betRef.current.status === 'idle' || betRef.current.status === 'cancelled') {
      betRef.current.autoCashOutEnabled = enabled;
      betRef.current.autoCashOut = value || 0;
    }
  }, []);

  // ========== EXPOSE REFRESH ==========
  const refreshBalance = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  return {
    roundState,
    balance,
    history,
    myBets,
    livePlayers,
    connectionStatus,
    loading,
    error,
    placeBet,
    cashOut,
    cancelBet,
    getBetState,
    setBetStake,
    setAutoCashOut,
    fetchBalance,
    fetchHistory,
    fetchMyBets,
    fetchCurrentRound,
    fetchLivePlayers,
    refreshBalance, // new
    bet1Ref,
    bet2Ref
  };
};

export default useAviatorGame;