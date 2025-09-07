import { PLAYER_CONFIG } from '../../shared/GameConstants.js';
import { MovementValidator } from '../../shared/MovementValidator.js';

export class PlayerController {
  constructor(framework, webSocketManager) {
    this.framework = framework;
    this.webSocketManager = webSocketManager;

    this.isMoving = false;
    this.lastMoveTime = 0;
    this.baseMoveThrottle = PLAYER_CONFIG.MOVE_INTERVALS[1];
    this.moveThrottle = this.baseMoveThrottle;

    this.lastBombPlacementTime = 0;

    this.onInvalidMove = null;
    this.onSuccessfulMove = null;

    this.setupEventHandlers();
  }

  setCallbacks(callbacks) {
    this.onInvalidMove = callbacks.onInvalidMove || null;
    this.onSuccessfulMove = callbacks.onSuccessfulMove || null;
  }

  setupEventHandlers() {
    if (this.inputHandler) return;

    this.inputHandler = (e) => {
      this.handleGameInput(e);
    };
    this.framework.eventManager.keydown('body', this.inputHandler);
  }

  handleGameInput(e) {
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');

    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.id === 'chat-input' || activeElement.id === 'game-chat-input')
    ) {
      return;
    }

    if (!gs?.gameStarted || !pid) {
      return;
    }

    let direction = null;
    let action = null;

    // Movement keys
    switch (e.key) {
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
        return;
      }
    }

    const currentTime = Date.now();
    if (this.isMoving || currentTime - this.lastMoveTime < this.moveThrottle) {
      return;
    }

    const validationResult = this.validateClientMoveWithRenderCheck(direction);
    if (!validationResult.isValid) {
      if (this.onInvalidMove) {
        this.onInvalidMove(direction, validationResult.reason);
      }
      return;
    }

    this.isMoving = true;
    this.lastMoveTime = currentTime;

    this.webSocketManager.sendWebSocketMessage({
      type: 'move',
      direction: direction,
    });

    setTimeout(() => {
      this.isMoving = false;
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
      return;
    }

    const now = Date.now();
    if (now - this.lastBombPlacementTime < 100) {
      return;
    }

    if (typeof player.maxBombs !== 'number') player.maxBombs = 1;
    if (typeof player.currentBombs !== 'number') player.currentBombs = 0;

    if (player.currentBombs >= player.maxBombs) {
      return;
    }

    const existingBomb = gs.bombs?.find((bomb) => bomb.x === player.x && bomb.y === player.y);
    if (existingBomb) {
      return;
    }

    this.lastBombPlacementTime = now;

    this.webSocketManager.sendWebSocketMessage({
      type: 'bomb',
      x: player.x,
      y: player.y,
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

    if (result.isValid) {
      this.framework.incrementCounter('valid-moves');
    } else {
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

    this.moveThrottle = PLAYER_CONFIG.MOVE_INTERVALS[speedLevel] || this.baseMoveThrottle;
  }
}
