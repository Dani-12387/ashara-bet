import { useState, useEffect, useCallback, useRef } from 'react';
import aviatorApi from '../services/aviatorApi';
import getAviatorSocket from '../services/aviatorSocket';

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
    betId: null,
    stake: 10,
    isActive: false,
    isPending: false,
    status: 'idle'
  });
  const bet2Ref = useRef({
    betId: null,
    stake: 10,
    isActive: false,
    isPending: false,
    status: 'idle'
  });

  // ========== FETCH BALANCE ==========
  const fetchBalance = useCallback(async () => {
    try {
      const response = await aviatorApi.getBalance();
      console.log('📊 Balance response:', response);
      if (response.success && typeof response.balance === 'number') {
        setBalance(response.balance);
        // Also update localStorage user object
        const userData = localStorage.getItem('user');
        if (userData) {
          try {
            const user = JSON.parse(userData);
            user.balance = response.balance;
            localStorage.setItem('user', JSON.stringify(user));
          } catch (e) {}
        }
      } else {
        // Fallback to localStorage
        const userData = localStorage.getItem('user');
        if (userData) {
          try {
            const user = JSON.parse(userData);
            if (typeof user.balance === 'number') {
              setBalance(user.balance);
            }
          } catch (e) {}
        }
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      // Fallback to localStorage
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (typeof user.balance === 'number') {
            setBalance(user.balance);
          }
        } catch (e) {}
      }
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
  }, [fetchBalance]);

  // ========== SOCKET CONNECTION ==========
  const connectSocket = (token) => {
    const socket = getAviatorSocket();
    socketRef.current = socket;
    
    socket.connect(token);
    setConnectionStatus('connecting');

    socket.on('connection:connected', () => {
      setConnectionStatus('connected');
      // Refresh balance on reconnect
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
        roundId: data.roundId,
        status: data.status,
        multiplier: data.multiplier || prev.multiplier,
        crashMultiplier: data.crashMultiplier || 0,
        serverTime: data.serverTime || Date.now()
      }));
    });

    socket.on('round:countdown', (data) => {
      setRoundState(prev => ({
        ...prev,
        countdown: data.countdown
      }));
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
        bet1Ref.current.isActive = false;
        bet1Ref.current.status = 'cashed';
      }
      if (data.betId === bet2Ref.current.betId) {
        bet2Ref.current.isActive = false;
        bet2Ref.current.status = 'cashed';
      }
    });

    socket.on('bet:placed', () => {
      fetchLivePlayers();
    });

    socket.on('bet:cashed_out', () => {
      fetchLivePlayers();
    });

    socket.on('wallet:updated', (data) => {
      setBalance(data.balance || data.newBalance);
    });

    socket.on('system:error', (data) => {
      setError(data.message || 'System error');
      setTimeout(() => setError(null), 3000);
    });
  };

  // ========== FETCH FUNCTIONS ==========
  const fetchHistory = async () => {
    try {
      const response = await aviatorApi.getHistory(20);
      if (response.success) {
        setHistory(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchMyBets = async () => {
    try {
      const response = await aviatorApi.getMyBets(20, 0);
      if (response.success) {
        setMyBets(response.data?.bets || []);
      }
    } catch (error) {
      console.error('Error fetching my bets:', error);
    }
  };

  const fetchCurrentRound = async () => {
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
  };

  const fetchLivePlayers = async () => {
    try {
      const response = await aviatorApi.getLivePlayers();
      if (response.success) {
        setLivePlayers(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching live players:', error);
    }
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

      // ✅ Allow betting when WAITING, BETTING_OPEN, or RUNNING
      // During RUNNING, bet goes to pending for next round
      if (roundState.status === 'CRASHED' || roundState.status === 'CLOSED') {
        setError('Game is not available');
        return { success: false, message: 'Game is not available' };
      }

      if (stake > balance) {
        setError('Insufficient balance');
        return { success: false, message: 'Insufficient balance' };
      }

      const betRef = betSlot === 1 ? bet1Ref : bet2Ref;
      
      if (betRef.current.isActive || betRef.current.isPending) {
        setError('Bet already placed');
        return { success: false, message: 'Bet already placed' };
      }

      const roundId = roundState.roundId;
      if (!roundId) {
        setError('No active round');
        return { success: false, message: 'No active round' };
      }

      const response = await aviatorApi.placeBet(roundId, stake, betSlot);
      
      if (response.success) {
        const betData = response.data.bet;
        betRef.current.betId = betData.betId;
        betRef.current.stake = stake;
        betRef.current.isActive = betData.status === 'ACTIVE';
        betRef.current.isPending = betData.status === 'PENDING';
        betRef.current.status = betData.status;
        
        if (response.data.balance !== undefined) {
          setBalance(response.data.balance);
        }
        fetchMyBets();
        fetchBalance();
        
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
  }, [roundState, balance, fetchBalance]);

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
      
      if (!betRef.current.isActive) {
        setError('No active bet found');
        return { success: false, message: 'No active bet found' };
      }

      const response = await aviatorApi.cashOut(betRef.current.betId);
      
      if (response.success) {
        const data = response.data;
        betRef.current.isActive = false;
        betRef.current.status = 'cashed';
        
        if (data.balance !== undefined) {
          setBalance(data.balance);
        }
        fetchMyBets();
        fetchBalance();
        
        return { 
          success: true, 
          payout: data.payout,
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
  }, [roundState, fetchBalance]);

  // ========== CANCEL BET ==========
  const cancelBet = useCallback(async (betSlot) => {
    try {
      setError(null);
      
      const betRef = betSlot === 1 ? bet1Ref : bet2Ref;
      
      if (!betRef.current.isPending) {
        setError('No pending bet to cancel');
        return { success: false, message: 'No pending bet to cancel' };
      }

      const response = await aviatorApi.cancelPendingBet(betRef.current.betId);
      
      if (response.success) {
        betRef.current.isPending = false;
        betRef.current.isActive = false;
        betRef.current.status = 'cancelled';
        
        if (response.data.balance !== undefined) {
          setBalance(response.data.balance);
        }
        fetchMyBets();
        fetchBalance();
        
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
  }, [fetchBalance]);

  // ========== GET BET STATE ==========
  const getBetState = useCallback((betSlot) => {
    const betRef = betSlot === 1 ? bet1Ref : bet2Ref;
    return {
      betId: betRef.current.betId,
      stake: betRef.current.stake,
      isActive: betRef.current.isActive,
      isPending: betRef.current.isPending,
      status: betRef.current.status
    };
  }, []);

  // ========== SET BET STAKE ==========
  const setBetStake = useCallback((betSlot, stake) => {
    const betRef = betSlot === 1 ? bet1Ref : bet2Ref;
    if (!betRef.current.isActive && !betRef.current.isPending) {
      betRef.current.stake = stake;
    }
  }, []);

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
    fetchBalance,
    fetchHistory,
    fetchMyBets,
    fetchCurrentRound,
    fetchLivePlayers,
    bet1Ref,
    bet2Ref
  };
};

export default useAviatorGame;