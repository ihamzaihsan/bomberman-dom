// ✅ CONSOLIDATED: Shared movement validation logic (CommonJS version for server)
const { MAP_CONFIG, WALKABLE_CELLS, DIRECTIONS, VALIDATION } = require('./GameConstants.cjs');

class MovementValidator {
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
}

module.exports = { MovementValidator };
