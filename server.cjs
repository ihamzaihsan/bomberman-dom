const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocketManager = require('./src/backend/websocketServer.cjs');
let MAP_CONFIG, GAME_TIMING, PLAYER_CONFIG, STARTING_POSITIONS, CELL_TYPES, POWER_UP_CONFIG, EXPLOSION_CONFIG, SERVER_CONFIG, MIME_TYPES;
(async () => {
  try {
    const constants = await import('./src/shared/GameConstants.js');
    MAP_CONFIG = constants.MAP_CONFIG;
    GAME_TIMING = constants.GAME_TIMING;
    PLAYER_CONFIG = constants.PLAYER_CONFIG;
    STARTING_POSITIONS = constants.STARTING_POSITIONS;
    CELL_TYPES = constants.CELL_TYPES;
    POWER_UP_CONFIG = constants.POWER_UP_CONFIG;
    EXPLOSION_CONFIG = constants.EXPLOSION_CONFIG;
    SERVER_CONFIG = constants.SERVER_CONFIG;
    MIME_TYPES = constants.MIME_TYPES;

    const movement = await import('./src/shared/MovementValidator.js');
    MovementValidator = movement.MovementValidator;

    PORT = SERVER_CONFIG.PORT;

    bootstrap();
  } catch (err) {
    console.error('Failed to load ESM modules:', err);
    process.exit(1);
  }
})();


let MovementValidator;

let gameServer, wsManager, server;

class GameServer {
  constructor() {
    this.gameState = {
      map: this.generateMap(),
      players: {},
      bombs: [],
      powerUps: [],

      gameStarted: false,
      gameTimer: null,
      countdown: 0,
      gameTimeLeft: GAME_TIMING.GAME_DURATION,
      gameTimeTimer: null,
      gameEnded: false,
      winner: null,
      waitingTimer: null,
      waitingTimeLeft: GAME_TIMING.WAITING_DURATION
    };

    this.wsManager = null;

    this.gameLoopInterval = null;
    this.gameLoopRunning = false;
    this.explodingBombs = new Set();
    this.explodedBombs = new Set();

    this.isPostGame = false;

    console.log(`GameServer initialized with ${MAP_CONFIG.WIDTH}x${MAP_CONFIG.HEIGHT} map`);
  }

  setWebSocketManager(wsManager) {
    this.wsManager = wsManager;
  }

  broadcastGameState() {
    if (this.wsManager) {
      this.wsManager.broadcastGameState();
    }
  }

  broadcastEvent(eventType, eventData) {
    if (this.wsManager) {
      this.wsManager.broadcastEvent(eventType, eventData);
    }
  }

  removePlayer(playerId) {
    if (this.gameState.players[playerId]) {
      delete this.gameState.players[playerId];

      const remainingPlayers = Object.keys(this.gameState.players).length;

      if (remainingPlayers < PLAYER_CONFIG.MIN_PLAYERS && this.gameState.waitingTimer) {
        clearInterval(this.gameState.waitingTimer);
        this.gameState.waitingTimer = null;
        this.gameState.waitingTimeLeft = GAME_TIMING.WAITING_DURATION;
        console.log('Waiting timer cancelled - insufficient players');
      }

      if (remainingPlayers === 1 && this.gameState.gameStarted) {
        const alivePlayers = Object.values(this.gameState.players).filter(p => p.alive);
        if (alivePlayers.length === 1) {
          this.endGame('Last player remaining after disconnect');
        }
      }

      if (remainingPlayers < 1 && this.gameState.gameStarted) {
        this.endGame('All players disconnected');
      }

      return true;
    }
    return false;
  }

  generateMap() {
    console.log(`Generating ${MAP_CONFIG.WIDTH}x${MAP_CONFIG.HEIGHT} map...`);
    const width = MAP_CONFIG.WIDTH;
    const height = MAP_CONFIG.HEIGHT;
    const map = [];

    for (let y = 0; y < height; y++) {
      map[y] = [];
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          map[y][x] = CELL_TYPES.BLOCK;
        }
        else if (x % 2 === 1 && y % 2 === 1) {
          map[y][x] = CELL_TYPES.WALL;
        }
        else if (Math.random() < MAP_CONFIG.BLOCK_DENSITY) {
          map[y][x] = CELL_TYPES.BLOCK;
        }
        else {
          map[y][x] = CELL_TYPES.EMPTY;
        }
      }
    }

    STARTING_POSITIONS.forEach((pos, index) => {
      console.log(`Creating 3x3 spawn area for player ${index + 1} at (${pos.x}, ${pos.y})`);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = pos.x + dx;
          const y = pos.y + dy;

          if (x >= 0 && x < width && y >= 0 && y < height) {
            if (dx === 0 && dy === 0) {
              map[y][x] = CELL_TYPES.SPAWN;
            } else {
              map[y][x] = CELL_TYPES.SPAWN_SAFE;
            }
          }
        }
      }
    });

    console.log(`${MAP_CONFIG.WIDTH}x${MAP_CONFIG.HEIGHT} Map generated successfully`);
    return map;
  }

  isStartingPosition(x, y) {
    return STARTING_POSITIONS.some(pos => {
      return Math.abs(x - pos.x) <= 1 && Math.abs(y - pos.y) <= 1;
    });
  }

  getGameState() {
    return this.gameState;
  }

  getCleanGameState() {
    const cleanState = {
      map: this.gameState.map,
      players: this.gameState.players,
      bombs: this.gameState.bombs,
      powerUps: this.gameState.powerUps,
      gameStarted: this.gameState.gameStarted,
      countdown: this.gameState.countdown,
      gameTimeLeft: this.gameState.gameTimeLeft,
      gameEnded: this.gameState.gameEnded,
      winner: this.gameState.winner,
      waitingTimeLeft: this.gameState.waitingTimeLeft
    };
    return cleanState;
  }

  addPlayer(playerId, nickname) {
    console.log(`Adding player: ${playerId}, nickname: ${nickname}`);
    console.log('Current game state:', {
      playerCount: Object.keys(this.gameState.players).length,
      gameStarted: this.gameState.gameStarted,
      countdown: this.gameState.countdown,
      waitingTimer: !!this.gameState.waitingTimer,
      waitingTimeLeft: this.gameState.waitingTimeLeft
    });

    const playerCount = Object.keys(this.gameState.players).length;
    console.log(`Current player count: ${playerCount}`);

    if (this.isPostGame) {
      console.log('Rejecting player: Game is resetting, please wait for next round');
      return { success: false, error: 'Game is resetting, please wait for next round' };
    }

    const normalizedNickname = nickname.trim().toLowerCase();
    console.log(`Checking for duplicate nickname: "${normalizedNickname}"`);

    const existingPlayers = Object.values(this.gameState.players);
    console.log(`Current players in lobby: ${JSON.stringify(existingPlayers.map(p => ({ id: p.id, nickname: p.nickname })))}`);

    const duplicate = existingPlayers.some(
      (p) => p.nickname && p.nickname.trim().toLowerCase() === normalizedNickname
    );

    if (duplicate) {
      const conflictingPlayer = existingPlayers.find(
        (p) => p.nickname && p.nickname.trim().toLowerCase() === normalizedNickname
      );
      console.log(`Rejecting player: Duplicate nickname "${nickname}" (conflicts with player ${conflictingPlayer.id})`);
      return { success: false, error: 'There is a player in the lobby with the same name' };
    }

    console.log(`Nickname "${nickname}" is unique - proceeding with player creation`);

    if (playerCount >= PLAYER_CONFIG.MAX_PLAYERS) {
      console.log('Rejecting player: Game is full');
      return { success: false, error: `Game is full (${PLAYER_CONFIG.MAX_PLAYERS} players maximum)` };
    }

    if (this.gameState.gameStarted) {
      console.log('Rejecting player: Game has already started');
      return { success: false, error: 'Game has already started' };
    }

    if (this.gameState.countdown > 0) {
      console.log('Rejecting player: Game is starting (countdown active)');
      return { success: false, error: 'Game is starting - please wait for next round' };
    }
    const player = {
      id: playerId,
      nickname,
      x: STARTING_POSITIONS[playerCount].x,
      y: STARTING_POSITIONS[playerCount].y,
      lives: PLAYER_CONFIG.STARTING_LIVES,
      powerUps: {
        bombs: PLAYER_CONFIG.DEFAULT_MAX_BOMBS,
        flames: PLAYER_CONFIG.DEFAULT_BOMB_RANGE,
        speed: PLAYER_CONFIG.DEFAULT_SPEED
      },
      maxBombs: PLAYER_CONFIG.DEFAULT_MAX_BOMBS,
      currentBombs: 0,
      alive: true
    };

    this.gameState.players[playerId] = player;
    console.log(`Player added successfully:`, player);

    const newPlayerCount = playerCount + 1;

    if (this.gameState.countdown > EXPLOSION_CONFIG.FINAL_COUNTDOWN_THRESHOLD) {
      console.log('New player joined during countdown - resetting to waiting timer');
      this.resetToWaitingTimer();
    }
    if (newPlayerCount === PLAYER_CONFIG.MIN_PLAYERS && !this.gameState.waitingTimer && !this.gameState.gameStarted && this.gameState.countdown === 0) {
      console.log(`Starting ${GAME_TIMING.WAITING_DURATION}-second waiting timer...`);
      this.startWaitingTimer();
    } else if (newPlayerCount === PLAYER_CONFIG.MAX_PLAYERS && !this.gameState.gameStarted) {
      console.log(`${PLAYER_CONFIG.MAX_PLAYERS} players reached - starting countdown immediately...`);
      this.skipToCountdown();
    }

    return { success: true, player };
  }

  startWaitingTimer() {
    this.gameState.waitingTimeLeft = GAME_TIMING.WAITING_DURATION;
    this.gameState.waitingTimer = setInterval(() => {
      this.gameState.waitingTimeLeft--;
      console.log(`Waiting time left: ${this.gameState.waitingTimeLeft} seconds`);

      this.broadcastEvent('waiting_timer_update', {
        waitingTimeLeft: this.gameState.waitingTimeLeft
      });

      if (this.gameState.waitingTimeLeft <= 0) {
        console.log('20-second wait completed - starting countdown');
        clearInterval(this.gameState.waitingTimer);
        this.gameState.waitingTimer = null;
        this.skipToCountdown();
      }
    }, GAME_TIMING.TIMER_INTERVAL);
  }

  resetToWaitingTimer() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }

    this.gameState.countdown = 0;
    this.startWaitingTimer();
  }

  skipToCountdown() {
    console.log('Skipping to countdown');
    if (this.gameState.waitingTimer) {
      console.log('Clearing waiting timer');
      clearInterval(this.gameState.waitingTimer);
      this.gameState.waitingTimer = null;
    }

    console.log('About to start game timer (countdown)');
    this.startGameTimer();
  }

  startGameTimer() {
    console.log('Starting game timer');
    this.gameState.countdown = GAME_TIMING.COUNTDOWN_DURATION;
    this.gameTimer = setInterval(() => {
      this.gameState.countdown--;
      console.log(`Game starting in: ${this.gameState.countdown}`);

      console.log('Broadcasting countdown_update event:', { countdown: this.gameState.countdown });
      this.broadcastEvent('countdown_update', { countdown: this.gameState.countdown });

      if (this.gameState.countdown <= 0) {
        this.gameState.gameStarted = true;
        clearInterval(this.gameTimer);
        console.log('Game started!');

        this.startRealTimeGameLoop();

        if (this.wsManager) {
          this.wsManager.broadcastEvent('game_started', { gameState: this.getCleanGameState() });
        }

        this.startGameTimeTimer();
      }
    }, GAME_TIMING.TIMER_INTERVAL);
  }

  startGameTimeTimer() {
    console.log('Starting game time timer');
    console.log('Initial game time:', this.gameState.gameTimeLeft);
    this.gameTimeTimer = setInterval(() => {
      this.gameState.gameTimeLeft--;
      console.log(`Game time left: ${this.gameState.gameTimeLeft} seconds`);

      console.log('Broadcasting timer_update event:', { timeLeft: this.gameState.gameTimeLeft });
      this.broadcastEvent('timer_update', { timeLeft: this.gameState.gameTimeLeft });

      if (this.gameState.gameTimeLeft <= 0) {
        this.endGame('Time\'s up!');
      }
    }, GAME_TIMING.TIMER_INTERVAL);
  }

  startRealTimeGameLoop() {
    if (this.gameLoopRunning) return;

    console.log('Starting real-time game loop...');
    this.gameLoopRunning = true;

    this.gameLoopInterval = setInterval(() => {
      this.processGameLogic();
    }, 100);
  }

  stopRealTimeGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
      this.gameLoopRunning = false;
      console.log('Real-time game loop stopped');
    }
  }

  processGameLogic() {
    if (!this.gameState.gameStarted) return;

    let gameStateChanged = false;

    if (this.gameState.bombs.length > 0) {
      console.log(`Processing ${this.gameState.bombs.length} bombs`);
    }

    const bombsToExplode = [];

    for (let i = this.gameState.bombs.length - 1; i >= 0; i--) {
      const bomb = this.gameState.bombs[i];
      bomb.timer -= 0.1;

      console.log(`Bomb ${bomb.id} at (${bomb.x}, ${bomb.y}) timer: ${bomb.timer.toFixed(1)}s`);

      if (bomb.timer <= 0) {
        console.log(`Bomb timer expired at (${bomb.x}, ${bomb.y})!`);
        bombsToExplode.push(bomb);
        this.gameState.bombs.splice(i, 1);
        gameStateChanged = true;
      }
    }

    bombsToExplode.forEach(bomb => {
      console.log(`Exploding timer-expired bomb: ${bomb.id}`);
      this.explodeBomb(bomb, 0);
    });

    if (gameStateChanged && this.wsManager) {
      this.wsManager.broadcastGameState();
    }
  }

  endGame(reason) {
    console.log(`Game ended: ${reason}`);
    this.gameState.gameEnded = true;
    this.gameState.gameStarted = false;
    this.isPostGame = true;

    this.stopRealTimeGameLoop();

    if (this.gameTimeTimer) {
      clearInterval(this.gameTimeTimer);
      this.gameTimeTimer = null;
    }

    const alivePlayers = Object.values(this.gameState.players).filter(p => p.alive);

    if (alivePlayers.length === 1) {
      this.gameState.winner = alivePlayers[0];
      console.log(`Winner: ${this.gameState.winner.nickname}`);
    } else if (alivePlayers.length > 1) {
      const maxLives = Math.max(...alivePlayers.map(p => p.lives));
      const playersWithMaxLives = alivePlayers.filter(p => p.lives === maxLives);

      if (playersWithMaxLives.length === 1) {
        this.gameState.winner = playersWithMaxLives[0];
        console.log(`Winner by lives: ${this.gameState.winner.nickname}`);
      } else {
        this.gameState.winner = { nickname: 'Draw', id: 'draw' };
        console.log('Game ended in a draw');
      }
    } else {
      this.gameState.winner = { nickname: 'No Winner', id: 'none' };
      console.log('No winner - all players eliminated');
    }

    this.broadcastEvent('game_ended', {
      reason: reason,
      winner: this.gameState.winner,
      gameState: this.gameState
    });

    setTimeout(() => {
      this.resetGame();
    }, GAME_TIMING.GAME_END_RESET_DELAY);
  }

  resetGame() {
    console.log('Resetting game...');

    if (this.gameState.waitingTimer) {
      clearInterval(this.gameState.waitingTimer);
    }
    if (this.gameState.gameTimer) {
      clearInterval(this.gameState.gameTimer);
    }
    if (this.gameState.gameTimeTimer) {
      clearInterval(this.gameState.gameTimeTimer);
    }

    this.gameState = {
      map: this.generateMap(),
      players: {},
      bombs: [],
      powerUps: [],
      gameStarted: false,
      gameTimer: null,
      countdown: 0,
      gameTimeLeft: GAME_TIMING.GAME_DURATION,
      gameTimeTimer: null,
      gameEnded: false,
      winner: null,
      waitingTimer: null,
      waitingTimeLeft: GAME_TIMING.WAITING_DURATION
    };

    this.isPostGame = false;

    this.explodingBombs.clear();
    this.explodedBombs.clear();
    console.log('Chain reaction tracking sets reset');

    this.broadcastEvent('game_reset', { gameState: this.gameState });
  }

  validatePlayerMove(playerId, direction) {
    const player = this.gameState.players[playerId];
    if (!player) return false;

    const result = MovementValidator.validateMove(player, direction, this.gameState);
    return result.isValid;
  }

  movePlayer(playerId, direction) {
    const player = this.gameState.players[playerId];
    if (!player) {
      console.log('Move rejected: Player not found');
      return false;
    }

    const validationResult = MovementValidator.validateMove(player, direction, this.gameState);

    if (!validationResult.isValid) {
      console.log('Move rejected:', validationResult.reason);
      return false;
    }

    player.x = validationResult.newX;
    player.y = validationResult.newY;
    console.log(`Player ${playerId} moved to (${validationResult.newX}, ${validationResult.newY})`);

    this.checkPowerUpCollection(playerId, validationResult.newX, validationResult.newY);

    return true;
  }

  placeBomb(playerId) {
    const player = this.gameState.players[playerId];
    if (!player || !player.alive || !this.gameState.gameStarted || this.gameState.gameEnded) return false;

    if (player.currentBombs >= player.maxBombs) {
      console.log(`Player ${player.nickname} cannot place bomb: ${player.currentBombs}/${player.maxBombs} bombs active`);
      return false;
    }

    const bomb = {
      id: 'bomb_' + Date.now(),
      playerId,
      x: player.x,
      y: player.y,
      timer: GAME_TIMING.BOMB_TIMER,
      range: player.powerUps.flames
    };

    this.gameState.bombs.push(bomb);
    player.currentBombs++;

    console.log(`Bomb placed by ${player.nickname}: ${bomb.id} at (${bomb.x}, ${bomb.y}). Active bombs: ${player.currentBombs}/${player.maxBombs}`);

    return true;
  }

  /**
   * Handle bomb explosion with chain reaction support
   * @param {Object} bomb - The bomb object to explode
   * @param {number} chainReactionDepth - Current chain reaction depth (prevents infinite loops)
   */
  explodeBomb(bomb, chainReactionDepth = 0) {
    console.log(`Exploding bomb: ${bomb.id} at position (${bomb.x}, ${bomb.y}) - Chain depth: ${chainReactionDepth}`);

    // Prevent duplicate explosions
    if (this.explodedBombs.has(bomb.id) || this.explodingBombs.has(bomb.id)) {
      console.log(`Bomb ${bomb.id} already exploded or is exploding, skipping`);
      return;
    }

    const bombOwner = this.gameState.players[bomb.playerId];
    if (bombOwner && bombOwner.currentBombs > 0) {
      bombOwner.currentBombs--;
      console.log(`Decremented bomb count for ${bombOwner.nickname}: ${bombOwner.currentBombs}/${bombOwner.maxBombs}`);
    }

    this.explodingBombs.add(bomb.id);

    const MAX_CHAIN_DEPTH = EXPLOSION_CONFIG.MAX_CHAIN_DEPTH;
    if (chainReactionDepth > MAX_CHAIN_DEPTH) {
      console.warn(`Chain reaction depth limit reached (${MAX_CHAIN_DEPTH}), stopping chain`);
      this.explodingBombs.delete(bomb.id);
      this.explodedBombs.add(bomb.id);
      return;
    }

    const explosions = [{ x: bomb.x, y: bomb.y }];
    const triggeredBombs = [];

    if (bombOwner && bombOwner.alive && bombOwner.x === bomb.x && bombOwner.y === bomb.y) {
      bombOwner.lives--;
      console.log(`Player ${bombOwner.nickname} damaged by their own bomb! Lives: ${bombOwner.lives}`);
      bombOwner.maxBombs = PLAYER_CONFIG.DEFAULT_MAX_BOMBS;
      bombOwner.currentBombs = 0;
      bombOwner.powerUps.bombs = PLAYER_CONFIG.DEFAULT_MAX_BOMBS;
      this.broadcastEvent('player_damaged', {
        playerId: bombOwner.id,
        nickname: bombOwner.nickname,
        livesRemaining: bombOwner.lives,
        position: { x: bombOwner.x, y: bombOwner.y }
      });
      if (bombOwner.lives <= 0) {
        bombOwner.lives = 0;
        bombOwner.alive = false;
        console.log(`Player ${bombOwner.nickname} eliminated by their own bomb! Lives: ${bombOwner.lives}`);

        const alivePlayers = Object.values(this.gameState.players).filter(p => p.alive);
        const willGameEnd = alivePlayers.length <= 1;
        const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;

        console.log(`Game end check (bomb owner): ${alivePlayers.length} alive, willGameEnd: ${willGameEnd}`);

        this.broadcastEvent('player_eliminated', {
          playerId: bombOwner.id,
          nickname: bombOwner.nickname,
          finalLives: bombOwner.lives,
          willGameEnd: willGameEnd,
          winner: winner ? { id: winner.id, nickname: winner.nickname } : null
        });
        if (this.wsManager) {
          this.wsManager.broadcastGameState();
        }
        setTimeout(() => {
          const alivePlayers = Object.values(this.gameState.players).filter(p => p.alive);
          if (alivePlayers.length <= 1) {
            this.endGame('Last player standing!');
          }
        }, 100);
      }
    }

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    directions.forEach(dir => {
      for (let i = 1; i <= bomb.range; i++) {
        const x = bomb.x + (dir.dx * i);
        const y = bomb.y + (dir.dy * i);

        if (x < 0 || x >= MAP_CONFIG.WIDTH || y < 0 || y >= MAP_CONFIG.HEIGHT) break;
        if (this.gameState.map[y][x] === 'wall') break;

        explosions.push({ x, y });

        const bombsAtPosition = this.gameState.bombs.filter(otherBomb =>
          otherBomb.x === x && otherBomb.y === y && otherBomb.id !== bomb.id
        );

        if (bombsAtPosition.length > 0) {
          bombsAtPosition.forEach(triggeredBomb => {
            console.log(`Chain reaction: Bomb ${triggeredBomb.id} at (${x}, ${y}) triggered by explosion`);
            triggeredBombs.push(triggeredBomb);
          });
        }

        Object.values(this.gameState.players).forEach(player => {
          if (player.alive && player.x === x && player.y === y) {
            player.lives--;
            console.log(`Player ${player.nickname} hit by explosion! Lives: ${player.lives}`);

            player.maxBombs = PLAYER_CONFIG.DEFAULT_MAX_BOMBS;
            player.currentBombs = 0;
            player.powerUps.bombs = PLAYER_CONFIG.DEFAULT_MAX_BOMBS;
            console.log(`Reset bomb system for ${player.nickname}: maxBombs=1, currentBombs=0, powerUps.bombs=1`);

            this.broadcastEvent('player_damaged', {
              playerId: player.id,
              nickname: player.nickname,
              livesRemaining: player.lives,
              position: { x: player.x, y: player.y }
            });

            if (player.lives <= 0) {
              player.lives = 0;
              player.alive = false;
              console.log(`Player ${player.nickname} eliminated! Lives: ${player.lives}`);

              const alivePlayers = Object.values(this.gameState.players).filter(p => p.alive);
              const willGameEnd = alivePlayers.length <= 1;
              const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;

              console.log(`Game end check: ${alivePlayers.length} alive, willGameEnd: ${willGameEnd}`);

              this.broadcastEvent('player_eliminated', {
                playerId: player.id,
                nickname: player.nickname,
                finalLives: player.lives,
                willGameEnd: willGameEnd,
                winner: winner ? { id: winner.id, nickname: winner.nickname } : null
              });

              if (this.wsManager) {
                this.wsManager.broadcastGameState();
              }

              setTimeout(() => {
                const alivePlayers = Object.values(this.gameState.players).filter(p => p.alive);
                if (alivePlayers.length <= 1) {
                  this.endGame('Last player standing!');
                }
              }, GAME_TIMING.STATE_SYNC_DELAY);
            }
          }
        });

        if (this.gameState.map[y][x] === CELL_TYPES.BLOCK) {
          this.gameState.map[y][x] = CELL_TYPES.EMPTY;
          console.log(`Block destroyed at (${x}, ${y})`);

          this.trySpawnPowerUp(x, y);

          break;
        }
      }
    });

    if (this.wsManager) {
      const explosionEvent = {
        bombId: bomb.id,
        position: { x: bomb.x, y: bomb.y },
        explosions: explosions,
        range: bomb.range,
        chainReactionDepth: chainReactionDepth
      };

      console.log('Broadcasting bomb_exploded event:', explosionEvent);
      this.wsManager.broadcastEvent('bomb_exploded', explosionEvent);
      console.log('bomb_exploded event sent to all clients');
    } else {
      console.error('wsManager not available for broadcasting explosion event');
    }

    console.log(`Bomb exploded at: (${bomb.x}, ${bomb.y}) with explosions at:`, explosions);

    if (triggeredBombs.length > 0) {
      console.log(`Processing ${triggeredBombs.length} chain reaction bombs at depth ${chainReactionDepth + 1}`);

      triggeredBombs.forEach(triggeredBomb => {
        const bombIndex = this.gameState.bombs.findIndex(b => b.id === triggeredBomb.id);
        if (bombIndex !== -1) {
          this.gameState.bombs.splice(bombIndex, 1);
          console.log(`Removed triggered bomb ${triggeredBomb.id} from game state`);

          setTimeout(() => {
            this.explodeBomb(triggeredBomb, chainReactionDepth + 1);
          }, GAME_TIMING.CHAIN_EXPLOSION_DELAY);
        }
      });
    }

    this.explodingBombs.delete(bomb.id);
    this.explodedBombs.add(bomb.id);
    console.log(`Bomb ${bomb.id} explosion complete, marked as exploded`);

    if (this.wsManager && chainReactionDepth === 0) {
      setTimeout(() => {
        this.wsManager.broadcastGameState();
        console.log(`Game state broadcasted after bomb explosion`);
      }, GAME_TIMING.GAME_STATE_BROADCAST_DELAY);
    }
  }

  trySpawnPowerUp(x, y) {
    if (Math.random() < POWER_UP_CONFIG.SPAWN_CHANCE) {
      const randomType = POWER_UP_CONFIG.TYPES[Math.floor(Math.random() * POWER_UP_CONFIG.TYPES.length)];

      const powerUp = {
        id: 'powerup_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
        type: randomType,
        x: x,
        y: y
      };

      this.gameState.powerUps.push(powerUp);
      console.log(`Power-up spawned: ${randomType} at (${x}, ${y})`);

      if (this.wsManager) {
        this.wsManager.broadcastEvent('powerup_spawned', {
          powerUp: powerUp
        });
      }
    }
  }

  checkPowerUpCollection(playerId, x, y) {
    const powerUpIndex = this.gameState.powerUps.findIndex(powerUp => powerUp.x === x && powerUp.y === y);

    if (powerUpIndex !== -1) {
      const powerUp = this.gameState.powerUps[powerUpIndex];
      const player = this.gameState.players[playerId];

      if (!player || !player.alive) {
        console.log(`Ghost player ${player?.nickname || playerId} cannot collect power-ups`);
        return;
      }

      console.log(`Player ${player.nickname} collected ${powerUp.type} power-up at (${x}, ${y})`);
      console.log(`   Before: maxBombs=${player.maxBombs}, powerUps.bombs=${player.powerUps.bombs}`);

      this.applyPowerUpEffect(player, powerUp.type);

      console.log(`   After: maxBombs=${player.maxBombs}, powerUps.bombs=${player.powerUps.bombs}`);

      this.gameState.powerUps.splice(powerUpIndex, 1);

      if (this.wsManager) {
        this.wsManager.broadcastEvent('powerup_collected', {
          playerId: playerId,
          playerNickname: player.nickname,
          powerUpType: powerUp.type,
          powerUpId: powerUp.id,
          position: { x, y },
          newStats: {
            bombs: player.powerUps.bombs,
            flames: player.powerUps.flames,
            speed: player.powerUps.speed,
            maxBombs: player.maxBombs,
            currentBombs: player.currentBombs
          }
        });

        this.wsManager.broadcastGameState();
      }
    }
  }

  applyPowerUpEffect(player, powerUpType) {
    const maxLimits = POWER_UP_CONFIG.MAX_LIMITS;

    switch (powerUpType) {
      case 'bombs':
        if (player.maxBombs < maxLimits.bombs) {
          player.maxBombs++;
          player.powerUps.bombs = player.maxBombs;
          console.log(`${player.nickname} maxBombs increased to ${player.maxBombs}`);
        } else {
          console.log(`${player.nickname} already at max bombs (${maxLimits.bombs})`);
        }
        break;

      case 'flames':
        if (player.powerUps.flames < maxLimits.flames) {
          player.powerUps.flames++;
          console.log(`${player.nickname} flames increased to ${player.powerUps.flames}`);
        } else {
          console.log(`${player.nickname} already at max flames (${maxLimits.flames})`);
        }
        break;

      case 'speed':
        if (player.powerUps.speed < maxLimits.speed) {
          player.powerUps.speed++;
          console.log(`${player.nickname} speed increased to ${player.powerUps.speed}`);
        } else {
          console.log(`${player.nickname} already at max speed (${maxLimits.speed})`);
        }
        break;

      default:
        console.warn(`Unknown power-up type: ${powerUpType}`);
    }
  }
}

let PORT;



function bootstrap() {
  gameServer = new GameServer();
  wsManager = new WebSocketManager(gameServer);
  gameServer.setWebSocketManager(wsManager);

  server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    if (req.url.startsWith('/api/')) {
      handleApiRequest(req, res);
      return;
    }

    let filePath = req.url === '/' ? './index.html' : '.' + req.url;
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    if (ext) {
      // Serve static files with extensions
      fs.readFile(filePath, (err, content) => {
        if (err) {
          if (err.code === 'ENOENT') {
            console.log(`Static file not found: ${filePath}`);
            res.writeHead(404);
            res.end('Static file not found');
          } else {
            console.log(`Server error: ${err.code}`);
            res.writeHead(500);
            res.end('Server error: ' + err.code);
          }
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    } else {
      // Serve index.html for routes without extensions (SPA fallback)
      console.log(`Serving index.html for route: ${req.url}`);
      fs.readFile('./index.html', (err, content) => {
        if (err) {
          console.log(`Index file not found: ./index.html`);
          res.writeHead(500);
          res.end('Server configuration error: Index file not found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
        }
      });
    }
  });

function handleApiRequest(req, res) {
  console.log(`API Request: ${req.method} ${req.url}`);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/gamestate' && req.method === 'GET') {
    try {
      const gameState = gameServer.getGameState();
      res.writeHead(200);
      res.end(JSON.stringify(gameState));
    } catch (error) {
      console.error('Error getting game state:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  } else if (req.url === '/api/join' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        console.log('Received join request body:', body);
        const { nickname } = JSON.parse(body);
        console.log('Parsed nickname:', nickname);

        const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        console.log('Generated player ID:', playerId);

        const result = gameServer.addPlayer(playerId, nickname);
        console.log('Add player result:', result);

        if (result.success) {
          const response = {
            success: true,
            playerId: playerId,
            player: result.player,
            gameState: gameServer.getGameState()
          };
          res.writeHead(200);
          res.end(JSON.stringify(response));
        } else {
          const errorResponse = { success: false, error: result.error };
          res.writeHead(400);
          res.end(JSON.stringify(errorResponse));
        }
      } catch (error) {
        console.error('Error processing join request:', error);
        const errorResponse = { success: false, error: error.message };
        res.writeHead(400);
        res.end(JSON.stringify(errorResponse));
      }
    });
  } else if (req.url === '/api/move' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { playerId, direction } = JSON.parse(body);
        console.log(`Move request: ${playerId} -> ${direction}`);
        const result = gameServer.movePlayer(playerId, direction);

        res.writeHead(200);
        res.end(JSON.stringify({ success: result, gameState: gameServer.getGameState() }));
      } catch (error) {
        console.error('Move error:', error);
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  } else if (req.url === '/api/bomb' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { playerId } = JSON.parse(body);
        const result = gameServer.placeBomb(playerId);

        res.writeHead(200);
        res.end(JSON.stringify({ success: result, gameState: gameServer.getGameState() }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
  } else {
    console.log('API endpoint not found:', req.url);
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

server.listen(PORT, () => {
  console.log(`Game server running at http://localhost:${PORT}`);

  wsManager.initWebSocketServer(server);
  console.log(`WebSocket server initialized on port ${PORT}`);
});
}
