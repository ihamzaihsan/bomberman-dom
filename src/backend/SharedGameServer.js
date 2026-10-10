import { GameServer } from './GameServer.js';
import { GAME_TIMING, PLAYER_CONFIG } from '../shared/GameConstants.js';

// Reuse the game rules, replacing process timers with serializable deadlines.
// Each Redis transaction reconstructs this engine and advances overdue work.
export class SharedGameServer extends GameServer {
  constructor(snapshot, now = Date.now()) {
    super();
    this.currentTime = now;
    this.deadlines = snapshot?.deadlines ?? { waiting: null, countdown: null, reset: null };
    if (snapshot) {
      this.gameState = snapshot.gameState;
      this.gameEndsAt = snapshot.gameEndsAt;
      this.moveTimes = new Map(snapshot.moveTimes);
    }
    this.waitingTimer = this.deadlines.waiting === null ? null : {};
    this.countdownTimer = this.deadlines.countdown === null ? null : {};
    this.messages = [];
    this.setWebSocketManager({
      broadcastGameState: () => {},
      broadcastEvent: (eventType, data) => this.messages.push({
        type: 'game_event', eventType, data: structuredClone(data), timestamp: this.now(),
      }),
      clearPlayerSessions: () => { this.didReset = true; },
    });
  }

  now() { return this.currentTime; }
  scheduleGameLoop() {} // Active connections advance persisted deadlines instead.
  scheduleReset() { this.deadlines.reset = this.now() + GAME_TIMING.GAME_END_RESET_DELAY; }

  startWaitingTimer() {
    this.gameState.waitingTimeLeft = GAME_TIMING.WAITING_DURATION;
    this.deadlines.waiting = this.now() + GAME_TIMING.WAITING_DURATION * 1000;
    this.waitingTimer = {};
  }

  startCountdown(at = this.now()) {
    this.waitingTimer = null;
    this.deadlines.waiting = null;
    if (this.countdownTimer || Object.keys(this.gameState.players).length < PLAYER_CONFIG.MIN_PLAYERS)
      return;
    this.deadlines.countdown = at + GAME_TIMING.COUNTDOWN_DURATION * 1000;
    this.countdownTimer = {};
    this.gameState.countdown = GAME_TIMING.COUNTDOWN_DURATION;
    this.broadcastEvent('countdown_update', { countdown: this.gameState.countdown });
  }

  removePlayer(playerId) {
    const removed = super.removePlayer(playerId);
    if (!this.waitingTimer) this.deadlines.waiting = null;
    if (!this.countdownTimer) this.deadlines.countdown = null;
    return removed;
  }

  advance() {
    if (this.deadlines.reset !== null && this.now() >= this.deadlines.reset) {
      this.deadlines = { waiting: null, countdown: null, reset: null };
      this.resetGame();
      return;
    }
    if (this.deadlines.waiting !== null) {
      const left = Math.max(0, Math.ceil((this.deadlines.waiting - this.now()) / 1000));
      if (left !== this.gameState.waitingTimeLeft) {
        this.gameState.waitingTimeLeft = left;
        this.broadcastEvent('waiting_timer_update', { waitingTimeLeft: left });
      }
      if (!left) this.startCountdown(this.deadlines.waiting);
    }
    if (this.deadlines.countdown !== null) {
      const left = Math.max(0, Math.ceil((this.deadlines.countdown - this.now()) / 1000));
      if (left !== this.gameState.countdown) {
        this.gameState.countdown = left;
        this.broadcastEvent('countdown_update', { countdown: left });
      }
      if (!left) {
        const startedAt = this.deadlines.countdown;
        this.deadlines.countdown = null;
        this.startGame();
        this.gameEndsAt = startedAt + GAME_TIMING.GAME_DURATION * 1000;
      }
    }
    this.processGameLogic();
  }

  snapshot() {
    return {
      gameState: this.gameState, gameEndsAt: this.gameEndsAt ?? null,
      deadlines: this.deadlines, moveTimes: [...this.moveTimes],
    };
  }
}
