// Game state related feature module
export function handleGameStateUpdate(app, newGameState) {
  const previousPlayerCount = app.gameState
    ? Object.keys(app.gameState.players).length
    : 0;
  const newPlayerCount = Object.keys(newGameState.players).length;

  const previousState = app.gameState;
  app.gameState = newGameState;
  app.gameUIManager.setGameState(app.gameState, app.playerId);
  app.playerController.setGameState(app.gameState, app.playerId);

  const inWaitingRoom = app.isInWaitingRoom();
  if (inWaitingRoom) {
    app.updateWaitingScreen();
    app.updateChatDisplay();
  }
  if (previousState) {
    app.handleGameStateChange(previousState, newGameState);
  }
}

export function handleGameReset(app, eventData) {
  // Add your reset logic here
}

export function handlePlayerEliminated(app, eventData) {
  // Add your elimination logic here
}
