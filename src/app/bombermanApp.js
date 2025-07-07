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

  // CRITICAL: Cache DOM elements to reduce queries
  cacheElements() {
    this.cachedElements.app = document.getElementById('app');
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

      case 'bomb_exploded':
        this.handleBombExplosion(eventData);
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
  showNotification(message) {
    let notificationDiv = document.getElementById('game-notification');
    if (!notificationDiv) {
      notificationDiv = document.createElement('div');
      notificationDiv.id = 'game-notification';
      notificationDiv.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: #27ae60;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10002;
        font-weight: bold;
        opacity: 0;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(notificationDiv);
    }

    notificationDiv.textContent = message;
    notificationDiv.style.opacity = '1';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      notificationDiv.style.opacity = '0';
    }, 3000);
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

  updatePlayerStats() {
    const player = this.gameState.players[this.playerId];
    if (!player) return;

    const livesElement = document.getElementById('player-lives');
    const bombsElement = document.getElementById('player-bombs');
    if (livesElement && bombsElement) {
      livesElement.textContent = player.lives;
      bombsElement.textContent = player.powerUps?.bombs || 1;
    }
  }

  renderGameMap() {
    if (!this.gameState || !this.gameState.map || !this.gameState.players) {
      console.error('Cannot render game map: invalid gameState', this.gameState);
      return '<div>Loading game map...</div>';
    }

    const map = this.gameState.map;
    const players = this.gameState.players;
    const bombs = this.gameState.bombs || [];
    
    return map.map((row, y) => 
      row.map((cell, x) => {
        const playersAtPosition = Object.values(players).filter(p => p.x === x && p.y === y && p.alive);
        const bombsAtPosition = bombs.filter(b => b.x === x && b.y === y);
        
        return `
          <div class="cell ${cell}" data-x="${x}" data-y="${y}">
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

  updateGameMap() {
    const gameMapElement = document.getElementById('game-map');
    if (gameMapElement && this.gameState) {
      gameMapElement.innerHTML = this.renderGameMap();
    }
  }

  // CRITICAL: Optimized version for game loop
  updateGameMapOptimized() {
    // Only update game map if we're in the game screen
    const gameMapElement = document.getElementById('game-map');
    if (gameMapElement && this.gameState && this.gameState.map) {
      // Only update if the map has actually changed
      const newMapHTML = this.renderGameMap();
      if (this.lastRenderedMap !== newMapHTML) {
        gameMapElement.innerHTML = newMapHTML;
        this.lastRenderedMap = newMapHTML;
      }
    }
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

  // ✅ CRITICAL: Handle bomb explosion events from server
  handleBombExplosion(eventData) {
    console.log('Bomb explosion received:', eventData);

    // Show explosion animation/effects
    this.showExplosionEffect(eventData.position, eventData.explosions);

    // Play explosion sound (if implemented)
    // this.playExplosionSound();

    // The game state will be updated via game_state_update message
  }

  // ✅ CRITICAL: Show explosion visual effects
  showExplosionEffect(position, explosions) {
    console.log(`Showing explosion at (${position.x}, ${position.y}) with ${explosions.length} cells`);

    // TODO: Add visual explosion effects here
    // For now, just log the explosion
    explosions.forEach(cell => {
      console.log(`Explosion cell: (${cell.x}, ${cell.y})`);
    });
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
    // Could add visual feedback here (screen flash, damage indicator, etc.)

    // Update player stats if it's the current player
    if (eventData.playerId === this.playerId) {
      this.updatePlayerStats();
    }
  }

  handlePlayerEliminated(eventData) {
    console.log(`Player ${eventData.nickname} eliminated!`);
    // Could add elimination animation or notification here
  }

  handleBombExplosion(eventData) {
    console.log('Bomb exploded:', eventData);
    // Could add explosion animation here
    // For now, the game state update will handle the visual changes
  }

  handleGameEnded(eventData) {
    console.log('Game ended:', eventData.reason);
    this.gameState.gameEnded = true;
    this.gameState.winner = eventData.winner;
    this.showGameEndScreen();
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

  updateTimer() {
    const timerElement = document.getElementById('timer-value');
    if (timerElement && this.gameState) {
      const timeLeft = this.gameState.gameTimeLeft || 0;
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
    
    app.innerHTML = `
      <div class="game-end-screen">
        <h1>${message}</h1>
        <h2>${submessage}</h2>
        <div class="game-stats">
          <h3>Final Results:</h3>
          <div class="players-final-stats">
            ${Object.values(this.gameState.players).map(player => `
              <div class="player-final-stat ${player.id === this.playerId ? 'current-player' : ''}">
                <span class="player-name">${player.nickname}</span>
                <span class="player-lives">Lives: ${player.lives}</span>
                <span class="player-status">${player.alive ? 'Alive' : 'Eliminated'}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="game-end-actions">
          <button id="play-again-btn" class="play-again-btn">Play Again</button>
          <div class="countdown-to-lobby">
            <p>Returning to lobby in <span id="lobby-countdown">10</span> seconds...</p>
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
