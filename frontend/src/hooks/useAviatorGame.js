// frontend/src/hooks/useAviatorGame.js
// Fixed: use refs for bet IDs to avoid stale closures in socket listener

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

  const [bet1, setBet1] = useState({ ...defaultBet });
  const [bet2, setBet2] = useState({ ...defaultBet });

  // Refs to hold current bet IDs (to avoid stale closures)
  const bet1IdRef = useRef(null);
  const bet2IdRef = useRef(null);

  // Update refs whenever bet IDs change
  useEffect(() => {
    bet1IdRef.current = bet1.betId;
  }, [bet1.betId]);

  useEffect(() => {
    bet2IdRef.current = bet2.betId;
  }, [bet2.betId]);

  const socketRef = useRef(null);
  const prevStatusRef = useRef('WAITING');
  const isPlacing = useRef(false);

  // ========== FETCH BALANCE ==========
  const fetchBalance = useCallback(async () => {
    try {
      const response = await aviatorApi.getBalance();
      if (response.success && typeof response.balance === 'number') {
        setBalance(response.balance);
        updateLocalStorageBalance(response.balance);
      } else {
        const local = getBalanceFromLocalStorage();
        setBalance(local.success ? local.balance : 0);
      }
    } catch (error) {
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
      setHistory([]);
    }
  }, []);

  // ========== FETCH MY BETS ==========
  const fetchMyBets = useCallback(async () => {
    try {
      const response = await aviatorApi.getMyBets(20, 0);
      if (response.success) setMyBets(response.data?.bets || []);
    } catch (error) {}
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
    } catch (error) {}
  }, []);

  // ========== FETCH LIVE PLAYERS ==========
  const fetchLivePlayers = useCallback(async () => {
    try {
      const response = await aviatorApi.getLivePlayers();
      if (response.success) setLivePlayers(response.data || []);
    } catch (error) {}
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
        if (getStoredBalance() === null) {
          await fetchBalance();
        } else {
          const stored = getStoredBalance();
          setBalance(stored);
          fetchBalance();
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

    socket.on('connection:connected', () => setConnectionStatus('connected'));
    socket.on('connection:disconnected', () => setConnectionStatus('disconnected'));
    socket.on('connection:reconnecting', () => setConnectionStatus('reconnecting'));
    socket.on('connection:reconnected', () => {
      setConnectionStatus('connected');
      fetchCurrentRound();
    });

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

      const prevStatus = prevStatusRef.current;

      if (normalizedStatus === 'RUNNING') {
        setBet1(prev => prev.status === 'pending' ? { ...prev, status: 'active' } : prev);
        setBet2(prev => prev.status === 'pending' ? { ...prev, status: 'active' } : prev);
        fetchMyBets();
      }

      if (normalizedStatus === 'CRASHED') {
        setBet1(prev => prev.status === 'active' ? { ...prev, status: 'lost' } : prev);
        setBet2(prev => prev.status === 'active' ? { ...prev, status: 'lost' } : prev);
        fetchHistory();
        fetchMyBets();
      }

      if (normalizedStatus === 'WAITING' && prevStatus !== 'WAITING') {
        setBet1(prev => {
          if (['pending','lost','cashed'].includes(prev.status)) {
            return { ...defaultBet, stake: prev.stake, autoCashOut: prev.autoCashOut, autoCashOutEnabled: prev.autoCashOutEnabled };
          }
          return prev;
        });
        setBet2(prev => {
          if (['pending','lost','cashed'].includes(prev.status)) {
            return { ...defaultBet, stake: prev.stake, autoCashOut: prev.autoCashOut, autoCashOutEnabled: prev.autoCashOutEnabled };
          }
          return prev;
        });
        fetchMyBets();
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
      const payload = data.data || data;
      const newBalance = payload.balance ?? payload.newBalance;
      if (typeof newBalance === 'number') {
        setBalance(newBalance);
        updateLocalStorageBalance(newBalance);
      }
      fetchMyBets();
      if (data.betId === bet1IdRef.current) {
        setBet1(prev => ({ ...prev, status: 'cashed', cashoutMultiplier: data.multiplier ?? 0, autoCashOutEnabled: false }));
      }
      if (data.betId === bet2IdRef.current) {
        setBet2(prev => ({ ...prev, status: 'cashed', cashoutMultiplier: data.multiplier ?? 0, autoCashOutEnabled: false }));
      }
    });

    socket.on('bet:placed', () => fetchLivePlayers());

    // ✅ FIXED: use refs to get latest bet IDs
    socket.on('bet:cashed_out', (data) => {
      const { betId, multiplier } = data;
      console.log('💸 Bet cashed out (auto or manual):', data);

      if (betId === bet1IdRef.current) {
        setBet1(prev => ({
          ...prev,
          status: 'cashed',
          cashoutMultiplier: multiplier || 0,
          autoCashOutEnabled: false   // turn off auto cashout toggle
        }));
        console.log('✅ Bet 1 marked as cashed');
      } else if (betId === bet2IdRef.current) {
        setBet2(prev => ({
          ...prev,
          status: 'cashed',
          cashoutMultiplier: multiplier || 0,
          autoCashOutEnabled: false
        }));
        console.log('✅ Bet 2 marked as cashed');
      }

      fetchLivePlayers();
      fetchMyBets();
    });

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

  // ========== PLACE BET (with optimistic lock) ==========
  const placeBet = useCallback(async (betSlot, stake) => {
    if (isPlacing.current) {
      console.warn('⚠️ Bet placement already in progress');
      return { success: false, message: 'Already placing bet' };
    }

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

      const autoCashOut = bet.autoCashOutEnabled ? Number(bet.autoCashOut) : 0;
      const newBalance = balance - stake;

      // Optimistic update
      setBet({
        ...bet,
        status: 'pending',
        betId: null,
        stake: stake,
        roundId: null,
        autoCashOutEnabled: bet.autoCashOutEnabled // keep the setting
      });
      setBalance(newBalance);
      updateLocalStorageBalance(newBalance);

      isPlacing.current = true;
      console.log('📤 Sending placeBet request:', { stake, autoCashOut, betSlot });
      const response = await aviatorApi.placeBet(stake, autoCashOut, betSlot);
      console.log('📥 placeBet response:', response);

      if (!response) {
        setBet(prev => ({ ...prev, status: 'idle' }));
        setBalance(balance);
        updateLocalStorageBalance(balance);
        setError('No response from server');
        return { success: false, message: 'No response' };
      }

      if (!response.success) {
        setBet(prev => ({ ...prev, status: 'idle' }));
        setBalance(balance);
        updateLocalStorageBalance(balance);
        const errorMsg = response.error?.message || response.message || 'Failed to place bet';
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }

      const betData = response.bet;
      if (!betData) {
        setBet(prev => ({ ...prev, status: 'idle' }));
        setBalance(balance);
        updateLocalStorageBalance(balance);
        setError('Server returned invalid bet data');
        return { success: false, message: 'Invalid response' };
      }

      const finalStatus = betData.status === 'ACTIVE' ? 'active' : 'pending';
      setBet(prev => ({
        ...prev,
        betId: betData.betId,
        status: finalStatus,
      }));

      fetchMyBets();
      return { success: true, bet: betData };

    } catch (error) {
      console.error('Error placing bet:', error);
      const bet = betSlot === 1 ? bet1 : bet2;
      const setBet = betSlot === 1 ? setBet1 : setBet2;
      setBet(prev => ({ ...prev, status: 'idle' }));
      setBalance(balance);
      updateLocalStorageBalance(balance);

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
    } finally {
      isPlacing.current = false;
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
      const payload = response.data || response;
      const newBalance = payload.balance ?? payload.newBalance;
      if (typeof newBalance === 'number') {
        setBalance(newBalance);
        updateLocalStorageBalance(newBalance);
      }
      setBet(prev => ({ ...prev, status: 'cashed', cashoutMultiplier: payload.multiplier ?? 0, autoCashOutEnabled: false }));
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
      if (error.response) errorMsg = error.response.data?.message || error.message;
      else if (error.request) errorMsg = 'Server not responding – please try again later';
      else errorMsg = error.message || 'Failed to cash out';
      setError(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [roundState, bet1, bet2]);

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
  }, [bet1, bet2, balance]);

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
        return { ...prev, autoCashOutEnabled: enabled, autoCashOut: Number(value) || 0 };
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