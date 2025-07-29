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

  // ✅ UPDATED: Ensure all players have proper bomb attributes from server
  Object.values(newGameState.players).forEach(player => {
    if (typeof player.maxBombs !== 'number') player.maxBombs = 1;
    if (typeof player.currentBombs !== 'number') player.currentBombs = 0;
  });

  // ✅ CRITICAL FIX: Force immediate UI update after game state change
  // This ensures bomb counter displays correct values immediately
  app.gameUIManager.updatePlayerStats(true);

  // ✅ ADDITIONAL FIX: Force another UI update after a short delay
  // This handles any race conditions or delayed state propagation
  setTimeout(() => {
    app.gameUIManager.updatePlayerStats(true);
  }, 50);
}

export function handleGameReset(app, eventData) {
  // ✅ REMOVED: Server now handles bomb count resets
  // No client-side bomb management needed
  console.log('Game reset - server will handle bomb count resets');
}

export function handlePlayerEliminated(app, eventData) {
  // ✅ REMOVED: Server now handles bomb count resets
  // No client-side bomb management needed
  console.log(`Player ${eventData.playerId} eliminated - server handles bomb reset`);
}
