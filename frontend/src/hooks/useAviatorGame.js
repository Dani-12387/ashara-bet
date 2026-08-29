import { useState, useEffect, useCallback, useRef } from 'react';
import aviatorApi from '../services/aviatorApi';
import getAviatorSocket from '../services/aviatorSocket';

// ---------- Helpers ----------
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

// ---------- Status Normalization ----------
const normalizeStatus = (status) => {
  if (!status) return 'WAITING';
  const s = status.toLowerCase();
  if (s === 'idle' || s === 'waiting' || s === 'betting_open') return 'WAITING';
  if (s === 'active' || s === 'running') return 'RUNNING';
  if (s === 'crashed') return 'CRASHED';
  if (s === 'closed') return 'CLOSED';
  if (s === 'betting_closed') return 'BETTING_CLOSED';
  return status;
};

// ---------- Default bet state ----------
const defaultBet = {
  stake: 10,
  betId: null,
  status: 'idle',          // idle, pending, active, cashed, cancelled, lost
  roundId: null,
  cashoutMultiplier: 0,
  autoCashOut: 0,
  autoCashOutEnabled: false
};

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

  // ---------- Bet states ----------
  const [bet1, setBet1] = useState({ ...defaultBet });
  const [bet2, setBet2] = useState({ ...defaultBet });

  const socketRef = useRef(null);

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
        const local = getBalanceFromLocalStorage();
        setBalance(local.success ? local.balance : 0);
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
      if (Array.isArray(response)) historyData = response;
      else if (response.data && Array.isArray(response.data)) historyData = response.data;
      else if (response.success && Array.isArray(response.data)) historyData = response.data;
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
      if (response.success) setMyBets(response.data?.bets || []);
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
          status: normalizeStatus(response.data.status),
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
      if (response.success) setLivePlayers(response.data || []);
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
        await fetchBalance();
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
      if (socketRef.current) socketRef.current.disconnect();
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

    // ---------- ROUND STATE ----------
    socket.on('round:state', (data) => {
      const normalizedStatus = normalizeStatus(data.status);
      setRoundState(prev => ({
        ...prev,
        roundId: data.roundId || prev.roundId,
        status: normalizedStatus,
        multiplier: data.multiplier !== undefined ? data.multiplier : prev.multiplier,
        crashMultiplier: data.crashMultiplier || 0,
        serverTime: data.serverTime || Date.now()
      }));

      // Activate pending bets when round starts – using functional updates
      if (normalizedStatus === 'RUNNING') {
        const currentRoundId = data.roundId || roundState.roundId;
        setBet1(prev => {
          if (prev.status === 'pending' && prev.roundId === currentRoundId) {
            console.log('✅ Bet 1 activated');
            return { ...prev, status: 'active' };
          }
          return prev;
        });
        setBet2(prev => {
          if (prev.status === 'pending' && prev.roundId === currentRoundId) {
            console.log('✅ Bet 2 activated');
            return { ...prev, status: 'active' };
          }
          return prev;
        });
        fetchMyBets();
      }

      if (normalizedStatus === 'CRASHED') {
        setBet1(prev => prev.status === 'active' ? { ...prev, status: 'lost' } : prev);
        setBet2(prev => prev.status === 'active' ? { ...prev, status: 'lost' } : prev);
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
      if (data.betId === bet1.betId) {
        setBet1(prev => ({ ...prev, status: 'cashed', cashoutMultiplier: data.multiplier }));
      }
      if (data.betId === bet2.betId) {
        setBet2(prev => ({ ...prev, status: 'cashed', cashoutMultiplier: data.multiplier }));
      }
    });

    socket.on('bet:placed', () => fetchLivePlayers());
    socket.on('bet:cashed_out', () => fetchLivePlayers());
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

      if (roundState.status !== 'WAITING') {
        setError('Betting is only available before the round starts');
        return { success: false, message: 'Betting not available' };
      }

      if (stake > balance) {
        setError(`Insufficient balance! Balance: ${balance.toFixed(2)} ETB`);
        return { success: false, message: 'Insufficient balance' };
      }

      const bet = betSlot === 1 ? bet1 : bet2;
      const setBet = betSlot === 1 ? setBet1 : setBet2;

      if (bet.status === 'pending' || bet.status === 'active') {
        setError('Bet already placed');
        return { success: false, message: 'Bet already placed' };
      }

      const autoCashOut = bet.autoCashOutEnabled ? bet.autoCashOut : 0;

      console.log('📤 Sending placeBet request:', { stake, autoCashOut });
      const response = await aviatorApi.placeBet(stake, autoCashOut);
      console.log('📥 placeBet response:', response);

      if (!response) {
        setError('No response from server');
        return { success: false, message: 'No response' };
      }

      if (!response.success) {
        const errorMsg = response.error?.message || response.message || 'Failed to place bet';
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }

      // ✅ Ensure we have bet data
      if (!response.data || !response.data.bet) {
        setError('Server returned invalid bet data');
        return { success: false, message: 'Invalid response' };
      }

      const betData = response.data.bet;
      console.log('📦 Bet data from server:', betData);

      // ✅ Update bet state – force status to 'pending' if not 'active'
      const newStatus = betData.status === 'ACTIVE' ? 'active' : 'pending';
      console.log(`🎯 Setting bet ${betSlot} status to: ${newStatus}`);

      setBet({
        ...bet,
        betId: betData.betId,
        stake: stake,
        roundId: betData.gameRound ? `AV-${betData.gameRound}` : roundState.roundId || null,
        status: newStatus,
      });

      // ✅ Update balance – use newBalance if provided, else optimistically deduct
      if (response.data.newBalance !== null && response.data.newBalance !== undefined) {
        setBalance(response.data.newBalance);
        updateLocalStorageBalance(response.data.newBalance);
      } else {
        const newBalance = balance - stake;
        setBalance(newBalance);
        updateLocalStorageBalance(newBalance);
      }

      fetchMyBets();
      return { success: true, bet: betData };

    } catch (error) {
      console.error('Error placing bet:', error);
      let errorMsg = 'Network error – please check your connection';
      if (error.response) {
        errorMsg = error.response.data?.message || error.message;
      } else if (error.request) {
        errorMsg = 'Server not responding – please try again later';
      } else {
        errorMsg = error.message || 'Failed to place bet';
      }
      setError(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [roundState, balance, bet1, bet2]);

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
      const bet = betSlot === 1 ? bet1 : bet2;
      const setBet = betSlot === 1 ? setBet1 : setBet2;
      if (bet.status !== 'active') {
        setError('No active bet found');
        return { success: false, message: 'No active bet found' };
      }
      const response = await aviatorApi.cashOut();
      if (!response || !response.success) {
        const errorMsg = response?.error?.message || response?.message || 'Failed to cash out';
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }
      const data = response.data;
      setBet(prev => ({ ...prev, status: 'cashed', cashoutMultiplier: data.multiplier }));
      if (data.newBalance !== undefined) setBalance(data.newBalance);
      else fetchBalance();
      fetchMyBets();
      return { success: true, payout: data.winAmount || data.payout, profit: data.profit, multiplier: data.multiplier };
    } catch (error) {
      console.error('Error cashing out:', error);
      let errorMsg = 'Network error – please check your connection';
      if (error.response) errorMsg = error.response.data?.message || error.message;
      else if (error.request) errorMsg = 'Server not responding – please try again later';
      else errorMsg = error.message || 'Failed to cash out';
      setError(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [roundState, bet1, bet2, fetchBalance, fetchMyBets]);

  // ========== CANCEL PENDING BET ==========
  const cancelBet = useCallback(async (betSlot) => {
    try {
      setError(null);
      const bet = betSlot === 1 ? bet1 : bet2;
      const setBet = betSlot === 1 ? setBet1 : setBet2;
      if (bet.status !== 'pending') {
        setError('No pending bet to cancel');
        return { success: false, message: 'No pending bet to cancel' };
      }
      const response = await aviatorApi.cancelPendingBet();
      if (!response || !response.success) {
        const errorMsg = response?.error?.message || response?.message || 'Failed to cancel bet';
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }
      setBet(prev => ({ ...prev, status: 'cancelled', roundId: null }));
      if (response.data.newBalance !== undefined) setBalance(response.data.newBalance);
      else fetchBalance();
      fetchMyBets();
      return { success: true, message: 'Bet cancelled' };
    } catch (error) {
      console.error('Error cancelling bet:', error);
      let errorMsg = 'Network error – please check your connection';
      if (error.response) errorMsg = error.response.data?.message || error.message;
      else if (error.request) errorMsg = 'Server not responding – please try again later';
      else errorMsg = error.message || 'Failed to cancel bet';
      setError(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [bet1, bet2, fetchBalance, fetchMyBets]);

  // ========== GET BET STATE ==========
  const getBetState = useCallback((betSlot) => {
    return betSlot === 1 ? bet1 : bet2;
  }, [bet1, bet2]);

  // ========== SET BET STAKE ==========
  const setBetStake = useCallback((betSlot, stake) => {
    const setBet = betSlot === 1 ? setBet1 : setBet2;
    setBet(prev => {
      if (prev.status === 'idle' || prev.status === 'cancelled') {
        return { ...prev, stake };
      }
      return prev;
    });
  }, []);

  // ========== SET AUTO CASH OUT ==========
  const setAutoCashOut = useCallback((betSlot, enabled, value) => {
    const setBet = betSlot === 1 ? setBet1 : setBet2;
    setBet(prev => {
      if (prev.status === 'idle' || prev.status === 'cancelled') {
        return { ...prev, autoCashOutEnabled: enabled, autoCashOut: value || 0 };
      }
      return prev;
    });
  }, []);

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
    refreshBalance,
    bet1,
    bet2
  };
};

export default useAviatorGame;