import { Framework } from '../framework/framework.js';

class BombermanApp {
  constructor() {
    this.framework = new Framework();
    this.gameState = null;
    this.playerId = null;
    this.nickname = '';
    this.gameLoop = null;
    this.performanceMonitor = null;
    this.isMoving = false; // Prevent multiple simultaneous moves
    this.lastMoveTime = 0;
    this.moveThrottle = 100; // Minimum time between moves (ms)
    this.lastRenderTime = 0;
    this.renderThrottle = 16; // ~60fps rendering
    
    this.init();
  }

  init() {
    this.setupEventHandlers();
    this.initPerformanceMonitoring();
    
    // Focus on the nickname input
    const nicknameInput = document.getElementById('nickname-input');
    if (nicknameInput) {
      nicknameInput.focus();
    }
  }

  initPerformanceMonitoring() {
    // Create performance display element
    this.createPerformanceDisplay();

    // Subscribe to performance updates from framework
    this.framework.onPerformanceUpdate((metrics) => {
      this.updatePerformanceDisplay(metrics);
      
      // Log warnings for performance issues
      if (metrics.fps < 55) {
        console.warn(`Low FPS detected: ${metrics.fps}`);
      }
      
      if (metrics.frameDropPercentage > 5) {
        console.warn(`High frame drop rate: ${metrics.frameDropPercentage.toFixed(2)}%`);
      }
    });

    // Monitor paint and layout thrashing
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

    // Show/hide with F12 key
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
    // Monitor for layout thrashing
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
    // Nickname form submission
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
      
      // Hide error after 5 seconds
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 5000);
    }
  }

  async joinGame(nickname) {
    try {
      // Show loading state
      const submitButton = document.querySelector('#nickname-form button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.textContent = 'Joining...';
      submitButton.disabled = true;

      this.nickname = nickname;

      const response = await fetch('/api/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nickname })
      });

      const data = await response.json();
      
      if (data.success) {
        this.playerId = data.playerId;
        this.gameState = data.gameState;
        
        console.log('Game joined successfully:', data);
        
        // Switch to waiting screen
        this.showWaitingScreen();
        this.startOptimizedGameLoop();
      } else {
        this.showError(data.error || 'Failed to join game');
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }
    } catch (error) {
      console.error('Error in joinGame:', error);
      this.showError('Failed to join game: ' + error.message);
      const submitButton = document.querySelector('#nickname-form button[type="submit"]');
      if (submitButton) {
        submitButton.textContent = 'Join Game';
        submitButton.disabled = false;
      }
    }
  }

  startOptimizedGameLoop() {
    // Start the framework's optimized game loop
    this.framework.startGameLoop((deltaTime, currentTime) => {
      this.gameUpdate(deltaTime, currentTime);
    });
  }

  async gameUpdate(deltaTime, currentTime) {
    try {
      // Throttle game state fetching to reduce server load
      if (currentTime - this.lastRenderTime >= this.renderThrottle) {
        await this.fetchGameState();
        this.lastRenderTime = currentTime;
      }

      // Update UI elements that need frequent updates
      this.updateTimer();
      
      // Process any pending animations or effects
      this.updateAnimations(deltaTime);
      
    } catch (error) {
      console.error('Game update error:', error);
    }
  }

  async fetchGameState() {
    try {
      const response = await fetch('/api/gamestate');
      const gameState = await response.json();
      
      // Only update if state actually changed (reduce unnecessary renders)
      if (JSON.stringify(gameState) !== JSON.stringify(this.gameState)) {
        const previousState = this.gameState;
        this.gameState = gameState;
        
        // Handle state changes efficiently
        this.handleGameStateChange(previousState, gameState);
      }
    } catch (error) {
      console.error('Failed to fetch game state:', error);
    }
  }

  handleGameStateChange(previousState, newState) {
    // Check if game ended
    if (newState.gameEnded && (!previousState || !previousState.gameEnded)) {
      this.showGameEndScreen();
      return;
    }
    
    // Check if game started
    if (newState.gameStarted && (!previousState || !previousState.gameStarted)) {
      this.showGameScreen();
      return;
    }
    
    // Update specific parts of the UI based on what changed
    if (newState.gameStarted) {
      this.updateGameScreen(previousState, newState);
    } else {
      this.updateWaitingScreen();
    }
  }

  updateAnimations(deltaTime) {
    // Update bomb pulse animations
    const bombs = document.querySelectorAll('.bomb');
    bombs.forEach(bomb => {
      // Bomb animations are handled by CSS, but we could add JS animations here
    });

    // Update player movement animations
    const players = document.querySelectorAll('.player');
    players.forEach(player => {
      // Smooth player position updates could go here
    });
  }

  showWaitingScreen() {
    if (!this.gameState) {
      console.error('Cannot show waiting screen: gameState is null');
      return;
    }

    const app = document.getElementById('app');
    const playerCount = Object.keys(this.gameState.players).length;
    
    // Use framework's optimized rendering
    const waitingScreenHTML = `
      <div class="waiting-screen">
        <h1>Waiting for Game to Start</h1>
        <div class="player-info">
          <p id="player-count">Players: ${playerCount}/4</p>
          <div class="players-list" id="players-list">
            ${Object.values(this.gameState.players).map(player => 
              `<div class="player-item">${player.nickname}</div>`
            ).join('')}
          </div>
        </div>
        <div class="countdown" id="countdown-container" style="display: none;">
          <h2 id="countdown-text">Game starting in: 3</h2>
          <p>Get ready!</p>
        </div>
      </div>
    `;

    // Batch DOM update to prevent layout thrashing
    requestAnimationFrame(() => {
      app.innerHTML = waitingScreenHTML;
    });
  }

  updateWaitingScreen() {
    if (!this.gameState) return;

    // Use efficient DOM updates instead of innerHTML
    const playerCountElement = document.getElementById('player-count');
    const playersListElement = document.getElementById('players-list');
    const countdownContainer = document.getElementById('countdown-container');
    const countdownText = document.getElementById('countdown-text');

    if (playerCountElement && playersListElement) {
      const playerCount = Object.keys(this.gameState.players).length;
      
      // Only update if changed
      const newCountText = `Players: ${playerCount}/4`;
      if (playerCountElement.textContent !== newCountText) {
        playerCountElement.textContent = newCountText;
      }
      
      // Update players list efficiently
      const newPlayersHTML = Object.values(this.gameState.players).map(player => 
        `<div class="player-item">${player.nickname}</div>`
      ).join('');
      
      if (playersListElement.innerHTML !== newPlayersHTML) {
        playersListElement.innerHTML = newPlayersHTML;
      }

      // Show countdown if it's started
      if (this.gameState.countdown > 0 && countdownContainer && countdownText) {
        countdownContainer.style.display = 'block';
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
      return;
    }

    const app = document.getElementById('app');
    const player = this.gameState.players[this.playerId];
    
    if (!player) {
      console.error('Player not found in game state:', this.playerId);
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
        <div class="game-map" id="game-map">
          ${this.renderGameMap()}
        </div>
      </div>
    `;

    // Batch DOM update
    requestAnimationFrame(() => {
      app.innerHTML = gameScreenHTML;
      this.setupGameControls();
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

  async movePlayer(direction) {
    if (this.isMoving) return; // Prevent multiple simultaneous moves
    
    this.isMoving = true;
    
    try {
      console.log(`Attempting to move ${direction} for player ${this.playerId}`);
      
      const response = await fetch('/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId: this.playerId, direction })
      });

      const data = await response.json();
      console.log('Move response:', data);
      
      if (data.success && data.gameState) {
        this.gameState = data.gameState;
        this.updateGameMap();
      }
    } catch (error) {
      console.error('Error moving player:', error);
    } finally {
      // Allow next move after a short delay
      setTimeout(() => {
        this.isMoving = false;
      }, 100);
    }
  }

  async placeBomb() {
    try {
      const response = await fetch('/api/bomb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId: this.playerId })
      });

      const data = await response.json();
      if (data.success && data.gameState) {
        this.gameState = data.gameState;
        this.updateGameMap();
        console.log('Bomb placed successfully');
      } else {
        console.log('Failed to place bomb');
      }
    } catch (error) {
      console.error('Error placing bomb:', error);
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
