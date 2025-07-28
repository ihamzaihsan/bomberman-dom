// GameStateManager: Handles game state updates and related logic
export class GameStateManager {
  constructor(app) {
    this.app = app;
  }

  handleGameStateUpdate(newGameState) {
    // Update the app's game state and trigger UI updates
    this.app.gameState = newGameState;
    this.app.gameUIManager.setGameState(newGameState, this.app.playerId);
    this.app.playerController.setGameState(newGameState, this.app.playerId);
    // Optionally, trigger map/UI updates
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
