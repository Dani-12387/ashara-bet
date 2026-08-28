class AviatorGameEngine {
  constructor(io) {
    this.io = io;
    this.currentRound = null;
    this.multiplier = 1.00;
    this.intervalId = null;
    this.isRunning = false;
    this.autoStart = false; // ✅ Admin must start
  }

  // ✅ Admin calls this
  async startNewRound() {
    if (this.isRunning) throw new Error('Game already running');
    // Create round, set status, start multiplier
    this.isRunning = true;
    // ... logic
    this.broadcastState();
    return { roundId: this.currentRound.roundId };
  }

  async crashRound() {
    if (!this.isRunning) throw new Error('No running round');
    // Stop interval, set crashed, broadcast
    this.isRunning = false;
    this.broadcastState();
    return { multiplier: this.multiplier };
  }

  // ... other methods

  broadcastState() {
    if (this.io) {
      this.io.emit('round:state', {
        status: this.currentRound?.status || 'IDLE',
        multiplier: this.multiplier,
        // ...
      });
    }
  }
}