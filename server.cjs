const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple GameServer class for now
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
      winner: null
    };
    console.log('GameServer initialized with 12x12 map');
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

  addPlayer(playerId, nickname) {
    console.log(`Adding player: ${playerId}, nickname: ${nickname}`);
    
    const playerCount = Object.keys(this.gameState.players).length;
    console.log(`Current player count: ${playerCount}`);
    
    if (playerCount >= 4) {
      return { success: false, error: 'Game is full (4 players maximum)' };
    }

    if (this.gameState.gameStarted) {
      return { success: false, error: 'Game has already started' };
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

    // Start countdown immediately when first player joins (for single player mode)
    if (playerCount + 1 >= 1 && !this.gameTimer) {
      console.log('Starting game timer for single player...');
      this.startGameTimer();
    }

    return { success: true, player };
  }

  startGameTimer() {
    this.gameState.countdown = 3; // Shorter countdown for single player
    this.gameTimer = setInterval(() => {
      this.gameState.countdown--;
      console.log(`Game starting in: ${this.gameState.countdown}`);
      if (this.gameState.countdown <= 0) {
        this.gameState.gameStarted = true;
        clearInterval(this.gameTimer);
        console.log('Game started!');
        
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
      
      if (this.gameState.gameTimeLeft <= 0) {
        this.endGame('Time\'s up!');
      }
    }, 1000);
  }

  endGame(reason) {
    console.log(`Game ended: ${reason}`);
    this.gameState.gameEnded = true;
    this.gameState.gameStarted = false;
    
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

    // Reset game after 10 seconds
    setTimeout(() => {
      this.resetGame();
    }, 10000);
  }

  resetGame() {
    console.log('Resetting game...');
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
      winner: null
    };
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
      timer: 3000,
      range: player.powerUps.flames
    };

    this.gameState.bombs.push(bomb);
    console.log('Bomb placed:', bomb);

    setTimeout(() => {
      this.explodeBomb(bomb.id);
    }, bomb.timer);

    return true;
  }

  explodeBomb(bombId) {
    console.log('Exploding bomb:', bombId);
    const bombIndex = this.gameState.bombs.findIndex(bomb => bomb.id === bombId);
    if (bombIndex === -1) return;

    const bomb = this.gameState.bombs[bombIndex];
    this.gameState.bombs.splice(bombIndex, 1);

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
            
            if (player.lives <= 0) {
              player.alive = false;
              console.log(`Player ${player.nickname} eliminated!`);
              
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

    console.log('Bomb exploded at:', bomb.x, bomb.y, 'with explosions at:', explosions);
  }
}

const PORT = 9090;
const gameServer = new GameServer();

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
        
        const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
});
