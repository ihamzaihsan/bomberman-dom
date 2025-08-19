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
// ✅ CONSOLIDATED: Import shared constants for validation
import { PLAYER_CONFIG } from "../shared/GameConstants.js";

class BombermanApp {
  constructor() {
    this.framework = new Framework();
    this.webSocketManager = new WebSocketManager(this.framework);
    this.gameUIManager = new GameUIManager(this.framework);
    this.mapRenderer = new MapRenderer(this.framework);
    this.playerController = new PlayerController(
      this.framework,
      this.webSocketManager
    );
    this.performanceMonitor = new PerformanceMonitor(this.framework);
    // Initialize Framework routing: map root route and let framework handle 404s
    // The root route component returns an empty string so the framework does not overwrite app content
    this.framework.routes({
      '/': () => ''
    });

    this.notificationManager = new NotificationManager(this.framework);
    this.chatManager = new ChatManager(this);
    this.gameStateManager = new GameStateManager(this);
    this.appEventHandlers = new AppEventHandlers(this);

    // ✅ NEW: Initialize framework state management for game
    this.initializeFrameworkState();

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

  // ✅ NEW: Initialize framework state management for Bomberman
  initializeFrameworkState() {
    // Initialize the game state structure in the framework
    this.framework.setState({
      gameState: null,
      playerId: null,
      nickname: "",
      isConnected: false,
      chatHistory: [],
      notifications: []
    });

    // Subscribe to state changes for automatic UI updates
    this.framework.subscribe((state) => {
      this.onFrameworkStateChange(state);
    });
  }

  // ✅ NEW: Handle framework state changes
  onFrameworkStateChange(state) {
    // Only react to gameState changes for rendering; avoid writing back to framework
    const prevGameState = this._lastFrameworkGameState;
    if (state.gameState !== prevGameState) {
      this._lastFrameworkGameState = state.gameState;
      if (this.mapRenderer) {
        this.mapRenderer.updateGameMapOptimized(state.gameState, Date.now());
      }
      // Recalculate movement speed after significant game state changes
      this.playerController.updateMovementSpeed();
    }
    // No need to re-set playerId/nickname here; getters read from framework directly
  }

  // ✅ NEW: Framework state getters
  get gameState() {
    return this.framework.get('gameState');
  }

  set gameState(value) {
    this.framework.set('gameState', value);
  }

  get playerId() {
    return this.framework.get('playerId');
  }

  set playerId(value) {
    this.framework.set('playerId', value);
  }

  get nickname() {
    return this.framework.get('nickname');
  }

  set nickname(value) {
    this.framework.set('nickname', value);
  }

  init() {
    // If router is in error state (invalid route), skip Bomberman initialization
    if (this.framework && this.framework.routeMatched === false) {
      console.warn('Framework router detected invalid route. Skipping BombermanApp initialization; 404 page will be shown.');
      return;
    }

    // Don't setup event handlers here since the form doesn't exist yet
    this.cacheElements();
    this.setupWebSocket();
    this.setupGameUIManager();
    this.setupModules();
    this.setupDebugTools();
    // Show initial screen and then setup event handlers
    this.gameUIManager.showInitialScreen();
    this.setupEventHandlers();
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
      // ✅ NEW: Add framework state debugging
      window.bombermanDebug.getFrameworkState = () => this.framework.getState();
      window.bombermanDebug.getGameState = () => this.framework.get('gameState');
      window.bombermanDebug.getPlayerId = () => this.framework.get('playerId');
      window.bombermanDebug.getNickname = () => this.framework.get('nickname');
      window.bombermanDebug.getChatHistory = () => this.framework.get('chatHistory');
    }
  }

  setupWebSocket() {
    this.webSocketManager.setConnectionCallbacks({
      onSuccess: () => this.updateConnectionStatus(),
      onError: (error) => this.updateConnectionStatus(),
      onDisconnect: () => this.updateConnectionStatus(),
    });
    this.webSocketManager.registerMessageHandler("connected", () => {});
    this.webSocketManager.registerMessageHandler("join_success", (data) => {
      console.log('🎉 CLIENT: Received join_success message for player:', data.player?.nickname || 'unknown');
      console.log('🎉 CLIENT: Full join_success data:', data);
      console.log('🎉 CLIENT: About to call handleJoinSuccess...');
      this.handleJoinSuccess(data);
      console.log('🎉 CLIENT: handleJoinSuccess completed');
    });
    this.webSocketManager.registerMessageHandler("join_error", (data) => {
      console.log('❌ CLIENT: Received join_error message:', data.message);
      console.log('❌ CLIENT: Full join_error data:', data);
      console.log('❌ CLIENT: About to show error notification...');
      this.showError(data.message);
      console.log('❌ CLIENT: Error notification shown');
      this.resetJoinButton();
    });
    this.webSocketManager.registerMessageHandler("game_state_update", (data) => this.handleGameStateUpdate(data.gameState));
    this.webSocketManager.registerMessageHandler("game_event", (data) => this.handleGameEvent(data.eventType, data.data));
    this.webSocketManager.registerMessageHandler("chat_message", (data) => this.handleChatMessage(data));
    this.webSocketManager.registerMessageHandler("error", (data) => this.showError(data.message));
    this.webSocketManager.registerMessageHandler("move_result", (data) => this.handleMoveResult(data));
    this.webSocketManager.registerMessageHandler("bomb_result", (data) => this.handleBombResult(data));
    this.webSocketManager.registerMessageHandler("game_reset", (data) => this.handleGameReset(data));
    this.webSocketManager.initWebSocket();
    setTimeout(() => this.updateConnectionStatus(), 100);
  }

  updateConnectionStatus() {
    // ✅ NEW: Update connection status in framework state
    const isConnected = this.webSocketManager.isConnected();
    this.framework.set('isConnected', isConnected);
  }

  setupGameUIManager() {
    this.gameUIManager.setCallbacks({
      onReturnToLobby: () => this.returnToLobby(),
      onShowError: (message) => this.showError(message),
      onShowNotification: (message, type) => this.showNotification(message, type),
    });

    // ✅ CONSOLIDATED: Set notification manager reference to avoid duplication
    this.gameUIManager.setNotificationManager(this.notificationManager);
  }

  sendWebSocketMessage(message) {
    return this.webSocketManager.sendWebSocketMessage(message);
  }

  cacheElements() {
    // ✅ FRAMEWORK: Use framework's getCachedElement which handles getElementById internally
    this.framework.cacheElement("app", this.framework.getCachedElement("app"));
    this.framework.cacheElement("game-map", this.framework.getCachedElement("game-map"));
    this.framework.cacheElement("timer-value", this.framework.getCachedElement("timer-value"));
    this.framework.cacheElement("player-lives", this.framework.getCachedElement("player-lives"));
    this.framework.cacheElement("player-bombs", this.framework.getCachedElement("player-bombs"));
    this.framework.cacheElement("game-chat-messages", this.framework.getCachedElement("game-chat-messages"));
    this.cachedElements = {
      app: this.framework.getCachedElement("app"),
    };
  }

  handleGameStateUpdate(newGameState) {
    // ✅ CONSOLIDATED: Let GameStateManager handle all state updates
    this.mapRenderer.framework = this.framework;
    return this.gameStateManager.handleGameStateUpdate(newGameState);
  }

  handleGameEvent(eventType, eventData) {
    // ✅ CONSOLIDATED: Use AppEventHandlers method
    return this.appEventHandlers.handleGameEvent(eventType, eventData);
  }

  showNotification(message, type = "success") {
    return this.notificationManager.showNotification(message, type);
  }

  showError(message) {
    return this.notificationManager.showError(message);
  }

  handleChatMessage(data) {
    this.chatManager.handleChatMessage(data);
    // Don't call updateChatDisplay() here - handleChatMessage already does it
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

  handleGameReset(data) {
    console.log('🔧 Game reset event received, clearing chat and returning to lobby');
    // Clear chat history when game resets
    this.clearChatHistory();
    // Let AppEventHandlers handle the reset logic
    return this.appEventHandlers.handleGameReset(data);
  }

  setupEventHandlers() {
    this.removeEventHandlers();

    const form = this.framework.find('#nickname-form');
    if (form) {
      this.formSubmitHandler = (e) => {
        e.preventDefault();
        console.log('Form submission handler triggered');

        const nicknameInput = this.framework.find('#nickname-input');
        if (nicknameInput) {
          const nickname = nicknameInput.value.trim();
          if (nickname.length < PLAYER_CONFIG.NICKNAME_MIN_LENGTH) {
            this.showError(`Nickname must be at least ${PLAYER_CONFIG.NICKNAME_MIN_LENGTH} characters long`);
            return;
          }
          if (nickname.length > PLAYER_CONFIG.NICKNAME_MAX_LENGTH) {
            this.showError(`Nickname must be less than ${PLAYER_CONFIG.NICKNAME_MAX_LENGTH} characters`);
            return;
          }
          console.log(`Calling joinGame with nickname: "${nickname}"`);
          this.joinGame(nickname);
        }
      };
      form.addEventListener("submit", this.formSubmitHandler);
      console.log('Single form submit handler attached');
    }
  }

  removeEventHandlers() {
    const form = this.framework.find('#nickname-form');
    if (form && this.formSubmitHandler) {
      form.removeEventListener('submit', this.formSubmitHandler);
      console.log('Form submit handler removed');
    }

    this.removeChatHandlers();
  }

  joinGame(nickname) {
    const submitButton = this.framework.find('#nickname-form button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = "Joining...";
      submitButton.disabled = true;
    }
    // ✅ NEW: Use framework state management
    this.framework.set('nickname', nickname);
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
    // ✅ FRAMEWORK: Use framework's find method instead of document.querySelector
    const submitButton = this.framework.find('#nickname-form button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = "Join Game";
      submitButton.disabled = false;
    }
  }

  isInWaitingRoom() {
    if (!this.waitingScreenReady) return false;
    // ✅ FRAMEWORK: Use framework's find method instead of document.querySelector
    const waitingScreen = this.framework.find(".waiting-screen");
    if (!waitingScreen) return false;
    const computedStyle = window.getComputedStyle(waitingScreen);
    return computedStyle.display !== "none" && waitingScreen.offsetParent !== null;
  }

  startOptimizedGameLoop() {
    this.framework.startGameLoop((_deltaTime, currentTime) => {
      const gs = this.framework.get('gameState');
      if (gs) {
        console.log('Game loop: gameTimeLeft =', gs.gameTimeLeft);
      }
      this.gameUIManager.updateTimer(); // Always update timer
      this.gameUIManager.updatePlayerStats();
      const gameMapEl = this.framework.getCachedElement('game-map');
      if (gs && gs.map && gameMapEl) {
        this.mapRenderer.updateGameMapOptimized(gs, currentTime);
      }
      if (this.isInWaitingRoom()) {
        this.updateWaitingScreen();
      }
    });
  }

  handleJoinSuccess(data) {
  // Use framework-backed state
  this.framework.set('playerId', data.playerId);
  this.framework.set('gameState', data.gameState);
  // Ensure controller movement speed is updated after join
  this.playerController.updateMovementSpeed();
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
    this.playerController.updateMovementSpeed();
    this.gameUIManager.showWaitingScreen();

    // ✅ CRITICAL FIX: Set waitingScreenReady flag so isInWaitingRoom() works
    this.waitingScreenReady = true;

    // Remove or hide timer elements in the lobby
    // ✅ FRAMEWORK: Use framework's getCachedElement instead of document.getElementById
    const timerDisplay = this.framework.getCachedElement('timer-display');
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
    // ✅ CRITICAL FIX: Reset waitingScreenReady flag when leaving waiting screen
    this.waitingScreenReady = false;

    this.playerController.updateMovementSpeed();
    this.gameUIManager.showGameScreen();

    // Clear caches and ensure fresh DOM references for map rendering
    this.framework.clearAllCaches();

    // Use setTimeout to ensure DOM is fully ready before rendering map
    setTimeout(() => {
      // Render the map with the latest state
      const gs = this.framework.get('gameState');
      this.mapRenderer.renderFullGameMap(gs);
      // Update chat UI
      this.updateChatDisplay();
      // Setup chat handlers for game screen
      this.setupGameChatHandlers();
      // Setup player movement controls
      this.setupGameControls();
    }, 50); // Small delay to ensure DOM is ready
  }

  updateGameScreen(previousState, newState) {
    this.gameUIManager.updateGameScreen(previousState, newState);
    // ✅ SPEED POWER-UP: Update movement speed when game state changes
    if (this.playerController && this.framework.get('playerId')) {
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
    console.log('🔧 returnToLobby: Starting comprehensive cleanup');

    // Option 1: Use location.reload() for most reliable cleanup (recommended)
    if (true) { // Set to false to use manual cleanup instead
      console.log('🔧 Using location.reload() for complete state reset');
      location.reload();
      return;
    }

    // Option 2: Manual cleanup (alternative approach)
    this.performManualCleanup();
  }

  performManualCleanup() {
    console.log('🔧 Performing manual cleanup');

    // Stop game loop first to prevent interference
    this.framework.stopGameLoop();

    // Clear all state
  this.framework.set('gameState', null);
  this.framework.set('playerId', null);
  this.framework.set('nickname', "");
    this.waitingScreenReady = false;

    // Clear chat history for fresh start
    this.clearChatHistory();

    // Reset map renderer state for fresh start
    this.mapRenderer.resetRenderer();

    // Remove ALL event handlers with comprehensive cleanup
    this.removeEventHandlers();
    this.removeChatHandlers(); // Extra cleanup

    // Clear all caches
    this.framework.clearAllCaches();
    this.cachedElements = {};

    // Reset UI manager state
    this.gameUIManager.resetGame();

    // Wait for cleanup to complete, then show initial screen
    setTimeout(() => {
      this.gameUIManager.showInitialScreen();
      setTimeout(() => {
        this.setupEventHandlers();
      }, 100);
    }, 200);
  }

  destroy() {
    this.removeEventHandlers();
    this.framework.stopGameLoop();
    this.webSocketManager.close();
  }

  handlePlayerDamaged(eventData) {
    // ✅ CONSOLIDATED: Use AppEventHandlers method
    return this.appEventHandlers.handlePlayerDamaged(eventData);
  }

  handlePlayerEliminated(eventData) {
    // ✅ CONSOLIDATED: Simplified - method now exists in AppEventHandlers
    return this.appEventHandlers.handlePlayerEliminated(eventData);
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
    // ✅ CONSOLIDATED: Simplified - method now exists in AppEventHandlers
    return this.appEventHandlers.handleBombExplosion(eventData);
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
    const isCurrentPlayer = eventData.playerId === this.framework.get('playerId');
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
    console.log('🧪 BOMB RESULT RECEIVED:', data);

    if (!data.success) {
      console.log('❌ Bomb placement rejected by server');
      if (data.debug) {
        console.log('🧪 Debug info:', data.debug);
      }
    } else {
      console.log('✅ Bomb placement successful');

      // ✅ CRITICAL FIX: Update client state immediately with server state
      if (data.playerBombState && this.framework.get('playerId') && this.framework.get('gameState')?.players[this.framework.get('playerId')]) {
          // Clone game state, update nested player safely, and set via framework
          const gs = this.framework.get('gameState') || {};
          const newGs = JSON.parse(JSON.stringify(gs));
          const clientPlayer = newGs.players && newGs.players[this.framework.get('playerId')];
          if (clientPlayer) {
            console.log(`🔄 Updating client state: ${clientPlayer.currentBombs}/${clientPlayer.maxBombs} → ${data.playerBombState.currentBombs}/${data.playerBombState.maxBombs}`);
            clientPlayer.maxBombs = data.playerBombState.maxBombs;
            clientPlayer.currentBombs = data.playerBombState.currentBombs;
            this.framework.set('gameState', newGs);
            // Force immediate UI update
            this.gameUIManager.updatePlayerStats(true);
          }
      }
    }
  }

  handlePlayerJoined(_eventData) {
    // Add logic if needed, for now just a stub to prevent errors
    // Example: update player list, show notification, etc.
    // this.showNotification(`${eventData.nickname} joined the game!`, 'info');
  }

  // ✅ CONSOLIDATED: Add missing event handler
  handlePlayerLeft(eventData) {
    return this.appEventHandlers.handlePlayerLeft(eventData);
  }

  // ✅ CONSOLIDATED: Add missing sound method
  playDamageSound() {
    // Placeholder for damage sound - could be implemented with Web Audio API
    console.log('🔊 Playing damage sound effect');
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
