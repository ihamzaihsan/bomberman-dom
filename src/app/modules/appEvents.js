// App event feature module
export function handleGameEvent(app, eventType, eventData) {
  switch (eventType) {
    case "countdown_update":
      app.gameUIManager.updateCountdown(eventData.countdown);
      break;
    case "waiting_timer_update":
      app.gameUIManager.updateWaitingTimer(eventData.waitingTimeLeft);
      break;
    case "player_joined":
      app.handlePlayerJoined(eventData);
      break;
    case "player_left":
      app.handlePlayerLeft(eventData);
      break;
    case "bomb_exploded":
      app.handleBombExplosion(eventData);
      break;
    case "powerup_spawned":
      app.handlePowerUpSpawned(eventData);
      break;
    case "powerup_collected":
      app.handlePowerUpCollected(eventData);
      break;
    case "game_started":
      app.handleGameStarted(eventData);
      break;
    case "timer_update":
      app.gameUIManager.updateGameTimer(eventData.timeLeft);
      break;
    case "player_damaged":
      app.handlePlayerDamaged(eventData);
      break;
    case "player_eliminated":
      app.handlePlayerEliminated(eventData);
      break;
    case "game_ended":
      app.handleGameEnded(eventData);
      break;
    case "game_reset":
      app.handleGameReset(eventData);
      break;
    default:
      break;
  }
}

export function handleJoinSuccess(app, data) {
  app.playerId = data.playerId;
  app.gameState = data.gameState;
  app.gameUIManager.setGameState(app.gameState, app.playerId);
  app.playerController.setGameState(app.gameState, app.playerId);
  app.resetJoinButton();
  app.gameUIManager.showWaitingScreen();
  setTimeout(() => {
    app.setupChatHandlers();
    app.updateWaitingScreen();
    app.updateChatDisplay();
  }, 100);
  app.startOptimizedGameLoop();
}
