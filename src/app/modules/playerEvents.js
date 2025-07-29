// Player event feature module
export function handlePlayerDamaged(app, eventData) {
  if (eventData.playerId === app.playerId) {
    if (app.gameState && app.gameState.players[app.playerId]) {
      app.gameState.players[app.playerId].lives = eventData.livesRemaining;
      // ✅ REMOVED: Don't modify bomb counts on client - server handles this
      // The server resets maxBombs=1 and currentBombs=0 on damage
      app.gameUIManager.setGameState(app.gameState, app.playerId);
    }
    app.gameUIManager.updatePlayerStats(true);
    app.gameUIManager.handlePlayerDamage();
    app.playDamageSound();
  }
}

export function handleGameStarted(app, eventData) {
  if (eventData.gameState) {
    app.gameState = eventData.gameState;
    if (!app.playerId || !app.gameState.players[app.playerId]) {
      const playerByNickname = Object.values(app.gameState.players).find(
        (p) => p.nickname === app.nickname
      );
      if (playerByNickname) {
        app.playerId = playerByNickname.id;
        app.gameUIManager.setGameState(app.gameState, app.playerId);
        app.playerController.setGameState(app.gameState, app.playerId);
        app.gameUIManager.showGameScreen();
        app.setupGameControls();
        setTimeout(() => {
          app.setupGameChatHandlers();
          app.updateChatDisplay();
          app.gameUIManager.updateTimer();
          app.applyAnimationSettings();
        }, 100);
      } else {
        app.showError("Failed to join game - please try again");
        app.returnToLobby();
      }
    } else {
      app.gameUIManager.setGameState(app.gameState, app.playerId);
      app.playerController.setGameState(app.gameState, app.playerId);
      app.gameUIManager.showGameScreen();
      app.setupGameControls();
      setTimeout(() => {
        app.setupGameChatHandlers();
        app.updateChatDisplay();
        app.gameUIManager.updateTimer();
        app.applyAnimationSettings();
      }, 100);
    }
  }
}

export function handlePowerUpCollected(app, eventData) {
  // ✅ FIXED: Let server handle all bomb logic, client just shows notification
  // The server increments maxBombs and sends updated game state

  if (eventData.powerUpType === 'bombs' && eventData.playerId === app.playerId) {
    app.showNotification('Bomb Power-Up collected!', 'success');
    // ✅ CRITICAL: Don't modify client state - wait for server update
    // The server will increment maxBombs and broadcast the new game state
    // Client will receive the update and UI will refresh automatically
  }
  // ...existing code for other power-ups...
}
