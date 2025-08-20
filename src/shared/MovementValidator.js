// Shared movement validation for client and server
import { MAP_CONFIG, WALKABLE_CELLS, DIRECTIONS, VALIDATION } from './GameConstants.js';

export class MovementValidator {
  /**
   * Validates if a player can move in the specified direction
   * @param {Object} player - Player object with x, y, id properties
   * @param {string} direction - Direction to move ('up', 'down', 'left', 'right')
   * @param {Object} gameState - Current game state with map, players, bombs
   * @returns {Object} - { isValid: boolean, reason: string, newX: number, newY: number }
   */
  static validateMove(player, direction, gameState) {
    // Basic validation checks
    if (!player || !player.alive || !gameState.gameStarted || gameState.gameEnded) {
      return {
        isValid: false,
        reason: 'Game not active or player not alive',
        newX: player?.x || 0,
        newY: player?.y || 0
      };
    }

    // Calculate new position
    const { newX, newY } = this.calculateNewPosition(player.x, player.y, direction);

    // Check if position actually changed (hitting boundary)
    if (newX === player.x && newY === player.y) {
      return {
        isValid: false,
        reason: 'Move would go out of bounds',
        newX,
        newY
      };
    }

    // Validate position is within map bounds
    if (!VALIDATION.isValidPosition(newX, newY)) {
      return {
        isValid: false,
        reason: 'Move would go out of bounds',
        newX,
        newY
      };
    }

    // Check if new position is walkable
    const targetCell = gameState.map[newY]?.[newX];
    if (!VALIDATION.isWalkableCell(targetCell)) {
      return {
        isValid: false,
        reason: `Target cell is blocked (${targetCell})`,
        newX,
        newY
      };
    }

    // Check for bomb collision
    const bombAtPosition = gameState.bombs?.find(bomb => bomb.x === newX && bomb.y === newY);
    if (bombAtPosition) {
      return {
        isValid: false,
        reason: 'Bomb is at target position',
        newX,
        newY
      };
    }

    // Check for other ALIVE players at the same position (ignore eliminated/ghost players)
    const playerAtPosition = Object.values(gameState.players || {}).find(
      p => p.id !== player.id && p.alive && p.x === newX && p.y === newY
    );
    if (playerAtPosition) {
      return {
        isValid: false,
        reason: 'Another alive player is at target position',
        newX,
        newY
      };
    }

    return {
      isValid: true,
      reason: 'Move is valid',
      newX,
      newY
    };
  }

  /**
   * Calculate new position based on current position and direction
   * @param {number} x - Current X position
   * @param {number} y - Current Y position
   * @param {string} direction - Direction to move
   * @returns {Object} - { newX: number, newY: number }
   */
  static calculateNewPosition(x, y, direction) {
    let newX = x;
    let newY = y;

    switch (direction) {
      case DIRECTIONS.UP:
        newY = Math.max(0, y - 1);
        break;
      case DIRECTIONS.DOWN:
        newY = Math.min(MAP_CONFIG.HEIGHT - 1, y + 1);
        break;
      case DIRECTIONS.LEFT:
        newX = Math.max(0, x - 1);
        break;
      case DIRECTIONS.RIGHT:
        newX = Math.min(MAP_CONFIG.WIDTH - 1, x + 1);
        break;
      default:
        // Invalid direction, return current position
        break;
    }

    return { newX, newY };
  }

  /**
   * Pre-validate player movement without actually moving (performance optimization)
   * @param {string} playerId - Player ID
   * @param {string} direction - Direction to move
   * @param {Object} gameState - Current game state
   * @returns {boolean} - true if move is valid, false otherwise
   */
  static preValidateMove(playerId, direction, gameState) {
    const player = gameState.players?.[playerId];
    if (!player) return false;

    const result = this.validateMove(player, direction, gameState);
    return result.isValid;
  }

  /**
   * Get all valid moves for a player
   * @param {Object} player - Player object
   * @param {Object} gameState - Current game state
   * @returns {Array} - Array of valid directions
   */
  static getValidMoves(player, gameState) {
    const validMoves = [];
    const directions = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT];

    directions.forEach(direction => {
      const result = this.validateMove(player, direction, gameState);
      if (result.isValid) {
        validMoves.push(direction);
      }
    });

    return validMoves;
  }

  /**
   * Check if a position is safe (not in explosion range)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Array} bombs - Array of active bombs
   * @param {Object} gameState - Current game state
   * @returns {boolean} - true if position is safe
   */
  static isPositionSafe(x, y, bombs, gameState) {
    // Check if position is in any bomb's explosion range
    for (const bomb of bombs) {
      const range = bomb.range || 1;
      
      // Check horizontal explosion range
      if (bomb.y === y && Math.abs(bomb.x - x) <= range) {
        // Check if there are walls blocking the explosion
        const minX = Math.min(bomb.x, x);
        const maxX = Math.max(bomb.x, x);
        let blocked = false;
        
        for (let checkX = minX + 1; checkX < maxX; checkX++) {
          const cell = gameState.map[y]?.[checkX];
          if (cell === 'wall' || cell === 'block') {
            blocked = true;
            break;
          }
        }
        
        if (!blocked) return false;
      }
      
      // Check vertical explosion range
      if (bomb.x === x && Math.abs(bomb.y - y) <= range) {
        // Check if there are walls blocking the explosion
        const minY = Math.min(bomb.y, y);
        const maxY = Math.max(bomb.y, y);
        let blocked = false;
        
        for (let checkY = minY + 1; checkY < maxY; checkY++) {
          const cell = gameState.map[checkY]?.[x];
          if (cell === 'wall' || cell === 'block') {
            blocked = true;
            break;
          }
        }
        
        if (!blocked) return false;
      }
    }
    
    return true;
  }
}
