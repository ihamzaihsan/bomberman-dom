// ✅ CONSOLIDATED: Import shared constants
import { GAME_TIMING } from '../../shared/GameConstants.js';

export class GameUIManager {
  constructor(framework) {
    this.framework = framework;

    // Event callbacks
    this.onReturnToLobby = null;
    this.onShowError = null;
    this.onShowNotification = null;

    // ✅ CONSOLIDATED: Reference to NotificationManager for notifications
    this.notificationManager = null;
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
    const gs = this.framework.get('gameState');
    if (gs && gs.gameTimeLeft !== undefined) {
      timeLeft = gs.gameTimeLeft;
    }
    // Only update if timer elements exist (we're in game screen)
    const timerValue = this.framework.getCachedElement('timer-value') || this.framework.find('#timer-value');
    const timerDisplay = this.framework.getCachedElement('timer-display') || this.framework.find('#timer-display');
    if (timerValue && timerDisplay) {
      timerValue.textContent = this.formatTime(timeLeft);
      // Optionally, add warning/caution classes
    }
  }

  // Update game timer from server events
  updateGameTimer(timeLeft) {
    console.log('GameUIManager: updateGameTimer called with timeLeft:', timeLeft);
    // ✅ FIX: Update game state with server-provided time via framework
    this.framework.merge('gameState', { gameTimeLeft: timeLeft });
    console.log('GameUIManager: framework gameState.gameTimeLeft set to:', timeLeft);

    // Update timer display
    console.log('GameUIManager: calling updateTimer()');
    this.updateTimer();
  }

  // Update waiting room timer
  updateWaitingTimer(waitingTimeLeft) {
    console.log('GameUIManager: updateWaitingTimer called with:', waitingTimeLeft);
    const timerElement = this.framework.getCachedElement('waiting-timer') || this.framework.find('#waiting-timer');
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
    const countdownText = this.framework.getCachedElement('countdown-text') || this.framework.find('#countdown-text');
    const countdownContainer = this.framework.getCachedElement('countdown-container') || this.framework.find('#countdown-container');
    const waitingTimerContainer = this.framework.find('.waiting-timer-container');

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
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    if (!gs || !gs.players || !pid) return;
    const currentPlayer = gs.players[pid];
    if (!currentPlayer) return;

    const livesElement = this.framework.getCachedElement('player-lives') || this.framework.find('#player-lives');
    const bombsElement = this.framework.getCachedElement('player-bombs') || this.framework.find('#player-bombs');

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
                        this.framework.find('#player-lives');

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
    // Clear element cache before recreating DOM to prevent stale references
    if (this.framework && this.framework.clearAllCaches) {
      this.framework.clearAllCaches();
    }

    const app = this.framework.find('#app');
    app.innerHTML = ''; // Clear previous content

    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    const winner = gs?.winner;
    const isCurrentPlayerWinner = winner && winner.id === pid;

    // Determine personalized messages and styling
    let personalMessage = '';
    let personalSubMessage = '';
    let announcementClass = 'winner-announcement';
    let announcementStyle = '';

    if (winner) {
      if (winner.id === 'draw') {
        personalMessage = 'It\'s a Draw!';
        personalSubMessage = 'No one wins this time';
        announcementStyle = 'background: linear-gradient(135deg, #f39c12, #e67e22);';
      } else if (winner.id === 'none') {
        personalMessage = 'Game Over';
        personalSubMessage = 'No winner this time';
        announcementStyle = 'background: linear-gradient(135deg, #95a5a6, #7f8c8d);';
      } else if (isCurrentPlayerWinner) {
        personalMessage = 'Victory!';
        personalSubMessage = 'You won!';
        announcementClass += ' victory-player';
        announcementStyle = 'background: linear-gradient(135deg, #27ae60, #2ecc71); box-shadow: 0 0 30px rgba(46, 204, 113, 0.5);';
      } else {
        personalMessage = 'You Lose';
        personalSubMessage = `${winner.nickname} wins!`;
        announcementClass += ' defeat-player';
        announcementStyle = 'background: linear-gradient(135deg, #e74c3c, #c0392b); box-shadow: 0 0 20px rgba(231, 76, 60, 0.3);';
      }
    } else {
      personalMessage = 'Game Over';
      personalSubMessage = 'Game ended unexpectedly';
      announcementStyle = 'background: linear-gradient(135deg, #95a5a6, #7f8c8d);';
    }

    // Add time-based context if applicable
    if ((gs?.gameTimeLeft ?? 0) <= 0) {
      personalMessage = isCurrentPlayerWinner ? 'Time\'s Up - You Win!' : 'Time\'s Up - You Lose';
    }

    const gameEndScreen = this.framework.selectiveRenderer.createElement('div', { className: 'game-end-screen' });

    // Announcement
    const announcement = this.framework.selectiveRenderer.createElement('div', { className: announcementClass, style: announcementStyle });
    const outcome = this.framework.selectiveRenderer.createElement('h1', { className: 'personal-outcome', innerHTML: `${isCurrentPlayerWinner ? '🏆' : (winner && winner.id !== 'draw' && winner.id !== 'none' ? '💀' : '🎮')} ${personalMessage} ${isCurrentPlayerWinner ? '🏆' : (winner && winner.id !== 'draw' && winner.id !== 'none' ? '💀' : '🎮')}` });
    const subMessage = this.framework.selectiveRenderer.createElement('div', { className: 'personal-submessage', textContent: personalSubMessage });
    announcement.appendChild(outcome);
    announcement.appendChild(subMessage);

    let flavorText;
    if (isCurrentPlayerWinner) {
      flavorText = this.framework.selectiveRenderer.createElement('p', { className: 'victory-flavor', textContent: 'Congratulations on your explosive victory!' });
    } else if (winner && winner.id !== 'draw' && winner.id !== 'none') {
      flavorText = this.framework.selectiveRenderer.createElement('p', { className: 'defeat-flavor', textContent: 'Better luck next time, bomber!' });
    } else {
      flavorText = this.framework.selectiveRenderer.createElement('p', { className: 'neutral-flavor', textContent: 'Thanks for playing!' });
    }
    announcement.appendChild(flavorText);

    // Final Results
    const finalResults = this.framework.selectiveRenderer.createElement('div', { className: 'final-results' });
    const resultsTitle = this.framework.selectiveRenderer.createElement('h3', { innerHTML: '📊 Final Results' });
    const playersFinalStats = this.framework.selectiveRenderer.createElement('div', { className: 'players-final-stats' });

    Object.values(gs.players).forEach(player => {
      const isWinner = winner && player.id === winner.id;
      const isCurrentPlayer = player.id === pid;
      let cssClass = 'player-final-stat';
      if (isCurrentPlayer) cssClass += ' current-player';
      if (isWinner) cssClass += ' winner';

      const playerStat = this.framework.selectiveRenderer.createElement('div', { className: cssClass });
      const playerName = this.framework.selectiveRenderer.createElement('span', { className: 'player-name', innerHTML: `${isWinner ? '👑 ' : ''}${player.nickname}${isCurrentPlayer ? ' (You)' : ''}` });
      const playerLives = this.framework.selectiveRenderer.createElement('span', { className: 'player-lives', innerHTML: `❤️ Lives: ${player.alive ? player.lives : 0}` });
      const playerStatus = this.framework.selectiveRenderer.createElement('span', { className: `player-status ${player.alive ? 'alive' : 'eliminated'}`,
        innerHTML: `${player.alive ? '✅ Alive' : '💀 Eliminated'}`
      });

      playerStat.appendChild(playerName);
      playerStat.appendChild(playerLives);
      playerStat.appendChild(playerStatus);
      playersFinalStats.appendChild(playerStat);
    });

    finalResults.appendChild(resultsTitle);
    finalResults.appendChild(playersFinalStats);

    // Game End Actions
    const gameEndActions = this.framework.selectiveRenderer.createElement('div', { className: 'game-end-actions' });
    const playAgainBtn = this.framework.selectiveRenderer.createElement('button', { id: 'play-again-btn', className: 'primary-button', innerHTML: '🎮 Play Again' });
    const countdownToLobby = this.framework.selectiveRenderer.createElement('div', { className: 'countdown-to-lobby' });
    const countdownP = this.framework.selectiveRenderer.createElement('p', { innerHTML: 'Auto-returning to lobby in <span id="lobby-countdown">10</span> seconds...' });
    countdownToLobby.appendChild(countdownP);
    gameEndActions.appendChild(playAgainBtn);
    gameEndActions.appendChild(countdownToLobby);

    gameEndScreen.appendChild(announcement);
    gameEndScreen.appendChild(finalResults);
    gameEndScreen.appendChild(gameEndActions);

    app.appendChild(gameEndScreen);

    // Set up play again button
    this.framework.eventManager.click('#play-again-btn', () => {
      if (this.onReturnToLobby) {
        this.onReturnToLobby();
      }
    });

    // Start countdown to return to lobby
    this.startLobbyCountdown();
  }

  startLobbyCountdown() {
    let countdown = GAME_TIMING.COUNTDOWN_DURATION; // ✅ CONSOLIDATED: Use shared constant
    const countdownElement = this.framework.find('#lobby-countdown');

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }

      if (countdown <= 0) {
        clearInterval(countdownInterval);
        // Only call the callback, don't automatically reset and show initial screen
        // Let the callback (returnToLobby) handle the reset logic
        if (this.onReturnToLobby) {
          this.onReturnToLobby();
        }
      }
    }, GAME_TIMING.TIMER_INTERVAL); // ✅ CONSOLIDATED: Use shared constant
  }

  // ===== GAME RESET FUNCTIONALITY =====
  resetGame() {
    // Clear UI-related elements/state for a fresh start (no local app state kept)
    // Clear element cache before recreating DOM to prevent stale references
    if (this.framework && this.framework.clearAllCaches) {
      this.framework.clearAllCaches();
    }
    // Clear app container
    const app = this.framework.find('#app');
    if (app) app.innerHTML = '';
    // Remove any lingering overlays (e.g., damage flash)
    const flashOverlay = this.framework.find('#damage-flash-overlay');
    if (flashOverlay) flashOverlay.remove();
    // Remove any notification area
    const notificationArea = this.framework.find('#notification-area');
    if (notificationArea) notificationArea.remove();
    // Don't automatically show initial screen - let calling code decide what to show
  }

  // ===== SCREEN MANAGEMENT =====

  showInitialScreen() {
    // Clear element cache before recreating DOM to prevent stale references
    if (this.framework && this.framework.clearAllCaches) {
      this.framework.clearAllCaches();
    }

    const app = this.framework.find('#app');
    app.innerHTML = ''; // Clear previous content

    const nicknameScreen = this.framework.selectiveRenderer.createElement('div', { className: 'nickname-screen' });
    const title = this.framework.selectiveRenderer.createElement('h1', { textContent: 'Bomberman' });
    const formContainer = this.framework.selectiveRenderer.createElement('div', { className: 'nickname-form-container' });
    const form = this.framework.selectiveRenderer.createElement('form', { id: 'nickname-form', action: 'javascript:void(0);' });
    const label = this.framework.selectiveRenderer.createElement('label', { htmlFor: 'nickname-input', textContent: 'Enter your nickname:' });
    const input = this.framework.selectiveRenderer.createElement('input', {
      id: 'nickname-input',
      type: 'text',
      placeholder: 'Your nickname',
      required: true,
      maxlength: '20',
      minlength: '2'
    });
    const button = this.framework.selectiveRenderer.createElement('button', { type: 'submit', textContent: 'Join Game' });
    const errorDiv = this.framework.selectiveRenderer.createElement('div', { id: 'error-message', className: 'error', style: 'display: none;' });

    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(button);

    formContainer.appendChild(form);
    formContainer.appendChild(errorDiv);

    nicknameScreen.appendChild(title);
    nicknameScreen.appendChild(formContainer);

    app.appendChild(nicknameScreen);

    // Focus on nickname
    const nicknameInput = this.framework.find('#nickname-input');
    if (nicknameInput) {
      nicknameInput.focus();
    }
  }

  showWaitingScreen() {
    // Clear element cache before recreating DOM to prevent stale references
    if (this.framework && this.framework.clearAllCaches) {
      this.framework.clearAllCaches();
    }

    const app = this.framework.find('#app');
    app.innerHTML = ''; // Clear previous content

    const waitingScreen = this.framework.selectiveRenderer.createElement('div', { className: 'waiting-screen' });
    const title = this.framework.selectiveRenderer.createElement('h1', { textContent: 'Waiting for Game to Start' });
    const waitingContent = this.framework.selectiveRenderer.createElement('div', { className: 'waiting-content' });

    const playerInfo = this.framework.selectiveRenderer.createElement('div', { className: 'player-info' });
    const playerInfoTitle = this.framework.selectiveRenderer.createElement('h3', { textContent: 'Players in Lobby:' });
    const playersList = this.framework.selectiveRenderer.createElement('div', { id: 'players-list', className: 'players-list' });
    const playerCountInfo = this.framework.selectiveRenderer.createElement('p', { id: 'player-count-info', textContent: 'Waiting for players...' });
    playerInfo.appendChild(playerInfoTitle);
    playerInfo.appendChild(playersList);
    playerInfo.appendChild(playerCountInfo);

    const chatContainer = this.framework.selectiveRenderer.createElement('div', { className: 'chat-container' });
    const chatTitle = this.framework.selectiveRenderer.createElement('h3', { textContent: 'Chat:' });
    const chatMessages = this.framework.selectiveRenderer.createElement('div', { id: 'chat-messages', className: 'chat-messages' });
    const chatInputContainer = this.framework.selectiveRenderer.createElement('div', { className: 'chat-input-container' });
    const chatInput = this.framework.selectiveRenderer.createElement('input', { id: 'chat-input', type: 'text', placeholder: 'Type a message...', maxlength: '100' });
    const chatButton = this.framework.selectiveRenderer.createElement('button', { id: 'chat-send', textContent: 'Send' });
    chatInputContainer.appendChild(chatInput);
    chatInputContainer.appendChild(chatButton);
    chatContainer.appendChild(chatTitle);
    chatContainer.appendChild(chatMessages);
    chatContainer.appendChild(chatInputContainer);

    waitingContent.appendChild(playerInfo);
    waitingContent.appendChild(chatContainer);

    const waitingTimerContainer = this.framework.selectiveRenderer.createElement('div', { className: 'waiting-timer-container' });
    const waitingTimerText = this.framework.selectiveRenderer.createElement('p', { innerHTML: 'Game starts in: <span id="waiting-timer">--:--</span>' });
    const waitingTimerSubtext = this.framework.selectiveRenderer.createElement('p', { textContent: 'Game will start automatically when timer expires or 4 players join' });
    waitingTimerContainer.appendChild(waitingTimerText);
    waitingTimerContainer.appendChild(waitingTimerSubtext);

    const countdownContainer = this.framework.selectiveRenderer.createElement('div', { id: 'countdown-container', className: 'countdown', style: 'display: none;' });
    const countdownText = this.framework.selectiveRenderer.createElement('h2', { id: 'countdown-text', textContent: 'Game starting in: 10' });
    countdownContainer.appendChild(countdownText);

    waitingScreen.appendChild(title);
    waitingScreen.appendChild(waitingContent);
    waitingScreen.appendChild(waitingTimerContainer);
    waitingScreen.appendChild(countdownContainer);

    app.appendChild(waitingScreen);

    // ✅ CRITICAL FIX: Update player list immediately after showing waiting screen
    this.updateWaitingScreen();
  }

  // ✅ NEW: Implement missing updateWaitingScreen method
  updateWaitingScreen() {
    const gs = this.framework.get('gameState');
    if (!gs) return;

    // Update player list
    this.updatePlayerList();

    // Update player count info
    this.updatePlayerCountInfo();

    // Update waiting timer if it exists
    if (gs.waitingTimeLeft !== undefined) {
      this.updateWaitingTimer(gs.waitingTimeLeft);
    }

    // Update countdown if it exists
    if ((gs.countdown || 0) > 0) {
      this.updateCountdown(gs.countdown);
    }
  }

  // ✅ NEW: Update player list in lobby
  updatePlayerList() {
    const playersListElement = this.framework.find('#players-list');
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    if (!playersListElement || !gs) return;

    playersListElement.innerHTML = ''; // Clear previous content

    const players = Object.values(gs.players);

    if (players.length === 0) {
      const playerItem = this.framework.selectiveRenderer.createElement('div', { className: 'player-item', textContent: 'No players in lobby' });
      playersListElement.appendChild(playerItem);
      return;
    }

    players.forEach((player) => {
      const isCurrentPlayer = player.id === pid;
      const playerItem = this.framework.selectiveRenderer.createElement('div', { className: `player-item ${isCurrentPlayer ? 'current-player' : ''}` });
      const playerName = this.framework.selectiveRenderer.createElement('span', { className: 'player-name', textContent: `${player.nickname}${isCurrentPlayer ? ' (You)' : ''}` });
      const playerStatus = this.framework.selectiveRenderer.createElement('span', { className: 'player-status', textContent: 'Ready' });
      playerItem.appendChild(playerName);
      playerItem.appendChild(playerStatus);
      playersListElement.appendChild(playerItem);
    });

    // Remove "Waiting for players..." if at least two players are in the lobby
    const playerCountElement = this.framework.find('#player-count-info');
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
    const playerCountElement = this.framework.find('#player-count-info');
    const gs = this.framework.get('gameState');
    if (!playerCountElement || !gs) return;

    const playerCount = Object.keys(gs.players).length;
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
    const playersListElement = this.framework.find('#players-list-game');
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    if (!playersListElement || !gs || !gs.players) return;

    // Clear existing content
    playersListElement.innerHTML = '';

    const players = Object.values(gs.players);

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
      const isCurrentPlayer = player.id === pid;

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
    // Clear element cache before recreating DOM to prevent stale references
    if (this.framework && this.framework.clearAllCaches) {
      this.framework.clearAllCaches();
    }

    // ✅ NEW: Use framework to create the game screen structure
    const gameScreenContainer = this.framework.selectiveRenderer.createElement('div', { className: 'game-screen' });

    // Create game UI section
    const gameUI = this.framework.selectiveRenderer.createElement('div', { className: 'game-ui' });

    // Game info section (timer and current player stats)
    const gameInfo = this.framework.selectiveRenderer.createElement('div', { className: 'game-info' });

    // Timer display
    const timerDisplay = this.framework.selectiveRenderer.createElement('div', { className: 'timer-display', id: 'timer-display', innerHTML: 'Time: <span id="timer-value">0:00</span>' });

    // Current player stats
    const playerStats = this.framework.selectiveRenderer.createElement('div', { className: 'player-stats' });

    const livesStatsDiv = this.framework.selectiveRenderer.createElement('div', { className: 'stat', innerHTML: '<span></span><span id="player-lives">3</span>' });

    const bombsStatsDiv = this.framework.selectiveRenderer.createElement('div', { className: 'stat', innerHTML: '<span>Bombs:</span><span id="player-bombs">1</span>' });

    // ✅ NEW: Players list with lives (moved to game-info)
    const playersListContainer = this.framework.selectiveRenderer.createElement('div', { className: 'game-players-list', id: 'game-players-list' });

    const playersListTitle = this.framework.selectiveRenderer.createElement('h4', { innerHTML: 'Players', style: 'margin: 10px 0 5px 0; color: #ecf0f1; font-size: 0.9em;' });

    const playersListDiv = this.framework.selectiveRenderer.createElement('div', { id: 'players-list-game', className: 'players-list-game' });

    // Assemble game info section
    playerStats.appendChild(livesStatsDiv);
    playerStats.appendChild(bombsStatsDiv);
    
    playersListContainer.appendChild(playersListTitle);
    playersListContainer.appendChild(playersListDiv);
    
    gameInfo.appendChild(timerDisplay);
    gameInfo.appendChild(playerStats);
    gameInfo.appendChild(playersListContainer);

    // Game map container
    const gameMapContainer = this.framework.selectiveRenderer.createElement('div', { className: 'game-map-container' });

    const gameMap = this.framework.selectiveRenderer.createElement('div', { id: 'game-map', className: 'game-map' });

    gameMapContainer.appendChild(gameMap);

    // Game chat container
    const gameChatContainer = this.framework.selectiveRenderer.createElement('div', { className: 'game-chat-container' });

    const gameChatMessages = this.framework.selectiveRenderer.createElement('div', { id: 'game-chat-messages', className: 'game-chat-messages' });

    const gameChatInputContainer = this.framework.selectiveRenderer.createElement('div', { className: 'game-chat-input-container', innerHTML: `
        <input id="game-chat-input" type="text" placeholder="Chat..." maxlength="100">
        <button id="game-chat-send">Send</button>
      ` });

    gameChatContainer.appendChild(gameChatMessages);
    gameChatContainer.appendChild(gameChatInputContainer);

    // Assemble game UI
    gameUI.appendChild(gameInfo);
    gameUI.appendChild(gameMapContainer);
    gameUI.appendChild(gameChatContainer);

    // Controls info
    const controlsInfo = this.framework.selectiveRenderer.createElement('div', { className: 'game-controls-info', innerHTML: `
        <p>Controls: Arrow keys or WASD to move, Space/Enter to place bomb</p>
        <p>Press F12 to toggle performance monitor</p>
      ` });

    // Assemble final structure
    gameScreenContainer.appendChild(gameUI);
    gameScreenContainer.appendChild(controlsInfo);

    // Add to DOM
    const app = this.framework.find('#app');
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
    const gs = this.framework.get('gameState');
    if (gs && gs.gameTimeLeft !== undefined) {
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
    if (!this.framework.find('#damage-shake-styles')) {
      const style = this.framework.selectiveRenderer.createElement('style', {
        id: 'damage-shake-styles',
        textContent: `
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
      `
      });
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
