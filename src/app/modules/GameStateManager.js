// GameStateManager: Handles game state updates and related logic
export class GameStateManager {
  constructor(app) {
    this.app = app;
  }

  handleGameStateUpdate(newGameState) {
    // ✅ CONSOLIDATED: Merged logic from gameState.js
    const previousState = this.app.gameState;

    // ✅ NEW: Update the app's game state through framework state management
    this.app.framework.set('gameState', newGameState);
    this.app.gameUIManager.setGameState(newGameState, this.app.playerId);
    this.app.playerController.setGameState(newGameState, this.app.playerId);

    // ✅ MERGED: Ensure all players have proper bomb attributes from server
    Object.values(newGameState.players).forEach(player => {
      if (typeof player.maxBombs !== 'number') player.maxBombs = 1;
      if (typeof player.currentBombs !== 'number') player.currentBombs = 0;
    });

    // Handle waiting room updates
    const inWaitingRoom = this.app.isInWaitingRoom();
    if (inWaitingRoom) {
      this.app.updateWaitingScreen();
      this.app.updateChatDisplay();
    }

    // Handle game state changes
    if (previousState) {
      this.handleGameStateChange(previousState, newGameState);
    }

    // ✅ MERGED: Force immediate UI update after game state change
    this.app.gameUIManager.updatePlayerStats(true);

    // ✅ MERGED: Force another UI update after a short delay for race conditions
    setTimeout(() => {
      this.app.gameUIManager.updatePlayerStats(true);
    }, 50);

    // Trigger map/UI updates
    this.app.mapRenderer.updateGameMapOptimized(newGameState, Date.now());
  }

  handleGameStateChange(previousState, newState) {
    if (newState.gameEnded && (!previousState || !previousState.gameEnded)) {
      this.app.showGameEndScreen();
      return;
    }
    if (newState.gameStarted && (!previousState || !previousState.gameStarted)) {
      this.app.showGameScreen();
      return;
    }
    if (newState.gameStarted) {
      this.app.updateGameScreen(previousState, newState);
    } else {
      this.app.updateWaitingScreen();
    }
  }
}
