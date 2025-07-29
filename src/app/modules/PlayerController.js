export class PlayerController {
  static BOMB_CAP = 8;

  constructor(framework, webSocketManager) {
    this.framework = framework;
    this.webSocketManager = webSocketManager;
    
    // Movement state
    this.isMoving = false;
    this.lastMoveTime = 0;
    this.baseMoveThrottle = 150; // Base movement delay in ms (slower default)
    this.moveThrottle = this.baseMoveThrottle; // Current throttle (will be modified by speed)
    this.lastInvalidMoveTime = 0;
    this.lastInvalidMove = null;
    
    // Game state reference (will be set by parent)
    this.gameState = null;
    this.playerId = null;

    // ✅ NEW: Bomb placement rate limiting
    this.lastBombPlacementTime = 0;
    
    // Callbacks
    this.onInvalidMove = null;
    this.onSuccessfulMove = null;
    
    this.setupEventHandlers();
  }

  // Set game state reference
  setGameState(gameState, playerId) {
    console.log('PlayerController: setGameState called with:', {
      gameState: !!gameState,
      gameStarted: gameState?.gameStarted,
      playerId: playerId,
      players: gameState?.players ? Object.keys(gameState.players) : 'none'
    });
    this.gameState = gameState;
    this.playerId = playerId;

    // ✅ UPDATED: Ensure player has proper bomb attributes from server
    if (gameState && gameState.players && playerId && gameState.players[playerId]) {
      const player = gameState.players[playerId];
      // Initialize bomb attributes if missing (for backward compatibility)
      if (typeof player.maxBombs !== 'number') player.maxBombs = 1;
      if (typeof player.currentBombs !== 'number') player.currentBombs = 0;
    }

    // ✅ SPEED POWER-UP: Update movement speed when game state changes
    this.updateMovementSpeed();
  }

  // Set callback functions
  setCallbacks(callbacks) {
    this.onInvalidMove = callbacks.onInvalidMove || null;
    this.onSuccessfulMove = callbacks.onSuccessfulMove || null;
  }

  setupEventHandlers() {
    console.log('PlayerController: Setting up event handlers');
    // Handle keyboard input for movement and actions
    document.addEventListener('keydown', (e) => {
      console.log('PlayerController: Keydown event captured:', e.key);
      this.handleGameInput(e);
    });
  }

  handleGameInput(e) {
    console.log('Key pressed:', e.key, 'GameState exists:', !!this.gameState, 'Game started:', this.gameState?.gameStarted, 'Player ID:', this.playerId);
    
    // Don't handle input if a chat input has focus
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.id === 'chat-input' || activeElement.id === 'game-chat-input')) {
      console.log('Input blocked - Chat input has focus');
      return;
    }
    
    // Only handle input when game has started and we have a player
    if (!this.gameState?.gameStarted || !this.playerId) {
      console.log('Input blocked - Game not started or no player ID');
      return;
    }

    let direction = null;
    let action = null;

    // Movement keys
    switch(e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        direction = 'up';
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        direction = 'down';
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        direction = 'left';
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        direction = 'right';
        break;
      case ' ':
      case 'Enter':
        action = 'placeBomb';
        break;
    }

    // Only prevent default for actual game keys
    if (direction || action) {
      e.preventDefault();
      
      if (direction) {
        this.movePlayer(direction);
      } else if (action === 'placeBomb') {
        this.placeBomb();
      }
    }
  }

  movePlayer(direction) {
    // Throttle movement to prevent spamming
    const currentTime = Date.now();
    if (this.isMoving || (currentTime - this.lastMoveTime) < this.moveThrottle) {
      console.log('Movement throttled');
      return;
    }

    // Validate move on client side first
    const validationResult = this.validateClientMoveWithRenderCheck(direction);
    if (!validationResult.isValid) {
      console.log('Invalid move:', validationResult.reason);
      
      // Track invalid move for rendering optimization
      this.lastInvalidMoveTime = currentTime;
      this.lastInvalidMove = direction;
      
      if (this.onInvalidMove) {
        this.onInvalidMove(direction, validationResult.reason);
      }
      return;
    }

    // Set moving state and send move to server
    this.isMoving = true;
    this.lastMoveTime = currentTime;

    console.log(`Moving player ${direction}`);
    // FIX: Use 'move' as message type for server compatibility
    this.webSocketManager.sendWebSocketMessage({
      type: 'move',
      direction: direction
    });

    // Reset moving state after a delay
    setTimeout(() => {
      this.isMoving = false;
      console.log('isMoving reset to false');
    }, this.moveThrottle);

    if (this.onSuccessfulMove) {
      this.onSuccessfulMove(direction);
    }
  }

  placeBomb() {
    if (!this.gameState?.gameStarted || !this.playerId) return;
    const player = this.gameState.players[this.playerId];
    if (!player) return;

    // ✅ NEW: Rate limiting to prevent rapid bomb placement attempts
    const now = Date.now();
    if (now - this.lastBombPlacementTime < 100) { // 100ms cooldown
      console.log('🚫 Bomb placement rate limited');
      return;
    }

    if (typeof player.maxBombs !== 'number') player.maxBombs = 1;
    if (typeof player.currentBombs !== 'number') player.currentBombs = 0;

    console.log(`🎯 CLIENT BOMB ATTEMPT: ${player.nickname} - currentBombs=${player.currentBombs}, maxBombs=${player.maxBombs}`);

    // ✅ CRITICAL FIX: Use exact same logic as server
    if (player.currentBombs >= player.maxBombs) {
      console.log(`🚫 CLIENT VALIDATION FAILED: ${player.currentBombs} >= ${player.maxBombs}`);
      return;
    }

    // Check if there's already a bomb at player's position
    const existingBomb = this.gameState.bombs?.find(bomb => bomb.x === player.x && bomb.y === player.y);
    if (existingBomb) {
      console.log('🚫 CLIENT VALIDATION FAILED: Bomb already exists at position');
      return;
    }

    console.log('✅ CLIENT VALIDATION PASSED: Sending bomb placement request');
    this.lastBombPlacementTime = now;

    // ✅ REMOVED: Don't optimistically increment currentBombs on client
    // This causes synchronization issues - let server handle the increment
    // and send back the updated game state

    // Send bomb placement to server
    this.webSocketManager.sendWebSocketMessage({
      type: 'bomb',
      x: player.x,
      y: player.y
    });

    // ✅ NOTE: UI will be updated when server sends back the updated game state
    // The server will increment currentBombs and broadcast the new state
  }

  // ✅ REMOVED: These methods are no longer needed as server manages bomb state
  // The server now handles:
  // - Bomb explosion decrementing currentBombs
  // - Power-up collection incrementing maxBombs
  // - Player damage resetting both maxBombs and currentBombs
  // Client just receives updated game state from server

  // ===== MOVEMENT VALIDATION =====

  validateClientMoveWithRenderCheck(direction) {
    if (!this.gameState || !this.gameState.players || !this.playerId) {
      return { isValid: false, reason: 'No game state or player' };
    }

    const player = this.gameState.players[this.playerId];
    if (!player) {
      return { isValid: false, reason: 'Player not found' };
    }

    const currentX = player.x;
    const currentY = player.y;

    // Calculate new position
    let newX = currentX;
    let newY = currentY;

    switch(direction) {
      case 'up':
        newY = currentY - 1;
        break;
      case 'down':
        newY = currentY + 1;
        break;
      case 'left':
        newX = currentX - 1;
        break;
      case 'right':
        newX = currentX + 1;
        break;
      default:
        return { isValid: false, reason: 'Invalid direction' };
    }

    // Check map boundaries
    if (newX < 0 || newX >= this.gameState.map[0].length || 
        newY < 0 || newY >= this.gameState.map.length) {
      this.framework.incrementCounter('invalid-moves-boundary');
      return { isValid: false, reason: 'Move would go out of bounds' };
    }

    // Check for walls
    const targetCell = this.gameState.map[newY][newX];
    if (targetCell === 'wall' || targetCell === 'block') {
      this.framework.incrementCounter('invalid-moves-wall');
      return { isValid: false, reason: 'Target cell is blocked' };
    }

    // Check for other players
    const playerAtTarget = Object.values(this.gameState.players).find(p => 
      p.x === newX && p.y === newY && p.id !== this.playerId
    );
    if (playerAtTarget) {
      this.framework.incrementCounter('invalid-moves-player');
      return { isValid: false, reason: 'Another player is at target position' };
    }

    // Check for bombs
    const bombAtTarget = this.gameState.bombs?.find(bomb => 
      bomb.x === newX && bomb.y === newY
    );
    if (bombAtTarget) {
      this.framework.incrementCounter('invalid-moves-bomb');
      return { isValid: false, reason: 'Bomb is at target position' };
    }

    this.framework.incrementCounter('valid-moves');
    return { isValid: true, reason: 'Move is valid' };
  }

  validateClientMove(direction) {
    if (!this.gameState || !this.gameState.players || !this.playerId) {
      return false;
    }

    const player = this.gameState.players[this.playerId];
    if (!player) {
      return false;
    }

    const currentX = player.x;
    const currentY = player.y;

    // Calculate new position
    let newX = currentX;
    let newY = currentY;

    switch(direction) {
      case 'up':
        newY = currentY - 1;
        break;
      case 'down':
        newY = currentY + 1;
        break;
      case 'left':
        newX = currentX - 1;
        break;
      case 'right':
        newX = currentX + 1;
        break;
      default:
        return false;
    }

    // Check map boundaries
    if (newX < 0 || newX >= this.gameState.map[0].length || 
        newY < 0 || newY >= this.gameState.map.length) {
      return false;
    }

    // Check for walls and blocks
    const targetCell = this.gameState.map[newY][newX];
    if (targetCell === 'wall' || targetCell === 'block') {
      return false;
    }

    // Check for other players
    const playerAtTarget = Object.values(this.gameState.players).find(p => 
      p.x === newX && p.y === newY && p.id !== this.playerId
    );
    if (playerAtTarget) {
      return false;
    }

    // Check for bombs
    const bombAtTarget = this.gameState.bombs?.find(bomb => 
      bomb.x === newX && bomb.y === newY
    );
    if (bombAtTarget) {
      return false;
    }

    return true;
  }

  // ===== MOVEMENT ANALYTICS =====

  getMovementStats() {
    return {
      validMoves: this.framework.getCounter('valid-moves') || 0,
      invalidMovesBoundary: this.framework.getCounter('invalid-moves-boundary') || 0,
      invalidMovesWall: this.framework.getCounter('invalid-moves-wall') || 0,
      invalidMovesPlayer: this.framework.getCounter('invalid-moves-player') || 0,
      invalidMovesBomb: this.framework.getCounter('invalid-moves-bomb') || 0,
      lastMoveTime: this.lastMoveTime,
      isMoving: this.isMoving,
      moveThrottle: this.moveThrottle
    };
  }

  resetMovementStats() {
    this.framework.resetCounter('valid-moves');
    this.framework.resetCounter('invalid-moves-boundary');
    this.framework.resetCounter('invalid-moves-wall');
    this.framework.resetCounter('invalid-moves-player');
    this.framework.resetCounter('invalid-moves-bomb');
  }

  // ===== SPEED POWER-UP IMPLEMENTATION =====

  // ✅ SPEED POWER-UP: Calculate movement throttle based on speed level
  updateMovementSpeed() {
    if (!this.gameState || !this.gameState.players || !this.playerId) {
      this.moveThrottle = this.baseMoveThrottle;
      return;
    }

    const player = this.gameState.players[this.playerId];
    if (!player || !player.powerUps) {
      this.moveThrottle = this.baseMoveThrottle;
      return;
    }

    const speedLevel = player.powerUps.speed || 1;
    
    // Speed level 1: 150ms (slow), level 2: 100ms (medium), level 3: 50ms (fast)
    const speedMultipliers = {
      1: 1.0,    // 150ms - base speed
      2: 0.67,   // 100ms - 33% faster
      3: 0.33    // 50ms - 67% faster
    };

    const multiplier = speedMultipliers[speedLevel] || 1.0;
    this.moveThrottle = Math.round(this.baseMoveThrottle * multiplier);
    
    console.log(`PlayerController: Speed level ${speedLevel}, movement throttle: ${this.moveThrottle}ms`);
  }

  // ===== GETTERS FOR OPTIMIZATION =====

  getLastInvalidMoveTime() {
    return this.lastInvalidMoveTime;
  }

  getLastInvalidMove() {
    return this.lastInvalidMove;
  }
}
