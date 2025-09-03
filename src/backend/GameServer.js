import { randomUUID } from 'node:crypto';
import {
  MAP_CONFIG,
  GAME_TIMING,
  PLAYER_CONFIG,
  STARTING_POSITIONS,
  CELL_TYPES,
  POWER_UP_CONFIG,
} from '../shared/GameConstants.js';
import { MovementValidator } from '../shared/MovementValidator.js';

// Owns one shared arena. Timer handles never enter the public game state.
export class GameServer {
  constructor() {
    this.wsManager = null;
    this.moveTimes = new Map();
    this.waitingTimer = this.countdownTimer = this.loopTimer = this.resetTimer = null;
    this.gameState = this.createState();
  }

  createState() {
    return {
      map: this.generateMap(),
      players: {},
      bombs: [],
      powerUps: [],
      gameStarted: false,
      gameEnded: false,
      countdown: 0,
      winner: null,
      gameTimeLeft: GAME_TIMING.GAME_DURATION,
      waitingTimeLeft: GAME_TIMING.WAITING_DURATION,
    };
  }

  generateMap() {
    const map = Array.from({ length: MAP_CONFIG.HEIGHT }, (_, y) =>
      Array.from({ length: MAP_CONFIG.WIDTH }, (_, x) => {
        if (
          x === 0 ||
          y === 0 ||
          x === MAP_CONFIG.WIDTH - 1 ||
          y === MAP_CONFIG.HEIGHT - 1 ||
          (x % 2 === 1 && y % 2 === 1)
        )
          return CELL_TYPES.WALL;
        return Math.random() < MAP_CONFIG.BLOCK_DENSITY ? CELL_TYPES.BLOCK : CELL_TYPES.EMPTY;
      }),
    );
    for (const position of STARTING_POSITIONS) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = position.x + dx;
          const y = position.y + dy;
          if (x > 0 && y > 0 && x < MAP_CONFIG.WIDTH - 1 && y < MAP_CONFIG.HEIGHT - 1) {
            map[y][x] = dx === 0 && dy === 0 ? CELL_TYPES.SPAWN : CELL_TYPES.SPAWN_SAFE;
          }
        }
      }
    }
    return map;
  }

  setWebSocketManager(manager) {
    this.wsManager = manager;
  }
  getCleanGameState() {
    return this.gameState;
  }
  broadcastGameState() {
    this.wsManager?.broadcastGameState();
  }
  broadcastEvent(type, data) {
    this.wsManager?.broadcastEvent(type, data);
  }

  addPlayer(playerId, input) {
    if (typeof input !== 'string') return { success: false, error: 'Enter a valid nickname' };
    const nickname = input.trim();
    if (
      nickname.length < PLAYER_CONFIG.NICKNAME_MIN_LENGTH ||
      nickname.length > PLAYER_CONFIG.NICKNAME_MAX_LENGTH ||
      /[\u0000-\u001f\u007f]/u.test(input)
    ) {
      return { success: false, error: 'Nickname must be between 2 and 20 characters' };
    }
    const players = Object.values(this.gameState.players);
    if (this.gameState.players[playerId])
      return { success: false, error: 'You have already joined' };
    if (this.gameState.gameStarted || this.gameState.gameEnded || this.gameState.countdown > 0)
      return { success: false, error: 'Please wait for the next round' };
    if (players.length >= PLAYER_CONFIG.MAX_PLAYERS)
      return { success: false, error: 'Game is full (4 players maximum)' };
    if (players.some((player) => player.nickname.toLowerCase() === nickname.toLowerCase()))
      return { success: false, error: 'This nickname is already in use' };
    const slot = STARTING_POSITIONS.findIndex(
      (_, index) => !players.some((player) => player.slot === index),
    );
    const player = {
      id: playerId,
      nickname,
      slot,
      ...STARTING_POSITIONS[slot],
      lives: PLAYER_CONFIG.STARTING_LIVES,
      alive: true,
      maxBombs: PLAYER_CONFIG.DEFAULT_MAX_BOMBS,
      currentBombs: 0,
      powerUps: {
        bombs: PLAYER_CONFIG.DEFAULT_MAX_BOMBS,
        flames: PLAYER_CONFIG.DEFAULT_BOMB_RANGE,
        speed: PLAYER_CONFIG.DEFAULT_SPEED,
      },
    };
    this.gameState.players[playerId] = player;
    if (players.length + 1 === PLAYER_CONFIG.MAX_PLAYERS) this.startCountdown();
    else if (players.length + 1 >= PLAYER_CONFIG.MIN_PLAYERS && !this.waitingTimer)
      this.startWaitingTimer();
    return { success: true, player };
  }

  removePlayer(playerId) {
    if (!this.gameState.players[playerId]) return false;
    delete this.gameState.players[playerId];
    this.moveTimes.delete(playerId);
    const players = Object.values(this.gameState.players);
    if (
      !this.gameState.gameStarted &&
      !this.gameState.gameEnded &&
      players.length < PLAYER_CONFIG.MIN_PLAYERS
    ) {
      clearInterval(this.waitingTimer);
      clearInterval(this.countdownTimer);
      this.waitingTimer = this.countdownTimer = null;
      this.gameState.countdown = 0;
      this.gameState.waitingTimeLeft = GAME_TIMING.WAITING_DURATION;
      this.broadcastEvent('countdown_update', { countdown: 0 });
      this.broadcastEvent('waiting_timer_update', {
        waitingTimeLeft: GAME_TIMING.WAITING_DURATION,
      });
    }
    if (this.gameState.gameStarted && players.filter((player) => player.alive).length <= 1)
      this.endGame('Last player remaining after disconnect');
    return true;
  }

  startWaitingTimer() {
    this.gameState.waitingTimeLeft = GAME_TIMING.WAITING_DURATION;
    this.waitingTimer = setInterval(() => {
      this.gameState.waitingTimeLeft--;
      this.broadcastEvent('waiting_timer_update', {
        waitingTimeLeft: this.gameState.waitingTimeLeft,
      });
      if (this.gameState.waitingTimeLeft <= 0) this.startCountdown();
    }, GAME_TIMING.TIMER_INTERVAL);
  }

  startCountdown() {
    clearInterval(this.waitingTimer);
    this.waitingTimer = null;
    if (
      this.countdownTimer ||
      Object.keys(this.gameState.players).length < PLAYER_CONFIG.MIN_PLAYERS
    )
      return;
    this.gameState.countdown = GAME_TIMING.COUNTDOWN_DURATION;
    this.broadcastEvent('countdown_update', { countdown: this.gameState.countdown });
    this.countdownTimer = setInterval(() => {
      this.gameState.countdown--;
      this.broadcastEvent('countdown_update', { countdown: this.gameState.countdown });
      if (this.gameState.countdown <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.startGame();
      }
    }, GAME_TIMING.TIMER_INTERVAL);
  }

  startGame() {
    if (
      this.gameState.gameStarted ||
      Object.keys(this.gameState.players).length < PLAYER_CONFIG.MIN_PLAYERS
    )
      return;
    clearInterval(this.waitingTimer);
    clearInterval(this.countdownTimer);
    this.waitingTimer = this.countdownTimer = null;
    this.gameState.countdown = 0;
    this.gameState.gameStarted = true;
    this.gameEndsAt = Date.now() + GAME_TIMING.GAME_DURATION * 1000;
    this.broadcastEvent('game_started', { gameState: this.gameState });
    this.broadcastGameState();
    this.loopTimer = setInterval(() => this.processGameLogic(), GAME_TIMING.GAME_LOOP_INTERVAL);
  }

  processGameLogic() {
    if (!this.gameState.gameStarted) return;
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((this.gameEndsAt - now) / 1000));
    if (remaining !== this.gameState.gameTimeLeft) {
      this.gameState.gameTimeLeft = remaining;
      this.broadcastEvent('timer_update', { timeLeft: remaining });
    }
    const expired = this.gameState.bombs.filter((bomb) => bomb.explodesAt <= now);
    if (expired.length) {
      // Resolve the whole tick before selecting a winner, including simultaneous draws.
      for (const bomb of expired) this.explodeBomb(bomb);
      this.broadcastGameState();
      if (Object.values(this.gameState.players).filter((player) => player.alive).length <= 1)
        this.endGame('Last player standing!');
    }
    if (remaining === 0) this.endGame("Time's up!");
  }

  movePlayer(playerId, direction) {
    const player = this.gameState.players[playerId];
    const result = MovementValidator.validateMove(player, direction, this.gameState);
    if (!result.isValid) return false;
    const now = Date.now();
    const throttle = PLAYER_CONFIG.MOVE_INTERVALS[player.powerUps.speed];
    if (now - (this.moveTimes.get(playerId) ?? -Infinity) < throttle) return false;
    this.moveTimes.set(playerId, now);
    player.x = result.newX;
    player.y = result.newY;
    this.checkPowerUpCollection(playerId, player.x, player.y);
    return true;
  }

  placeBomb(playerId) {
    const player = this.gameState.players[playerId];
    if (!player?.alive || !this.gameState.gameStarted || player.currentBombs >= player.maxBombs)
      return false;
    if (this.gameState.bombs.some((bomb) => bomb.x === player.x && bomb.y === player.y))
      return false;
    this.gameState.bombs.push({
      id: randomUUID(),
      playerId,
      x: player.x,
      y: player.y,
      timer: GAME_TIMING.BOMB_TIMER,
      range: player.powerUps.flames,
      explodesAt: Date.now() + GAME_TIMING.BOMB_TIMER * 1000,
    });
    player.currentBombs++;
    return true;
  }

  explodeBomb(bomb) {
    const index = this.gameState.bombs.findIndex((active) => active.id === bomb.id);
    if (index === -1) return;
    this.gameState.bombs.splice(index, 1);
    const owner = this.gameState.players[bomb.playerId];
    if (owner) owner.currentBombs = Math.max(0, owner.currentBombs - 1);
    const explosions = [{ x: bomb.x, y: bomb.y }];
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      for (let distance = 1; distance <= bomb.range; distance++) {
        const x = bomb.x + dx * distance;
        const y = bomb.y + dy * distance;
        const cell = this.gameState.map[y]?.[x];
        if (!cell || cell === CELL_TYPES.WALL) break;
        explosions.push({ x, y });
        if (cell === CELL_TYPES.BLOCK) {
          this.gameState.map[y][x] = CELL_TYPES.EMPTY;
          this.trySpawnPowerUp(x, y);
          break;
        }
      }
    }
    for (const player of Object.values(this.gameState.players)) {
      if (
        player.alive &&
        explosions.some((position) => position.x === player.x && position.y === player.y)
      )
        this.damagePlayer(player);
    }
    this.broadcastEvent('bomb_exploded', {
      bombId: bomb.id,
      position: { x: bomb.x, y: bomb.y },
      explosions,
      range: bomb.range,
    });
    // Removing each bomb before recursion makes chain reactions idempotent.
    for (const triggered of [...this.gameState.bombs]) {
      if (explosions.some((position) => position.x === triggered.x && position.y === triggered.y))
        this.explodeBomb(triggered);
    }
  }

  damagePlayer(player) {
    player.lives = Math.max(0, player.lives - 1);
    player.maxBombs = PLAYER_CONFIG.DEFAULT_MAX_BOMBS;
    player.powerUps.bombs = PLAYER_CONFIG.DEFAULT_MAX_BOMBS;
    player.alive = player.lives > 0;
    this.broadcastEvent('player_damaged', {
      playerId: player.id,
      nickname: player.nickname,
      livesRemaining: player.lives,
      position: { x: player.x, y: player.y },
    });
    if (!player.alive)
      this.broadcastEvent('player_eliminated', {
        playerId: player.id,
        nickname: player.nickname,
        finalLives: 0,
        willGameEnd: false,
        winner: null,
      });
  }

  trySpawnPowerUp(x, y) {
    if (Math.random() >= POWER_UP_CONFIG.SPAWN_CHANCE) return;
    const type = POWER_UP_CONFIG.TYPES[Math.floor(Math.random() * POWER_UP_CONFIG.TYPES.length)];
    const powerUp = { id: randomUUID(), type, x, y };
    this.gameState.powerUps.push(powerUp);
    this.broadcastEvent('powerup_spawned', { powerUp });
  }

  checkPowerUpCollection(playerId, x, y) {
    const index = this.gameState.powerUps.findIndex(
      (powerUp) => powerUp.x === x && powerUp.y === y,
    );
    if (index === -1) return;
    const [powerUp] = this.gameState.powerUps.splice(index, 1);
    const player = this.gameState.players[playerId];
    player.powerUps[powerUp.type] = Math.min(
      POWER_UP_CONFIG.MAX_LIMITS[powerUp.type],
      player.powerUps[powerUp.type] + 1,
    );
    player.maxBombs = player.powerUps.bombs;
    this.broadcastEvent('powerup_collected', {
      playerId,
      playerNickname: player.nickname,
      powerUpType: powerUp.type,
      powerUpId: powerUp.id,
      position: { x, y },
      newStats: {
        ...player.powerUps,
        maxBombs: player.maxBombs,
        currentBombs: player.currentBombs,
      },
    });
  }

  endGame(reason) {
    if (this.gameState.gameEnded || !this.gameState.gameStarted) return;
    clearInterval(this.loopTimer);
    this.loopTimer = null;
    this.gameState.gameStarted = false;
    this.gameState.gameEnded = true;
    const survivors = Object.values(this.gameState.players).filter((player) => player.alive);
    const maxLives = Math.max(0, ...survivors.map((player) => player.lives));
    const leaders = survivors.filter((player) => player.lives === maxLives);
    this.gameState.winner =
      leaders.length === 1
        ? leaders[0]
        : { id: leaders.length ? 'draw' : 'none', nickname: leaders.length ? 'Draw' : 'No Winner' };
    this.broadcastEvent('game_ended', {
      reason,
      winner: this.gameState.winner,
      gameState: this.gameState,
    });
    this.broadcastGameState();
    this.resetTimer = setTimeout(() => this.resetGame(), GAME_TIMING.GAME_END_RESET_DELAY);
  }

  resetGame() {
    this.dispose();
    this.gameState = this.createState();
    this.wsManager?.clearPlayerSessions();
    this.broadcastEvent('game_reset', { gameState: this.gameState });
  }

  dispose() {
    clearInterval(this.waitingTimer);
    clearInterval(this.countdownTimer);
    clearInterval(this.loopTimer);
    clearTimeout(this.resetTimer);
    this.waitingTimer = this.countdownTimer = this.loopTimer = this.resetTimer = null;
    this.moveTimes.clear();
  }
}
