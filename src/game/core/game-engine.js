/**
 * Single-Player Game Engine for Bomberman DOM
 * Handles game board, player movement, and basic game logic
 */

import { GameConfig } from './config.js';

export class GameEngine {
  constructor() {
    this.board = [];
    this.player = null;
    this.gameStarted = false;
    this.gameTime = 0;
    this.startTime = null;
    
    this.initializeBoard();
  }

  /**
   * Initialize the game board with walls and blocks
   */
  initializeBoard() {
    this.board = [];
    
    // Create the board grid
    for (let y = 0; y < GameConfig.BOARD_HEIGHT; y++) {
      this.board[y] = [];
      for (let x = 0; x < GameConfig.BOARD_WIDTH; x++) {
        // Create walls on borders and in a grid pattern
        if (x === 0 || x === GameConfig.BOARD_WIDTH - 1 || 
            y === 0 || y === GameConfig.BOARD_HEIGHT - 1 || 
            (x % 2 === 0 && y % 2 === 0)) {
          this.board[y][x] = { type: 'wall' };
        } else {
          this.board[y][x] = { type: 'empty' };
        }
      }
    }
    
    // Add some destructible blocks
    this.generateBlocks();
  }

  /**
   * Generate destructible blocks on the board
   */
  generateBlocks() {
    const blockDensity = 0.6; // 60% of empty spaces get blocks
    const safeZoneRadius = 2;
    const spawnPos = GameConfig.PLAYER_SPAWN_POSITION;
    
    for (let y = 1; y < GameConfig.BOARD_HEIGHT - 1; y++) {
      for (let x = 1; x < GameConfig.BOARD_WIDTH - 1; x++) {
        if (this.board[y][x].type === 'empty') {
          // Don't place blocks in safe zone around spawn point
          const distance = Math.abs(x - spawnPos.x) + Math.abs(y - spawnPos.y);
          const isSafeZone = distance <= safeZoneRadius;
          
          if (!isSafeZone && Math.random() < blockDensity) {
            this.board[y][x] = { type: 'block' };
          }
        }
      }
    }
  }

  /**
   * Spawn the player on the board
   */
  spawnPlayer(nickname) {
    const spawnPos = GameConfig.PLAYER_SPAWN_POSITION;
    
    this.player = {
      nickname: nickname || 'Player',
      x: spawnPos.x,
      y: spawnPos.y,
      lives: GameConfig.PLAYER_LIVES,
      bombCapacity: 1,
      bombRange: 1,
      speedMultiplier: 1,
      status: 'alive',
      score: 0
    };
    
    this.gameStarted = true;
    this.startTime = Date.now();
  }

  /**
   * Move the player in the specified direction
   */
  movePlayer(direction) {
    if (!this.player || this.player.status !== 'alive') {
      return false;
    }
    
    const { x, y } = this.player;
    let newX = x;
    let newY = y;
    
    switch (direction) {
      case 'up':
        newY = Math.max(0, y - 1);
        break;
      case 'down':
        newY = Math.min(GameConfig.BOARD_HEIGHT - 1, y + 1);
        break;
      case 'left':
        newX = Math.max(0, x - 1);
        break;
      case 'right':
        newX = Math.min(GameConfig.BOARD_WIDTH - 1, x + 1);
        break;
      default:
        return false;
    }
    
    // Check if the new position is valid
    if (this.isValidPosition(newX, newY)) {
      this.player.x = newX;
      this.player.y = newY;
      return true;
    }
    
    return false;
  }

  /**
   * Check if a position is valid for movement
   */
  isValidPosition(x, y) {
    if (x < 0 || x >= GameConfig.BOARD_WIDTH || y < 0 || y >= GameConfig.BOARD_HEIGHT) {
      return false;
    }
    
    const cell = this.board[y][x];
    return cell.type === 'empty';
  }

  /**
   * Place a bomb at the player's current position
   */
  placeBomb() {
    if (!this.player || this.player.status !== 'alive') {
      return false;
    }
    
    // For now, just log the bomb placement
    // TODO: Implement actual bomb logic
    console.log(`Bomb placed at (${this.player.x}, ${this.player.y})`);
    return true;
  }

  /**
   * Get the current game state
   */
  getGameState() {
    return {
      board: this.board,
      player: this.player,
      gameStarted: this.gameStarted,
      gameTime: this.getGameTime(),
      timeRemaining: this.getTimeRemaining()
    };
  }

  /**
   * Get elapsed game time
   */
  getGameTime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Get remaining game time
   */
  getTimeRemaining() {
    if (!this.startTime) return GameConfig.GAME_DURATION;
    const elapsed = this.getGameTime();
    return Math.max(0, GameConfig.GAME_DURATION - elapsed);
  }

  /**
   * Check if the game is over
   */
  isGameOver() {
    if (!this.player) return true;
    if (this.player.status !== 'alive') return true;
    if (this.getTimeRemaining() <= 0) return true;
    return false;
  }

  /**
   * Reset the game
   */
  reset() {
    this.board = [];
    this.player = null;
    this.gameStarted = false;
    this.gameTime = 0;
    this.startTime = null;
    this.initializeBoard();
  }

  /**
   * Get board cell at position
   */
  getCellAt(x, y) {
    if (x < 0 || x >= GameConfig.BOARD_WIDTH || y < 0 || y >= GameConfig.BOARD_HEIGHT) {
      return null;
    }
    return this.board[y][x];
  }

  /**
   * Set board cell at position
   */
  setCellAt(x, y, cellData) {
    if (x < 0 || x >= GameConfig.BOARD_WIDTH || y < 0 || y >= GameConfig.BOARD_HEIGHT) {
      return false;
    }
    this.board[y][x] = cellData;
    return true;
  }
}
