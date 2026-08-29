import { useState, useEffect, useCallback, useRef } from 'react';
import aviatorApi from '../services/aviatorApi';
import getAviatorSocket from '../services/aviatorSocket';

// ---------- Helpers ----------
const BALANCE_KEY = 'aviator_balance';

function getStoredBalance() {
  try {
    const stored = localStorage.getItem(BALANCE_KEY);
    if (stored !== null) {
      const val = parseFloat(stored);
      if (!isNaN(val)) return val;
    }
  } catch (e) {}
  return null;
}

function storeBalance(balance) {
  try {
    localStorage.setItem(BALANCE_KEY, String(balance));
  } catch (e) {}
}

function getBalanceFromLocalStorage() {
  const stored = getStoredBalance();
  if (stored !== null) return { success: true, balance: stored };
  // Fallback to user object
  try {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user && typeof user.balance === 'number') {
        storeBalance(user.balance);
        return { success: true, balance: user.balance };
      }
    }
  } catch (e) {}
  return { success: false, balance: 0 };
}

function updateLocalStorageBalance(balance) {
  storeBalance(balance);
  // Also update user object
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
  status: 'idle',
  roundId: null,
  cashoutMultiplier: 0,
  autoCashOut: 0,
  autoCashOutEnabled: false
};

export const useAviatorGame = () => {
  // ---------- Initialize balance from localStorage ----------
  const initialBalance = getStoredBalance() !== null ? getStoredBalance() : 0;

  const [roundState, setRoundState] = useState({
    roundId: null,
    status: 'WAITING',
    multiplier: 1.00,
    crashMultiplier: 0,
    countdown: 0,
    serverTime: Date.now()
  });

  const [balance, setBalance] = useState(initialBalance);
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
  const prevStatusRef = useRef('WAITING');
  const isFirstLoad = useRef(true);

  // ========== FETCH BALANCE (only on initial load) ==========
  const fetchBalance = useCallback(async () => {
    try {
      console.log('🔄 Fetching balance from server...');
      const response = await aviatorApi.getBalance();
      console.log('📊 Balance response:', response);
      if (response.success && typeof response.balance === 'number') {
        setBalance(response.balance);
        updateLocalStorageBalance(response.balance);
      } else {
        const local = getBalanceFromLocalStorage();
        if (local.success) {
          setBalance(local.balance);
          updateLocalStorageBalance(local.balance);
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
        // Only fetch balance on initial load if we don't have a stored balance
        if (getStoredBalance() === null) {
          await fetchBalance();
        } else {
          // Use stored balance
          const stored = getStoredBalance();
          setBalance(stored);
          // Optionally, sync with server silently
          fetchBalance(); // will update if different, but might cause refund issue – we'll handle via optimistic updates
        }
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
  }, []);

  // ========== SOCKET CONNECTION ==========
  const connectSocket = (token) => {
    const socket = getAviatorSocket();
    socketRef.current = socket;
    socket.connect(token);
    setConnectionStatus('connecting');

    socket.on('connection:connected', () => {
      setConnectionStatus('connected');
      // Don't refresh balance on reconnect – trust local storage
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
    });

    // ---------- ROUND STATE ----------
    socket.on('round:state', (data) => {
      const normalizedStatus = normalizeStatus(data.status);
      const currentRoundId = data.roundId || roundState.roundId;

      console.log(`📡 Round state: ${normalizedStatus} (${data.status})`);

      setRoundState(prev => ({
        ...prev,
        roundId: currentRoundId,
        status: normalizedStatus,
        multiplier: data.multiplier !== undefined ? data.multiplier : prev.multiplier,
        crashMultiplier: data.crashMultiplier || 0,
        serverTime: data.serverTime || Date.now()
      }));

      const prevStatus = prevStatusRef.current;

      if (normalizedStatus === 'RUNNING') {
        console.log('🏁 Round started – activating pending bets');
        setBet1(prev => {
          if (prev.status === 'pending') {
            console.log('✅ Bet 1 activated');
            return { ...prev, status: 'active' };
          }
          return prev;
        });
        setBet2(prev => {
          if (prev.status === 'pending') {
            console.log('✅ Bet 2 activated');
            return { ...prev, status: 'active' };
          }
          return prev;
        });
        fetchMyBets();
      }

      if (normalizedStatus === 'CRASHED') {
        console.log('💥 Round crashed – marking active bets as lost');
        setBet1(prev => prev.status === 'active' ? { ...prev, status: 'lost' } : prev);
        setBet2(prev => prev.status === 'active' ? { ...prev, status: 'lost' } : prev);
        fetchHistory();
        fetchMyBets();
        // Do NOT fetch balance – keep our local deduction
      }

      if (normalizedStatus === 'WAITING' && prevStatus !== 'WAITING') {
        console.log('🔄 Round reset to WAITING – resetting bets to idle');
        setBet1(prev => {
          if (prev.status === 'pending' || prev.status === 'lost' || prev.status === 'cashed') {
            return { ...defaultBet, stake: prev.stake, autoCashOut: prev.autoCashOut, autoCashOutEnabled: prev.autoCashOutEnabled };
          }
          return prev;
        });
        setBet2(prev => {
          if (prev.status === 'pending' || prev.status === 'lost' || prev.status === 'cashed') {
            return { ...defaultBet, stake: prev.stake, autoCashOut: prev.autoCashOut, autoCashOutEnabled: prev.autoCashOutEnabled };
          }
          return prev;
        });
        fetchMyBets();
        // We do NOT fetch balance to keep our local state
      }

      prevStatusRef.current = normalizedStatus;
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
      // When bet is accepted, server may send updated balance – but we already did optimistic update.
      // Only update if we received a new balance and it's different.
      if (typeof data.balance === 'number') {
        setBalance(data.balance);
        updateLocalStorageBalance(data.balance);
      }
      fetchMyBets();
    });

    socket.on('bet:rejected', (data) => {
      setError(data.error?.message || 'Bet rejected');
      setTimeout(() => setError(null), 3000);
    });

    socket.on('cashout:success', (data) => {
      console.log('💰 Cashout success:', data);
      // The response might have `balance` or `newBalance` at root or inside `data`
      const payload = data.data || data;
      const newBalance = payload.balance ?? payload.newBalance;
      if (typeof newBalance === 'number') {
        setBalance(newBalance);
        updateLocalStorageBalance(newBalance);
      }
      fetchMyBets();
      if (data.betId === bet1.betId) {
        setBet1(prev => ({ ...prev, status: 'cashed', cashoutMultiplier: data.multiplier ?? 0 }));
      }
      if (data.betId === bet2.betId) {
        setBet2(prev => ({ ...prev, status: 'cashed', cashoutMultiplier: data.multiplier ?? 0 }));
      }
    });

    socket.on('bet:placed', () => fetchLivePlayers());
    socket.on('bet:cashed_out', () => fetchLivePlayers());
    socket.on('wallet:updated', (data) => {
      const payload = data.data || data;
      const newBalance = payload.balance ?? payload.newBalance;
      if (typeof newBalance === 'number') {
        console.log('💳 Wallet updated:', newBalance);
        setBalance(newBalance);
        updateLocalStorageBalance(newBalance);
      }
    });
    socket.on('system:error', (data) => {
      setError(data.message || 'System error');
      setTimeout(() => setError(null), 3000);
    });
  };

  // ========== PLACE BET ==========
  // ✅ Updated: now passes betSlot to the API
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

      console.log('📤 Sending placeBet request:', { stake, autoCashOut, betSlot });
      // ✅ Pass betSlot to the API
      const response = await aviatorApi.placeBet(stake, autoCashOut, betSlot);
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

      const betData = response.bet;
      if (!betData) {
        setError('Server returned invalid bet data');
        return { success: false, message: 'Invalid response' };
      }

      console.log('📦 Bet data from server:', betData);

      const newStatus = betData.status === 'ACTIVE' ? 'active' : 'pending';
      console.log(`🎯 Setting bet ${betSlot} status to: ${newStatus}`);

      // Deduct balance immediately (optimistic update)
      const newBalance = balance - stake;
      setBalance(newBalance);
      updateLocalStorageBalance(newBalance);
      console.log(`💰 New balance after bet: ${newBalance}`);

      setBet({
        ...bet,
        betId: betData.betId,
        stake: stake,
        roundId: null,
        status: newStatus,
      });

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
      console.log('💰 Cashout response:', response);
      if (!response || !response.success) {
        const errorMsg = response?.error?.message || response?.message || 'Failed to cash out';
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }
      // The response may have data at root or inside `data`
      const payload = response.data || response;
      const newBalance = payload.balance ?? payload.newBalance;
      if (typeof newBalance === 'number') {
        setBalance(newBalance);
        updateLocalStorageBalance(newBalance);
      }
      setBet(prev => ({ ...prev, status: 'cashed', cashoutMultiplier: payload.multiplier ?? 0 }));
      fetchMyBets();
      return {
        success: true,
        payout: payload.winAmount || payload.payout || 0,
        profit: payload.profit || 0,
        multiplier: payload.multiplier || 0
      };
    } catch (error) {
      console.error('Error cashing out:', error);
      let errorMsg = 'Network error – please check your connection';
      if (error.response) {
        errorMsg = error.response.data?.message || error.message;
      } else if (error.request) {
        errorMsg = 'Server not responding – please try again later';
      } else {
        errorMsg = error.message || 'Failed to cash out';
      }
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
      const newBalance = response.data?.newBalance ?? response.newBalance;
      if (typeof newBalance === 'number') {
        setBalance(newBalance);
        updateLocalStorageBalance(newBalance);
      } else {
        // Refund the stake manually
        const refund = balance + bet.stake;
        setBalance(refund);
        updateLocalStorageBalance(refund);
      }
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
  }, [bet1, bet2, balance, fetchBalance, fetchMyBets]);

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