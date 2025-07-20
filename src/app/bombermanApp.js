import { Framework } from '../framework/framework.js';

class BombermanApp {
  constructor() {
    this.framework = new Framework();
    this.gameState = null;
    this.playerId = null;
    this.nickname = '';
    this.gameLoop = null;
    this.performanceMonitor = null;
    this.isMoving = false;
    this.lastMoveTime = 0;
    this.moveThrottle = 100;
    this.lastRenderTime = 0;
    this.renderThrottle = 16; // Improved: Back to 60fps rendering since we removed HTTP polling

    // WebSocket connection
    this.ws = null;
    this.wsConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    // Chat functionality
    this.chatMessages = [];
    this.maxChatMessages = 50;

    // ✅ FIX: State management for DOM readiness
    this.waitingScreenReady = false;

    // ✅ NEW: Enhanced rendering optimizations
    this.gameMapCache = new Map(); // Cache for game map cells
    this.lastGameMapState = null; // Track last rendered state
    this.dirtyMapCells = new Set(); // Track which cells need updates
    this.entityPool = {
      bombs: [],
      explosions: [],
      powerUps: []
    }; // Object pooling for game entities
    this.lastRenderedEntities = {
      players: new Map(),
      bombs: new Map(),
      powerUps: new Map()
    }; // Track entity states for selective updates

    // ✅ NEW: Movement-aware rendering optimization
    this.lastInvalidMoveTime = 0; // Track when last invalid move occurred
    this.lastInvalidMove = null; // Cache for repeated invalid move detection
    this.lastRenderStateSignature = ''; // Track rendering state changes

    // ✅ NEW: Performance-aware animation system
    this.animationQuality = 'high'; // 'high', 'medium', 'low'
    this.lastPerformanceCheck = 0;
    this.performanceCheckInterval = 1000; // Check every second
    this.fpsThresholds = {
      high: 55,    // Above 55 FPS = high quality
      medium: 40,  // 40-55 FPS = medium quality
      low: 25      // Below 40 FPS = low quality
    };
    this.animationSettings = {
      high: {
        explosionDuration: 1.5,
        powerUpPulse: true,
        bombPulse: true,
        playerTransitions: true,
        particleEffects: true
      },
      medium: {
        explosionDuration: 1.0,
        powerUpPulse: true,
        bombPulse: false,
        playerTransitions: true,
        particleEffects: false
      },
      low: {
        explosionDuration: 0.5,
        powerUpPulse: false,
        bombPulse: false,
        playerTransitions: false,
        particleEffects: false
      }
    };

    // CRITICAL: Cache DOM elements to avoid repeated queries
    this.cachedElements = {
      app: null,
      gameMap: null,
      timerValue: null,
      playerLives: null,
      playerBombs: null
    };

    // CRITICAL: Cache rendered map to avoid unnecessary re-renders
    this.lastRenderedMap = null;
    this.lastRenderedPlayers = null;
    this.lastRenderedBombs = null;

    this.init();
  }

  init() {
    this.setupEventHandlers();
    this.initPerformanceMonitoring();
    this.cacheElements();
    this.initWebSocket();

    const nicknameInput = document.getElementById('nickname-input');
    if (nicknameInput) {
      nicknameInput.focus();
    }

    // ✅ NEW: Expose debug tools for movement checker testing
    this.setupDebugTools();
  }

  // ✅ NEW: Setup debugging tools for movement performance analysis
  setupDebugTools() {
    if (typeof window !== 'undefined') {
      window.bombermanDebug = {
        togglePerformanceStats: () => this.togglePerformanceStats(),
        resetPerformanceCounters: () => this.resetPerformanceCounters(),
        getMovementStats: () => this.getMovementCheckerStats(),
        getFrameworkCounters: () => this.framework.getAllCounters(),
        simulateInvalidMoves: (count = 10) => {
          const directions = ['up', 'down', 'left', 'right'];
          for (let i = 0; i < count; i++) {
            setTimeout(() => {
              const dir = directions[Math.floor(Math.random() * directions.length)];
              console.log(`Simulating move: ${dir}`);
              this.movePlayer(dir);
            }, i * 100);
          }
        }
      };
      
      console.log('🎮 Bomberman Debug Tools Available:');
      console.log('  bombermanDebug.togglePerformanceStats() - Show/hide movement performance stats');
      console.log('  bombermanDebug.resetPerformanceCounters() - Reset all performance counters');
      console.log('  bombermanDebug.getMovementStats() - Get current movement checker stats');
      console.log('  bombermanDebug.getFrameworkCounters() - Get all framework performance counters');
      console.log('  bombermanDebug.simulateInvalidMoves(count) - Simulate invalid moves for testing');
    }
  }

  // Initialize WebSocket connection
  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Connecting to WebSocket:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = (event) => {
        console.log('WebSocket connected successfully');
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        this.hideConnectionError();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.wsConnected = false;
        this.handleWebSocketDisconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.wsConnected = false;
        this.showConnectionError('Connection error occurred');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.showConnectionError('Failed to connect to server');
    }
  }

  // Handle WebSocket disconnection and reconnection
  handleWebSocketDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      this.showConnectionError(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.initWebSocket();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      this.showConnectionError('Connection lost. Please refresh the page.');
    }
  }

  // Send message via WebSocket
  sendWebSocketMessage(message) {
    console.log('=== SENDING WEBSOCKET MESSAGE ===');
    console.log('Message:', message);
    console.log('WebSocket exists:', !!this.ws);
    console.log('WebSocket connected:', this.wsConnected);
    console.log('WebSocket ready state:', this.ws ? this.ws.readyState : 'no websocket');
    console.log('WebSocket.OPEN constant:', WebSocket.OPEN);

    if (this.ws && this.wsConnected && this.ws.readyState === WebSocket.OPEN) {
      try {
        const messageString = JSON.stringify(message);
        console.log('Sending message string:', messageString);
        this.ws.send(messageString);
        console.log('Message sent successfully');
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
      console.warn('Conditions:', {
        wsExists: !!this.ws,
        wsConnected: this.wsConnected,
        readyState: this.ws ? this.ws.readyState : 'no websocket',
        expectedState: WebSocket.OPEN
      });
      return false;
    }
  }

  // ✅ ENHANCED: Cache DOM elements using framework's caching system
  cacheElements() {
    // Use framework's element caching for better performance
    this.framework.cacheElement('app', document.getElementById('app'));
    this.framework.cacheElement('game-map', document.getElementById('game-map'));
    this.framework.cacheElement('timer-value', document.getElementById('timer-value'));
    this.framework.cacheElement('player-lives', document.getElementById('player-lives'));
    this.framework.cacheElement('player-bombs', document.getElementById('player-bombs'));
    this.framework.cacheElement('game-chat-messages', document.getElementById('game-chat-messages'));

    // Cache performance display elements
    this.framework.cacheElement('performance-display', document.getElementById('performance-display'));
    this.framework.cacheElement('fps-counter', document.getElementById('fps-counter'));
    this.framework.cacheElement('frame-time', document.getElementById('frame-time'));

    // Legacy support
    this.cachedElements = {
      app: this.framework.getCachedElement('app')
    };
  }

  // Handle incoming WebSocket messages
  handleWebSocketMessage(data) {
    console.log('=== CLIENT WEBSOCKET MESSAGE RECEIVED ===');
    console.log('Message type:', data.type);
    console.log('Full message data:', data);
    console.log('Current player ID:', this.playerId);
    console.log('Current game state:', this.gameState);

    switch (data.type) {
      case 'connected':
        console.log('WebSocket connection confirmed');
        break;

      case 'join_success':
        console.log('=== PROCESSING JOIN_SUCCESS MESSAGE ===');
        console.log('Join success data:', data);
        console.log('About to call handleJoinSuccess...');
        this.handleJoinSuccess(data);
        console.log('handleJoinSuccess completed');
        break;

      case 'join_error':
        console.log('Join failed:', data.message);
        this.showError(data.message);
        this.resetJoinButton();
        break;

      case 'game_state_update':
        this.handleGameStateUpdate(data.gameState);
        break;

      case 'game_event':
        this.handleGameEvent(data.eventType, data.data);
        break;

      case 'move_result':
        // Movement feedback (optional)
        break;

      case 'bomb_result':
        // Bomb placement feedback (optional)
        break;

      case 'chat_message':
        this.handleChatMessage(data);
        break;

      case 'error':
        console.error('Server error:', data.message);
        this.showError(data.message);
        break;

      case 'pong':
        // Handle ping/pong for connection health
        break;

      default:
        console.warn('Unknown WebSocket message type:', data.type);
    }
  }

  // Handle successful join
  handleJoinSuccess(data) {
    console.log('=== HANDLE JOIN SUCCESS STARTED ===');
    console.log('Received data:', data);

    console.log('Setting player ID...');
    this.playerId = data.playerId;
    console.log('Player ID set to:', this.playerId);

    console.log('Setting game state...');
    this.gameState = data.gameState;
    console.log('Game state set:', this.gameState);
    console.log('Player in game state:', this.gameState.players[this.playerId]);
    console.log('Total players in game:', Object.keys(this.gameState.players).length);

    console.log('Resetting join button...');
    this.resetJoinButton();
    console.log('Join button reset completed');

    console.log('About to show waiting screen...');
    this.showWaitingScreen();
    console.log('showWaitingScreen() call completed');

    console.log('Starting optimized game loop...');
    this.startOptimizedGameLoop();
    console.log('Game loop started');

    console.log('=== HANDLE JOIN SUCCESS COMPLETED ===');
  }

  // Handle game state updates
  handleGameStateUpdate(newGameState) {
    const previousPlayerCount = this.gameState ? Object.keys(this.gameState.players).length : 0;
    const newPlayerCount = Object.keys(newGameState.players).length;

    console.log('Handling game state update:', {
      previousPlayerCount,
      newPlayerCount,
      newPlayers: Object.values(newGameState.players).map(p => p.nickname)
    });

    // Always update game state
    const previousState = this.gameState;
    this.gameState = newGameState;

    // Update waiting room if we're currently in it
    const inWaitingRoom = this.isInWaitingRoom();
    console.log('In waiting room?', inWaitingRoom);

    if (inWaitingRoom) {
      console.log('Updating waiting room with new game state');
      console.log(`Player count changed: ${previousPlayerCount} -> ${newPlayerCount}`);
      this.updateWaitingScreen();
      this.updateChatDisplay(); // Also update chat in case of new messages
    } else {
      console.log('Not in waiting room, skipping waiting room update');
    }

    // Handle other game state changes
    if (previousState) {
      this.handleGameStateChange(previousState, newGameState);
    }
  }

  // Handle specific game events
  handleGameEvent(eventType, eventData) {
    console.log('Game event received:', eventType, eventData);

    switch (eventType) {
      case 'countdown_update':
        this.updateCountdown(eventData.countdown);
        break;

      case 'waiting_timer_update':
        this.updateWaitingTimer(eventData.waitingTimeLeft);
        break;

      case 'player_joined':
        this.handlePlayerJoined(eventData);
        break;

      case 'player_left':
        this.handlePlayerLeft(eventData);
        break;

      case 'bomb_exploded':
        this.handleBombExplosion(eventData);
        break;

      case 'powerup_spawned':
        this.handlePowerUpSpawned(eventData);
        break;

      case 'powerup_collected':
        this.handlePowerUpCollected(eventData);
        break;

      case 'game_started':
        this.handleGameStarted(eventData);
        break;

      case 'timer_update':
        this.updateGameTimer(eventData.timeLeft);
        break;

      case 'player_damaged':
        this.handlePlayerDamaged(eventData);
        break;

      case 'player_eliminated':
        this.handlePlayerEliminated(eventData);
        break;

      case 'game_ended':
        this.handleGameEnded(eventData);
        break;

      case 'game_reset':
        this.handleGameReset(eventData);
        break;

      default:
        console.log('Unhandled game event:', eventType);
    }
  }

  // Handle chat messages
  handleChatMessage(data) {
    this.chatMessages.push({
      playerId: data.playerId,
      nickname: data.nickname,
      message: data.message,
      timestamp: data.timestamp
    });

    // Keep only the last N messages
    if (this.chatMessages.length > this.maxChatMessages) {
      this.chatMessages = this.chatMessages.slice(-this.maxChatMessages);
    }

    this.updateChatDisplay();
  }

  // Show/hide connection error
  showConnectionError(message) {
    let errorDiv = document.getElementById('connection-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'connection-error';
      errorDiv.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #e74c3c;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10001;
        font-weight: bold;
      `;
      document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  hideConnectionError() {
    const errorDiv = document.getElementById('connection-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }
  }

  // Show notification for player events
  showNotification(message, type = 'success') {
    let notificationDiv = document.getElementById('game-notification');
    if (!notificationDiv) {
      notificationDiv = document.createElement('div');
      notificationDiv.id = 'game-notification';
      notificationDiv.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10002;
        font-weight: bold;
        opacity: 0;
        transition: opacity 0.3s;
        max-width: 400px;
        text-align: center;
      `;
      document.body.appendChild(notificationDiv);
    }

    // Set background color based on notification type
    const colors = {
      success: '#27ae60',
      damage: '#e74c3c',
      warning: '#f39c12',
      info: '#3498db'
    };

    notificationDiv.style.background = colors[type] || colors.success;
    notificationDiv.textContent = message;
    notificationDiv.style.opacity = '1';

    // Auto-hide after different durations based on type
    const durations = {
      success: 3000,
      damage: 4000,  // Damage notifications stay longer
      warning: 3500,
      info: 3000
    };

    setTimeout(() => {
      notificationDiv.style.opacity = '0';
    }, durations[type] || 3000);
  }

  initPerformanceMonitoring() {
    this.createPerformanceDisplay();

    this.framework.onPerformanceUpdate((metrics) => {
      this.updatePerformanceDisplay(metrics);
      
      if (metrics.fps < 55) {
        console.warn(`Low FPS detected: ${metrics.fps}`);
      }
      
      if (metrics.frameDropPercentage > 5) {
        console.warn(`High frame drop rate: ${metrics.frameDropPercentage.toFixed(2)}%`);
      }
    });

    this.monitorDOMPerformance();
  }

  createPerformanceDisplay() {
    const perfDisplay = document.createElement('div');
    perfDisplay.id = 'performance-display';
    perfDisplay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      z-index: 10000;
      display: none;
      min-width: 200px;
      backdrop-filter: blur(5px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    document.body.appendChild(perfDisplay);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        const display = document.getElementById('performance-display');
        display.style.display = display.style.display === 'none' ? 'block' : 'none';
      }
    });
  }

  updatePerformanceDisplay(metrics) {
    const perfDisplay = document.getElementById('performance-display');
    if (perfDisplay && perfDisplay.style.display !== 'none') {
      const fpsColor = metrics.fps >= 58 ? '#00ff00' : metrics.fps >= 45 ? '#ffff00' : '#ff0000';
      const frameDropColor = metrics.frameDropPercentage < 1 ? '#00ff00' : 
                           metrics.frameDropPercentage < 5 ? '#ffff00' : '#ff0000';
      
      perfDisplay.innerHTML = `
        <div style="color: ${fpsColor}; font-weight: bold; margin-bottom: 5px;">
          FPS: ${metrics.fps}
        </div>
        <div>Frame Time: ${metrics.frameTime.toFixed(2)}ms</div>
        <div>Avg Frame: ${metrics.averageFrameTime.toFixed(2)}ms</div>
        <div>Min Frame: ${metrics.minFrameTime.toFixed(2)}ms</div>
        <div>Max Frame: ${metrics.maxFrameTime.toFixed(2)}ms</div>
        <div>Render Time: ${metrics.renderTime.toFixed(2)}ms</div>
        <div>Update Time: ${metrics.updateTime.toFixed(2)}ms</div>
        <div style="color: ${frameDropColor};">
          Dropped: ${metrics.droppedFrames} (${metrics.frameDropPercentage.toFixed(2)}%)
        </div>
        <div>Total Frames: ${metrics.totalFrames}</div>
        <div style="margin-top: 5px; font-size: 10px; color: #aaa;">
          Press F12 to toggle
        </div>
      `;
    }
  }

  monitorDOMPerformance() {
    let lastScrollTop = 0;
    let layoutCount = 0;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          layoutCount++;
          if (layoutCount > 10) {
            console.warn('Potential layout thrashing detected');
            layoutCount = 0;
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  setupEventHandlers() {
    const form = document.getElementById('nickname-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nicknameInput = document.getElementById('nickname-input');
        const nickname = nicknameInput.value.trim();
        
        if (nickname.length < 2) {
          this.showError('Nickname must be at least 2 characters long');
          return;
        }
        
        if (nickname.length > 20) {
          this.showError('Nickname must be less than 20 characters');
          return;
        }
        
        this.joinGame(nickname);
      });
    }
  }

  showError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 5000);
    }
  }

  joinGame(nickname) {
    console.log('=== JOIN GAME PROCESS STARTED ===');
    console.log('Nickname:', nickname);

    const submitButton = document.querySelector('#nickname-form button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Joining...';
    submitButton.disabled = true;

    this.nickname = nickname;
    console.log('Nickname stored:', this.nickname);

    // Check WebSocket connection
    if (!this.wsConnected) {
      console.error('WebSocket not connected');
      this.showError('Not connected to server. Please wait...');
      this.resetJoinButton();
      return;
    }

    console.log('WebSocket connected, sending join request...');

    // Send join request via WebSocket
    const success = this.sendWebSocketMessage({
      type: 'join',
      nickname: nickname
    });

    console.log('Join request sent:', success);

    if (!success) {
      console.error('Failed to send join request');
      this.showError('Failed to send join request');
      this.resetJoinButton();
    }
  }

  // Helper method to reset join button
  resetJoinButton() {
    const submitButton = document.querySelector('#nickname-form button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = 'Join Game';
      submitButton.disabled = false;
    }
  }

  // ✅ FIX: Improved state management for waiting room detection
  isInWaitingRoom() {
    // First check our internal state flag
    if (!this.waitingScreenReady) {
      console.log('isInWaitingRoom: waiting screen not ready yet');
      return false;
    }

    const waitingScreen = document.querySelector('.waiting-screen');
    if (!waitingScreen) {
      console.log('isInWaitingRoom: no waiting screen element found');
      return false;
    }

    // Check if the waiting screen is visible (not hidden)
    const computedStyle = window.getComputedStyle(waitingScreen);
    const isVisible = computedStyle.display !== 'none' && waitingScreen.offsetParent !== null;

    console.log('isInWaitingRoom check:', {
      waitingScreenReady: this.waitingScreenReady,
      exists: !!waitingScreen,
      display: computedStyle.display,
      offsetParent: !!waitingScreen.offsetParent,
      isVisible: isVisible
    });

    return isVisible;
  }

  startOptimizedGameLoop() {
    console.log('Starting optimized game loop');
    // CRITICAL: Start framework game loop with optimized callback
    this.framework.startGameLoop((deltaTime, currentTime) => {
      this.gameUpdate(deltaTime, currentTime);
    });
  }

  gameUpdate(deltaTime, currentTime) {
    try {
      // ✅ NEW: Performance-aware animation quality adjustment
      this.checkAndAdjustAnimationQuality(currentTime);

      // ✅ CRITICAL: Continuous real-time updates for UI elements
      // Update UI elements that need frequent updates
      if (currentTime - this.lastRenderTime >= this.renderThrottle) {
        // Always update timers and stats for real-time display
        this.updateTimer();
        this.updatePlayerStats();

        // Update game map if we have a valid game state and are in game
        if (this.gameState && this.gameState.map && document.getElementById('game-map')) {
          this.updateGameMapOptimized(); // CRITICAL: Use optimized map update
        }

        // Update waiting room elements if in waiting room
        if (this.isInWaitingRoom()) {
          // Refresh waiting room display periodically for real-time updates
          this.updateWaitingScreen();
        }

        this.lastRenderTime = currentTime;
      }

      // Send periodic ping to maintain connection health
      if (currentTime % 30000 < this.renderThrottle) { // Every 30 seconds
        this.sendWebSocketMessage({ type: 'ping', timestamp: currentTime });
      }

    } catch (error) {
      console.error('Game update error:', error);
      console.error('Error stack:', error.stack);
      console.error('Game state:', this.gameState);
      console.error('Player ID:', this.playerId);
    }
  }

  // REMOVED: fetchGameState() - now handled by WebSocket events

  handleGameStateChange(previousState, newState) {
    if (newState.gameEnded && (!previousState || !previousState.gameEnded)) {
      this.showGameEndScreen();
      return;
    }
    
    if (newState.gameStarted && (!previousState || !previousState.gameStarted)) {
      this.showGameScreen();
      return;
    }
    
    if (newState.gameStarted) {
      // Game is running - minimal updates only
      this.updateGameScreen(previousState, newState);
    } else {
      this.updateWaitingScreen();
    }
  }

  showWaitingScreen() {
    console.log('=== SHOWING WAITING SCREEN STARTED ===');
    console.log('Game state exists:', !!this.gameState);
    console.log('Game state:', this.gameState);
    console.log('Player ID:', this.playerId);
    console.log('Current waitingScreenReady:', this.waitingScreenReady);

    // ✅ FIX: Reset state flag when starting to show waiting screen
    this.waitingScreenReady = false;
    console.log('Set waitingScreenReady to false');

    if (!this.gameState) {
      console.error('Cannot show waiting screen: gameState is null');
      return;
    }

    console.log('Looking for app element...');
    const app = this.cachedElements.app || document.getElementById('app');
    console.log('App element found:', !!app);
    console.log('App element:', app);

    if (!app) {
      console.error('App element not found!');
      return;
    }

    const playerCount = Object.keys(this.gameState.players).length;
    console.log('Player count:', playerCount);
    console.log('Players:', Object.values(this.gameState.players).map(p => p.nickname));
    
    // CRITICAL: Use template literals efficiently and batch DOM update
    const waitingScreenHTML = `
      <div class="waiting-screen">
        <h1>Waiting for Game to Start</h1>
        <div class="waiting-content">
          <div class="player-info">
            <p id="player-count">Players: ${playerCount}/4</p>
            <div class="players-list" id="players-list">
              ${Object.values(this.gameState.players).map(player =>
                `<div class="player-item">${player.nickname}</div>`
              ).join('')}
            </div>
          </div>
          <div class="chat-container">
            <h3>Chat</h3>
            <div class="chat-messages" id="chat-messages">
              ${this.chatMessages.map(msg => `
                <div class="chat-message">
                  <span class="chat-nickname">${msg.nickname}:</span>
                  <span class="chat-text">${msg.message}</span>
                </div>
              `).join('')}
            </div>
            <div class="chat-input-container">
              <input type="text" id="chat-input" placeholder="Type a message..." maxlength="100">
              <button id="chat-send">Send</button>
            </div>
          </div>
        </div>
        <div class="waiting-timer" id="waiting-timer-container" style="display: none;">
          <h3 id="waiting-timer-text">Waiting for more players: 20s</h3>
          <p>Game will start automatically when timer expires or 4 players join</p>
        </div>
        <div class="countdown" id="countdown-container" style="display: none;">
          <h2 id="countdown-text">Game starting in: 10</h2>
          <p>Get ready!</p>
        </div>
      </div>
    `;

    // ✅ FIX: Properly sequence DOM updates to prevent timing issues
    console.log('About to update DOM with waiting screen HTML');
    console.log('HTML length:', waitingScreenHTML.length);

    requestAnimationFrame(() => {
      console.log('=== FIRST ANIMATION FRAME ===');
      console.log('Updating DOM with waiting screen');
      console.log('App element before update:', app);

      app.innerHTML = waitingScreenHTML;
      console.log('DOM innerHTML updated');
      console.log('App element after update:', app);

      console.log('Setting up chat handlers...');
      this.setupChatHandlers();
      console.log('Chat handlers setup completed');

      // ✅ FIX: Ensure DOM is fully rendered before any updates
      requestAnimationFrame(() => {
        console.log('=== SECOND ANIMATION FRAME ===');
        console.log('DOM should be fully rendered now');

        // Check if waiting screen elements exist
        const waitingScreen = document.querySelector('.waiting-screen');
        const playerCount = document.getElementById('player-count');
        const playersList = document.getElementById('players-list');

        console.log('Waiting screen element exists:', !!waitingScreen);
        console.log('Player count element exists:', !!playerCount);
        console.log('Players list element exists:', !!playersList);

        // Mark that the waiting screen is now ready for updates
        this.waitingScreenReady = true;
        console.log('Set waitingScreenReady to true');

        // Force an immediate update now that DOM is ready
        console.log('Calling updateWaitingScreen...');
        this.updateWaitingScreen();
        console.log('updateWaitingScreen completed');

        console.log('=== WAITING SCREEN SETUP COMPLETE ===');
      });
    });
  }

  updateWaitingScreen() {
    if (!this.gameState) {
      console.warn('Cannot update waiting screen: no game state');
      return;
    }

    // ✅ FIX: Don't update if waiting screen isn't ready yet
    if (!this.waitingScreenReady) {
      console.log('Waiting screen not ready yet, skipping update');
      return;
    }

    console.log('Updating waiting screen with players:', Object.keys(this.gameState.players));

    // CRITICAL: Use efficient DOM updates instead of innerHTML
    const playerCountElement = document.getElementById('player-count');
    const playersListElement = document.getElementById('players-list');
    const waitingTimerContainer = document.getElementById('waiting-timer-container');
    const waitingTimerText = document.getElementById('waiting-timer-text');
    const countdownContainer = document.getElementById('countdown-container');
    const countdownText = document.getElementById('countdown-text');

    console.log('DOM elements found:', {
      playerCountElement: !!playerCountElement,
      playersListElement: !!playersListElement
    });

    if (playerCountElement && playersListElement) {
      const playerCount = Object.keys(this.gameState.players).length;

      const newCountText = `Players: ${playerCount}/4`;
      console.log(`Current player count text: "${playerCountElement.textContent}", new: "${newCountText}"`);
      if (playerCountElement.textContent !== newCountText) {
        console.log(`Updating player count: ${newCountText}`);
        playerCountElement.textContent = newCountText;
      }

      const newPlayersHTML = Object.values(this.gameState.players).map(player =>
        `<div class="player-item">${player.nickname}</div>`
      ).join('');

      console.log(`Current players HTML length: ${playersListElement.innerHTML.length}, new length: ${newPlayersHTML.length}`);
      if (playersListElement.innerHTML !== newPlayersHTML) {
        console.log('Updating players list:', Object.values(this.gameState.players).map(p => p.nickname));
        playersListElement.innerHTML = newPlayersHTML;
      }
    } else {
      console.warn('Missing DOM elements for waiting screen update:', {
        playerCountElement: !!playerCountElement,
        playersListElement: !!playersListElement
      });

      // Show waiting timer if active
      if (this.gameState.waitingTimeLeft > 0 && this.gameState.waitingTimeLeft < 20 && waitingTimerContainer && waitingTimerText) {
        waitingTimerContainer.style.display = 'block';
        const newWaitingText = `Waiting for more players: ${this.gameState.waitingTimeLeft}s`;
        if (waitingTimerText.textContent !== newWaitingText) {
          waitingTimerText.textContent = newWaitingText;
        }
      } else if (waitingTimerContainer) {
        waitingTimerContainer.style.display = 'none';
      }

      // Show countdown if active
      if (this.gameState.countdown > 0 && countdownContainer && countdownText) {
        countdownContainer.style.display = 'block';
        if (waitingTimerContainer) {
          waitingTimerContainer.style.display = 'none'; // Hide waiting timer when countdown starts
        }
        const newCountdownText = `Game starting in: ${this.gameState.countdown}`;
        if (countdownText.textContent !== newCountdownText) {
          countdownText.textContent = newCountdownText;
        }
      }
    }
  }

  showGameScreen() {
    if (!this.gameState || !this.gameState.map || !this.gameState.players) {
      console.error('Cannot show game screen: invalid gameState', this.gameState);
      this.showError('Game state not available');
      return;
    }

    if (!this.playerId) {
      console.error('Cannot show game screen: no player ID');
      this.showError('Player ID not set - please rejoin');
      this.returnToLobby();
      return;
    }

    const app = this.cachedElements.app || document.getElementById('app');
    const player = this.gameState.players[this.playerId];

    if (!player) {
      console.error('Player not found in game state:', this.playerId);
      console.log('Available players:', Object.keys(this.gameState.players));
      this.showError('Player not found in game - please rejoin');
      this.returnToLobby();
      return;
    }
    
    const gameScreenHTML = `
      <div class="game-screen">
        <div class="game-timer">
          <div class="timer-display" id="timer-display">
            <span class="timer-label">Time Left:</span>
            <span class="timer-value" id="timer-value">${this.formatTime(this.gameState.gameTimeLeft || 60)}</span>
          </div>
        </div>
        <div class="game-ui">
          <div class="player-stats">
            <span>${player.nickname || 'Player'}</span>
            <span>Lives: <span id="player-lives">${player.lives || 0}</span></span>
            <span>Bombs: <span id="player-bombs">${player.powerUps?.bombs || 1}</span></span>
          </div>
          <div class="controls-info">
            <p>Controls: Arrow keys or WASD to move, Space/Enter to place bomb</p>
            <p>Press F12 to toggle performance monitor</p>
          </div>
        </div>
        <div class="game-content">
          <div class="game-chat-container">
            <h4>Chat</h4>
            <div class="game-chat-messages" id="game-chat-messages">
              ${this.chatMessages.map(msg => `
                <div class="chat-message">
                  <span class="chat-nickname">${msg.nickname}:</span>
                  <span class="chat-text">${msg.message}</span>
                </div>
              `).join('')}
            </div>
            <div class="game-chat-input-container">
              <input type="text" id="game-chat-input" placeholder="Type message..." maxlength="100">
              <button id="game-chat-send">Send</button>
            </div>
          </div>
          <div class="game-map" id="game-map">
            ${this.renderGameMap()}
          </div>
        </div>
      </div>
    `;

    // Batch DOM update
    requestAnimationFrame(() => {
      app.innerHTML = gameScreenHTML;
      this.setupGameControls();
      this.setupGameChatHandlers();
    });
  }

  updateGameScreen(previousState, newState) {
    // Update only changed elements to minimize DOM manipulation
    this.updateTimer();
    this.updatePlayerStats();
    this.updateGameMap();
  }

  // ✅ OPTIMIZED: Use cached elements for player stats updates
  updatePlayerStats(forceUpdate = false) {
    const player = this.gameState.players[this.playerId];
    if (!player) return;

    // Use framework's selective updating for better performance
    // ✅ FIX: Use forceUpdate when we know player data has changed (e.g., damage, power-ups)
    this.framework.updateElement('player-lives', (livesElement) => {
      livesElement.textContent = player.alive ? player.lives : 0;
    }, forceUpdate);

    this.framework.updateElement('player-bombs', (bombsElement) => {
      bombsElement.textContent = player.powerUps?.bombs || 1;
    }, forceUpdate);

    // ✅ POWER-UP SYSTEM: Enhanced stats display with caching
    this.framework.updateElement('player-flames', (flamesElement) => {
      if (flamesElement) {
        flamesElement.textContent = player.powerUps?.flames || 1;
      }
    }, forceUpdate);

    this.framework.updateElement('player-speed', (speedElement) => {
      if (speedElement) {
        speedElement.textContent = player.powerUps?.speed || 1;
      }
    }, forceUpdate);

    // ✅ NEW: Movement checker performance stats (visible in debug mode)
    if (window.location.hash.includes('debug') || window.localStorage.getItem('showPerformanceStats') === 'true') {
      this.updateMovementCheckerStats();
    }
  }

  // ✅ NEW: Update movement checker performance display
  updateMovementCheckerStats() {
    const stats = this.getMovementCheckerStats();
    
    // Create or update performance stats container
    let perfContainer = document.getElementById('movement-perf-stats');
    if (!perfContainer) {
      perfContainer = document.createElement('div');
      perfContainer.id = 'movement-perf-stats';
      perfContainer.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-size: 12px;
        font-family: monospace;
        z-index: 10000;
        max-width: 250px;
      `;
      document.body.appendChild(perfContainer);
    }

    perfContainer.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px;">🎮 Movement Checker Stats</div>
      <div>Skipped (Invalid): ${stats.skippedRendersInvalidMove}</div>
      <div>Skipped (No Change): ${stats.skippedRendersNoChange}</div>
      <div>Total Optimizations: ${stats.skippedRendersInvalidMove + stats.skippedRendersNoChange}</div>
      <div>Last Invalid: ${stats.lastInvalidMoveTime ? stats.lastInvalidMoveTime + 'ms ago' : 'None'}</div>
      <div style="margin-top: 5px; font-size: 10px; opacity: 0.7;">
        Add #debug to URL or set localStorage.showPerformanceStats=true to show
      </div>
    `;
  }

  renderGameMap() {
    if (!this.gameState || !this.gameState.map || !this.gameState.players) {
      console.error('Cannot render game map: invalid gameState', this.gameState);
      return '<div>Loading game map...</div>';
    }

    const map = this.gameState.map;
    const players = this.gameState.players;
    const bombs = this.gameState.bombs || [];
    const powerUps = this.gameState.powerUps || []; // ✅ POWER-UP SYSTEM: Include power-ups

    return map.map((row, y) =>
      row.map((cell, x) => {
        const playersAtPosition = Object.values(players).filter(p => p.x === x && p.y === y && p.alive);
        const bombsAtPosition = bombs.filter(b => b.x === x && b.y === y);
        const powerUpsAtPosition = powerUps.filter(p => p.x === x && p.y === y); // ✅ POWER-UP SYSTEM

        return `
          <div class="cell ${cell}" data-x="${x}" data-y="${y}">
            ${powerUpsAtPosition.map(powerUp =>
              `<div class="powerup powerup-${powerUp.type}" data-powerup-id="${powerUp.id}">
                ${this.getPowerUpEmoji(powerUp.type)}
              </div>`
            ).join('')}
            ${bombsAtPosition.map(bomb =>
              `<div class="bomb">💣</div>`
            ).join('')}
            ${playersAtPosition.map((player, index) => {
              const playerKeys = Object.keys(players);
              const playerIndex = playerKeys.indexOf(player.id);
              return `<div class="player player-${playerIndex}">${player.nickname.charAt(0).toUpperCase()}</div>`;
            }).join('')}
          </div>
        `;
      }).join('')
    ).join('');
  }

  // ✅ POWER-UP SYSTEM: Get emoji for power-up type
  getPowerUpEmoji(powerUpType) {
    const powerUpEmojis = {
      bombs: '💣',   // Bombs power-up
      flames: '🔥',  // Flames power-up
      speed: '⚡'    // Speed power-up
    };
    return powerUpEmojis[powerUpType] || '💎'; // Default to gem if unknown type
  }

  updateGameMap() {
    const gameMapElement = document.getElementById('game-map');
    if (gameMapElement && this.gameState) {
      gameMapElement.innerHTML = this.renderGameMap();
    }
  }

  // ✅ ENHANCED: Selective rendering with movement-aware optimization
  updateGameMapOptimized() {
    if (!this.gameState || !this.gameState.map) return;

    const gameMapElement = this.framework.getCachedElement('game-map') ||
                          this.framework.cacheElement('game-map', document.getElementById('game-map'));

    if (!gameMapElement) return;

    // ✅ FPS OPTIMIZATION: Skip rendering if no meaningful changes occurred
    if (this.shouldSkipRendering()) {
      console.log('Skipping rendering - no significant changes detected');
      return;
    }

    // Use framework's selective rendering for optimal performance
    this.updateGameMapSelective();
  }

  // ✅ NEW: Intelligent rendering skip detection
  shouldSkipRendering() {
    // Skip if there's been a recent invalid movement attempt
    if (this.lastInvalidMoveTime && (Date.now() - this.lastInvalidMoveTime) < 50) {
      this.framework.incrementCounter('skipped-renders-invalid-move');
      return true;
    }

    // Skip if no players are currently moving and no dynamic entities changed
    const currentPlayerPositions = Object.values(this.gameState.players || {})
      .filter(p => p.alive)
      .map(p => `${p.x}-${p.y}`).join(',');
    
    const currentBombCount = (this.gameState.bombs || []).length;
    const currentPowerUpCount = (this.gameState.powerUps || []).length;

    const stateSignature = `${currentPlayerPositions}-${currentBombCount}-${currentPowerUpCount}`;
    
    if (this.lastRenderStateSignature === stateSignature) {
      this.framework.incrementCounter('skipped-renders-no-change');
      return true;
    }

    this.lastRenderStateSignature = stateSignature;
    return false;
  }

  // ✅ NEW: Movement checker performance stats
  getMovementCheckerStats() {
    return {
      skippedRendersInvalidMove: this.framework.getCounter('skipped-renders-invalid-move') || 0,
      skippedRendersNoChange: this.framework.getCounter('skipped-renders-no-change') || 0,
      lastInvalidMoveTime: this.lastInvalidMoveTime ? Date.now() - this.lastInvalidMoveTime : null,
      cachedInvalidMove: this.lastInvalidMove
    };
  }

  // ✅ NEW: Toggle performance stats display
  togglePerformanceStats() {
    const current = window.localStorage.getItem('showPerformanceStats') === 'true';
    window.localStorage.setItem('showPerformanceStats', (!current).toString());
    
    if (!current) {
      console.log('🎮 Movement checker performance stats enabled');
      this.updateMovementCheckerStats();
    } else {
      console.log('🎮 Movement checker performance stats disabled');
      const perfContainer = document.getElementById('movement-perf-stats');
      if (perfContainer) {
        perfContainer.remove();
      }
    }
    
    return !current;
  }

  // ✅ NEW: Reset performance counters
  resetPerformanceCounters() {
    this.framework.resetCounter('skipped-renders-invalid-move');
    this.framework.resetCounter('skipped-renders-no-change');
    this.lastInvalidMoveTime = 0;
    this.lastInvalidMove = null;
    this.lastRenderStateSignature = '';
    console.log('🎮 Movement checker performance counters reset');
  }

  // ✅ NEW: Selective map rendering using framework capabilities
  updateGameMapSelective() {
    const map = this.gameState.map;
    const players = this.gameState.players;
    const bombs = this.gameState.bombs || [];
    const powerUps = this.gameState.powerUps || [];

    // Check which cells need updates
    this.identifyDirtyCells(map, players, bombs, powerUps);

    // Process dirty cells using framework's batch update system
    this.processDirtyCells(map, players, bombs, powerUps);
  }

  // ✅ NEW: Identify which map cells need re-rendering
  identifyDirtyCells(map, players, bombs, powerUps) {
    // Create current state snapshot
    const currentState = this.createMapStateSnapshot(map, players, bombs, powerUps);

    // Compare with last state to find changes
    if (this.lastGameMapState) {
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          const cellKey = `${x}-${y}`;
          const currentCellState = currentState.get(cellKey);
          const lastCellState = this.lastGameMapState.get(cellKey);

          if (!lastCellState || JSON.stringify(currentCellState) !== JSON.stringify(lastCellState)) {
            this.dirtyMapCells.add(cellKey);
            this.framework.markElementDirty(`cell-${cellKey}`, currentCellState);
          }
        }
      }
    } else {
      // First render - mark all cells as dirty
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          const cellKey = `${x}-${y}`;
          this.dirtyMapCells.add(cellKey);
          this.framework.markElementDirty(`cell-${cellKey}`, currentState.get(cellKey));
        }
      }
    }

    this.lastGameMapState = currentState;
  }

  // ✅ NEW: Create state snapshot for comparison
  createMapStateSnapshot(map, players, bombs, powerUps) {
    const snapshot = new Map();

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const cellKey = `${x}-${y}`;
        const playersAtPosition = Object.values(players).filter(p => p.x === x && p.y === y && p.alive);
        const bombsAtPosition = bombs.filter(b => b.x === x && b.y === y);
        const powerUpsAtPosition = powerUps.filter(p => p.x === x && p.y === y);

        snapshot.set(cellKey, {
          cellType: map[y][x],
          players: playersAtPosition.map(p => ({ id: p.id, nickname: p.nickname })),
          bombs: bombsAtPosition.map(b => ({ id: b.id })),
          powerUps: powerUpsAtPosition.map(p => ({ id: p.id, type: p.type }))
        });
      }
    }

    return snapshot;
  }

  // ✅ NEW: Process dirty cells with framework's selective rendering
  processDirtyCells(map, players, bombs, powerUps) {
    const gameMapElement = this.framework.getCachedElement('game-map');
    if (!gameMapElement) return;

    // Ensure game map has proper structure for selective updates
    this.ensureGameMapStructure(gameMapElement, map);

    // Update only dirty cells
    this.dirtyMapCells.forEach(cellKey => {
      const [x, y] = cellKey.split('-').map(Number);
      const cellData = this.lastGameMapState.get(cellKey);

      this.framework.updateElement(`cell-${cellKey}`, (cellElement) => {
        this.renderCellContent(cellElement, x, y, cellData, map, players, bombs, powerUps);
      });
    });

    // Clear dirty cells after processing
    this.dirtyMapCells.clear();
  }

  // ✅ NEW: Ensure game map has proper cell structure for selective updates
  ensureGameMapStructure(gameMapElement, map) {
    // Check if we need to create the initial structure
    if (gameMapElement.children.length === 0) {
      const mapHTML = map.map((row, y) =>
        row.map((cell, x) => {
          const cellElement = document.createElement('div');
          cellElement.className = `cell ${cell}`;
          cellElement.setAttribute('data-x', x);
          cellElement.setAttribute('data-y', y);
          cellElement.id = `cell-${x}-${y}`;

          // Cache the element in framework
          this.framework.cacheElement(`cell-${x}-${y}`, cellElement);

          return cellElement;
        })
      );

      // Flatten and append all cells
      mapHTML.flat().forEach(cellElement => {
        gameMapElement.appendChild(cellElement);
      });
    }
  }

  // ✅ NEW: Render individual cell content with hardware acceleration
  renderCellContent(cellElement, x, y, cellData, map, players, bombs, powerUps) {
    // Clear existing content
    cellElement.innerHTML = '';

    // Update cell class
    cellElement.className = `cell ${cellData.cellType}`;

    // Add power-ups with hardware acceleration
    cellData.powerUps.forEach(powerUpData => {
      const powerUpElement = this.createPowerUpElement(powerUpData);
      cellElement.appendChild(powerUpElement);
    });

    // Add bombs with hardware acceleration
    cellData.bombs.forEach(bombData => {
      const bombElement = this.createBombElement(bombData);
      cellElement.appendChild(bombElement);
    });

    // Add players with hardware acceleration
    cellData.players.forEach((playerData, index) => {
      const playerElement = this.createPlayerElement(playerData, index);
      cellElement.appendChild(playerElement);
    });
  }

  // ✅ NEW: Object pooling for power-up elements
  createPowerUpElement(powerUpData) {
    let powerUpElement = this.getPooledElement('powerUps');

    if (!powerUpElement) {
      powerUpElement = document.createElement('div');
      // ✅ PERFORMANCE: Add hardware acceleration
      powerUpElement.style.willChange = 'transform, opacity';
      powerUpElement.style.transform = 'translate3d(-50%, -50%, 0)';
    }

    powerUpElement.className = `powerup powerup-${powerUpData.type}`;
    powerUpElement.setAttribute('data-powerup-id', powerUpData.id);
    powerUpElement.textContent = this.getPowerUpEmoji(powerUpData.type);

    return powerUpElement;
  }

  // ✅ NEW: Object pooling for bomb elements
  createBombElement(bombData) {
    let bombElement = this.getPooledElement('bombs');

    if (!bombElement) {
      bombElement = document.createElement('div');
      // ✅ PERFORMANCE: Add hardware acceleration
      bombElement.style.willChange = 'transform, opacity';
      bombElement.style.transform = 'translate3d(-50%, -50%, 0)';
    }

    bombElement.className = 'bomb';
    bombElement.setAttribute('data-bomb-id', bombData.id);
    bombElement.textContent = '💣';

    return bombElement;
  }

  // ✅ NEW: Object pooling for player elements
  createPlayerElement(playerData, index) {
    let playerElement = this.getPooledElement('players');

    if (!playerElement) {
      playerElement = document.createElement('div');
      // ✅ PERFORMANCE: Add hardware acceleration for smooth movement
      playerElement.style.willChange = 'transform, opacity';
      playerElement.style.transform = 'translate3d(0, 0, 0)';
    }

    const playerKeys = Object.keys(this.gameState.players);
    const playerIndex = playerKeys.indexOf(playerData.id);

    playerElement.className = `player player-${playerIndex}`;
    playerElement.textContent = playerData.nickname.charAt(0).toUpperCase();

    return playerElement;
  }

  // ✅ NEW: Object pooling system
  getPooledElement(type) {
    if (this.entityPool[type] && this.entityPool[type].length > 0) {
      return this.entityPool[type].pop();
    }
    return null;
  }

  // ✅ NEW: Return element to pool for reuse
  returnToPool(element, type) {
    if (!this.entityPool[type]) {
      this.entityPool[type] = [];
    }

    // Reset element state
    element.className = '';
    element.removeAttribute('data-powerup-id');
    element.removeAttribute('data-bomb-id');
    element.removeAttribute('data-player-id');
    element.textContent = '';

    // Return to pool if not at capacity
    if (this.entityPool[type].length < 50) { // Limit pool size
      this.entityPool[type].push(element);
    }
  }

  // ✅ NEW: Clean up removed elements and return to pool
  cleanupRemovedElements() {
    // This method should be called when elements are removed from the DOM
    // to return them to the object pool for reuse
    const gameMapElement = this.framework.getCachedElement('game-map');
    if (!gameMapElement) return;

    // Find elements that are no longer needed and return to pool
    const unusedBombs = gameMapElement.querySelectorAll('.bomb:not([data-bomb-id])');
    const unusedPowerUps = gameMapElement.querySelectorAll('.powerup:not([data-powerup-id])');

    unusedBombs.forEach(element => {
      element.remove();
      this.returnToPool(element, 'bombs');
    });

    unusedPowerUps.forEach(element => {
      element.remove();
      this.returnToPool(element, 'powerUps');
    });
  }

  // ✅ NEW: Performance-aware animation quality system
  checkAndAdjustAnimationQuality(currentTime) {
    // Only check performance periodically to avoid overhead
    if (currentTime - this.lastPerformanceCheck < this.performanceCheckInterval) {
      return;
    }

    this.lastPerformanceCheck = currentTime;

    // Get current FPS from framework
    const metrics = this.framework.performanceMetrics;
    const currentFPS = metrics.fps || 60;

    // Determine appropriate animation quality based on FPS
    let newQuality = this.animationQuality;

    if (currentFPS >= this.fpsThresholds.high) {
      newQuality = 'high';
    } else if (currentFPS >= this.fpsThresholds.medium) {
      newQuality = 'medium';
    } else {
      newQuality = 'low';
    }

    // Apply quality changes if needed
    if (newQuality !== this.animationQuality) {
      console.log(`🎮 Animation quality changed: ${this.animationQuality} → ${newQuality} (FPS: ${currentFPS})`);
      this.animationQuality = newQuality;
      this.applyAnimationQuality(newQuality);
    }
  }

  // ✅ NEW: Apply animation quality settings
  applyAnimationQuality(quality) {
    const settings = this.animationSettings[quality];
    const gameMapElement = this.framework.getCachedElement('game-map');

    if (!gameMapElement) return;

    // Apply CSS custom properties for dynamic animation control
    const root = document.documentElement;
    root.style.setProperty('--explosion-duration', `${settings.explosionDuration}s`);
    root.style.setProperty('--powerup-pulse', settings.powerUpPulse ? 'running' : 'paused');
    root.style.setProperty('--bomb-pulse', settings.bombPulse ? 'running' : 'paused');

    // Toggle animation classes based on quality
    gameMapElement.classList.toggle('high-quality', quality === 'high');
    gameMapElement.classList.toggle('medium-quality', quality === 'medium');
    gameMapElement.classList.toggle('low-quality', quality === 'low');

    // Disable/enable transitions for player movement
    const players = gameMapElement.querySelectorAll('.player');
    players.forEach(player => {
      if (settings.playerTransitions) {
        player.style.transition = 'transform 0.1s ease';
      } else {
        player.style.transition = 'none';
      }
    });
  }

  // ✅ NEW: Get current animation settings
  getCurrentAnimationSettings() {
    return this.animationSettings[this.animationQuality];
  }

  // ✅ NEW: Check if specific animation should be enabled
  shouldUseAnimation(animationType) {
    const settings = this.getCurrentAnimationSettings();
    return settings[animationType] !== false;
  }

  setupGameControls() {
    // Remove any existing event listeners
    if (this.gameKeyHandler) {
      document.removeEventListener('keydown', this.gameKeyHandler);
    }
    
    // Create bound handler
    this.gameKeyHandler = (e) => {
      if (this.gameState?.gameStarted && !this.isMoving) {
        this.handleGameInput(e);
      }
    };

    document.addEventListener('keydown', this.gameKeyHandler);
  }

  handleGameInput(e) {
    const player = this.gameState?.players[this.playerId];
    if (!player || !player.alive) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        this.movePlayer('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        this.movePlayer('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        this.movePlayer('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        this.movePlayer('right');
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        this.placeBomb();
        break;
    }
  }

  movePlayer(direction) {
    if (this.isMoving) return; // Prevent multiple simultaneous moves

    // ✅ ENHANCED: Pre-validate movement with rendering optimization
    const moveValidation = this.validateClientMoveWithRenderCheck(direction);
    if (!moveValidation.isValid) {
      console.log(`Move ${direction} blocked: ${moveValidation.reason}`);
      
      // ✅ FPS OPTIMIZATION: Track invalid move for rendering skip
      this.lastInvalidMoveTime = Date.now();
      
      // ✅ FPS OPTIMIZATION: Skip all rendering operations for invalid moves
      // No network request, no rendering update, no state change
      return;
    }

    this.isMoving = true;

    console.log(`Attempting to move ${direction} for player ${this.playerId}`);

    // Send move request via WebSocket
    const success = this.sendWebSocketMessage({
      type: 'move',
      direction: direction
    });

    if (!success) {
      console.error('Failed to send move request');
    }

    // Allow next move after a short delay
    setTimeout(() => {
      this.isMoving = false;
    }, 100);
  }

  // ✅ ENHANCED: Movement validation with detailed feedback for rendering optimization
  validateClientMoveWithRenderCheck(direction) {
    const player = this.gameState?.players[this.playerId];
    
    // ✅ OPTIMIZATION: Check for repeated invalid moves in the same direction
    const moveKey = `${player?.x}-${player?.y}-${direction}`;
    if (this.lastInvalidMove === moveKey && (Date.now() - this.lastInvalidMoveTime) < 100) {
      return { isValid: false, reason: 'Repeated invalid move - cached result' };
    }
    
    // Basic validation checks
    if (!player) {
      return { isValid: false, reason: 'No player found' };
    }
    
    if (!player.alive) {
      return { isValid: false, reason: 'Player is not alive' };
    }
    
    if (!this.gameState?.gameStarted) {
      return { isValid: false, reason: 'Game not started' };
    }
    
    if (this.gameState?.gameEnded) {
      return { isValid: false, reason: 'Game has ended' };
    }

    let newX = player.x;
    let newY = player.y;

    // Calculate new position
    switch (direction) {
      case 'up':
        newY = Math.max(0, player.y - 1);
        break;
      case 'down':
        newY = Math.min(11, player.y + 1);
        break;
      case 'left':
        newX = Math.max(0, player.x - 1);
        break;
      case 'right':
        newX = Math.min(11, player.x + 1);
        break;
      default:
        return { isValid: false, reason: 'Invalid direction' };
    }

    // Check if position actually changed (hitting boundary)
    if (newX === player.x && newY === player.y) {
      this.lastInvalidMove = moveKey;
      return { isValid: false, reason: 'Boundary collision - no movement needed' };
    }

    // Check if new position is valid (not wall or block)
    if (!this.gameState.map[newY] || this.gameState.map[newY][newX] !== 'empty') {
      const cellType = this.gameState.map[newY]?.[newX] || 'out-of-bounds';
      this.lastInvalidMove = moveKey;
      return { isValid: false, reason: `Terrain collision - ${cellType}` };
    }

    // Check for bomb collision
    const bombAtPosition = this.gameState.bombs.find(bomb => bomb.x === newX && bomb.y === newY);
    if (bombAtPosition) {
      this.lastInvalidMove = moveKey;
      return { isValid: false, reason: 'Bomb collision' };
    }

    // Check for other players at the same position
    const playerAtPosition = Object.values(this.gameState.players).find(
      p => p.id !== this.playerId && p.alive && p.x === newX && p.y === newY
    );
    if (playerAtPosition) {
      this.lastInvalidMove = moveKey;
      return { isValid: false, reason: `Player collision - ${playerAtPosition.nickname}` };
    }

    // Clear invalid move cache on successful validation
    this.lastInvalidMove = null;
    return { isValid: true, reason: 'Valid move', newPosition: { x: newX, y: newY } };
  }

  // ✅ PERFORMANCE: Client-side movement validation to prevent unnecessary requests
  validateClientMove(direction) {
    const player = this.gameState?.players[this.playerId];
    if (!player || !player.alive || !this.gameState?.gameStarted || this.gameState?.gameEnded) {
      return false;
    }

    let newX = player.x;
    let newY = player.y;

    // Calculate new position
    switch (direction) {
      case 'up':
        newY = Math.max(0, player.y - 1);
        break;
      case 'down':
        newY = Math.min(11, player.y + 1);
        break;
      case 'left':
        newX = Math.max(0, player.x - 1);
        break;
      case 'right':
        newX = Math.min(11, player.x + 1);
        break;
      default:
        return false;
    }

    // Check if position actually changed (hitting boundary)
    if (newX === player.x && newY === player.y) {
      return false;
    }

    // Check if new position is valid (not wall or block)
    if (!this.gameState.map[newY] || this.gameState.map[newY][newX] !== 'empty') {
      return false;
    }

    // Check for bomb collision
    const bombAtPosition = this.gameState.bombs.find(bomb => bomb.x === newX && bomb.y === newY);
    if (bombAtPosition) {
      return false;
    }

    // Check for other players at the same position
    const playerAtPosition = Object.values(this.gameState.players).find(
      p => p.id !== this.playerId && p.alive && p.x === newX && p.y === newY
    );
    if (playerAtPosition) {
      return false;
    }

    return true;
  }

  placeBomb() {
    console.log('Attempting to place bomb for player', this.playerId);

    // Send bomb placement request via WebSocket
    const success = this.sendWebSocketMessage({
      type: 'bomb'
    });

    if (!success) {
      console.error('Failed to send bomb placement request');
    }
  }

  // Event handlers for WebSocket game events
  updateCountdown(countdown) {
    const countdownText = document.getElementById('countdown-text');
    const countdownContainer = document.getElementById('countdown-container');
    const waitingTimerContainer = document.getElementById('waiting-timer-container');

    if (countdownText && countdownContainer) {
      countdownText.textContent = `Game starting in: ${countdown}`;
      countdownContainer.style.display = 'block';

      // Hide waiting timer when countdown starts
      if (waitingTimerContainer) {
        waitingTimerContainer.style.display = 'none';
      }
    }
  }

  updateWaitingTimer(waitingTimeLeft) {
    const waitingTimerText = document.getElementById('waiting-timer-text');
    const waitingTimerContainer = document.getElementById('waiting-timer-container');

    if (waitingTimerText && waitingTimerContainer) {
      waitingTimerText.textContent = `Waiting for more players: ${waitingTimeLeft}s`;
      waitingTimerContainer.style.display = 'block';
    }
  }

  handlePlayerJoined(eventData) {
    console.log('=== HANDLE PLAYER JOINED EVENT ===');
    console.log(`Player joined: ${eventData.nickname} (${eventData.playerCount} total players)`);
    console.log('Event data:', eventData);
    console.log('Current player ID:', this.playerId);
    console.log('Current game state player count:', this.gameState ? Object.keys(this.gameState.players).length : 'no game state');

    // Force update waiting screen if we're in it
    const inWaitingRoom = this.isInWaitingRoom();
    console.log('Am I in waiting room?', inWaitingRoom);

    if (inWaitingRoom) {
      console.log('Forcing waiting room update due to player join');
      this.updateWaitingScreen();

      // Fallback: If DOM elements are missing, refresh the entire waiting screen
      setTimeout(() => {
        const playerCountElement = document.getElementById('player-count');
        console.log('Fallback check - player count element exists:', !!playerCountElement);
        if (!playerCountElement && this.isInWaitingRoom()) {
          console.log('DOM elements missing, refreshing entire waiting screen');
          this.showWaitingScreen();
        }
      }, 50);
    } else {
      console.log('Not in waiting room, skipping update');
    }

    // Show notification (optional)
    console.log('Showing notification...');
    this.showNotification(`${eventData.nickname} joined the game!`);
    console.log('=== HANDLE PLAYER JOINED COMPLETED ===');
  }

  handlePlayerLeft(eventData) {
    console.log(`Player left: ${eventData.nickname} (${eventData.playerCount} total players)`);

    // Force update waiting screen if we're in it
    if (this.isInWaitingRoom()) {
      console.log('Forcing waiting room update due to player leave');
      this.updateWaitingScreen();
    }

    // Show notification (optional)
    this.showNotification(`${eventData.nickname} left the game`);
  }

  // ✅ CRITICAL: Handle bomb explosion events from server with chain reaction support
  handleBombExplosion(eventData) {
    console.log('🔥 Bomb explosion received:', eventData);
    console.log('Chain reaction depth:', eventData.chainReactionDepth || 0);

    // ✅ NEW: Handle chain reaction explosions with proper sequencing
    const chainDepth = eventData.chainReactionDepth || 0;
    const isChainReaction = chainDepth > 0;

    if (isChainReaction) {
      console.log(`🔗 Chain reaction explosion at depth ${chainDepth}`);
    }

    // Show explosion animation/effects with chain reaction awareness
    this.showExplosionEffect(eventData.position, eventData.explosions, eventData.range, chainDepth);

    // Play explosion sound (if implemented)
    // this.playExplosionSound();

    // The game state will be updated via game_state_update message
  }

  // ✅ ENHANCED: Show explosion visual effects with animation and chain reaction support
  showExplosionEffect(position, explosions, range = 1, chainDepth = 0) {
    console.log(`💥 SHOWING EXPLOSION at (${position.x}, ${position.y}) with ${explosions.length} cells - Chain depth: ${chainDepth}`);

    const gameMap = document.getElementById('game-map');
    if (!gameMap) {
      console.error('❌ Game map element not found for explosion animation');
      return;
    }

    console.log('✅ Game map found:', gameMap);
    console.log('📍 Explosion cells:', explosions);

    // ✅ NEW: Create explosion animations with chain reaction awareness
    explosions.forEach((cell, index) => {
      const type = index === 0 ? 'center' : 'blast';
      console.log(`🎆 Creating ${type} explosion at (${cell.x}, ${cell.y}) - Chain depth: ${chainDepth}`);

      // Add slight delay for chain reactions to create visual sequence
      const delay = chainDepth > 0 ? chainDepth * 50 : 0; // 50ms delay per chain level

      setTimeout(() => {
        this.createExplosionAnimation(cell.x, cell.y, type, chainDepth);
      }, delay);
    });

    // ✅ NEW: Improved cleanup - don't clean up immediately for chain reactions
    // Let each explosion manage its own cleanup to avoid conflicts
    const cleanupDelay = 1500 + (chainDepth * 100); // Longer cleanup for chain reactions
    setTimeout(() => {
      console.log(`🧹 Cleaning up explosion animations for chain depth ${chainDepth}`);
      this.cleanupExplosionAnimations();
    }, cleanupDelay);
  }

  // ✅ NEW: Create individual explosion animation for a cell with chain reaction support
  createExplosionAnimation(x, y, type = 'blast', chainDepth = 0) {
    console.log(`🎯 Creating ${type} explosion animation at (${x}, ${y}) - Chain depth: ${chainDepth}`);

    const gameMap = document.getElementById('game-map');
    if (!gameMap) {
      console.error('❌ Game map not found in createExplosionAnimation');
      return;
    }

    // Find the cell element
    const cellSelector = `[data-x="${x}"][data-y="${y}"]`;
    console.log(`🔍 Looking for cell with selector: ${cellSelector}`);

    const cellElement = gameMap.querySelector(cellSelector);
    if (!cellElement) {
      console.error(`❌ Cell element not found for explosion at (${x}, ${y})`);
      console.log('Available cells:', gameMap.querySelectorAll('[data-x][data-y]').length);

      // Debug: Log all available cells
      const allCells = gameMap.querySelectorAll('[data-x][data-y]');
      console.log('First 5 cells:', Array.from(allCells).slice(0, 5).map(cell => ({
        x: cell.getAttribute('data-x'),
        y: cell.getAttribute('data-y')
      })));
      return;
    }

    console.log(`✅ Found cell element for (${x}, ${y}):`, cellElement);

    // Create explosion element with simplified approach
    const explosionElement = document.createElement('div');
    explosionElement.setAttribute('data-explosion', 'true');
    explosionElement.setAttribute('data-chain-depth', chainDepth.toString());

    // ✅ NEW: Add explosion content and classes based on type and chain depth
    if (type === 'center') {
      explosionElement.innerHTML = '💥';
      explosionElement.className = `explosion-effect explosion-center ${chainDepth > 0 ? 'chain-reaction' : ''}`;
    } else {
      explosionElement.innerHTML = '🔥';
      explosionElement.className = `explosion-effect explosion-blast ${chainDepth > 0 ? 'chain-reaction' : ''}`;
    }

    // ✅ SIMPLIFIED: Direct inline styles for reliability
    explosionElement.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 1000;
      font-size: ${type === 'center' ? '2.5em' : '2em'};
      opacity: 1;
      transform: scale(1);
    `;

    // Add to cell with relative positioning
    cellElement.style.position = 'relative';
    cellElement.appendChild(explosionElement);

    // ✅ IMMEDIATE: Trigger animation immediately for visibility
    console.log(`🎬 Explosion element added to DOM at (${x}, ${y})`);
    console.log(`📏 Element dimensions:`, {
      width: explosionElement.offsetWidth,
      height: explosionElement.offsetHeight,
      visible: explosionElement.offsetParent !== null,
      innerHTML: explosionElement.innerHTML
    });
    console.log(`🎨 Element computed styles:`, {
      opacity: getComputedStyle(explosionElement).opacity,
      transform: getComputedStyle(explosionElement).transform,
      fontSize: getComputedStyle(explosionElement).fontSize,
      display: getComputedStyle(explosionElement).display
    });

    console.log(`✨ Created ${type} explosion animation at (${x}, ${y})`);
    console.log(`🔧 Element classes:`, explosionElement.className);
    console.log(`📍 Element parent:`, cellElement);
  }

  // ✅ NEW: Clean up all explosion animations
  cleanupExplosionAnimations() {
    const explosionElements = document.querySelectorAll('[data-explosion="true"]');
    explosionElements.forEach(element => {
      element.classList.add('explosion-fade-out');
      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }, 300);
    });
    console.log(`Cleaned up ${explosionElements.length} explosion animations`);
  }

  // ✅ POWER-UP SYSTEM: Handle power-up spawn events
  handlePowerUpSpawned(eventData) {
    console.log('🎁 Power-up spawned:', eventData.powerUp);
    // Power-up will be rendered when game state updates
    this.showNotification(`💎 ${eventData.powerUp.type.toUpperCase()} power-up appeared!`);
  }

  // ✅ POWER-UP SYSTEM: Handle power-up collection events
  handlePowerUpCollected(eventData) {
    console.log('🎁 Power-up collected:', eventData);

    const isCurrentPlayer = eventData.playerId === this.playerId;
    const playerName = isCurrentPlayer ? 'You' : eventData.playerNickname;

    // Show collection notification
    this.showNotification(`🎉 ${playerName} collected ${eventData.powerUpType.toUpperCase()} power-up!`);

    // Update player stats if it's the current player
    if (isCurrentPlayer) {
      this.updatePlayerStats(true); // forceUpdate = true since power-ups changed
    }
  }

  handleGameStarted(eventData) {
    console.log('Game started event received');
    if (eventData.gameState) {
      this.gameState = eventData.gameState;

      // Check if current player is actually in the game state
      if (!this.playerId || !this.gameState.players[this.playerId]) {
        console.warn('Player not found in game state:', this.playerId);
        console.log('Available players:', Object.keys(this.gameState.players));

        // Try to find player by nickname as fallback
        const playerByNickname = Object.values(this.gameState.players).find(p => p.nickname === this.nickname);
        if (playerByNickname) {
          console.log('Found player by nickname, updating playerId:', playerByNickname.id);
          this.playerId = playerByNickname.id;
          this.showGameScreen();
        } else {
          console.error('Player not found in game - returning to lobby');
          this.showError('Failed to join game - please try again');
          this.returnToLobby();
        }
      } else {
        this.showGameScreen();
      }
    }
  }

  updateGameTimer(timeLeft) {
    // ✅ FIX: Update game state with server-provided time
    if (this.gameState) {
      this.gameState.gameTimeLeft = timeLeft;
    }

    const timerElement = document.getElementById('timer-value');
    if (timerElement) {
      timerElement.textContent = this.formatTime(timeLeft);

      // Add warning class when time is low
      const timerDisplay = document.getElementById('timer-display');
      if (timerDisplay) {
        if (timeLeft <= 10) {
          timerDisplay.classList.add('timer-warning');
        } else if (timeLeft <= 30) {
          timerDisplay.classList.add('timer-caution');
        } else {
          timerDisplay.classList.remove('timer-warning', 'timer-caution');
        }
      }
    }
  }

  handlePlayerDamaged(eventData) {
    console.log(`Player ${eventData.nickname} damaged! Lives: ${eventData.livesRemaining}`);

    // Update player stats if it's the current player
    if (eventData.playerId === this.playerId) {
      // ✅ FIX: Update the game state immediately with the correct lives value
      // This ensures the UI shows the correct value even before the server sends game_state_update
      if (this.gameState && this.gameState.players[this.playerId]) {
        this.gameState.players[this.playerId].lives = eventData.livesRemaining;
      }

      // ✅ FIX: Force update player stats since we know the data has changed
      this.updatePlayerStats(true); // forceUpdate = true

      // ✅ NEW: Trigger damage effect for visual feedback (without popup notification)
      this.triggerDamageEffect(eventData);
    }
  }

  // ✅ NEW: Visual damage effect system (without popup notifications)
  triggerDamageEffect(eventData) {
    console.log('🩸 Triggering damage effect for player:', eventData.nickname);

    // 1. Screen flash effect
    this.createScreenFlash();

    // 2. Screen shake effect
    this.createScreenShake();

    // 3. Lives counter highlight effect
    this.highlightLivesCounter();

    // 4. Play damage sound (if audio is enabled)
    this.playDamageSound();

    // Note: Removed damage indicator popup and notification as requested
  }

  // ✅ NEW: Screen flash effect
  createScreenFlash() {
    // Create or get existing flash overlay
    let flashOverlay = document.getElementById('damage-flash-overlay');
    if (!flashOverlay) {
      flashOverlay = document.createElement('div');
      flashOverlay.id = 'damage-flash-overlay';
      flashOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: radial-gradient(circle, rgba(255,0,0,0.4) 0%, rgba(255,0,0,0.1) 100%);
        pointer-events: none;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.1s ease-in-out;
      `;
      document.body.appendChild(flashOverlay);
    }

    // Trigger flash animation
    flashOverlay.style.opacity = '1';
    setTimeout(() => {
      flashOverlay.style.opacity = '0';
    }, 150);
  }



  // ✅ NEW: Screen shake effect
  createScreenShake() {
    const gameScreen = document.querySelector('.game-screen') || document.body;

    // Add shake class
    gameScreen.classList.add('damage-shake');

    // Add CSS for shake animation if not present
    if (!document.getElementById('damage-shake-styles')) {
      const style = document.createElement('style');
      style.id = 'damage-shake-styles';
      style.textContent = `
        @keyframes damageShake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-5px); }
          20% { transform: translateX(5px); }
          30% { transform: translateX(-3px); }
          40% { transform: translateX(3px); }
          50% { transform: translateX(-2px); }
          60% { transform: translateX(2px); }
          70% { transform: translateX(-1px); }
          80% { transform: translateX(1px); }
          90% { transform: translateX(0); }
        }
        .damage-shake {
          animation: damageShake 0.5s ease-in-out;
        }
      `;
      document.head.appendChild(style);
    }

    // Remove shake class after animation
    setTimeout(() => {
      gameScreen.classList.remove('damage-shake');
    }, 500);
  }

  // ✅ NEW: Highlight lives counter
  highlightLivesCounter() {
    const livesElement = this.framework.getCachedElement('player-lives') ||
                        document.getElementById('player-lives');

    if (livesElement) {
      // Add highlight effect
      livesElement.style.transition = 'all 0.3s ease';
      livesElement.style.color = '#ff0000';
      livesElement.style.fontWeight = 'bold';
      livesElement.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.8)';
      livesElement.style.transform = 'scale(1.2)';

      // Reset after effect
      setTimeout(() => {
        livesElement.style.color = '';
        livesElement.style.fontWeight = '';
        livesElement.style.textShadow = '';
        livesElement.style.transform = '';
      }, 1000);
    }
  }

  // ✅ NEW: Play damage sound effect
  playDamageSound() {
    try {
      // Create audio context if not exists
      if (!this.audioContext && typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext();
      }

      if (!this.audioContext) {
        console.warn('AudioContext not available');
        return;
      }

      // Generate damage sound using Web Audio API
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Configure damage sound (low frequency hit sound)
      oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.2);

    } catch (error) {
      console.warn('Could not play damage sound:', error);
    }
  }

  handlePlayerEliminated(eventData) {
    console.log(`Player ${eventData.nickname} eliminated!`);
    // Could add elimination animation or notification here
  }

  // ✅ ENHANCED: Handle bomb explosion with visual animation
  handleBombExplosion(eventData) {
    console.log('🔥 BOMB EXPLOSION EVENT RECEIVED:', eventData);
    console.log('Position:', eventData.position);
    console.log('Explosions:', eventData.explosions);
    console.log('Range:', eventData.range);

    // Show explosion animation/effects
    this.showExplosionEffect(eventData.position, eventData.explosions, eventData.range);

    // Play explosion sound (if implemented)
    // this.playExplosionSound();

    // The game state will be updated via game_state_update message
  }

  handleGameEnded(eventData) {
    console.log('Game ended:', eventData.reason);

    // ✅ FIX: Update game state with server data to ensure accurate life counts
    if (eventData.gameState) {
      this.gameState = eventData.gameState;
    }

    this.gameState.gameEnded = true;
    this.gameState.winner = eventData.winner;

    // ✅ FIX: Small delay to ensure all state updates are processed
    setTimeout(() => {
      this.showGameEndScreen();
    }, 50);
  }

  handleGameReset(eventData) {
    console.log('Game reset');
    this.gameState = eventData.gameState;
    this.returnToLobby();
  }

  // Chat functionality
  updateChatDisplay() {
    // Update waiting room chat
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) {
      chatContainer.innerHTML = this.chatMessages.map(msg => `
        <div class="chat-message">
          <span class="chat-nickname">${msg.nickname}:</span>
          <span class="chat-text">${msg.message}</span>
        </div>
      `).join('');

      // Scroll to bottom
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Update game screen chat
    const gameChatContainer = document.getElementById('game-chat-messages');
    if (gameChatContainer) {
      gameChatContainer.innerHTML = this.chatMessages.map(msg => `
        <div class="chat-message">
          <span class="chat-nickname">${msg.nickname}:</span>
          <span class="chat-text">${msg.message}</span>
        </div>
      `).join('');

      // Scroll to bottom
      gameChatContainer.scrollTop = gameChatContainer.scrollHeight;
    }
  }

  sendChatMessage(message) {
    if (!message.trim()) return;

    const success = this.sendWebSocketMessage({
      type: 'chat',
      message: message.trim()
    });

    if (!success) {
      console.error('Failed to send chat message');
    }
  }

  // Setup chat event handlers
  setupChatHandlers() {
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');

    if (chatInput && chatSend) {
      // Send message on button click
      chatSend.addEventListener('click', () => {
        const message = chatInput.value;
        if (message.trim()) {
          this.sendChatMessage(message);
          chatInput.value = '';
        }
      });

      // Send message on Enter key
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const message = chatInput.value;
          if (message.trim()) {
            this.sendChatMessage(message);
            chatInput.value = '';
          }
        }
      });
    }
  }

  // Setup chat handlers for game screen
  setupGameChatHandlers() {
    const gameChatInput = document.getElementById('game-chat-input');
    const gameChatSend = document.getElementById('game-chat-send');

    if (gameChatInput && gameChatSend) {
      // Send message on button click
      gameChatSend.addEventListener('click', () => {
        const message = gameChatInput.value;
        if (message.trim()) {
          this.sendChatMessage(message);
          gameChatInput.value = '';
        }
      });

      // Send message on Enter key
      gameChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const message = gameChatInput.value;
          if (message.trim()) {
            this.sendChatMessage(message);
            gameChatInput.value = '';
          }
        }
      });
    }
  }

  // ✅ OPTIMIZED: Use cached elements for timer updates
  updateTimer() {
    if (this.gameState && this.gameState.gameTimeLeft !== undefined) {
      const timeLeft = this.gameState.gameTimeLeft;

      this.framework.updateElement('timer-value', (timerElement) => {
        timerElement.textContent = this.formatTime(timeLeft);
      });

      // Add warning class when time is low
      this.framework.updateElement('timer-display', (timerDisplay) => {
        if (timeLeft <= 10) {
          timerDisplay.classList.add('timer-warning');
        } else if (timeLeft <= 30) {
          timerDisplay.classList.add('timer-caution');
        } else {
          timerDisplay.classList.remove('timer-warning', 'timer-caution');
        }
      });
    }
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  showGameEndScreen() {
    const app = document.getElementById('app');
    const winner = this.gameState.winner;
    
    let message = 'Game Over!';
    let submessage = '';
    
    if (this.gameState.gameTimeLeft <= 0) {
      message = 'Time\'s Up!';
    }
    
    if (winner) {
      if (winner.id === 'draw') {
        submessage = 'It\'s a draw!';
      } else if (winner.id === 'none') {
        submessage = 'No winner this time.';
      } else if (winner.id === this.playerId) {
        submessage = 'Congratulations! You won!';
      } else {
        submessage = `${winner.nickname} wins!`;
      }
    }
    
    // ✅ ENHANCED: Professional game end screen with improved design
    app.innerHTML = `
      <div class="game-end-screen">
        <h1>🎮 ${message} 🎮</h1>

        ${winner && winner.id !== 'draw' && winner.id !== 'none' ? `
          <div class="winner-announcement">
            <h2>🏆 Victory! 🏆</h2>
            <div class="winner-name">${winner.nickname}</div>
            <p>Congratulations on your explosive victory!</p>
          </div>
        ` : `
          <div class="winner-announcement" style="background: linear-gradient(135deg, #e74c3c, #c0392b);">
            <h2>⏰ ${message} ⏰</h2>
            <div class="winner-name">${submessage}</div>
            <p>Better luck next time!</p>
          </div>
        `}

        <div class="final-results">
          <h3>📊 Final Results</h3>
          <div class="players-final-stats">
            ${Object.values(this.gameState.players).map(player => {
              const isWinner = winner && player.id === winner.id;
              const isCurrentPlayer = player.id === this.playerId;
              let cssClass = 'player-final-stat';
              if (isCurrentPlayer) cssClass += ' current-player';
              if (isWinner) cssClass += ' winner';

              return `
                <div class="${cssClass}">
                  <span class="player-name">
                    ${isWinner ? '👑 ' : ''}${player.nickname}${isCurrentPlayer ? ' (You)' : ''}
                  </span>
                  <span class="player-lives">❤️ Lives: ${player.alive ? player.lives : 0}</span>
                  <span class="player-status ${player.alive ? 'alive' : 'eliminated'}">
                    ${player.alive ? '✅ Alive' : '💀 Eliminated'}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="game-end-actions">
          <button id="play-again-btn" class="primary-button">🎮 Play Again</button>
          <button class="secondary-button" onclick="window.bombermanApp.returnToLobby()">🏠 Return to Lobby</button>
          <div class="countdown-to-lobby">
            <p>Auto-returning to lobby in <span id="lobby-countdown">10</span> seconds...</p>
          </div>
        </div>
      </div>
    `;

    // Set up play again button
    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', () => {
        this.returnToLobby();
      });
    }

    // Start countdown to return to lobby
    this.startLobbyCountdown();
  }

  startLobbyCountdown() {
    let countdown = 10;
    const countdownElement = document.getElementById('lobby-countdown');
    
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        this.returnToLobby();
      }
    }, 1000);
  }

  returnToLobby() {
    // Clear game loop
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    
    // Reset game state
    this.gameState = null;
    this.playerId = null;
    this.nickname = '';
    
    // Show initial screen
    this.showInitialScreen();
  }

  showInitialScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="nickname-screen">
        <h1>Bomberman</h1>
        <div class="nickname-form-container">
          <form id="nickname-form">
            <label for="nickname-input">Enter your nickname:</label>
            <input 
              id="nickname-input" 
              type="text" 
              placeholder="Your nickname"
              required 
              maxlength="20"
              minlength="2"
            >
            <button type="submit">Join Game</button>
          </form>
          <div id="error-message" class="error" style="display: none;"></div>
        </div>
      </div>
    `;
    
    // Re-setup event handlers
    this.setupEventHandlers();
    
    // Focus on nickname
    const nicknameInput = document.getElementById('nickname-input');
    if (nicknameInput) {
      nicknameInput.focus();
    }
  }

  // Clean up when the app is destroyed
  destroy() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }
    if (this.gameKeyHandler) {
      document.removeEventListener('keydown', this.gameKeyHandler);
    }
    if (this.framework.gameLoop) {
      this.framework.stopGameLoop();
    }

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.wsConnected = false;
    }
  }
}

// Initialize the app when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new BombermanApp();
  });
} else {
  // DOM is already ready
  new BombermanApp();
}

export default BombermanApp;
