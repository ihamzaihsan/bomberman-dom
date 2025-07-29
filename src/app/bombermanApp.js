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
  handleGameEvent,
  handlePlayerDamaged,
} from "./modules/index.js";

class BombermanApp {
  constructor() {
    this.framework = new Framework();
    this.webSocketManager = new WebSocketManager();
    this.gameUIManager = new GameUIManager(this.framework);
    this.mapRenderer = new MapRenderer(this.framework);
    this.playerController = new PlayerController(
      this.framework,
      this.webSocketManager
    );
    this.performanceMonitor = new PerformanceMonitor(this.framework);
    this.notificationManager = new NotificationManager(this.framework);
    this.chatManager = new ChatManager(this);
    this.gameStateManager = new GameStateManager(this);
    this.appEventHandlers = new AppEventHandlers(this);
    this.gameState = null;
    this.playerId = null;
    this.nickname = "";
    this.waitingScreenReady = false;
    this.animationSettings = {
      explosionDuration: 1.2,
      powerUpPulse: true,
      bombPulse: true,
      playerTransitions: true,
      particleEffects: true,
    };
    this.cachedElements = {};
    this.init();
  }

  init() {
    this.setupEventHandlers();
    this.cacheElements();
    this.setupWebSocket();
    this.setupGameUIManager();
    this.setupModules();
    this.setupDebugTools();
  }

  setupModules() {
    this.playerController.setCallbacks({
      onInvalidMove: (direction, reason) => {
        this.performanceMonitor.trackInvalidMove(direction, Date.now());
        this.mapRenderer.setInvalidMoveTime(Date.now());
        this.mapRenderer.setInvalidMove(direction);
      },
      onSuccessfulMove: (direction) => {
        this.performanceMonitor.trackValidMove();
      },
    });
  }

  setupDebugTools() {
    if (typeof window !== "undefined") {
      window.bombermanDebug = this.performanceMonitor.getDebugInterface();
    }
  }

  setupWebSocket() {
    this.webSocketManager.setConnectionCallbacks({
      onSuccess: () => this.updateConnectionStatus(),
      onError: (error) => this.updateConnectionStatus(),
      onDisconnect: () => this.updateConnectionStatus(),
    });
    this.webSocketManager.registerMessageHandler("connected", () => {});
    this.webSocketManager.registerMessageHandler("join_success", (data) => this.handleJoinSuccess(data));
    this.webSocketManager.registerMessageHandler("join_error", (data) => {
      this.showError(data.message);
      this.resetJoinButton();
    });
    this.webSocketManager.registerMessageHandler("game_state_update", (data) => this.handleGameStateUpdate(data.gameState));
    this.webSocketManager.registerMessageHandler("game_event", (data) => this.handleGameEvent(data.eventType, data.data));
    this.webSocketManager.registerMessageHandler("chat_message", (data) => this.handleChatMessage(data));
    this.webSocketManager.registerMessageHandler("error", (data) => this.showError(data.message));
    this.webSocketManager.registerMessageHandler("move_result", (data) => this.handleMoveResult(data));
    this.webSocketManager.registerMessageHandler("bomb_result", (data) => this.handleBombResult(data));
    this.webSocketManager.initWebSocket();
    setTimeout(() => this.updateConnectionStatus(), 100);
  }

  updateConnectionStatus() {
    // Optionally update UI connection status
  }

  setupGameUIManager() {
    this.gameUIManager.setCallbacks({
      onReturnToLobby: () => this.returnToLobby(),
      onShowError: (message) => this.showError(message),
      onShowNotification: (message, type) => this.showNotification(message, type),
    });
  }

  sendWebSocketMessage(message) {
    return this.webSocketManager.sendWebSocketMessage(message);
  }

  cacheElements() {
    this.framework.cacheElement("app", document.getElementById("app"));
    this.framework.cacheElement("game-map", document.getElementById("game-map"));
    this.framework.cacheElement("timer-value", document.getElementById("timer-value"));
    this.framework.cacheElement("player-lives", document.getElementById("player-lives"));
    this.framework.cacheElement("player-bombs", document.getElementById("player-bombs"));
    this.framework.cacheElement("game-chat-messages", document.getElementById("game-chat-messages"));
    this.cachedElements = {
      app: this.framework.getCachedElement("app"),
    };
  }

  handleGameStateUpdate(newGameState) {
    this.gameState = newGameState;
    this.gameUIManager.setGameState(this.gameState, this.playerId);
    this.playerController.setGameState(this.gameState, this.playerId); // Always update controller
    this.mapRenderer.framework = this.framework;
    return this.gameStateManager.handleGameStateUpdate(newGameState);
  }

  handleGameEvent(eventType, eventData) {
    return handleGameEvent(this, eventType, eventData);
  }

  showNotification(message, type = "success") {
    return this.notificationManager.showNotification(message, type);
  }

  showError(message) {
    return this.notificationManager.showError(message);
  }

  handleChatMessage(data) {
    this.chatManager.handleChatMessage(data);
    this.updateChatDisplay(); // ensure UI updates after new message
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

  setupEventHandlers() {
    const form = document.getElementById("nickname-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nicknameInput = document.getElementById("nickname-input");
        const nickname = nicknameInput.value.trim();
        if (nickname.length < 2) {
          this.showError("Nickname must be at least 2 characters long");
          return;
        }
        if (nickname.length > 20) {
          this.showError("Nickname must be less than 20 characters");
          return;
        }
        this.joinGame(nickname);
      });
    }
  }

  joinGame(nickname) {
    const submitButton = document.querySelector('#nickname-form button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = "Joining...";
      submitButton.disabled = true;
    }
    this.nickname = nickname;
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
    const submitButton = document.querySelector('#nickname-form button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = "Join Game";
      submitButton.disabled = false;
    }
  }

  isInWaitingRoom() {
    if (!this.waitingScreenReady) return false;
    const waitingScreen = document.querySelector(".waiting-screen");
    if (!waitingScreen) return false;
    const computedStyle = window.getComputedStyle(waitingScreen);
    return computedStyle.display !== "none" && waitingScreen.offsetParent !== null;
  }

  startOptimizedGameLoop() {
    this.framework.startGameLoop((deltaTime, currentTime) => {
      if (this.gameState) {
        console.log('Game loop: gameTimeLeft =', this.gameState.gameTimeLeft);
      }
      this.gameUIManager.updateTimer(); // Always update timer
      this.gameUIManager.updatePlayerStats();
      if (this.gameState && this.gameState.map && document.getElementById("game-map")) {
        this.mapRenderer.updateGameMapOptimized(this.gameState, currentTime);
      }
      if (this.isInWaitingRoom()) {
        this.updateWaitingScreen();
      }
    });
  }

  handleJoinSuccess(data) {
    this.playerId = data.playerId;
    this.playerController.setGameState(this.gameState, this.playerId); // Ensure controller is updated after join
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

  showWaitingScreen() {
    this.gameUIManager.setGameState(this.gameState, this.playerId);
    this.gameUIManager.showWaitingScreen();
    // Remove or hide timer elements in the lobby
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) timerDisplay.style.display = 'none';
    // Setup chat handlers for lobby
    this.setupChatHandlers();
    // Update chat UI
    this.updateChatDisplay();
  }

  updateWaitingScreen() {
    this.gameUIManager.updateWaitingScreen();
  }

  showGameScreen() {
    this.gameUIManager.setGameState(this.gameState, this.playerId);
    this.gameUIManager.showGameScreen();
    // Render the map with the latest state
    this.mapRenderer.updateGameMap(this.gameState);
    // Update chat UI
    this.updateChatDisplay();
    // Setup chat handlers for game screen
    this.setupGameChatHandlers();
    // Setup player movement controls
    this.setupGameControls();
  }

  updateGameScreen(previousState, newState) {
    this.gameUIManager.updateGameScreen(previousState, newState);
    // ✅ SPEED POWER-UP: Update movement speed when game state changes
    if (this.playerController && this.playerId) {
      this.playerController.updateMovementSpeed();
    }
  }

  applyAnimationSettings() {
    this.gameUIManager.applyAnimationSettings?.();
  }

  setupGameControls() {
    this.playerController.setupEventHandlers();
  }

  returnToLobby() {
    this.gameState = null;
    this.playerId = null;
    this.nickname = "";
    this.gameUIManager.showInitialScreen();
    this.setupEventHandlers();
  }

  destroy() {
    this.framework.stopGameLoop();
    this.webSocketManager.close();
  }

  handlePlayerDamaged(eventData) {
    return handlePlayerDamaged(this, eventData);
  }

  handlePlayerEliminated(eventData) {
    if (this.appEventHandlers.handlePlayerEliminated) {
      return this.appEventHandlers.handlePlayerEliminated(eventData);
    } else if (this.gameStateManager.handlePlayerEliminated) {
      return this.gameStateManager.handlePlayerEliminated(eventData);
    }
  }

  handleBombExplosion(eventData) {
    console.log('🎯 handleBombExplosion called with:', eventData);
    // Show explosion effect on the map
    if (eventData.explosions && eventData.position) {
      console.log('🎆 Calling showExplosionEffect with position:', eventData.position, 'explosions:', eventData.explosions);
      this.mapRenderer.showExplosionEffect(eventData.position, eventData.explosions, eventData.range, eventData.chainReactionDepth);
    } else {
      console.log('❌ Missing explosions or position data in event:', eventData);
    }
    if (this.appEventHandlers.handleBombExplosion) {
      return this.appEventHandlers.handleBombExplosion(eventData);
    } else if (this.gameStateManager.handleBombExplosion) {
      return this.gameStateManager.handleBombExplosion(eventData);
    }
  }

  handlePowerUpSpawned(eventData) {
    this.showNotification(
      `💎 ${eventData.powerUp?.type?.toUpperCase() || 'POWER-UP'} appeared!`
    );
    if (eventData.powerUp?.id) {
      setTimeout(() => this.mapRenderer.animatePowerUpSpawn(eventData.powerUp.id), 100);
    }
  }

  handlePowerUpCollected(eventData) {
    const isCurrentPlayer = eventData.playerId === this.playerId;
    const playerName = isCurrentPlayer ? "You" : eventData.playerNickname || "Player";
    this.showNotification(
      `🎉 ${playerName} collected ${eventData.powerUpType?.toUpperCase() || 'POWER-UP'}!`
    );
    if (eventData.powerUpId) {
      this.mapRenderer.animatePowerUpCollected(eventData.powerUpId);
    }
    if (isCurrentPlayer) {
      this.gameUIManager.updatePlayerStats(true);
      // ✅ SPEED POWER-UP: Update movement speed when current player collects power-ups
      if (eventData.powerUpType === 'speed') {
        this.playerController.updateMovementSpeed();
        console.log('Speed power-up collected - movement speed updated');
      }
    }
  }

  handleMoveResult(data) {
    // Handle movement result feedback from server
    if (!data.success) {
      console.log(`Move ${data.direction} rejected: ${data.reason || 'Unknown reason'}`);
      // Could show user feedback here if needed
    }
  }

  handleBombResult(data) {
    // Handle bomb placement result feedback from server
    if (!data.success) {
      console.log('Bomb placement rejected');
      // Could show user feedback here if needed
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new BombermanApp();
  });
} else {
  new BombermanApp();
}

export default BombermanApp;
