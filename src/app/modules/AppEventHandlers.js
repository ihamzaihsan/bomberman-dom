// AppEventHandlers: Handles app-level events (join, start, end, reset, etc.)
export class AppEventHandlers {
  constructor(app) {
    this.app = app;
  }

  handleJoinSuccess(data) {
    // Set playerId and update UI for successful join
    this.app.playerId = data.playerId;
    this.app.showNotification(`Welcome, ${this.app.nickname}!`);
    this.app.showWaitingScreen();
  }

  handleGameStarted(eventData) {
    // Set game state and show game screen
    if (eventData.gameState) {
      this.app.gameState = eventData.gameState;
      this.app.gameUIManager.setGameState(this.app.gameState, this.app.playerId);
      this.app.playerController.setGameState(this.app.gameState, this.app.playerId);
      this.app.showGameScreen();
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
}
