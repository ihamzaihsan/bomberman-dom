export class GameStateManager {
  constructor(app) {
    this.app = app;
  }

  handleGameStateUpdate(newGameState) {
    const previousState = this.app.framework.get("gameState");

    this.app.framework.set("gameState", newGameState);

    this.app.playerController.updateMovementSpeed();

    Object.values(newGameState.players).forEach((player) => {
      if (typeof player.maxBombs !== "number") player.maxBombs = 1;
      if (typeof player.currentBombs !== "number") player.currentBombs = 0;
    });

    const inWaitingRoom = this.app.isInWaitingRoom();
    if (inWaitingRoom) {
      this.app.updateWaitingScreen();
      this.app.updateChatDisplay();
    }

    if (previousState) {
      this.handleGameStateChange(previousState, newGameState);
    }

    this.app.gameUIManager.updatePlayerStats();

    setTimeout(() => {
      this.app.gameUIManager.updatePlayerStats();
    }, 50);

    this.app.mapRenderer.updateGameMapOptimized(newGameState, Date.now());
  }

  handleGameStateChange(previousState, newState) {
    if (newState.gameEnded && (!previousState || !previousState.gameEnded)) {
      this.app.gameUIManager.showGameEndScreen();
      return;
    }
    if (
      newState.gameStarted &&
      (!previousState || !previousState.gameStarted)
    ) {
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
