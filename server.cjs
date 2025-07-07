const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocketManager = require('./src/backend/websocketServer.cjs');

// GameServer class - handles game logic
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
      gameTimeLeft: 60,
      gameTimeTimer: null,
      gameEnded: false,
      winner: null,
      waitingTimer: null,
      waitingTimeLeft: 20
    };

    // WebSocket manager will be injected
    this.wsManager = null;

    // Real-time game loop for processing bombs, explosions, etc.
    this.gameLoopInterval = null;
    this.gameLoopRunning = false;

    console.log('GameServer initialized with 12x12 map');
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

      if (remainingPlayers < 2 && this.gameState.waitingTimer) {
        // Cancel waiting timer if less than 2 players
        clearInterval(this.gameState.waitingTimer);
        this.gameState.waitingTimer = null;
        this.gameState.waitingTimeLeft = 20;
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
    console.log('Generating 12x12 map...');
    const width = 12;
    const height = 12;
    const map = [];

    for (let y = 0; y < height; y++) {
      map[y] = [];
      for (let x = 0; x < width; x++) {
        if (x % 2 === 1 && y % 2 === 1) {
          map[y][x] = 'wall';
        } else if (this.isStartingPosition(x, y, width, height)) {
          map[y][x] = 'empty';
        } else if (Math.random() < 0.6) { // Reduced block density slightly
          map[y][x] = 'block';
        } else {
          map[y][x] = 'empty';
        }
      }
    }

    console.log('12x12 Map generated successfully');
    return map;
  }

  isStartingPosition(x, y, width, height) {
    // Ensure starting corners are clear (2x2 areas)
    // Top-left corner
    if (x <= 1 && y <= 1) return true;
    // Top-right corner
    if (x >= width - 2 && y <= 1) return true;
    // Bottom-left corner
    if (x <= 1 && y >= height - 2) return true;
    // Bottom-right corner
    if (x >= width - 2 && y >= height - 2) return true;
    return false;
  }

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

    if (playerCount >= 4) {
      console.log('Rejecting player: Game is full');
      return { success: false, error: 'Game is full (4 players maximum)' };
    }

    if (this.gameState.gameStarted) {
      console.log('Rejecting player: Game has already started');
      return { success: false, error: 'Game has already started' };
    }

    // Allow joining and reset countdown if a new player joins during countdown
    // Only block during the final 3 seconds to prevent last-second joins
    if (this.gameState.countdown > 0 && this.gameState.countdown <= 3) {
      console.log('Rejecting player: Game is starting (final countdown active)');
      return { success: false, error: 'Game is starting - please wait for next round' };
    }

    // Starting positions for 12x12 map
    const startingPositions = [
      { x: 1, y: 1 },     // Top-left
      { x: 10, y: 1 },    // Top-right
      { x: 1, y: 10 },    // Bottom-left
      { x: 10, y: 10 }    // Bottom-right
    ];

    const player = {
      id: playerId,
      nickname,
      x: startingPositions[playerCount].x,
      y: startingPositions[playerCount].y,
      lives: 3,
      powerUps: {
        bombs: 1,
        flames: 2, // Increased flame range for bigger map
        speed: 1
      },
      alive: true
    };

    this.gameState.players[playerId] = player;
    console.log(`Player added successfully:`, player);

    const newPlayerCount = playerCount + 1;

    // Reset countdown if a new player joins during countdown (except final 3 seconds)
    if (this.gameState.countdown > 3) {
      console.log('New player joined during countdown - resetting to waiting timer');
      this.resetToWaitingTimer();
    }

    // Implement proper waiting room timer logic
    if (newPlayerCount === 2 && !this.gameState.waitingTimer && !this.gameState.gameStarted && this.gameState.countdown === 0) {
      // Start 20-second waiting timer when 2nd player joins
      console.log('Starting 20-second waiting timer...');
      this.startWaitingTimer();
    } else if (newPlayerCount === 4 && !this.gameState.gameStarted) {
      // Skip to countdown immediately when 4th player joins
      console.log('4 players reached - starting countdown immediately...');
      this.skipToCountdown();
    }

    return { success: true, player };
  }

  // Start 20-second waiting timer
  startWaitingTimer() {
    this.gameState.waitingTimeLeft = 20;
    this.gameState.waitingTimer = setInterval(() => {
      this.gameState.waitingTimeLeft--;
      console.log(`Waiting time left: ${this.gameState.waitingTimeLeft} seconds`);

      // Broadcast waiting timer update
      this.broadcastEvent('waiting_timer_update', {
        waitingTimeLeft: this.gameState.waitingTimeLeft
      });

      if (this.gameState.waitingTimeLeft <= 0) {
        console.log('20-second wait completed - starting countdown...');
        this.skipToCountdown();
      }
    }, 1000);
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
    // Clear waiting timer if it exists
    if (this.gameState.waitingTimer) {
      clearInterval(this.gameState.waitingTimer);
      this.gameState.waitingTimer = null;
    }

    // Start the 10-second countdown
    this.startGameTimer();
  }

  startGameTimer() {
    this.gameState.countdown = 10; // 10-second countdown as per requirements
    this.gameTimer = setInterval(() => {
      this.gameState.countdown--;
      console.log(`Game starting in: ${this.gameState.countdown}`);

      // Broadcast countdown update
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
    }, 1000);
  }

  startGameTimeTimer() {
    console.log('Starting 1-minute game timer...');
    this.gameTimeTimer = setInterval(() => {
      this.gameState.gameTimeLeft--;
      console.log(`Game time left: ${this.gameState.gameTimeLeft} seconds`);

      // Broadcast timer update every 10 seconds or when time is low
      if (this.gameState.gameTimeLeft % 10 === 0 || this.gameState.gameTimeLeft <= 10) {
        this.broadcastEvent('timer_update', { timeLeft: this.gameState.gameTimeLeft });
      }

      if (this.gameState.gameTimeLeft <= 0) {
        this.endGame('Time\'s up!');
      }
    }, 1000);
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
    for (let i = this.gameState.bombs.length - 1; i >= 0; i--) {
      const bomb = this.gameState.bombs[i];
      bomb.timer -= 0.1; // Decrease by 100ms

      if (bomb.timer <= 0) {
        console.log(`Bomb at (${bomb.x}, ${bomb.y}) exploding!`);
        this.explodeBomb(bomb);
        this.gameState.bombs.splice(i, 1);
        gameStateChanged = true;
      }
    }

    // Process power-up spawning (if needed)
    // TODO: Add power-up spawning logic here

    // Broadcast game state if anything changed
    if (gameStateChanged && this.wsManager) {
      this.wsManager.broadcastGameState();
    }
  }

  endGame(reason) {
    console.log(`Game ended: ${reason}`);
    this.gameState.gameEnded = true;
    this.gameState.gameStarted = false;

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
    }, 10000);
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
      gameTimeLeft: 60,
      gameTimeTimer: null,
      gameEnded: false,
      winner: null,
      waitingTimer: null,
      waitingTimeLeft: 20
    };

    // Broadcast game reset event
    this.broadcastEvent('game_reset', { gameState: this.gameState });
  }

  movePlayer(playerId, direction) {
    const player = this.gameState.players[playerId];
    if (!player || !player.alive || !this.gameState.gameStarted || this.gameState.gameEnded) {
      console.log('Move rejected:', { 
        playerExists: !!player, 
        alive: player?.alive, 
        gameStarted: this.gameState.gameStarted,
        gameEnded: this.gameState.gameEnded
      });
      return false;
    }

    let newX = player.x;
    let newY = player.y;

    switch (direction) {
      case 'up':
        newY = Math.max(0, player.y - 1);
        break;
      case 'down':
        newY = Math.min(11, player.y + 1); // Changed from 12 to 11
        break;
      case 'left':
        newX = Math.max(0, player.x - 1);
        break;
      case 'right':
        newX = Math.min(11, player.x + 1); // Changed from 14 to 11
        break;
    }

    // Check if new position is valid (not wall or block)
    if (this.gameState.map[newY] && this.gameState.map[newY][newX] === 'empty') {
      player.x = newX;
      player.y = newY;
      console.log(`Player ${playerId} moved to (${newX}, ${newY})`);
      return true;
    }

    console.log(`Move blocked: (${newX}, ${newY}) is ${this.gameState.map[newY]?.[newX]}`);
    return false;
  }

  placeBomb(playerId) {
    const player = this.gameState.players[playerId];
    if (!player || !player.alive || !this.gameState.gameStarted || this.gameState.gameEnded) return false;

    // Check if player can place more bombs
    const playerBombs = this.gameState.bombs.filter(bomb => bomb.playerId === playerId);
    if (playerBombs.length >= player.powerUps.bombs) return false;

    const bomb = {
      id: 'bomb_' + Date.now(),
      playerId,
      x: player.x,
      y: player.y,
      timer: 3.0, // 3 seconds in decimal format for easier processing
      range: player.powerUps.flames
    };

    this.gameState.bombs.push(bomb);
    console.log('Bomb placed:', bomb);

    // ✅ REMOVED: setTimeout approach - now handled by real-time game loop
    // The game loop will automatically process bomb timers and trigger explosions

    return true;
  }

  // ✅ UPDATED: Handle bomb explosion (called from game loop)
  explodeBomb(bomb) {
    console.log('Exploding bomb:', bomb.id, 'at position', bomb.x, bomb.y);

    // Create explosion pattern
    const explosions = [{ x: bomb.x, y: bomb.y }];

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

        if (x < 0 || x >= 12 || y < 0 || y >= 12) break; // Updated bounds
        if (this.gameState.map[y][x] === 'wall') break;

        explosions.push({ x, y });

        // Check for player hits
        Object.values(this.gameState.players).forEach(player => {
          if (player.alive && player.x === x && player.y === y) {
            player.lives--;
            console.log(`Player ${player.nickname} hit by explosion! Lives: ${player.lives}`);

            // Broadcast player damage event
            this.broadcastEvent('player_damaged', {
              playerId: player.id,
              nickname: player.nickname,
              livesRemaining: player.lives,
              position: { x: player.x, y: player.y }
            });

            if (player.lives <= 0) {
              player.alive = false;
              console.log(`Player ${player.nickname} eliminated!`);

              // Broadcast player elimination event
              this.broadcastEvent('player_eliminated', {
                playerId: player.id,
                nickname: player.nickname
              });

              // Check if game should end
              const alivePlayers = Object.values(this.gameState.players).filter(p => p.alive);
              if (alivePlayers.length <= 1) {
                this.endGame('Last player standing!');
              }
            }
          }
        });

        if (this.gameState.map[y][x] === 'block') {
          this.gameState.map[y][x] = 'empty';
          console.log(`Block destroyed at (${x}, ${y})`);
          break;
        }
      }
    });

    // Broadcast explosion event
    if (this.wsManager) {
      this.wsManager.broadcastEvent('bomb_exploded', {
        bombId: bomb.id,
        position: { x: bomb.x, y: bomb.y },
        explosions: explosions,
        range: bomb.range
      });
    }

    console.log('Bomb exploded at:', bomb.x, bomb.y, 'with explosions at:', explosions);
  }
}

const PORT = 9090;
const gameServer = new GameServer();
const wsManager = new WebSocketManager(gameServer);

// Set up bidirectional reference
gameServer.setWebSocketManager(wsManager);

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json'
};

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
