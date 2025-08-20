import { DIRECTIONS, VALIDATION } from "../../shared/GameConstants.js";
import { MovementValidator } from "../../shared/MovementValidator.js";

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
    
    // Game state is sourced from framework; no local copies are kept

    this.lastBombPlacementTime = 0;
    
    // Callbacks
    this.onInvalidMove = null;
    this.onSuccessfulMove = null;
    
    this.setupEventHandlers();
  }


  // Set callback functions
  setCallbacks(callbacks) {
    this.onInvalidMove = callbacks.onInvalidMove || null;
    this.onSuccessfulMove = callbacks.onSuccessfulMove || null;
  }

  setupEventHandlers() {
    console.log('PlayerController: Setting up event handlers');
    // Handle keyboard input for movement and actions
    this.framework.eventManager.keydown('body', (e) => {
      console.log('PlayerController: Keydown event captured:', e.key);
      this.handleGameInput(e);
    });
  }

  handleGameInput(e) {
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    console.log('Key pressed:', e.key, 'GameState exists:', !!gs, 'Game started:', gs?.gameStarted, 'Player ID:', pid);

    // Don't handle input if a chat input has focus
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.id === 'chat-input' || activeElement.id === 'game-chat-input')) {
      console.log('Input blocked - Chat input has focus');
      return;
    }

    // Only handle input when game has started and we have a player
    if (!gs?.gameStarted || !pid) {
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
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    if (gs && gs.players && pid) {
      const currentPlayer = gs.players[pid];
      if (currentPlayer && !currentPlayer.alive) {
        console.log('Movement blocked: Player is eliminated (ghost mode)');
        return;
      }
    }

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
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    if (!gs?.gameStarted || !pid) return;
    const player = gs.players[pid];
    if (!player) return;

    if (!player.alive) {
      console.log('🚫 Cannot place bomb: Player is eliminated (ghost mode)');
      return;
    }

    const now = Date.now();
    if (now - this.lastBombPlacementTime < 100) { // 100ms cooldown
      console.log('🚫 Bomb placement rate limited');
      return;
    }

    if (typeof player.maxBombs !== 'number') player.maxBombs = 1;
    if (typeof player.currentBombs !== 'number') player.currentBombs = 0;

    console.log(`🎯 CLIENT BOMB ATTEMPT: ${player.nickname} - currentBombs=${player.currentBombs}, maxBombs=${player.maxBombs}`);

    if (player.currentBombs >= player.maxBombs) {
      console.log(`🚫 CLIENT VALIDATION FAILED: ${player.currentBombs} >= ${player.maxBombs}`);
      return;
    }

    // Check if there's already a bomb at player's position
    const existingBomb = gs.bombs?.find(bomb => bomb.x === player.x && bomb.y === player.y);
    if (existingBomb) {
      console.log('🚫 CLIENT VALIDATION FAILED: Bomb already exists at position');
      return;
    }

    console.log('✅ CLIENT VALIDATION PASSED: Sending bomb placement request');
    this.lastBombPlacementTime = now;


    // Send bomb placement to server
    this.webSocketManager.sendWebSocketMessage({
      type: 'bomb',
      x: player.x,
      y: player.y
    });

  }



  validateClientMoveWithRenderCheck(direction) {
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    if (!gs || !gs.players || !pid) {
      return { isValid: false, reason: 'No game state or player' };
    }

    const player = gs.players[pid];
    if (!player) {
      return { isValid: false, reason: 'Player not found' };
    }

    const result = MovementValidator.validateMove(player, direction, gs);

    // Update framework counters based on result
    if (result.isValid) {
      this.framework.incrementCounter('valid-moves');
    } else {
      // Categorize the type of invalid move for better tracking
      if (result.reason.includes('bounds')) {
        this.framework.incrementCounter('invalid-moves-boundary');
      } else if (result.reason.includes('blocked')) {
        this.framework.incrementCounter('invalid-moves-wall');
      } else if (result.reason.includes('player')) {
        this.framework.incrementCounter('invalid-moves-player');
      } else if (result.reason.includes('bomb')) {
        this.framework.incrementCounter('invalid-moves-bomb');
      }
    }

    return result;
  }

  validateClientMove(direction) {
    const result = this.validateClientMoveWithRenderCheck(direction);
    return result.isValid;
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

  // Calculate movement throttle based on speed power-up level
  updateMovementSpeed() {
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    if (!gs || !gs.players || !pid) {
      this.moveThrottle = this.baseMoveThrottle;
      return;
    }

    const player = gs.players[pid];
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
