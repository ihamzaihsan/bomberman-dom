const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocketManager = require('./src/backend/websocketServer.cjs');
const {
  MAP_CONFIG,
  GAME_TIMING,
  PLAYER_CONFIG,
  STARTING_POSITIONS,
  CELL_TYPES,
  WALKABLE_CELLS,
  POWER_UP_CONFIG,
  EXPLOSION_CONFIG,
  SERVER_CONFIG,
  VALIDATION,
  MIME_TYPES
} = require('./src/shared/GameConstants.cjs');

const { MovementValidator } = require('./src/shared/MovementValidator.cjs');
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
      gameTimeLeft: GAME_TIMING.GAME_DURATION, // ✅ CONSOLIDATED: Use shared constant
      gameTimeTimer: null,
      gameEnded: false,
      winner: null,
      waitingTimer: null,
      waitingTimeLeft: GAME_TIMING.WAITING_DURATION // ✅ CONSOLIDATED: Use shared constant
    };

    // WebSocket manager will be injected
    this.wsManager = null;

    // Real-time game loop for processing bombs, explosions, etc.
    this.gameLoopInterval = null;
    this.gameLoopRunning = false;

    // ✅ NEW: Chain reaction tracking to prevent infinite loops and duplicate explosions
    this.explodingBombs = new Set(); // Track bombs currently exploding
    this.explodedBombs = new Set(); // Track bombs that have already exploded

    this.isPostGame = false; // <--- Add post-game flag

    console.log(`GameServer initialized with ${MAP_CONFIG.WIDTH}x${MAP_CONFIG.HEIGHT} map`); // ✅ CONSOLIDATED: Use shared constant
  }

  // Set WebSocket manager reference
  setWebSocketManager(wsManager) {
    this.wsManager = wsManager;
  }

  // Broadcast methods for WebSocket communication
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

  // Add removePlayer method for WebSocket disconnections
  removePlayer(playerId) {
    if (this.gameState.players[playerId]) {
      delete this.gameState.players[playerId];

      // Check if we need to cancel timers due to insufficient players
      const remainingPlayers = Object.keys(this.gameState.players).length;

      if (remainingPlayers < PLAYER_CONFIG.MIN_PLAYERS && this.gameState.waitingTimer) { // ✅ CONSOLIDATED: Use shared constant
        // Cancel waiting timer if less than 2 players
        clearInterval(this.gameState.waitingTimer);
        this.gameState.waitingTimer = null;
        this.gameState.waitingTimeLeft = GAME_TIMING.WAITING_DURATION; // ✅ CONSOLIDATED: Use shared constant
        console.log('Waiting timer cancelled - insufficient players');
      }

      if (remainingPlayers < 1 && this.gameState.gameStarted) {
        this.endGame('All players disconnected');
      }

      return true;
    }
    return false;
  }

  generateMap() {
    console.log(`Generating ${MAP_CONFIG.WIDTH}x${MAP_CONFIG.HEIGHT} map...`); // ✅ CONSOLIDATED: Use shared constant
    const width = MAP_CONFIG.WIDTH; // ✅ CONSOLIDATED: Use shared constant
    const height = MAP_CONFIG.HEIGHT; // ✅ CONSOLIDATED: Use shared constant
    const map = [];

    // Initialize the map
    for (let y = 0; y < height; y++) {
      map[y] = [];
      for (let x = 0; x < width; x++) {
        // ✅ UPDATED: Add soft blocks around all edges
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          map[y][x] = CELL_TYPES.BLOCK; // Soft blocks around edges
        }
        // Interior walls on odd coordinates (classic Bomberman pattern)
        else if (x % 2 === 1 && y % 2 === 1) {
          map[y][x] = CELL_TYPES.WALL; // Indestructible walls
        }
        // Random blocks in the interior
        else if (Math.random() < MAP_CONFIG.BLOCK_DENSITY) {
          map[y][x] = CELL_TYPES.BLOCK; // Destructible blocks
        }
        // Empty cells
        else {
          map[y][x] = CELL_TYPES.EMPTY;
        }
      }
    }

    // ✅ FIXED: Create proper 3x3 spawn-safe areas for all starting positions
    STARTING_POSITIONS.forEach((pos, index) => {
      console.log(`Creating 3x3 spawn area for player ${index + 1} at (${pos.x}, ${pos.y})`);

      // Create 3x3 safe area around each starting position
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = pos.x + dx;
          const y = pos.y + dy;

          // Ensure coordinates are within bounds
          if (x >= 0 && x < width && y >= 0 && y < height) {
            // Center cell is the spawn point
            if (dx === 0 && dy === 0) {
              map[y][x] = CELL_TYPES.SPAWN;
            } else {
              map[y][x] = CELL_TYPES.SPAWN_SAFE;
            }
          }
        }
      }
    });

    console.log(`${MAP_CONFIG.WIDTH}x${MAP_CONFIG.HEIGHT} Map generated successfully`); // ✅ CONSOLIDATED: Use shared constant
    return map;
  }

  // ✅ UPDATED: Simplified method for checking if position is in spawn area
  isStartingPosition(x, y, width, height) {
    // Check if position is within any of the 3x3 spawn areas
    return STARTING_POSITIONS.some(pos => {
      return Math.abs(x - pos.x) <= 1 && Math.abs(y - pos.y) <= 1;
    });
  }

  // ✅ CONSOLIDATED: Removed duplicate method - now using VALIDATION.isPlayerSpawnPoint from shared constants

  getGameState() {
    return this.gameState;
  }

  // Get a clean version of game state for JSON serialization (removes circular references)
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
      // Exclude waitingTimer, gameTimer, gameTimeTimer (these contain circular references)
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

    // === PREVENT JOIN DURING POST-GAME ===
    if (this.isPostGame) {
      console.log('Rejecting player: Game is resetting, please wait for next round');
      return { success: false, error: 'Game is resetting, please wait for next round' };
    }

    // === DUPLICATE NICKNAME CHECK ===
    const duplicate = Object.values(this.gameState.players).some(
      (p) => p.nickname && p.nickname.trim().toLowerCase() === nickname.trim().toLowerCase()
    );
    if (duplicate) {
      console.log('Rejecting player: Duplicate nickname');
      return { success: false, error: 'There is a player in the lobby with the same name' };
    }

    if (playerCount >= PLAYER_CONFIG.MAX_PLAYERS) { // ✅ CONSOLIDATED: Use shared constant
      console.log('Rejecting player: Game is full');
      return { success: false, error: `Game is full (${PLAYER_CONFIG.MAX_PLAYERS} players maximum)` };
    }

    if (this.gameState.gameStarted) {
      console.log('Rejecting player: Game has already started');
      return { success: false, error: 'Game has already started' };
    }

    if (this.gameState.countdown > 0 && this.gameState.countdown <= EXPLOSION_CONFIG.FINAL_COUNTDOWN_THRESHOLD) { // ✅ CONSOLIDATED: Use shared constant
      console.log('Rejecting player: Game is starting (final countdown active)');
      return { success: false, error: 'Game is starting - please wait for next round' };
    }
    const player = {
      id: playerId,
      nickname,
      x: STARTING_POSITIONS[playerCount].x, // ✅ CONSOLIDATED: Use shared constant
      y: STARTING_POSITIONS[playerCount].y, // ✅ CONSOLIDATED: Use shared constant
      lives: PLAYER_CONFIG.STARTING_LIVES, // ✅ CONSOLIDATED: Use shared constant
      powerUps: {
        bombs: PLAYER_CONFIG.DEFAULT_MAX_BOMBS, // ✅ CONSOLIDATED: Use shared constant
        flames: PLAYER_CONFIG.DEFAULT_BOMB_RANGE, // ✅ CONSOLIDATED: Use shared constant
        speed: PLAYER_CONFIG.DEFAULT_SPEED // ✅ CONSOLIDATED: Use shared constant
      },
      // ✅ NEW: Proper bomb management system
      maxBombs: PLAYER_CONFIG.DEFAULT_MAX_BOMBS, // ✅ CONSOLIDATED: Use shared constant
      currentBombs: 0,  // Current number of active bombs on field
      alive: true
    };

    this.gameState.players[playerId] = player;
    console.log(`Player added successfully:`, player);

    const newPlayerCount = playerCount + 1;

    // Reset countdown if a new player joins during countdown (except final countdown threshold)
    if (this.gameState.countdown > EXPLOSION_CONFIG.FINAL_COUNTDOWN_THRESHOLD) { // ✅ CONSOLIDATED: Use shared constant
      console.log('New player joined during countdown - resetting to waiting timer');
      this.resetToWaitingTimer();
    }

    // Implement proper waiting room timer logic
    if (newPlayerCount === PLAYER_CONFIG.MIN_PLAYERS && !this.gameState.waitingTimer && !this.gameState.gameStarted && this.gameState.countdown === 0) { // ✅ CONSOLIDATED: Use shared constant
      // Start waiting timer when minimum players join
      console.log(`Starting ${GAME_TIMING.WAITING_DURATION}-second waiting timer...`);
      this.startWaitingTimer();
    } else if (newPlayerCount === PLAYER_CONFIG.MAX_PLAYERS && !this.gameState.gameStarted) { // ✅ CONSOLIDATED: Use shared constant
      // Skip to countdown immediately when maximum players join
      console.log(`${PLAYER_CONFIG.MAX_PLAYERS} players reached - starting countdown immediately...`);
      this.skipToCountdown();
    }

    return { success: true, player };
  }

  // Start waiting timer
  startWaitingTimer() {
    this.gameState.waitingTimeLeft = GAME_TIMING.WAITING_DURATION; // ✅ CONSOLIDATED: Use shared constant
    this.gameState.waitingTimer = setInterval(() => {
      this.gameState.waitingTimeLeft--;
      console.log(`Waiting time left: ${this.gameState.waitingTimeLeft} seconds`);

      // Broadcast waiting timer update
      this.broadcastEvent('waiting_timer_update', {
        waitingTimeLeft: this.gameState.waitingTimeLeft
      });

      if (this.gameState.waitingTimeLeft <= 0) {
        console.log('=== 20-SECOND WAIT COMPLETED - STARTING COUNTDOWN ===');
        clearInterval(this.gameState.waitingTimer);
        this.gameState.waitingTimer = null;
        this.skipToCountdown();
      }
    }, GAME_TIMING.TIMER_INTERVAL); // ✅ CONSOLIDATED: Use shared constant
  }

  // Reset countdown back to waiting timer when new player joins
  resetToWaitingTimer() {
    // Clear countdown timer if it exists
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }

    // Reset countdown
    this.gameState.countdown = 0;

    // Start waiting timer again
    this.startWaitingTimer();
  }

  // Skip to 10-second countdown (called when 4 players join or 20s wait expires)
  skipToCountdown() {
    console.log('=== SKIPPING TO COUNTDOWN ===');
    // Clear waiting timer if it exists
    if (this.gameState.waitingTimer) {
      console.log('Clearing waiting timer');
      clearInterval(this.gameState.waitingTimer);
      this.gameState.waitingTimer = null;
    }

    // Start the 10-second countdown
    console.log('About to start game timer (countdown)');
    this.startGameTimer();
  }

  startGameTimer() {
    console.log('=== STARTING GAME TIMER ===');
    this.gameState.countdown = GAME_TIMING.COUNTDOWN_DURATION; // ✅ CONSOLIDATED: Use shared constant
    this.gameTimer = setInterval(() => {
      this.gameState.countdown--;
      console.log(`Game starting in: ${this.gameState.countdown}`);

      // Broadcast countdown update
      console.log('Broadcasting countdown_update event:', { countdown: this.gameState.countdown });
      this.broadcastEvent('countdown_update', { countdown: this.gameState.countdown });

      if (this.gameState.countdown <= 0) {
        this.gameState.gameStarted = true;
        clearInterval(this.gameTimer);
        console.log('Game started!');

        // ✅ CRITICAL: Start real-time game loop for bomb processing
        this.startRealTimeGameLoop();

        // Broadcast game start event
        if (this.wsManager) {
          this.wsManager.broadcastEvent('game_started', { gameState: this.getCleanGameState() });
        }

        // Start the game time countdown
        this.startGameTimeTimer();
      }
    }, GAME_TIMING.TIMER_INTERVAL); // ✅ CONSOLIDATED: Use shared constant
  }

  startGameTimeTimer() {
    console.log('=== STARTING GAME TIME TIMER ===');
    console.log('Initial game time:', this.gameState.gameTimeLeft);
    this.gameTimeTimer = setInterval(() => {
      this.gameState.gameTimeLeft--;
      console.log(`Game time left: ${this.gameState.gameTimeLeft} seconds`);

      // ✅ FIX: Broadcast timer update EVERY SECOND for real-time display
      console.log('Broadcasting timer_update event:', { timeLeft: this.gameState.gameTimeLeft });
      this.broadcastEvent('timer_update', { timeLeft: this.gameState.gameTimeLeft });

      if (this.gameState.gameTimeLeft <= 0) {
        this.endGame('Time\'s up!');
      }
    }, GAME_TIMING.TIMER_INTERVAL); // ✅ CONSOLIDATED: Use shared constant
  }

  // ✅ CRITICAL: Start real-time game loop for processing bombs, explosions, etc.
  startRealTimeGameLoop() {
    if (this.gameLoopRunning) return;

    console.log('Starting real-time game loop...');
    this.gameLoopRunning = true;

    // Process game logic every 100ms (10 FPS) for smooth real-time updates
    this.gameLoopInterval = setInterval(() => {
      this.processGameLogic();
    }, 100);
  }

  // ✅ CRITICAL: Stop real-time game loop
  stopRealTimeGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
      this.gameLoopRunning = false;
      console.log('Real-time game loop stopped');
    }
  }

  // ✅ CRITICAL: Process real-time game logic (bombs, explosions, power-ups)
  processGameLogic() {
    if (!this.gameState.gameStarted) return;

    let gameStateChanged = false;

    // Process bomb timers and explosions
    if (this.gameState.bombs.length > 0) {
      console.log(`🔄 Processing ${this.gameState.bombs.length} bombs`);
    }

    // ✅ UPDATED: Process bombs with chain reaction support
    const bombsToExplode = []; // Collect bombs that need to explode this cycle

    for (let i = this.gameState.bombs.length - 1; i >= 0; i--) {
      const bomb = this.gameState.bombs[i];
      bomb.timer -= 0.1; // Decrease by 100ms

      console.log(`💣 Bomb ${bomb.id} at (${bomb.x}, ${bomb.y}) timer: ${bomb.timer.toFixed(1)}s`);

      if (bomb.timer <= 0) {
        console.log(`💥 BOMB TIMER EXPIRED at (${bomb.x}, ${bomb.y})!`);
        bombsToExplode.push(bomb);
        this.gameState.bombs.splice(i, 1); // Remove from active bombs
        gameStateChanged = true;
      }
    }

    // ✅ NEW: Explode all bombs that reached timer = 0 (not chain reactions)
    bombsToExplode.forEach(bomb => {
      console.log(`💥 Exploding timer-expired bomb: ${bomb.id}`);
      this.explodeBomb(bomb, 0); // Start chain reaction with depth 0
    });

    // Broadcast game state if anything changed
    if (gameStateChanged && this.wsManager) {
      this.wsManager.broadcastGameState();
    }
  }

  endGame(reason) {
    console.log(`Game ended: ${reason}`);
    this.gameState.gameEnded = true;
    this.gameState.gameStarted = false;
    this.isPostGame = true; // <--- Set post-game flag

    // ✅ CRITICAL: Stop real-time game loop
    this.stopRealTimeGameLoop();

    if (this.gameTimeTimer) {
      clearInterval(this.gameTimeTimer);
      this.gameTimeTimer = null;
    }

    // Determine winner based on remaining lives or last player standing
    const alivePlayers = Object.values(this.gameState.players).filter(p => p.alive);

    if (alivePlayers.length === 1) {
      this.gameState.winner = alivePlayers[0];
      console.log(`Winner: ${this.gameState.winner.nickname}`);
    } else if (alivePlayers.length > 1) {
      // If time runs out, winner is player with most lives
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

    // Broadcast game end event
    this.broadcastEvent('game_ended', {
      reason: reason,
      winner: this.gameState.winner,
      gameState: this.gameState
    });

    // Reset game after 10 seconds
    setTimeout(() => {
      this.resetGame();
    }, GAME_TIMING.GAME_END_RESET_DELAY); // ✅ CONSOLIDATED: Use shared constant
  }

  resetGame() {
    console.log('Resetting game...');

    // Clear all timers
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
      gameTimeLeft: GAME_TIMING.GAME_DURATION, // ✅ CONSOLIDATED: Use shared constant
      gameTimeTimer: null,
      gameEnded: false,
      winner: null,
      waitingTimer: null,
      waitingTimeLeft: GAME_TIMING.WAITING_DURATION // ✅ CONSOLIDATED: Use shared constant
    };

    this.isPostGame = false; // <--- Clear post-game flag

    // ✅ NEW: Reset chain reaction tracking sets
    this.explodingBombs.clear();
    this.explodedBombs.clear();
    console.log('🔄 Chain reaction tracking sets reset');

    // Broadcast game reset event
    this.broadcastEvent('game_reset', { gameState: this.gameState });
  }

  // ✅ CONSOLIDATED: Use shared movement validator
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

    // ✅ CONSOLIDATED: Use shared movement validator
    const validationResult = MovementValidator.validateMove(player, direction, this.gameState);

    if (!validationResult.isValid) {
      console.log('Move rejected:', validationResult.reason);
      return false;
    }

    // Apply the validated move
    player.x = validationResult.newX;
    player.y = validationResult.newY;
    console.log(`Player ${playerId} moved to (${validationResult.newX}, ${validationResult.newY})`);

    // ✅ PHASE 4: Check for power-up collection
    this.checkPowerUpCollection(playerId, validationResult.newX, validationResult.newY);

    return true;
  }

  placeBomb(playerId) {
    const player = this.gameState.players[playerId];
    if (!player || !player.alive || !this.gameState.gameStarted || this.gameState.gameEnded) return false;

    // ✅ UPDATED: Check if player can place more bombs using new system
    if (player.currentBombs >= player.maxBombs) {
      console.log(`Player ${player.nickname} cannot place bomb: ${player.currentBombs}/${player.maxBombs} bombs active`);
      return false;
    }

    const bomb = {
      id: 'bomb_' + Date.now(),
      playerId,
      x: player.x,
      y: player.y,
      timer: GAME_TIMING.BOMB_TIMER, // ✅ CONSOLIDATED: Use shared constant
      range: player.powerUps.flames
    };

    this.gameState.bombs.push(bomb);

    // ✅ NEW: Increment current bomb count
    player.currentBombs++;

    console.log(`Bomb placed by ${player.nickname}: ${bomb.id} at (${bomb.x}, ${bomb.y}). Active bombs: ${player.currentBombs}/${player.maxBombs}`);

    // ✅ REMOVED: setTimeout approach - now handled by real-time game loop
    // The game loop will automatically process bomb timers and trigger explosions

    return true;
  }

  // ✅ UPDATED: Handle bomb explosion with chain reaction support (called from game loop)
  explodeBomb(bomb, chainReactionDepth = 0) {
    console.log(`💥 Exploding bomb: ${bomb.id} at position (${bomb.x}, ${bomb.y}) - Chain depth: ${chainReactionDepth}`);

    // ✅ NEW: Prevent duplicate explosions - check if bomb already exploded or is exploding
    if (this.explodedBombs.has(bomb.id) || this.explodingBombs.has(bomb.id)) {
      console.log(`⚠️ Bomb ${bomb.id} already exploded or is exploding, skipping`);
      return;
    }

    // ✅ NEW: Decrement bomb count for the player who placed this bomb
    const bombOwner = this.gameState.players[bomb.playerId];
    if (bombOwner && bombOwner.currentBombs > 0) {
      bombOwner.currentBombs--;
      console.log(`💣 Decremented bomb count for ${bombOwner.nickname}: ${bombOwner.currentBombs}/${bombOwner.maxBombs}`);
    }

    // Mark bomb as currently exploding
    this.explodingBombs.add(bomb.id);

    // Prevent infinite chain reactions by limiting depth
    const MAX_CHAIN_DEPTH = EXPLOSION_CONFIG.MAX_CHAIN_DEPTH; // ✅ CONSOLIDATED: Use shared constant
    if (chainReactionDepth > MAX_CHAIN_DEPTH) {
      console.warn(`⚠️ Chain reaction depth limit reached (${MAX_CHAIN_DEPTH}), stopping chain`);
      this.explodingBombs.delete(bomb.id);
      this.explodedBombs.add(bomb.id);
      return;
    }

    // Create explosion pattern
    const explosions = [{ x: bomb.x, y: bomb.y }];
    const triggeredBombs = []; // Track bombs triggered by this explosion

    // Damage bomb owner if still standing on their own bomb
    if (bombOwner && bombOwner.alive && bombOwner.x === bomb.x && bombOwner.y === bomb.y) {
      bombOwner.lives--;
      console.log(`Player ${bombOwner.nickname} damaged by their own bomb! Lives: ${bombOwner.lives}`);
      bombOwner.maxBombs = PLAYER_CONFIG.DEFAULT_MAX_BOMBS; // ✅ CONSOLIDATED: Use shared constant
      bombOwner.currentBombs = 0;
      bombOwner.powerUps.bombs = PLAYER_CONFIG.DEFAULT_MAX_BOMBS; // ✅ CONSOLIDATED: Use shared constant
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

        // ✅ GAME END LOGIC: Check if this elimination will end the game
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

    // Add explosion in 4 directions
    const directions = [
      { dx: 0, dy: -1 }, // up
      { dx: 0, dy: 1 },  // down
      { dx: -1, dy: 0 }, // left
      { dx: 1, dy: 0 }   // right
    ];

    directions.forEach(dir => {
      for (let i = 1; i <= bomb.range; i++) {
        const x = bomb.x + (dir.dx * i);
        const y = bomb.y + (dir.dy * i);

        if (x < 0 || x >= MAP_CONFIG.WIDTH || y < 0 || y >= MAP_CONFIG.HEIGHT) break; // ✅ CONSOLIDATED: Use shared constants
        if (this.gameState.map[y][x] === 'wall') break;

        explosions.push({ x, y });

        // ✅ NEW: Check for bombs in explosion range for chain reactions
        const bombsAtPosition = this.gameState.bombs.filter(otherBomb =>
          otherBomb.x === x && otherBomb.y === y && otherBomb.id !== bomb.id
        );

        if (bombsAtPosition.length > 0) {
          bombsAtPosition.forEach(triggeredBomb => {
            console.log(`🔗 Chain reaction: Bomb ${triggeredBomb.id} at (${x}, ${y}) triggered by explosion`);
            triggeredBombs.push(triggeredBomb);
          });
        }

        // Check for player hits
        Object.values(this.gameState.players).forEach(player => {
          if (player.alive && player.x === x && player.y === y) {
            player.lives--;
            console.log(`Player ${player.nickname} hit by explosion! Lives: ${player.lives}`);

            // ✅ CRITICAL FIX: Reset bomb system on damage
            player.maxBombs = PLAYER_CONFIG.DEFAULT_MAX_BOMBS; // ✅ CONSOLIDATED: Use shared constant
            player.currentBombs = 0;
            // ✅ ALSO reset powerUps.bombs for backward compatibility
            player.powerUps.bombs = PLAYER_CONFIG.DEFAULT_MAX_BOMBS; // ✅ CONSOLIDATED: Use shared constant
            console.log(`💣 Reset bomb system for ${player.nickname}: maxBombs=1, currentBombs=0, powerUps.bombs=1`);

            // Broadcast player damage event
            this.broadcastEvent('player_damaged', {
              playerId: player.id,
              nickname: player.nickname,
              livesRemaining: player.lives,
              position: { x: player.x, y: player.y }
            });

            if (player.lives <= 0) {
              // ✅ FIX: Ensure lives are set to exactly 0 for eliminated players
              player.lives = 0;
              player.alive = false;
              console.log(`Player ${player.nickname} eliminated! Lives: ${player.lives}`);

              // ✅ GAME END LOGIC: Check if this elimination will end the game
              const alivePlayers = Object.values(this.gameState.players).filter(p => p.alive);
              const willGameEnd = alivePlayers.length <= 1;
              const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;

              console.log(`Game end check: ${alivePlayers.length} alive, willGameEnd: ${willGameEnd}`);

              // Broadcast player elimination event with game end information
              this.broadcastEvent('player_eliminated', {
                playerId: player.id,
                nickname: player.nickname,
                finalLives: player.lives,
                willGameEnd: willGameEnd,
                winner: winner ? { id: winner.id, nickname: winner.nickname } : null
              });

              // ✅ FIX: Broadcast updated game state BEFORE ending game
              if (this.wsManager) {
                this.wsManager.broadcastGameState();
              }

              // Check if game should end (with small delay to ensure state sync)
              setTimeout(() => {
                const alivePlayers = Object.values(this.gameState.players).filter(p => p.alive);
                if (alivePlayers.length <= 1) {
                  this.endGame('Last player standing!');
                }
              }, GAME_TIMING.STATE_SYNC_DELAY); // ✅ CONSOLIDATED: Use shared constant
            }
          }
        });

        if (this.gameState.map[y][x] === CELL_TYPES.BLOCK) { // ✅ CONSOLIDATED: Use shared constant
          this.gameState.map[y][x] = CELL_TYPES.EMPTY; // ✅ CONSOLIDATED: Use shared constant
          console.log(`Block destroyed at (${x}, ${y})`);

          // ✅ PHASE 2: Power-up spawning system
          this.trySpawnPowerUp(x, y);

          break;
        }
      }
    });

    // Broadcast explosion event for this bomb
    if (this.wsManager) {
      const explosionEvent = {
        bombId: bomb.id,
        position: { x: bomb.x, y: bomb.y },
        explosions: explosions,
        range: bomb.range,
        chainReactionDepth: chainReactionDepth
      };

      console.log('📡 BROADCASTING bomb_exploded event:', explosionEvent);
      this.wsManager.broadcastEvent('bomb_exploded', explosionEvent);
      console.log('✅ bomb_exploded event sent to all clients');
    } else {
      console.error('❌ wsManager not available for broadcasting explosion event');
    }

    console.log(`💥 Bomb exploded at: (${bomb.x}, ${bomb.y}) with explosions at:`, explosions);

    // ✅ NEW: Process chain reactions - trigger bombs that were hit by this explosion
    if (triggeredBombs.length > 0) {
      console.log(`🔗 Processing ${triggeredBombs.length} chain reaction bombs at depth ${chainReactionDepth + 1}`);

      triggeredBombs.forEach(triggeredBomb => {
        // Remove the triggered bomb from the game state bombs array
        const bombIndex = this.gameState.bombs.findIndex(b => b.id === triggeredBomb.id);
        if (bombIndex !== -1) {
          this.gameState.bombs.splice(bombIndex, 1);
          console.log(`🗑️ Removed triggered bomb ${triggeredBomb.id} from game state`);

          // Recursively explode the triggered bomb with increased chain depth
          // Add small delay to create visual sequence of explosions
          setTimeout(() => {
            this.explodeBomb(triggeredBomb, chainReactionDepth + 1);
          }, GAME_TIMING.CHAIN_EXPLOSION_DELAY); // ✅ CONSOLIDATED: Use shared constant
        }
      });
    }

    // ✅ NEW: Mark bomb as exploded and clean up tracking
    this.explodingBombs.delete(bomb.id);
    this.explodedBombs.add(bomb.id);
    console.log(`✅ Bomb ${bomb.id} explosion complete, marked as exploded`);

    // ✅ CRITICAL FIX: Broadcast game state after bomb explosion
    // This ensures clients get the updated currentBombs count immediately
    if (this.wsManager && chainReactionDepth === 0) {
      // Only broadcast on the root explosion to avoid spam during chain reactions
      setTimeout(() => {
        this.wsManager.broadcastGameState();
        console.log(`📡 Game state broadcasted after bomb explosion`);
      }, GAME_TIMING.GAME_STATE_BROADCAST_DELAY); // ✅ CONSOLIDATED: Use shared constant
    }
  }

  // ✅ CONSOLIDATED: Power-up spawning system using shared constants
  trySpawnPowerUp(x, y) {
    if (Math.random() < POWER_UP_CONFIG.SPAWN_CHANCE) { // ✅ CONSOLIDATED: Use shared constant
      const randomType = POWER_UP_CONFIG.TYPES[Math.floor(Math.random() * POWER_UP_CONFIG.TYPES.length)]; // ✅ CONSOLIDATED: Use shared constant

      const powerUp = {
        id: 'powerup_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
        type: randomType,
        x: x,
        y: y
      };

      this.gameState.powerUps.push(powerUp);
      console.log(`🎁 Power-up spawned: ${randomType} at (${x}, ${y})`);

      // Broadcast power-up spawn event
      if (this.wsManager) {
        this.wsManager.broadcastEvent('powerup_spawned', {
          powerUp: powerUp
        });
      }
    }
  }

  // ✅ PHASE 4: Power-up collection system
  checkPowerUpCollection(playerId, x, y) {
    const powerUpIndex = this.gameState.powerUps.findIndex(powerUp => powerUp.x === x && powerUp.y === y);

    if (powerUpIndex !== -1) {
      const powerUp = this.gameState.powerUps[powerUpIndex];
      const player = this.gameState.players[playerId];

      // ✅ GHOST MODE: Only alive players can collect power-ups
      if (!player || !player.alive) {
        console.log(`🚫 Ghost player ${player?.nickname || playerId} cannot collect power-ups`);
        return;
      }

      console.log(`🎁 Player ${player.nickname} collected ${powerUp.type} power-up at (${x}, ${y})`);
      console.log(`   Before: maxBombs=${player.maxBombs}, powerUps.bombs=${player.powerUps.bombs}`);

      // Apply power-up effect
      this.applyPowerUpEffect(player, powerUp.type);

      console.log(`   After: maxBombs=${player.maxBombs}, powerUps.bombs=${player.powerUps.bombs}`);

      // Remove power-up from game state
      this.gameState.powerUps.splice(powerUpIndex, 1);

      // Broadcast power-up collection event
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

        // ✅ CRITICAL: Broadcast updated game state after power-up collection
        this.wsManager.broadcastGameState();
      }
    }
  }

  applyPowerUpEffect(player, powerUpType) {
    const maxLimits = POWER_UP_CONFIG.MAX_LIMITS; // ✅ CONSOLIDATED: Use shared constant

    switch (powerUpType) {
      case 'bombs':
        // ✅ UPDATED: Use new maxBombs system instead of powerUps.bombs
        if (player.maxBombs < maxLimits.bombs) {
          player.maxBombs++;
          // Keep powerUps.bombs for backward compatibility
          player.powerUps.bombs = player.maxBombs;
          console.log(`💣 ${player.nickname} maxBombs increased to ${player.maxBombs}`);
        } else {
          console.log(`💣 ${player.nickname} already at max bombs (${maxLimits.bombs})`);
        }
        break;

      case 'flames':
        if (player.powerUps.flames < maxLimits.flames) {
          player.powerUps.flames++;
          console.log(`🔥 ${player.nickname} flames increased to ${player.powerUps.flames}`);
        } else {
          console.log(`🔥 ${player.nickname} already at max flames (${maxLimits.flames})`);
        }
        break;

      case 'speed':
        if (player.powerUps.speed < maxLimits.speed) {
          player.powerUps.speed++;
          console.log(`⚡ ${player.nickname} speed increased to ${player.powerUps.speed}`);
        } else {
          console.log(`⚡ ${player.nickname} already at max speed (${maxLimits.speed})`);
        }
        break;

      default:
        console.warn(`Unknown power-up type: ${powerUpType}`);
    }
  }
}

const PORT = SERVER_CONFIG.PORT; // ✅ CONSOLIDATED: Use shared constant
const gameServer = new GameServer();
const wsManager = new WebSocketManager(gameServer);
gameServer.setWebSocketManager(wsManager);
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  if (req.url.startsWith('/api/')) {
    handleApiRequest(req, res);
    return;
  }

  let filePath = req.url === '/' ? './index.html' : '.' + req.url;
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.log(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end('File not found');
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
  console.log(`Bomberman server running at http://localhost:${PORT}`);

  // Initialize WebSocket server
  wsManager.initWebSocketServer(server);
  console.log(`WebSocket server initialized on port ${PORT}`);
});
