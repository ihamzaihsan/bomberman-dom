export class PlayerController {
  constructor(framework, webSocketManager) {
    this.framework = framework;
    this.webSocketManager = webSocketManager;
    
    // Movement state
    this.isMoving = false;
    this.lastMoveTime = 0;
    this.moveThrottle = 10; // Reduced throttle for debugging
    this.lastInvalidMoveTime = 0;
    this.lastInvalidMove = null;
    
    // Game state reference (will be set by parent)
    this.gameState = null;
    this.playerId = null;
    
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
    if (!this.gameState?.gameStarted || !this.playerId) {
      return;
    }

    const player = this.gameState.players[this.playerId];
    if (!player) {
      return;
    }

    // Check if player has bombs available
    if (player.bombCount <= 0) {
      console.log('No bombs available');
      return;
    }

    // Check if there's already a bomb at player's position
    const existingBomb = this.gameState.bombs?.find(bomb => 
      bomb.x === player.x && bomb.y === player.y
    );

    if (existingBomb) {
      console.log('Bomb already exists at this position');
      return;
    }

    console.log('Placing bomb');
    // FIX: Use 'bomb' as message type for server compatibility
    this.webSocketManager.sendWebSocketMessage({
      type: 'bomb'
    });
  }

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

  // ===== GETTERS FOR OPTIMIZATION =====

  getLastInvalidMoveTime() {
    return this.lastInvalidMoveTime;
  }

  getLastInvalidMove() {
    return this.lastInvalidMove;
  }
}
