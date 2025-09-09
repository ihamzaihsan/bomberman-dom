import { GAME_TIMING } from '../../shared/GameConstants.js';

export class GameUIManager {
  constructor(framework) {
    this.framework = framework;

    this.onReturnToLobby = null;
  }

  setCallbacks(callbacks) {
    this.onReturnToLobby = callbacks.onReturnToLobby || null;
  }

  updateTimer() {
    let timeLeft = 180;
    const gs = this.framework.get('gameState');
    if (gs && gs.gameTimeLeft !== undefined) {
      timeLeft = gs.gameTimeLeft;
    }

    const timerValue =
      this.framework.getCachedElement('timer-value') || this.framework.find('#timer-value');
    const timerDisplay =
      this.framework.getCachedElement('timer-display') || this.framework.find('#timer-display');
    if (timerValue && timerDisplay) {
      timerValue.textContent = this.formatTime(timeLeft);
    }
  }

  updateGameTimer(timeLeft) {
    this.framework.merge('gameState', { gameTimeLeft: timeLeft });

    this.updateTimer();
  }

  updateWaitingTimer(waitingTimeLeft) {
    const timerElement =
      this.framework.getCachedElement('waiting-timer') || this.framework.find('#waiting-timer');
    if (timerElement) {
      const formattedTime = this.formatTime(waitingTimeLeft);

      timerElement.textContent = formattedTime;
    } else {
      console.warn('GameUIManager: waiting-timer element not found');
    }
  }

  updateCountdown(countdown) {
    const countdownText =
      this.framework.getCachedElement('countdown-text') || this.framework.find('#countdown-text');
    const countdownContainer =
      this.framework.getCachedElement('countdown-container') ||
      this.framework.find('#countdown-container');
    const waitingTimerContainer = this.framework.find('.waiting-timer-container');

    if (countdownText && countdownContainer) {
      countdownText.textContent = `Game starting in: ${countdown}`;
      countdownContainer.style.display = countdown > 0 ? 'block' : 'none';

      if (waitingTimerContainer) {
        waitingTimerContainer.style.display = countdown > 0 ? 'none' : 'block';
      }
    } else {
      console.warn('GameUIManager: countdown elements not found');
    }
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  updatePlayerStats() {
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    if (!gs || !gs.players || !pid) return;
    const currentPlayer = gs.players[pid];
    if (!currentPlayer) return;

    const livesElement =
      this.framework.getCachedElement('player-lives') || this.framework.find('#player-lives');
    const bombsElement =
      this.framework.getCachedElement('player-bombs') || this.framework.find('#player-bombs');

    if (livesElement) {
      livesElement.textContent = `Lives: ${currentPlayer.lives ?? 1}`;
    }

    const maxBombs = typeof currentPlayer.maxBombs === 'number' ? currentPlayer.maxBombs : 1;
    const currentBombs =
      typeof currentPlayer.currentBombs === 'number' ? currentPlayer.currentBombs : 0;
    const availableBombs = maxBombs - currentBombs;

    if (bombsElement) {
      bombsElement.textContent = `${maxBombs}`;

      if (availableBombs <= 0) {
        bombsElement.style.color = '#e74c3c';
        bombsElement.style.fontWeight = 'bold';
        bombsElement.title = `No bombs left! (${currentBombs}/${maxBombs} active)`;
      } else if (availableBombs === maxBombs) {
        bombsElement.style.color = '#27ae60';
        bombsElement.style.fontWeight = '';
        bombsElement.title = `Max capacity: ${maxBombs} bombs, ${availableBombs} available`;
      } else {
        bombsElement.style.color = '#f39c12';
        bombsElement.style.fontWeight = '';
        bombsElement.title = `Max capacity: ${maxBombs} bombs, ${availableBombs} available, ${currentBombs} active`;
      }
    }

    this.updateGamePlayersList();
  }

  highlightLivesCounter() {
    const livesElement =
      this.framework.getCachedElement('player-lives') || this.framework.find('#player-lives');

    if (livesElement) {
      livesElement.style.transition = 'all 0.3s ease';
      livesElement.style.color = '#ff0000';
      livesElement.style.fontWeight = 'bold';
      livesElement.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.8)';
      livesElement.style.transform = 'scale(1.2)';

      setTimeout(() => {
        livesElement.style.color = '';
        livesElement.style.fontWeight = '';
        livesElement.style.textShadow = '';
        livesElement.style.transform = '';
      }, 1000);
    }
  }

  showGameEndScreen() {
    if (document.querySelector('.game-end-screen')) return;
    if (this.framework && this.framework.clearAllCaches) {
      this.framework.clearAllCaches();
    }

    const app = this.framework.find('#app');
    app.innerHTML = '';

    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    const winner = gs?.winner;
    const isCurrentPlayerWinner = winner && winner.id === pid;

    let personalMessage = '';
    let personalSubMessage = '';
    let announcementClass = 'winner-announcement';
    let announcementStyle = '';

    if (winner) {
      if (winner.id === 'draw') {
        personalMessage = "It's a Draw!";
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
        announcementStyle =
          'background: linear-gradient(135deg, #27ae60, #2ecc71); box-shadow: 0 0 30px rgba(46, 204, 113, 0.5);';
      } else {
        personalMessage = 'You Lose';
        personalSubMessage = `${winner.nickname} wins!`;
        announcementClass += ' defeat-player';
        announcementStyle =
          'background: linear-gradient(135deg, #e74c3c, #c0392b); box-shadow: 0 0 20px rgba(231, 76, 60, 0.3);';
      }
    } else {
      personalMessage = 'Game Over';
      personalSubMessage = 'Game ended unexpectedly';
      announcementStyle = 'background: linear-gradient(135deg, #95a5a6, #7f8c8d);';
    }

    if ((gs?.gameTimeLeft ?? 0) <= 0) {
      personalMessage = isCurrentPlayerWinner ? "Time's Up - You Win!" : "Time's Up - You Lose";
    }

    const gameEndScreen = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-end-screen',
    });

    const announcement = this.framework.selectiveRenderer.createElement('div', {
      className: announcementClass,
      style: announcementStyle,
    });
    const outcome = this.framework.selectiveRenderer.createElement('h1', {
      className: 'personal-outcome',
      innerHTML: `${isCurrentPlayerWinner ? '🏆' : winner && winner.id !== 'draw' && winner.id !== 'none' ? '💀' : '🎮'} ${personalMessage} ${isCurrentPlayerWinner ? '🏆' : winner && winner.id !== 'draw' && winner.id !== 'none' ? '💀' : '🎮'}`,
    });
    const subMessage = this.framework.selectiveRenderer.createElement('div', {
      className: 'personal-submessage',
      textContent: personalSubMessage,
    });
    announcement.appendChild(outcome);
    announcement.appendChild(subMessage);

    let flavorText;
    if (isCurrentPlayerWinner) {
      flavorText = this.framework.selectiveRenderer.createElement('p', {
        className: 'victory-flavor',
        textContent: 'Congratulations on your explosive victory!',
      });
    } else if (winner && winner.id !== 'draw' && winner.id !== 'none') {
      flavorText = this.framework.selectiveRenderer.createElement('p', {
        className: 'defeat-flavor',
        textContent: 'Better luck next time, bomber!',
      });
    } else {
      flavorText = this.framework.selectiveRenderer.createElement('p', {
        className: 'neutral-flavor',
        textContent: 'Thanks for playing!',
      });
    }
    announcement.appendChild(flavorText);

    const finalResults = this.framework.selectiveRenderer.createElement('div', {
      className: 'final-results',
    });
    const resultsTitle = this.framework.selectiveRenderer.createElement('h3', {
      innerHTML: '📊 Final Results',
    });
    const playersFinalStats = this.framework.selectiveRenderer.createElement('div', {
      className: 'players-final-stats',
    });

    Object.values(gs.players).forEach((player) => {
      const isWinner = winner && player.id === winner.id;
      const isCurrentPlayer = player.id === pid;
      let cssClass = 'player-final-stat';
      if (isCurrentPlayer) cssClass += ' current-player';
      if (isWinner) cssClass += ' winner';

      const playerStat = this.framework.selectiveRenderer.createElement('div', {
        className: cssClass,
      });
      const playerName = this.framework.selectiveRenderer.createElement('span', {
        className: 'player-name',
        textContent: `${isWinner ? '👑 ' : ''}${player.nickname}${isCurrentPlayer ? ' (You)' : ''}`,
      });
      const playerLives = this.framework.selectiveRenderer.createElement('span', {
        className: 'player-lives',
        innerHTML: `❤️ Lives: ${player.alive ? player.lives : 0}`,
      });
      const playerStatus = this.framework.selectiveRenderer.createElement('span', {
        className: `player-status ${player.alive ? 'alive' : 'eliminated'}`,
        innerHTML: `${player.alive ? '✅ Alive' : '💀 Eliminated'}`,
      });

      playerStat.appendChild(playerName);
      playerStat.appendChild(playerLives);
      playerStat.appendChild(playerStatus);
      playersFinalStats.appendChild(playerStat);
    });

    finalResults.appendChild(resultsTitle);
    finalResults.appendChild(playersFinalStats);

    const gameEndActions = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-end-actions',
    });
    const playAgainBtn = this.framework.selectiveRenderer.createElement('button', {
      id: 'play-again-btn',
      className: 'primary-button',
      innerHTML: '🎮 Play Again',
    });
    const countdownToLobby = this.framework.selectiveRenderer.createElement('div', {
      className: 'countdown-to-lobby',
    });
    const countdownP = this.framework.selectiveRenderer.createElement('p', {
      innerHTML: 'Auto-returning to lobby in <span id="lobby-countdown">10</span> seconds...',
    });
    countdownToLobby.appendChild(countdownP);
    gameEndActions.appendChild(playAgainBtn);
    gameEndActions.appendChild(countdownToLobby);

    gameEndScreen.appendChild(announcement);
    gameEndScreen.appendChild(finalResults);
    gameEndScreen.appendChild(gameEndActions);

    app.appendChild(gameEndScreen);

    this.framework.eventManager.click('#play-again-btn', () => {
      if (this.onReturnToLobby) {
        this.onReturnToLobby();
      }
    });

    this.startLobbyCountdown();
  }

  startLobbyCountdown() {
    clearInterval(this.lobbyCountdownInterval);
    let countdown = GAME_TIMING.COUNTDOWN_DURATION;
    const countdownElement = this.framework.find('#lobby-countdown');

    this.lobbyCountdownInterval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }

      if (countdown <= 0) {
        clearInterval(this.lobbyCountdownInterval);
        if (this.onReturnToLobby) {
          this.onReturnToLobby();
        }
      }
    }, GAME_TIMING.TIMER_INTERVAL);
  }

  showInitialScreen() {
    clearInterval(this.lobbyCountdownInterval);
    if (this.framework && this.framework.clearAllCaches) {
      this.framework.clearAllCaches();
    }

    const app = this.framework.find('#app');
    app.innerHTML = '';

    const nicknameScreen = this.framework.selectiveRenderer.createElement('div', {
      className: 'nickname-screen',
    });
    const title = this.framework.selectiveRenderer.createElement('h1', {
      textContent: 'Bomberman',
    });
    const subtitle = this.framework.createElement('p', {
      className: 'game-subtitle',
      textContent: 'Real-Time Multiplayer Web Game',
    });
    const instructions = this.framework.createElement('p', {
      className: 'lobby-instructions',
      textContent:
        '2–4 players · Arrow keys or WASD to move · Space to place a bomb. Open another browser tab or share this address with a friend to play.',
    });
    const formContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'nickname-form-container',
    });
    const form = this.framework.selectiveRenderer.createElement('form', { id: 'nickname-form' });
    const label = this.framework.selectiveRenderer.createElement('label', {
      htmlFor: 'nickname-input',
      textContent: 'Enter your nickname:',
    });
    const input = this.framework.selectiveRenderer.createElement('input', {
      id: 'nickname-input',
      type: 'text',
      placeholder: 'Your nickname',
      required: true,
      maxlength: '20',
      minlength: '2',
      autocomplete: 'nickname',
    });
    const button = this.framework.selectiveRenderer.createElement('button', {
      type: 'submit',
      textContent: 'Join Game',
    });
    const errorDiv = this.framework.selectiveRenderer.createElement('div', {
      id: 'error-message',
      role: 'alert',
      className: 'error',
      style: 'display: none;',
    });

    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(button);

    formContainer.appendChild(form);
    formContainer.appendChild(errorDiv);

    nicknameScreen.appendChild(title);
    nicknameScreen.appendChild(subtitle);
    nicknameScreen.appendChild(instructions);
    nicknameScreen.appendChild(formContainer);

    app.appendChild(nicknameScreen);

    const nicknameInput = this.framework.find('#nickname-input');
    if (nicknameInput) {
      nicknameInput.focus();
    }
  }

  showWaitingScreen() {
    if (this.framework && this.framework.clearAllCaches) {
      this.framework.clearAllCaches();
    }

    const app = this.framework.find('#app');
    app.innerHTML = '';

    const waitingScreen = this.framework.selectiveRenderer.createElement('div', {
      className: 'waiting-screen',
    });
    const title = this.framework.selectiveRenderer.createElement('h1', {
      textContent: 'Waiting for Game to Start',
    });
    const waitingContent = this.framework.selectiveRenderer.createElement('div', {
      className: 'waiting-content',
    });

    const playerInfo = this.framework.selectiveRenderer.createElement('div', {
      className: 'player-info',
    });
    const playerInfoTitle = this.framework.selectiveRenderer.createElement('h3', {
      textContent: 'Players in Lobby:',
    });
    const playersList = this.framework.selectiveRenderer.createElement('div', {
      id: 'players-list',
      className: 'players-list',
    });
    const playerCountInfo = this.framework.selectiveRenderer.createElement('p', {
      id: 'player-count-info',
      textContent: 'Waiting for players...',
    });
    playerInfo.appendChild(playerInfoTitle);
    playerInfo.appendChild(playersList);
    playerInfo.appendChild(playerCountInfo);

    const chatContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'chat-container',
    });
    const chatTitle = this.framework.selectiveRenderer.createElement('h3', {
      textContent: 'Chat:',
    });
    const chatMessages = this.framework.selectiveRenderer.createElement('div', {
      id: 'chat-messages',
      className: 'chat-messages',
    });
    const chatInputContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'chat-input-container',
    });
    const chatInput = this.framework.selectiveRenderer.createElement('input', {
      id: 'chat-input',
      'aria-label': 'Lobby chat message',
      type: 'text',
      placeholder: 'Type a message...',
      maxlength: '100',
    });
    const chatButton = this.framework.selectiveRenderer.createElement('button', {
      id: 'chat-send',
      textContent: 'Send',
    });
    chatInputContainer.appendChild(chatInput);
    chatInputContainer.appendChild(chatButton);
    chatContainer.appendChild(chatTitle);
    chatContainer.appendChild(chatMessages);
    chatContainer.appendChild(chatInputContainer);

    waitingContent.appendChild(playerInfo);
    waitingContent.appendChild(chatContainer);

    const waitingTimerContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'waiting-timer-container',
    });
    const waitingTimerText = this.framework.selectiveRenderer.createElement('p', {
      innerHTML: 'Game starts in: <span id="waiting-timer">--:--</span>',
    });
    const waitingTimerSubtext = this.framework.selectiveRenderer.createElement('p', {
      textContent: 'Game will start automatically when timer expires or 4 players join',
    });
    waitingTimerContainer.appendChild(waitingTimerText);
    waitingTimerContainer.appendChild(waitingTimerSubtext);

    const countdownContainer = this.framework.selectiveRenderer.createElement('div', {
      id: 'countdown-container',
      className: 'countdown',
      style: 'display: none;',
    });
    const countdownText = this.framework.selectiveRenderer.createElement('h2', {
      id: 'countdown-text',
      textContent: 'Game starting in: 10',
    });
    countdownContainer.appendChild(countdownText);

    waitingScreen.appendChild(title);
    waitingScreen.appendChild(waitingContent);
    waitingScreen.appendChild(waitingTimerContainer);
    waitingScreen.appendChild(countdownContainer);

    app.appendChild(waitingScreen);

    this.updateWaitingScreen();
  }

  updateWaitingScreen() {
    const gs = this.framework.get('gameState');
    if (!gs) return;

    this.updatePlayerList();

    this.updatePlayerCountInfo();

    if (gs.waitingTimeLeft !== undefined) {
      this.updateWaitingTimer(gs.waitingTimeLeft);
    }

    this.updateCountdown(gs.countdown || 0);
  }

  updatePlayerList() {
    const playersListElement = this.framework.find('#players-list');
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    if (!playersListElement || !gs) return;

    playersListElement.innerHTML = '';

    const players = Object.values(gs.players);

    if (players.length === 0) {
      const playerItem = this.framework.selectiveRenderer.createElement('div', {
        className: 'player-item',
        textContent: 'No players in lobby',
      });
      playersListElement.appendChild(playerItem);
      return;
    }

    players.forEach((player) => {
      const isCurrentPlayer = player.id === pid;
      const playerItem = this.framework.selectiveRenderer.createElement('div', {
        className: `player-item ${isCurrentPlayer ? 'current-player' : ''}`,
      });
      const playerName = this.framework.selectiveRenderer.createElement('span', {
        className: 'player-name',
        textContent: `${player.nickname}${isCurrentPlayer ? ' (You)' : ''}`,
      });
      const playerStatus = this.framework.selectiveRenderer.createElement('span', {
        className: 'player-status',
        textContent: 'Ready',
      });
      playerItem.appendChild(playerName);
      playerItem.appendChild(playerStatus);
      playersListElement.appendChild(playerItem);
    });

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

  updateGamePlayersList() {
    const playersListElement = this.framework.find('#players-list-game');
    const gs = this.framework.get('gameState');
    const pid = this.framework.get('playerId');
    if (!playersListElement || !gs || !gs.players) return;

    playersListElement.innerHTML = '';

    const players = Object.values(gs.players);

    if (players.length === 0) {
      const emptyMessage = this.framework.selectiveRenderer.createElement('div', {
        className: 'no-players-message',
        textContent: 'No players in game',
        style: 'color: #bdc3c7; font-style: italic; text-align: center; padding: 10px;',
      });
      playersListElement.appendChild(emptyMessage);
      return;
    }

    players.forEach((player, index) => {
      const isCurrentPlayer = player.id === pid;

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
        `,
      });

      const playerNameContainer = this.framework.selectiveRenderer.createElement('div', {
        className: 'player-name-container',
        style: 'display: flex; align-items: center; gap: 6px;',
      });

      if (isCurrentPlayer) {
        const crown = this.framework.selectiveRenderer.createElement('span', {
          className: 'player-crown',
          innerHTML: '👑',
          style: 'font-size: 1.1em; filter: drop-shadow(0 0 3px gold);',
          title: 'You',
        });
        playerNameContainer.appendChild(crown);
      }

      const playerName = this.framework.selectiveRenderer.createElement('span', {
        className: 'player-name',
        textContent: player.nickname,
        style: 'font-weight: bold;',
      });

      playerNameContainer.appendChild(playerName);

      const livesContainer = this.framework.selectiveRenderer.createElement('div', {
        className: 'player-lives-container',
        style: 'display: flex; align-items: center; gap: 4px;',
      });

      const livesLabel = this.framework.selectiveRenderer.createElement('span', {
        textContent: 'Lives:',
        style: 'font-size: 0.8em; color: #bdc3c7;',
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
        `,
      });

      livesContainer.appendChild(livesLabel);
      livesContainer.appendChild(livesCount);

      playerItem.appendChild(playerNameContainer);
      playerItem.appendChild(livesContainer);

      playersListElement.appendChild(playerItem);
    });
  }

  showGameScreen() {
    if (this.framework && this.framework.clearAllCaches) {
      this.framework.clearAllCaches();
    }

    const gameScreenContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-screen',
    });

    const heading = this.framework.createElement('header', { className: 'game-heading' });
    heading.append(
      this.framework.createElement('h1', { textContent: 'Bomberman' }),
      this.framework.createElement('p', { textContent: 'Real-Time Multiplayer Web Game' }),
    );
    gameScreenContainer.appendChild(heading);
    const gameUI = this.framework.selectiveRenderer.createElement('div', { className: 'game-ui' });

    const gameInfo = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-info',
    });

    const timerDisplay = this.framework.selectiveRenderer.createElement('div', {
      className: 'timer-display',
      id: 'timer-display',
      innerHTML: 'Time: <span id="timer-value">0:00</span>',
    });

    const playerStats = this.framework.selectiveRenderer.createElement('div', {
      className: 'player-stats',
    });

    const livesStatsDiv = this.framework.selectiveRenderer.createElement('div', {
      className: 'stat',
      innerHTML: '<span></span><span id="player-lives">3</span>',
    });

    const bombsStatsDiv = this.framework.selectiveRenderer.createElement('div', {
      className: 'stat',
      innerHTML: '<span>Bombs:</span><span id="player-bombs">1</span>',
    });

    const playersListContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-players-list',
      id: 'game-players-list',
    });

    const playersListTitle = this.framework.selectiveRenderer.createElement('h4', {
      innerHTML: 'Players',
      style: 'margin: 10px 0 5px 0; color: #ecf0f1; font-size: 0.9em;',
    });

    const playersListDiv = this.framework.selectiveRenderer.createElement('div', {
      id: 'players-list-game',
      className: 'players-list-game',
    });

    playerStats.appendChild(livesStatsDiv);
    playerStats.appendChild(bombsStatsDiv);

    playersListContainer.appendChild(playersListTitle);
    playersListContainer.appendChild(playersListDiv);

    gameInfo.appendChild(timerDisplay);
    gameInfo.appendChild(playerStats);
    gameInfo.appendChild(playersListContainer);

    const gameMapContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-map-container',
    });

    const gameMap = this.framework.selectiveRenderer.createElement('div', {
      id: 'game-map',
      className: 'game-map',
    });

    gameMapContainer.appendChild(gameMap);

    const gameChatContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-chat-container',
    });

    const gameChatMessages = this.framework.selectiveRenderer.createElement('div', {
      id: 'game-chat-messages',
      className: 'game-chat-messages',
    });

    const gameChatInputContainer = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-chat-input-container',
      innerHTML: `
        <input id="game-chat-input" aria-label="Game chat message" type="text" placeholder="Chat..." maxlength="100">
        <button id="game-chat-send">Send</button>
      `,
    });

    gameChatContainer.appendChild(gameChatMessages);
    gameChatContainer.appendChild(gameChatInputContainer);

    gameUI.appendChild(gameInfo);
    gameUI.appendChild(gameMapContainer);
    gameUI.appendChild(gameChatContainer);

    const controlsInfo = this.framework.selectiveRenderer.createElement('div', {
      className: 'game-controls-info',
      innerHTML: `
        <p>Controls: Arrow keys or WASD to move, Space/Enter to place bomb</p>
        <p>Press F2 to toggle performance monitor</p>
      `,
    });

    gameScreenContainer.appendChild(gameUI);
    gameScreenContainer.appendChild(controlsInfo);

    const app = this.framework.find('#app');
    app.innerHTML = '';
    app.appendChild(gameScreenContainer);

    this.updateGamePlayersList();
  }

  updateGameScreen() {
    this.updatePlayerStats();

    const gs = this.framework.get('gameState');
    if (gs && gs.gameTimeLeft !== undefined) {
      this.updateTimer();
    }
  }

  createScreenFlash() {
    let flashOverlay = this.framework.getCachedElement('damage-flash-overlay');
    if (!flashOverlay) {
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
        `,
      });
      document.body.appendChild(flashOverlay);
      this.framework.cacheElement('damage-flash-overlay', flashOverlay);
    }

    flashOverlay.style.opacity = '1';
    setTimeout(() => {
      flashOverlay.style.opacity = '0';
    }, 150);
  }

  createScreenShake() {
    const gameScreen = this.framework.find('.game-screen') || document.body;

    gameScreen.classList.add('damage-shake');

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
      `,
      });
      document.head.appendChild(style);
    }

    setTimeout(() => {
      gameScreen.classList.remove('damage-shake');
    }, 500);
  }

  handlePlayerDamage() {
    this.createScreenFlash();

    this.createScreenShake();

    this.highlightLivesCounter();
  }
}
