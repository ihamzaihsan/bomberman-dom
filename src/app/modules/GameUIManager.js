// ✅ CONSOLIDATED: Import shared constants
import { GAME_TIMING } from '../../shared/GameConstants.js';

export class GameUIManager {
  constructor(framework) {
    this.framework = framework;

    // UI state
    this.gameState = null;
    this.playerId = null;

    // Event callbacks
    this.onReturnToLobby = null;
    this.onShowError = null;
    this.onShowNotification = null;

    // ✅ CONSOLIDATED: Reference to NotificationManager for notifications
    this.notificationManager = null;
  }

  // Set game state reference
  setGameState(gameState, playerId) {
    this.gameState = gameState;
    this.playerId = playerId;
  }

  // Set callback functions
  setCallbacks(callbacks) {
    this.onReturnToLobby = callbacks.onReturnToLobby || null;
    this.onShowError = callbacks.onShowError || null;
    this.onShowNotification = callbacks.onShowNotification || null;
  }

  // ✅ CONSOLIDATED: Set notification manager reference
  setNotificationManager(notificationManager) {
    this.notificationManager = notificationManager;
  }

  // ===== TIMER FUNCTIONALITY =====

  // ✅ OPTIMIZED: Use cached elements for timer updates
  updateTimer() {
    let timeLeft = 180; // default to 3 minutes
    if (this.gameState && this.gameState.gameTimeLeft !== undefined) {
      timeLeft = this.gameState.gameTimeLeft;
    }
    // Only update if timer elements exist (we're in game screen)
    const timerValue = document.getElementById('timer-value');
    const timerDisplay = document.getElementById('timer-display');
    if (timerValue && timerDisplay) {
      timerValue.textContent = this.formatTime(timeLeft);
      // Optionally, add warning/caution classes
    }
  }

  // Update game timer from server events
  updateGameTimer(timeLeft) {
    console.log('GameUIManager: updateGameTimer called with timeLeft:', timeLeft);
    // ✅ FIX: Update game state with server-provided time
    if (this.gameState) {
      this.gameState.gameTimeLeft = timeLeft;
      console.log('GameUIManager: updated gameState.gameTimeLeft to:', timeLeft);
      // This ensures the UI shows the correct value even before the server sends game_state_update
    }

    // Update timer display
    console.log('GameUIManager: calling updateTimer()');
    this.updateTimer();
  }

  // Update waiting room timer
  updateWaitingTimer(waitingTimeLeft) {
    console.log('GameUIManager: updateWaitingTimer called with:', waitingTimeLeft);
    const timerElement = document.getElementById('waiting-timer');
    if (timerElement) {
      const formattedTime = this.formatTime(waitingTimeLeft);
      console.log('GameUIManager: updating timer to:', formattedTime);
      timerElement.textContent = formattedTime;
    } else {
      console.warn('GameUIManager: waiting-timer element not found');
    }
  }

  // Update countdown display
  updateCountdown(countdown) {
    console.log('GameUIManager: updateCountdown called with:', countdown);
    const countdownText = document.getElementById('countdown-text');
    const countdownContainer = document.getElementById('countdown-container');
    const waitingTimerContainer = document.querySelector('.waiting-timer-container');

    if (countdownText && countdownContainer) {
      countdownText.textContent = `Game starting in: ${countdown}`;
      countdownContainer.style.display = 'block';
      console.log('GameUIManager: countdown display updated to:', countdown);

      // Hide waiting timer when countdown starts
      if (waitingTimerContainer) {
        waitingTimerContainer.style.display = 'none';
      }
    } else {
      console.warn('GameUIManager: countdown elements not found');
    }
  }

  // Format time in MM:SS format
  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // ===== LIVES AND BOMB COUNTER =====

  // ✅ ENHANCED: Update player stats with selective updating
  updatePlayerStats(forceUpdate = false) {
    if (!this.gameState || !this.gameState.players || !this.playerId) return;
    const currentPlayer = this.gameState.players[this.playerId];
    if (!currentPlayer) return;

    const livesElement = document.getElementById('player-lives');
    const bombsElement = document.getElementById('player-bombs');

    if (livesElement) {
      livesElement.textContent = `Lives: ${currentPlayer.lives ?? 1}`;
    }

    // ✅ UPDATED: Use new bomb system with maxBombs and currentBombs
    const maxBombs = typeof currentPlayer.maxBombs === 'number' ? currentPlayer.maxBombs : 1;
    const currentBombs = typeof currentPlayer.currentBombs === 'number' ? currentPlayer.currentBombs : 0;
    const availableBombs = maxBombs - currentBombs;



    if (bombsElement) {
      // ✅ UPDATED: Display maximum bomb capacity as requested
      bombsElement.textContent = `${maxBombs}`;

      // Visual indicator based on bomb availability
      if (availableBombs <= 0) {
        bombsElement.style.color = '#e74c3c';
        bombsElement.style.fontWeight = 'bold';
        bombsElement.title = `No bombs left! (${currentBombs}/${maxBombs} active)`;
      } else if (availableBombs === maxBombs) {
        // All bombs available
        bombsElement.style.color = '#27ae60';
        bombsElement.style.fontWeight = '';
        bombsElement.title = `Max capacity: ${maxBombs} bombs, ${availableBombs} available`;
      } else {
        // Some bombs available
        bombsElement.style.color = '#f39c12';
        bombsElement.style.fontWeight = '';
        bombsElement.title = `Max capacity: ${maxBombs} bombs, ${availableBombs} available, ${currentBombs} active`;
      }
    }

    // ✅ NEW: Update the game players list when stats change
    this.updateGamePlayersList();
  }

  // ✅ NEW: Highlight lives counter when taking damage
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

  // ===== END GAME SCREEN =====

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
        if (this.onReturnToLobby) {
          this.onReturnToLobby();
        }
      });
    }

    // Start countdown to return to lobby
    this.startLobbyCountdown();
  }

  startLobbyCountdown() {
    let countdown = GAME_TIMING.COUNTDOWN_DURATION; // ✅ CONSOLIDATED: Use shared constant
    const countdownElement = document.getElementById('lobby-countdown');
    
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        if (this.onReturnToLobby) {
          this.onReturnToLobby();
        }
      }
    }, GAME_TIMING.TIMER_INTERVAL); // ✅ CONSOLIDATED: Use shared constant
  }

  // ===== SCREEN MANAGEMENT =====

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
    
    // Focus on nickname
    const nicknameInput = document.getElementById('nickname-input');
    if (nicknameInput) {
      nicknameInput.focus();
    }
  }

  showWaitingScreen() {
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="waiting-screen">
        <h1>Waiting for Game to Start</h1>

        <div class="waiting-content">
          <div class="player-info">
            <h3>Players in Lobby:</h3>
            <div id="players-list" class="players-list"></div>
            <p id="player-count-info">Waiting for players...</p>
          </div>

          <div class="chat-container">
            <h3>Chat:</h3>
            <div id="chat-messages" class="chat-messages"></div>
            <div class="chat-input-container">
              <input id="chat-input" type="text" placeholder="Type a message..." maxlength="100">
              <button id="chat-send">Send</button>
            </div>
          </div>
        </div>

        <div class="waiting-timer-container">
          <p>Game starts in: <span id="waiting-timer">--:--</span></p>
          <p>Game will start automatically when timer expires or 4 players join</p>
        </div>

        <div id="countdown-container" class="countdown" style="display: none;">
          <h2 id="countdown-text">Game starting in: 10</h2>
        </div>
      </div>
    `;

    // ✅ CRITICAL FIX: Update player list immediately after showing waiting screen
    this.updateWaitingScreen();
  }

  // ✅ NEW: Implement missing updateWaitingScreen method
  updateWaitingScreen() {
    if (!this.gameState) return;

    // Update player list
    this.updatePlayerList();

    // Update player count info
    this.updatePlayerCountInfo();

    // Update waiting timer if it exists
    if (this.gameState.waitingTimeLeft !== undefined) {
      this.updateWaitingTimer(this.gameState.waitingTimeLeft);
    }

    // Update countdown if it exists
    if (this.gameState.countdown > 0) {
      this.updateCountdown(this.gameState.countdown);
    }
  }

  // ✅ NEW: Update player list in lobby
  updatePlayerList() {
    const playersListElement = document.getElementById('players-list');
    if (!playersListElement || !this.gameState) return;

    const players = Object.values(this.gameState.players);

    if (players.length === 0) {
      playersListElement.innerHTML = '<div class="player-item">No players in lobby</div>';
      return;
    }

    playersListElement.innerHTML = players.map((player) => {
      const isCurrentPlayer = player.id === this.playerId;
      return `
        <div class="player-item ${isCurrentPlayer ? 'current-player' : ''}">
          <span class="player-name">
            ${player.nickname}${isCurrentPlayer ? ' (You)' : ''}
          </span>
          <span class="player-status">Ready</span>
        </div>
      `;
    }).join('');

    // Remove "Waiting for players..." if at least two players are in the lobby
    const playerCountElement = document.getElementById('player-count-info');
    if (playerCountElement) {
      const playerCount = players.length;
      if (playerCount >= 2) {
        playerCountElement.style.display = 'none';
      } else {
        playerCountElement.style.display = 'block';
      }
    }
  }

  // ✅ NEW: Update player count information
  updatePlayerCountInfo() {
    const playerCountElement = document.getElementById('player-count-info');
    if (!playerCountElement || !this.gameState) return;

    const playerCount = Object.keys(this.gameState.players).length;
    const maxPlayers = 4;

    let message = '';
    if (playerCount === 0) {
      message = 'Waiting for players to join...';
    } else if (playerCount === 1) {
      message = `${playerCount}/4 players - Need at least 2 players to start`;
    } else if (playerCount < maxPlayers) {
      message = `${playerCount}/4 players - Game will start soon`;
    } else {
      message = `${playerCount}/4 players - Lobby full!`;
    }

    playerCountElement.textContent = message;
  }

  // ✅ NEW: Update player list in game screen with lives and crown identifier
  updateGamePlayersList() {
    const playersListElement = document.getElementById('players-list-game');
    if (!playersListElement || !this.gameState || !this.gameState.players) return;

    // Clear existing content
    playersListElement.innerHTML = '';

    const players = Object.values(this.gameState.players);
    
    if (players.length === 0) {
      const emptyMessage = this.framework.selectiveRenderer.createElement('div', {
        className: 'no-players-message',
        textContent: 'No players in game',
        style: 'color: #bdc3c7; font-style: italic; text-align: center; padding: 10px;'
      });
      playersListElement.appendChild(emptyMessage);
      return;
    }

    // Create player list items
    players.forEach((player, index) => {
      const isCurrentPlayer = player.id === this.playerId;
      
      // Create player item container
      const playerItem = this.framework.selectiveRenderer.createElement('div', {
        className: `game-player-item ${isCurrentPlayer ? 'current-player' : ''}`,
        style: `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          margin-bottom: 6px;
          background: ${isCurrentPlayer ? 'linear-gradient(135deg, #3498db, #2980b9)' : 'linear-gradient(135deg, #34495e, #2c3e50)'};
          border-radius: 8px;
          border: ${isCurrentPlayer ? '2px solid #3498db' : '2px solid transparent'};
          color: #ecf0f1;
          font-size: 0.9em;
          transition: all 0.3s ease;
          position: relative;
        `
      });

      // Create player name with crown for current player
      const playerNameContainer = this.framework.selectiveRenderer.createElement('div', {
        className: 'player-name-container',
        style: 'display: flex; align-items: center; gap: 6px;'
      });

      // Add crown for current player
      if (isCurrentPlayer) {
        const crown = this.framework.selectiveRenderer.createElement('span', {
          className: 'player-crown',
          innerHTML: '👑',
          style: 'font-size: 1.1em; filter: drop-shadow(0 0 3px gold);',
          title: 'You'
        });
        playerNameContainer.appendChild(crown);
      }

      const playerName = this.framework.selectiveRenderer.createElement('span', {
        className: 'player-name',
        textContent: player.nickname,
        style: 'font-weight: bold;'
      });

      playerNameContainer.appendChild(playerName);

      // Create lives display
      const livesContainer = this.framework.selectiveRenderer.createElement('div', {
        className: 'player-lives-container',
        style: 'display: flex; align-items: center; gap: 4px;'
      });

      const livesLabel = this.framework.selectiveRenderer.createElement('span', {
        textContent: 'Lives:',
        style: 'font-size: 0.8em; color: #bdc3c7;'
      });

      const livesCount = this.framework.selectiveRenderer.createElement('span', {
        className: 'player-lives-count',
        textContent: player.lives || 0,
        style: `
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 4px;
          background: ${player.lives > 1 ? '#27ae60' : player.lives === 1 ? '#f39c12' : '#e74c3c'};
          color: white;
          font-size: 0.85em;
          min-width: 16px;
          text-align: center;
        `
      });

      livesContainer.appendChild(livesLabel);
      livesContainer.appendChild(livesCount);

      // Assemble player item
      playerItem.appendChild(playerNameContainer);
      playerItem.appendChild(livesContainer);

      // Add to list
      playersListElement.appendChild(playerItem);
    });
  }

  showGameScreen() {
    // ✅ NEW: Use framework to create the game screen structure
    const gameScreenContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-screen'
    });

    // Create game UI section
    const gameUI = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-ui'
    });

    // Game info section (timer and current player stats)
    const gameInfo = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-info'
    });

    // Timer display
    const timerDisplay = this.framework.selectiveRenderer.createElement('div', {
      className: 'timer-display',
      id: 'timer-display',
      innerHTML: 'Time: <span id="timer-value">0:00</span>'
    });

    // Current player stats
    const playerStats = this.framework.selectiveRenderer.createElement('div', {
      className: 'player-stats'
    });

    const livesStatsDiv = this.framework.selectiveRenderer.createElement('div', {
      className: 'stat',
      innerHTML: '<span>Lives:</span><span id="player-lives">3</span>'
    });

    const bombsStatsDiv = this.framework.selectiveRenderer.createElement('div', {
      className: 'stat',
      innerHTML: '<span>Bombs:</span><span id="player-bombs">1</span>'
    });

    // ✅ NEW: Players list with lives (moved to game-info)
    const playersListContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-players-list',
      id: 'game-players-list'
    });

    const playersListTitle = this.framework.selectiveRenderer.createElement('h4', {
      innerHTML: 'Players',
      style: 'margin: 10px 0 5px 0; color: #ecf0f1; font-size: 0.9em;'
    });

    const playersListDiv = this.framework.selectiveRenderer.createElement('div', {
      id: 'players-list-game',
      className: 'players-list-game'
    });

    // Assemble game info section
    playerStats.appendChild(livesStatsDiv);
    playerStats.appendChild(bombsStatsDiv);
    
    playersListContainer.appendChild(playersListTitle);
    playersListContainer.appendChild(playersListDiv);
    
    gameInfo.appendChild(timerDisplay);
    gameInfo.appendChild(playerStats);
    gameInfo.appendChild(playersListContainer);

    // Game map container
    const gameMapContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-map-container'
    });

    const gameMap = this.framework.selectiveRenderer.createElement('div', {
      id: 'game-map',
      className: 'game-map'
    });

    gameMapContainer.appendChild(gameMap);

    // Game chat container
    const gameChatContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-chat-container'
    });

    const gameChatMessages = this.framework.selectiveRenderer.createElement('div', {
      id: 'game-chat-messages',
      className: 'game-chat-messages'
    });

    const gameChatInputContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-chat-input-container',
      innerHTML: `
        <input id="game-chat-input" type="text" placeholder="Chat..." maxlength="100">
        <button id="game-chat-send">Send</button>
      `
    });

    gameChatContainer.appendChild(gameChatMessages);
    gameChatContainer.appendChild(gameChatInputContainer);

    // Assemble game UI
    gameUI.appendChild(gameInfo);
    gameUI.appendChild(gameMapContainer);
    gameUI.appendChild(gameChatContainer);

    // Controls info
    const controlsInfo = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-controls-info',
      innerHTML: `
        <p>Controls: Arrow keys or WASD to move, Space/Enter to place bomb</p>
        <p>Press F12 to toggle performance monitor</p>
      `
    });

    // Assemble final structure
    gameScreenContainer.appendChild(gameUI);
    gameScreenContainer.appendChild(controlsInfo);

    // Add to DOM
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(gameScreenContainer);

    // Initialize the player list
    this.updateGamePlayersList();
  }

  // ✅ NEW: Update game screen when state changes
  updateGameScreen(previousState, newState) {
    // Update player stats (which also updates the player list)
    this.updatePlayerStats();
    
    // Update timer if it has changed
    if (newState && newState.gameTimeLeft !== undefined) {
      this.updateTimer();
    }
  }

  // ✅ CONSOLIDATED: Use NotificationManager instead of duplicate methods
  showNotification(message, type = 'success') {
    if (this.notificationManager) {
      this.notificationManager.showNotification(message, type);
    } else if (this.onShowNotification) {
      this.onShowNotification(message, type);
    }
  }

  showError(message) {
    if (this.notificationManager) {
      this.notificationManager.showError(message);
    } else if (this.onShowError) {
      this.onShowError(message);
    }
  }

  // ===== DAMAGE EFFECTS =====

  // ✅ NEW: Screen flash effect
  createScreenFlash() {
    // Create or get existing flash overlay
    // ✅ FRAMEWORK: Use framework's getCachedElement instead of document.getElementById
    let flashOverlay = this.framework.getCachedElement('damage-flash-overlay');
    if (!flashOverlay) {
      // ✅ FRAMEWORK: Use framework's createElement instead of document.createElement
      flashOverlay = this.framework.createElement('div', {
        id: 'damage-flash-overlay',
        style: `
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
        `
      });
      document.body.appendChild(flashOverlay);
      // Cache the newly created element
      this.framework.cacheElement('damage-flash-overlay', flashOverlay);
    }

    // Trigger flash animation
    flashOverlay.style.opacity = '1';
    setTimeout(() => {
      flashOverlay.style.opacity = '0';
    }, 150);
  }

  // ✅ NEW: Screen shake effect
  createScreenShake() {
    // ✅ FRAMEWORK: Use framework's find instead of document.querySelector
    const gameScreen = this.framework.find('.game-screen') || document.body;

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

  // Handle player damage visual effects
  handlePlayerDamage() {
    // 1. Screen flash effect
    this.createScreenFlash();

    // 2. Screen shake effect
    this.createScreenShake();

    // 3. Lives counter highlight effect
    this.highlightLivesCounter();
  }
}
