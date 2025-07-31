// AppEventHandlers: Handles app-level events (join, start, end, reset, etc.)
export class AppEventHandlers {
  constructor(app) {
    this.app = app;
  }

  handleJoinSuccess(data) {
    // ✅ CONSOLIDATED: Merged logic from appEvents.js
    this.app.playerId = data.playerId;
    this.app.gameState = data.gameState;
    this.app.gameUIManager.setGameState(this.app.gameState, this.app.playerId);
    this.app.playerController.setGameState(this.app.gameState, this.app.playerId);
    this.app.resetJoinButton();
    this.app.gameUIManager.showWaitingScreen();
    setTimeout(() => {
      this.app.setupChatHandlers();
      this.app.updateWaitingScreen();
      this.app.updateChatDisplay();
    }, 100);
    this.app.startOptimizedGameLoop();
    this.app.showNotification(`Welcome, ${this.app.nickname}!`);
  }

  handleGameStarted(eventData) {
    // ✅ CONSOLIDATED: Merged logic from playerEvents.js
    if (eventData.gameState) {
      this.app.gameState = eventData.gameState;
      if (!this.app.playerId || !this.app.gameState.players[this.app.playerId]) {
        const playerByNickname = Object.values(this.app.gameState.players).find(
          (p) => p.nickname === this.app.nickname
        );
        if (playerByNickname) {
          this.app.playerId = playerByNickname.id;
          this.app.gameUIManager.setGameState(this.app.gameState, this.app.playerId);
          this.app.playerController.setGameState(this.app.gameState, this.app.playerId);
          this.app.gameUIManager.showGameScreen();
          this.app.setupGameControls();
          setTimeout(() => {
            this.app.setupGameChatHandlers();
            this.app.updateChatDisplay();
            this.app.gameUIManager.updateTimer();
            this.app.applyAnimationSettings();
          }, 100);
        } else {
          this.app.showError("Failed to join game - please try again");
          this.app.returnToLobby();
        }
      } else {
        this.app.gameUIManager.setGameState(this.app.gameState, this.app.playerId);
        this.app.playerController.setGameState(this.app.gameState, this.app.playerId);
        this.app.gameUIManager.showGameScreen();
        this.app.setupGameControls();
        setTimeout(() => {
          this.app.setupGameChatHandlers();
          this.app.updateChatDisplay();
          this.app.gameUIManager.updateTimer();
          this.app.applyAnimationSettings();
        }, 100);
      }
    }
  }

  handleGameEnded(eventData) {
    if (eventData.gameState) {
      this.app.gameState = eventData.gameState;
      this.app.gameUIManager.setGameState(this.app.gameState, this.app.playerId);
    }
    this.app.gameState.gameEnded = true;
    this.app.gameState.winner = eventData.winner;
    setTimeout(() => {
      this.app.gameUIManager.showGameEndScreen();
    }, 50);
  }

  handleGameReset(eventData) {
    this.app.gameState = eventData.gameState;
    this.app.returnToLobby();
  }

  // ✅ CONSOLIDATED: Add missing event handlers
  handlePlayerEliminated(eventData) {
    const isCurrentPlayer = eventData.playerId === this.app.playerId;
    const playerName = isCurrentPlayer ? "You" : eventData.nickname || "Player";

    if (isCurrentPlayer) {
      this.app.showNotification(`💀 ${playerName} were eliminated!`, 'error');
      // Update UI to reflect elimination
      this.app.gameUIManager.updatePlayerStats(true);
    } else {
      this.app.showNotification(`💀 ${playerName} was eliminated!`, 'info');
    }
  }

  handleBombExplosion(eventData) {
    // Additional bomb explosion handling if needed
    // The main explosion effect is already handled in bombermanApp.js
    console.log('🎆 Bomb explosion event processed:', eventData.bombId);
  }

  handlePlayerLeft(eventData) {
    const playerName = eventData.nickname || "Player";
    this.app.showNotification(`👋 ${playerName} left the game`, 'info');

    // Update waiting screen if in lobby
    if (this.app.isInWaitingRoom()) {
      this.app.updateWaitingScreen();
    }
  }

  // ✅ CONSOLIDATED: Merged handlePlayerDamaged from playerEvents.js
  handlePlayerDamaged(eventData) {
    if (eventData.playerId === this.app.playerId) {
      if (this.app.gameState && this.app.gameState.players[this.app.playerId]) {
        this.app.gameState.players[this.app.playerId].lives = eventData.livesRemaining;
        this.app.gameUIManager.setGameState(this.app.gameState, this.app.playerId);
      }
      this.app.gameUIManager.updatePlayerStats(true);
      this.app.gameUIManager.handlePlayerDamage();
      this.app.playDamageSound();
    }
  }

  // ✅ CONSOLIDATED: Merged handleGameEvent from appEvents.js
  handleGameEvent(eventType, eventData) {
    switch (eventType) {
      case "countdown_update":
        this.app.gameUIManager.updateCountdown(eventData.countdown);
        break;
      case "waiting_timer_update":
        this.app.gameUIManager.updateWaitingTimer(eventData.waitingTimeLeft);
        break;
      case "player_joined":
        this.app.handlePlayerJoined(eventData);
        break;
      case "player_left":
        this.app.handlePlayerLeft(eventData);
        break;
      case "bomb_exploded":
        this.app.handleBombExplosion(eventData);
        break;
      case "powerup_spawned":
        this.app.handlePowerUpSpawned(eventData);
        break;
      case "powerup_collected":
        this.app.handlePowerUpCollected(eventData);
        break;
      case "game_started":
        this.app.handleGameStarted(eventData);
        break;
      case "timer_update":
        this.app.gameUIManager.updateGameTimer(eventData.timeLeft);
        break;
      case "player_damaged":
        this.handlePlayerDamaged(eventData);
        break;
      case "player_eliminated":
        this.app.handlePlayerEliminated(eventData);
        break;
      case "game_ended":
        this.app.handleGameEnded(eventData);
        break;
      case "game_reset":
        this.app.handleGameReset(eventData);
        break;
      default:
        break;
    }
  }
}
