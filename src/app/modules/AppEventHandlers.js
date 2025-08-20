/**
 * AppEventHandlers: Handles app-level events (join, start, end, reset, etc.)
 */
export class AppEventHandlers {
  constructor(app) {
    this.app = app;
    this.registerEventHandlers();
  }

  registerEventHandlers() {
    const eventManager = this.app.framework.eventManager;

    eventManager.addEventListener("countdown_update", (eventData) => this.app.gameUIManager.updateCountdown(eventData.countdown));
    eventManager.addEventListener("waiting_timer_update", (eventData) => this.app.gameUIManager.updateWaitingTimer(eventData.waitingTimeLeft));
    eventManager.addEventListener("player_joined", (eventData) => this.app.handlePlayerJoined(eventData));
    eventManager.addEventListener("player_left", (eventData) => this.app.handlePlayerLeft(eventData));
    eventManager.addEventListener("bomb_exploded", (eventData) => this.app.handleBombExplosion(eventData));
    eventManager.addEventListener("powerup_spawned", (eventData) => this.app.handlePowerUpSpawned(eventData));
    eventManager.addEventListener("powerup_collected", (eventData) => this.app.handlePowerUpCollected(eventData));
    eventManager.addEventListener("game_started", (eventData) => this.app.handleGameStarted(eventData));
    eventManager.addEventListener("timer_update", (eventData) => this.app.gameUIManager.updateGameTimer(eventData.timeLeft));
    eventManager.addEventListener("player_damaged", this.handlePlayerDamaged.bind(this));
    eventManager.addEventListener("player_eliminated", (eventData) => this.app.handlePlayerEliminated(eventData));
    eventManager.addEventListener("game_ended", (eventData) => this.app.handleGameEnded(eventData));
    eventManager.addEventListener("game_reset", (eventData) => this.app.handleGameReset(eventData));
  }

  handleJoinSuccess(data) {
    console.log('CLIENT: handleJoinSuccess called with data:', data);

    // ✅ NEW: Use framework state management
    this.app.framework.set('playerId', data.playerId);
    this.app.framework.set('gameState', data.gameState);

    const playerNickname = data.player?.nickname || this.app.framework.get('nickname') || 'Player';
    console.log('Join success - showing welcome notification for:', playerNickname);
    console.log('Available nicknames - data.player.nickname:', data.player?.nickname, 'framework.nickname:', this.app.framework.get('nickname'));

    this.app.clearChatHistory();

    this.app.playerController.updateMovementSpeed();
    this.app.resetJoinButton();
    this.app.gameUIManager.showWaitingScreen();
    setTimeout(() => {
      this.app.setupChatHandlers();
      this.app.updateWaitingScreen();
      this.app.updateChatDisplay();
    }, 100);
    this.app.startOptimizedGameLoop();

    this.app.showNotification(`🎉 WELCOME ${playerNickname}! You joined successfully! 🎉`);
  }

  handleGameStarted(eventData) {
    if (eventData.gameState) {
      // ✅ NEW: Use framework state management
      this.app.framework.set('gameState', eventData.gameState);
      if (!this.app.framework.get('playerId') || !this.app.framework.get('gameState').players[this.app.framework.get('playerId')]) {
        const playerByNickname = Object.values(this.app.framework.get('gameState').players).find(
          (p) => p.nickname === this.app.framework.get('nickname')
        );
        if (playerByNickname) {
          // ✅ NEW: Use framework state management
          this.app.framework.set('playerId', playerByNickname.id);
          this.app.playerController.updateMovementSpeed();
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
        this.app.playerController.updateMovementSpeed();
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
      // ✅ NEW: Use framework state management
      this.app.framework.set('gameState', eventData.gameState);
      this.app.playerController.updateMovementSpeed();
    }
    // ✅ NEW: Update game state through framework
    this.app.framework.merge('gameState', { gameEnded: true, winner: eventData.winner });
    setTimeout(() => {
      this.app.gameUIManager.showGameEndScreen();
    }, 50);
  }

  handleGameReset(eventData) {
    console.log('🔧 AppEventHandlers: Game reset event received');
    // ✅ NEW: Use framework state management
    this.app.framework.set('gameState', eventData.gameState);

    // Only return to lobby if we're not already there
    // Check if we're currently in a game or waiting room
    const currentScreen = document.querySelector('.game-screen, .waiting-screen, .game-end-screen');
    if (currentScreen) {
      console.log('🔧 Currently in game/waiting/end screen, returning to lobby');
      this.app.returnToLobby();
    } else {
      console.log('🔧 Already in lobby, just updating game state');
      // Just update the game state without changing screens
    }
  }

  handlePlayerEliminated(eventData) {
    const isCurrentPlayer = eventData.playerId === this.app.framework.get('playerId');
    const playerName = isCurrentPlayer ? "You" : eventData.nickname || "Player";

    // Check if this elimination ends the game
    if (eventData.willGameEnd) {
      console.log('Game will end after this elimination, skipping ghost mode notifications');

      if (isCurrentPlayer) {
        if (eventData.winner) {
          this.app.showNotification(`💀 ${playerName} were eliminated! ${eventData.winner.nickname} wins the game!`, 'error');
        } else {
          this.app.showNotification(`💀 ${playerName} were eliminated! Game Over!`, 'error');
        }
      } else {
        this.app.showNotification(`💀 ${playerName} was eliminated! Game ending...`, 'info');
      }

      this.app.gameUIManager.updatePlayerStats(true);
      return;
    }

    // Normal elimination handling when game continues
    if (isCurrentPlayer) {
      this.app.showNotification(`💀 ${playerName} were eliminated! You are now in ghost mode - you can watch the game continue.`, 'error');
      this.app.gameUIManager.updatePlayerStats(true);

      setTimeout(() => {
        this.app.showNotification(`👻 Ghost Mode: You can still watch the game and chat, but cannot move or place bombs.`, 'info');
      }, 3000);
    } else {
      this.app.showNotification(`💀 ${playerName} was eliminated and is now a ghost!`, 'info');
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

  handlePlayerDamaged(eventData) {
    if (eventData.playerId === this.app.framework.get('playerId')) {
      // Update nested player lives via framework state to ensure reactivity
      const gs = this.app.framework.get('gameState') || {};
      if (gs.players && gs.players[this.app.framework.get('playerId')]) {
        const newGs = JSON.parse(JSON.stringify(gs));
        newGs.players[this.app.framework.get('playerId')].lives = eventData.livesRemaining;
        this.app.framework.set('gameState', newGs);
        this.app.playerController.updateMovementSpeed();
      }
      this.app.gameUIManager.updatePlayerStats(true);
      this.app.gameUIManager.handlePlayerDamage();
      this.app.playDamageSound();
    }
  }

  
}
