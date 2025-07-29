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
    let countdown = 10;
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
    }, 1000);
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
        
        <div class="waiting-info">
          <div class="player-list-container">
            <h3>Players in Lobby:</h3>
            <div id="player-list" class="player-list"></div>
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
        
        <div id="countdown-container" style="display: none;">
          <h2 id="countdown-text">Game starting in: 10</h2>
        </div>
      </div>
    `;
  }

  showGameScreen() {
    const app = document.getElementById('app');
    
    app.innerHTML = `
      <div class="game-screen">
        <div class="game-ui">
          <div class="game-info">
            <div class="timer-display" id="timer-display">
              Time: <span id="timer-value">0:00</span>
            </div>
            <div class="player-stats">
              <div class="stat">
                <span>Lives:</span>
                <span id="player-lives">3</span>
              </div>
              <div class="stat">
                <span>Bombs:</span>
                <span id="player-bombs">1</span>
              </div>
            </div>
          </div>
          
          <div class="game-map-container">
            <div id="game-map" class="game-map"></div>
          </div>
          
          <div class="game-chat-container">
            <div id="game-chat-messages" class="game-chat-messages"></div>
            <div class="game-chat-input-container">
              <input id="game-chat-input" type="text" placeholder="Chat..." maxlength="100">
              <button id="game-chat-send">Send</button>
            </div>
          </div>
        </div>
        
        <div class="game-controls-info">
          <p>Controls: Arrow keys or WASD to move, Space/Enter to place bomb</p>
          <p>Press F12 to toggle performance monitor</p>
        </div>
      </div>
    `;
  }

  // ===== NOTIFICATIONS =====

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
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 10000;
        font-weight: bold;
        max-width: 400px;
        text-align: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      document.body.appendChild(notificationDiv);
    }

    // Set notification style based on type
    switch (type) {
      case 'success':
        notificationDiv.style.background = '#27ae60';
        notificationDiv.style.color = 'white';
        break;
      case 'error':
        notificationDiv.style.background = '#e74c3c';
        notificationDiv.style.color = 'white';
        break;
      case 'warning':
        notificationDiv.style.background = '#f39c12';
        notificationDiv.style.color = 'white';
        break;
      case 'info':
        notificationDiv.style.background = '#3498db';
        notificationDiv.style.color = 'white';
        break;
      default:
        notificationDiv.style.background = '#95a5a6';
        notificationDiv.style.color = 'white';
    }

    notificationDiv.textContent = message;
    notificationDiv.style.opacity = '1';

    // Auto-hide after different durations based on type
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      notificationDiv.style.opacity = '0';
    }, duration);
  }

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    } else {
      // Fallback to notification
      this.showNotification(message, 'error');
    }
  }

  // ===== DAMAGE EFFECTS =====

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
