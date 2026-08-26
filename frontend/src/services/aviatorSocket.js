import { io } from 'socket.io-client';

class AviatorSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  connect(token) {
    if (this.socket) {
      this.disconnect();
    }

    const API_URL = process.env.REACT_APP_API_URL || 'https://ashara-bet.onrender.com';
    
    this.socket = io(API_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      transports: ['websocket', 'polling']
    });

    this.setupListeners();
  }

  setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Aviator Socket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emitEvent('connection:connected');
    });

    this.socket.on('disconnect', () => {
      console.log('🔴 Aviator Socket disconnected');
      this.isConnected = false;
      this.emitEvent('connection:disconnected');
    });

    this.socket.on('reconnect', () => {
      console.log('🟡 Aviator Socket reconnected');
      this.isConnected = true;
      this.emitEvent('connection:reconnected');
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`🟡 Reconnect attempt ${attempt}`);
      this.emitEvent('connection:reconnecting', { attempt });
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ Reconnect error:', error);
      this.emitEvent('connection:error', { error });
    });

    this.socket.on('round:state', (data) => {
      this.emitEvent('round:state', data);
    });

    this.socket.on('round:countdown', (data) => {
      this.emitEvent('round:countdown', data);
    });

    this.socket.on('round:multiplier', (data) => {
      this.emitEvent('round:multiplier', data);
    });

    this.socket.on('bet:accepted', (data) => {
      this.emitEvent('bet:accepted', data);
    });

    this.socket.on('bet:rejected', (data) => {
      this.emitEvent('bet:rejected', data);
    });

    this.socket.on('bet:placed', (data) => {
      this.emitEvent('bet:placed', data);
    });

    this.socket.on('bet:cashed_out', (data) => {
      this.emitEvent('bet:cashed_out', data);
    });

    this.socket.on('cashout:success', (data) => {
      this.emitEvent('cashout:success', data);
    });

    this.socket.on('wallet:updated', (data) => {
      this.emitEvent('wallet:updated', data);
    });

    this.socket.on('system:error', (data) => {
      this.emitEvent('system:error', data);
    });
  }

  emitEvent(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error);
        }
      });
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id || null
    };
  }
}

let instance = null;

export const getAviatorSocket = () => {
  if (!instance) {
    instance = new AviatorSocketService();
  }
  return instance;
};

export default getAviatorSocket;