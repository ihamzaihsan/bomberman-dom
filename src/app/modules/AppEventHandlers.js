/**
 * AppEventHandlers: Handles app-level events (join, start, end, reset, etc.)
 */
export class AppEventHandlers {
  constructor(app) {
    this.app = app;
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
