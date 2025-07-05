const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

class GameServer {
  constructor() {
    this.players = new Map();
    this.gameState = {
      map: this.generateMap(),
      players: {},
      bombs: [],
      powerUps: [],
      gameStarted: false,
      gameTimer: null,
      countdown: 0
    };
    console.log('GameServer initialized');
  }

  generateMap() {
    console.log('Generating map...');
    // 15x13 grid - standard Bomberman size
    const width = 15;
    const height = 13;
    const map = [];

    for (let y = 0; y < height; y++) {
      map[y] = [];
      for (let x = 0; x < width; x++) {
        // Walls on odd positions (classic Bomberman pattern)
        if (x % 2 === 1 && y % 2 === 1) {
          map[y][x] = 'wall';
        }
        // Keep starting corners clear
        else if (this.isStartingPosition(x, y, width, height)) {
          map[y][x] = 'empty';
        }
        // Random destructible blocks
        else if (Math.random() < 0.7) {
          map[y][x] = 'block';
        } else {
          map[y][x] = 'empty';
        }
      }
    }

    console.log('Map generated successfully');
    return map;
  }

  isStartingPosition(x, y, width, height) {
    // Top-left corner (player 1) - 2x2 area
    if ((x <= 1 && y <= 1)) return true;
    // Top-right corner (player 2) - 2x2 area
    if ((x >= width - 2 && y <= 1)) return true;
    // Bottom-left corner (player 3) - 2x2 area
    if ((x <= 1 && y >= height - 2)) return true;
    // Bottom-right corner (player 4) - 2x2 area
    if ((x >= width - 2 && y >= height - 2)) return true;
    
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

    const startingPositions = [
      { x: 1, y: 1 },
      { x: 13, y: 1 },
      { x: 1, y: 11 },
      { x: 13, y: 11 }
    ];

    const player = {
      id: playerId,
      nickname,
      x: startingPositions[playerCount].x,
      y: startingPositions[playerCount].y,
      lives: 3,
      powerUps: {
        bombs: 1,
        flames: 1,
        speed: 1
      },
      alive: true
    };

    this.gameState.players[playerId] = player;
    console.log(`Player added successfully:`, player);

    // Start countdown if we have at least 2 players
    if (playerCount + 1 >= 2 && !this.gameTimer) {
      console.log('Starting game timer...');
      this.startGameTimer();
    }

    return { success: true, player };
  }

  startGameTimer() {
    this.gameState.countdown = 10;
    this.gameTimer = setInterval(() => {
      this.gameState.countdown--;
      console.log(`Game starting in: ${this.gameState.countdown}`);
      if (this.gameState.countdown <= 0) {
        this.gameState.gameStarted = true;
        clearInterval(this.gameTimer);
        console.log('Game started!');
      }
    }, 1000);
  }

  movePlayer(playerId, direction) {
    const player = this.gameState.players[playerId];
    if (!player || !player.alive || !this.gameState.gameStarted) return false;

    let newX = player.x;
    let newY = player.y;

    switch (direction) {
      case 'up':
        newY = Math.max(0, player.y - 1);
        break;
      case 'down':
        newY = Math.min(12, player.y + 1);
        break;
      case 'left':
        newX = Math.max(0, player.x - 1);
        break;
      case 'right':
        newX = Math.min(14, player.x + 1);
        break;
    }

    // Check if new position is valid (not wall or block)
    if (this.gameState.map[newY][newX] === 'empty') {
      player.x = newX;
      player.y = newY;
      return true;
    }

    return false;
  }

  placeBomb(playerId) {
    const player = this.gameState.players[playerId];
    if (!player || !player.alive || !this.gameState.gameStarted) return false;

    // Check if player can place more bombs
    const playerBombs = this.gameState.bombs.filter(bomb => bomb.playerId === playerId);
    if (playerBombs.length >= player.powerUps.bombs) return false;

    const bomb = {
      id: 'bomb_' + Date.now(),
      playerId,
      x: player.x,
      y: player.y,
      timer: 3000, // 3 seconds
      range: player.powerUps.flames
    };

    this.gameState.bombs.push(bomb);
    console.log('Bomb placed:', bomb);

    // Set bomb explosion timer
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

    // Simple explosion logic for now
    console.log('Bomb exploded at:', bomb.x, bomb.y);
  }

  spawnPowerUp(x, y) {
    const powerUpTypes = ['bombs', 'flames', 'speed'];
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    
    this.gameState.powerUps.push({
      id: 'powerup_' + Date.now(),
      type,
      x,
      y
    });
  }

  broadcastGameState() {
    // This will be implemented when we add WebSocket support
    console.log('Game state updated');
  }
}

module.exports = GameServer;