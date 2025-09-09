import { Framework } from "../framework/framework.js";
import {
  WebSocketManager,
  GameUIManager,
  MapRenderer,
  PlayerController,
  PerformanceMonitor,
  NotificationManager,
  ChatManager,
  GameStateManager,
  AppEventHandlers,
} from "./modules/index.js";
import { PLAYER_CONFIG } from "../shared/GameConstants.js";

class BombermanApp {
  constructor() {
    this.framework = new Framework();
    this.webSocketManager = new WebSocketManager(this.framework);
    this.gameUIManager = new GameUIManager(this.framework);
    this.mapRenderer = new MapRenderer(this.framework);
    this.playerController = new PlayerController(
      this.framework,
      this.webSocketManager,
    );
    this.performanceMonitor = new PerformanceMonitor(this.framework);
    this.framework.routes({
      "/": () => "",
    });

    this.notificationManager = new NotificationManager(this.framework);
    this.chatManager = new ChatManager(this);
    this.gameStateManager = new GameStateManager(this);
    this.appEventHandlers = new AppEventHandlers(this);

    this.initializeFrameworkState();

    this.init();
  }

  initializeFrameworkState() {
    this.framework.setState({
      gameState: null,
      playerId: null,
      nickname: "",
      isConnected: false,
      chatHistory: [],
      notifications: [],
    });

    this.framework.subscribe((state) => {
      this.onFrameworkStateChange(state);
    });
  }

  onFrameworkStateChange(state) {
    const prevGameState = this._lastFrameworkGameState;
    if (state.gameState !== prevGameState) {
      this._lastFrameworkGameState = state.gameState;
      if (this.mapRenderer) {
        this.mapRenderer.updateGameMapOptimized(state.gameState, Date.now());
      }
      this.playerController.updateMovementSpeed();
    }
  }

  init() {
    if (this.framework && this.framework.routeMatched === false) {
      console.warn(
        "Framework router detected invalid route. Skipping BombermanApp initialization; 404 page will be shown.",
      );
      return;
    }

    this.setupWebSocket();
    this.setupGameUIManager();
    this.setupModules();
    this.setupDebugTools();
    this.gameUIManager.showInitialScreen();
    this.setupEventHandlers();
  }

  setupModules() {
    this.playerController.setCallbacks({
      onInvalidMove: (direction) => {
        this.performanceMonitor.trackInvalidMove(direction, Date.now());
      },
      onSuccessfulMove: () => {
        this.performanceMonitor.trackValidMove();
      },
    });
  }

  setupDebugTools() {
    if (typeof window !== "undefined") {
      window.bombermanDebug = this.performanceMonitor.getDebugInterface();
      window.bombermanDebug.getFrameworkState = () => this.framework.getState();
      window.bombermanDebug.getGameState = () =>
        this.framework.get("gameState");
      window.bombermanDebug.getPlayerId = () => this.framework.get("playerId");
      window.bombermanDebug.getNickname = () => this.framework.get("nickname");
      window.bombermanDebug.getChatHistory = () =>
        this.framework.get("chatHistory");
    }
  }

  setupWebSocket() {
    this.webSocketManager.setConnectionCallbacks({
      onSuccess: () => this.updateConnectionStatus(),
      onError: () => this.updateConnectionStatus(),
      onDisconnect: () => {
        this.updateConnectionStatus();
        this.framework.stopGameLoop();
        this.framework.setState({
          playerId: null,
          gameState: null,
          chatHistory: [],
        });
        this.gameUIManager.showInitialScreen();
        this.resetJoinButton();
      },
    });
    this.webSocketManager.registerMessageHandler("join_success", (data) => {
      this.handleJoinSuccess(data);
    });
    this.webSocketManager.registerMessageHandler("join_error", (data) => {
      this.showError(data.message);
      this.resetJoinButton();
    });
    this.webSocketManager.registerMessageHandler("game_state_update", (data) =>
      this.handleGameStateUpdate(data.gameState),
    );
    this.webSocketManager.registerMessageHandler("game_event", (data) =>
      this.framework.eventManager.emit(data.eventType, data.data),
    );
    this.webSocketManager.registerMessageHandler("chat_message", (data) =>
      this.handleChatMessage(data),
    );
    this.webSocketManager.registerMessageHandler("error", (data) =>
      this.showError(data.message),
    );
    this.webSocketManager.registerMessageHandler("move_result", (data) =>
      this.handleMoveResult(data),
    );
    this.webSocketManager.registerMessageHandler("bomb_result", (data) =>
      this.handleBombResult(data),
    );
    this.webSocketManager.registerMessageHandler("game_reset", (data) =>
      this.handleGameReset(data),
    );
    this.webSocketManager.initWebSocket();
    setTimeout(() => this.updateConnectionStatus(), 100);
  }

  updateConnectionStatus() {
    const isConnected = this.webSocketManager.isConnected();
    this.framework.set("isConnected", isConnected);
  }

  setupGameUIManager() {
    this.gameUIManager.setCallbacks({
      onReturnToLobby: () => this.returnToLobby(),
    });
  }

  sendWebSocketMessage(message) {
    return this.webSocketManager.sendWebSocketMessage(message);
  }

  handleGameStateUpdate(newGameState) {
    return this.gameStateManager.handleGameStateUpdate(newGameState);
  }

  showNotification(message, type = "success") {
    return this.notificationManager.showNotification(message, type);
  }

  showError(message) {
    return this.notificationManager.showError(message);
  }

  handleChatMessage(data) {
    this.chatManager.handleChatMessage(data);
  }

  updateChatDisplay() {
    return this.chatManager.updateChatDisplay();
  }

  sendChatMessage(message) {
    return this.chatManager.sendChatMessage(message);
  }

  setupChatHandlers() {
    return this.chatManager.setupChatHandlers();
  }

  setupGameChatHandlers() {
    return this.chatManager.setupGameChatHandlers();
  }

  removeChatHandlers() {
    this.chatManager.removeChatHandlers();
    this.chatManager.removeGameChatHandlers();
  }

  clearChatHistory() {
    return this.chatManager.clearChatHistory();
  }

  setupEventHandlers() {
    this.removeEventHandlers();

    this.formSubmitHandler = (e) => {
      e.preventDefault();
      const nicknameInput = this.framework.find("#nickname-input");
      if (nicknameInput) {
        const nickname = nicknameInput.value.trim();
        if (nickname.length < PLAYER_CONFIG.NICKNAME_MIN_LENGTH) {
          this.showError(
            `Nickname must be at least ${PLAYER_CONFIG.NICKNAME_MIN_LENGTH} characters long`,
          );
          return;
        }
        if (nickname.length > PLAYER_CONFIG.NICKNAME_MAX_LENGTH) {
          this.showError(
            `Nickname must be less than ${PLAYER_CONFIG.NICKNAME_MAX_LENGTH} characters`,
          );
          return;
        }
        this.joinGame(nickname);
      }
    };
    this.framework.eventManager.submit(
      "#nickname-form",
      this.formSubmitHandler,
    );
  }

  removeEventHandlers() {
    if (this.formSubmitHandler) {
      this.framework.eventManager.off(
        "submit",
        "#nickname-form",
        this.formSubmitHandler,
      );
      this.formSubmitHandler = null;
    }

    this.removeChatHandlers();
  }

  joinGame(nickname) {
    const submitButton = this.framework.find(
      '#nickname-form button[type="submit"]',
    );
    if (submitButton) {
      submitButton.textContent = "Joining...";
      submitButton.disabled = true;
    }
    this.framework.set("nickname", nickname);
    if (!this.webSocketManager.isConnected()) {
      this.showError("Not connected to server. Please wait...");
      this.resetJoinButton();
      return;
    }
    const success = this.sendWebSocketMessage({ type: "join", nickname });
    if (!success) {
      this.showError("Failed to send join request");
      this.resetJoinButton();
    }
  }

  resetJoinButton() {
    const submitButton = this.framework.find(
      '#nickname-form button[type="submit"]',
    );
    if (submitButton) {
      submitButton.textContent = "Join Game";
      submitButton.disabled = false;
    }
  }

  isInWaitingRoom() {
    const waitingScreen = this.framework.find(".waiting-screen");
    if (!waitingScreen) return false;
    const computedStyle = window.getComputedStyle(waitingScreen);
    return (
      computedStyle.display !== "none" && waitingScreen.offsetParent !== null
    );
  }

  startOptimizedGameLoop() {
    this.framework.startGameLoop((_deltaTime, currentTime) => {
      const gs = this.framework.get("gameState");

      const gameMapEl = this.framework.getCachedElement("game-map");
      if (gs && gs.map && gameMapEl) {
        this.mapRenderer.updateGameMapOptimized(gs, currentTime);
      }
    });
  }

  handleJoinSuccess(data) {
    return this.appEventHandlers.handleJoinSuccess(data);
  }

  handleGameStarted(eventData) {
    return this.appEventHandlers.handleGameStarted(eventData);
  }

  handleGameEnded(eventData) {
    return this.appEventHandlers.handleGameEnded(eventData);
  }

  handleGameReset(eventData) {
    return this.appEventHandlers.handleGameReset(eventData);
  }

  updateWaitingScreen() {
    this.gameUIManager.updateWaitingScreen();
  }

  showGameScreen() {
    this.playerController.updateMovementSpeed();
    this.gameUIManager.showGameScreen();

    this.framework.clearAllCaches();

    setTimeout(() => {
      const gs = this.framework.get("gameState");
      this.mapRenderer.renderFullGameMap(gs);
      this.updateChatDisplay();
      this.setupGameChatHandlers();
      this.setupGameControls();
    }, 50);
  }

  updateGameScreen(previousState, newState) {
    this.gameUIManager.updateGameScreen(previousState, newState);
    if (this.playerController && this.framework.get("playerId")) {
      this.playerController.updateMovementSpeed();
    }
  }

  setupGameControls() {
    this.playerController.setupEventHandlers();
  }

  returnToLobby() {
    this.destroy();
    location.reload();
  }

  destroy() {
    this.removeEventHandlers();
    this.framework.stopGameLoop();
    this.webSocketManager.close();
  }

  handlePlayerEliminated(eventData) {
    return this.appEventHandlers.handlePlayerEliminated(eventData);
  }

  handleBombExplosion(eventData) {
    if (eventData.explosions && eventData.position) {
      this.mapRenderer.showExplosionEffect(
        eventData.position,
        eventData.explosions,
        eventData.range,
        eventData.chainReactionDepth,
      );
    }
  }

  handlePowerUpSpawned(eventData) {
    this.showNotification(
      `💎 ${eventData.powerUp?.type?.toUpperCase() || "POWER-UP"} appeared!`,
    );
    if (eventData.powerUp?.id) {
      setTimeout(
        () => this.mapRenderer.animatePowerUpSpawn(eventData.powerUp.id),
        100,
      );
    }
  }

  handlePowerUpCollected(eventData) {
    const isCurrentPlayer =
      eventData.playerId === this.framework.get("playerId");
    const playerName = isCurrentPlayer
      ? "You"
      : eventData.playerNickname || "Player";
    this.showNotification(
      `🎉 ${playerName} collected ${eventData.powerUpType?.toUpperCase() || "POWER-UP"}!`,
    );
    if (eventData.powerUpId) {
      this.mapRenderer.animatePowerUpCollected(eventData.powerUpId);
    }
    if (isCurrentPlayer) {
      this.gameUIManager.updatePlayerStats();
      if (eventData.powerUpType === "speed") {
        this.playerController.updateMovementSpeed();
      }
    }
  }

  handleMoveResult(data) {
    if (!data.success) this.playerController.isMoving = false;
  }

  handleBombResult(data) {
    if (data.success) {
      if (
        data.playerBombState &&
        this.framework.get("playerId") &&
        this.framework.get("gameState")?.players[this.framework.get("playerId")]
      ) {
        const gs = this.framework.get("gameState") || {};
        const newGs = JSON.parse(JSON.stringify(gs));
        const clientPlayer =
          newGs.players && newGs.players[this.framework.get("playerId")];
        if (clientPlayer) {
          clientPlayer.maxBombs = data.playerBombState.maxBombs;
          clientPlayer.currentBombs = data.playerBombState.currentBombs;
          this.framework.set("gameState", newGs);
          this.gameUIManager.updatePlayerStats();
        }
      }
    }
  }

  handlePlayerJoined(eventData) {
    this.showNotification(`${eventData.nickname} joined the lobby`, "info");
  }

  handlePlayerLeft(eventData) {
    return this.appEventHandlers.handlePlayerLeft(eventData);
  }
}

export default BombermanApp;
