import { Framework } from '../framework/framework.js';

class BombermanApp {
  constructor() {
    this.framework = new Framework();
    this.gameState = null;
    this.playerId = null;
    this.nickname = '';
    this.gameLoop = null;
    
    this.init();
  }

  init() {
    this.setupEventHandlers();
    
    // Focus on the nickname input
    const nicknameInput = document.getElementById('nickname-input');
    if (nicknameInput) {
      nicknameInput.focus();
    }
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
        this.startGameStatePolling();
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

  startGameStatePolling() {
    // Clear any existing polling
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }

    // Poll game state every 500ms
    this.gameLoop = setInterval(async () => {
      try {
        const response = await fetch('/api/gamestate');
        const gameState = await response.json();
        
        console.log('Received game state:', gameState);
        
        this.gameState = gameState;
        
        // Update UI based on game state
        if (gameState.gameStarted) {
          this.showGameScreen();
        } else {
          this.updateWaitingScreen();
        }

      } catch (error) {
        console.error('Failed to fetch game state:', error);
      }
    }, 500);
  }

  showWaitingScreen() {
    if (!this.gameState) {
      console.error('Cannot show waiting screen: gameState is null');
      return;
    }

    const app = document.getElementById('app');
    const playerCount = Object.keys(this.gameState.players).length;
    
    app.innerHTML = `
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
  }

  updateWaitingScreen() {
    if (!this.gameState) return;

    const playerCountElement = document.getElementById('player-count');
    const playersListElement = document.getElementById('players-list');
    const countdownContainer = document.getElementById('countdown-container');
    const countdownText = document.getElementById('countdown-text');

    if (playerCountElement && playersListElement) {
      const playerCount = Object.keys(this.gameState.players).length;
      playerCountElement.textContent = `Players: ${playerCount}/4`;
      
      playersListElement.innerHTML = Object.values(this.gameState.players).map(player => 
        `<div class="player-item">${player.nickname}</div>`
      ).join('');

      // Show countdown if it's started
      if (this.gameState.countdown > 0 && countdownContainer && countdownText) {
        countdownContainer.style.display = 'block';
        countdownText.textContent = `Game starting in: ${this.gameState.countdown}`;
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
    
    app.innerHTML = `
      <div class="game-screen">
        <div class="game-ui">
          <div class="player-stats">
            <span>${player.nickname || 'Player'}</span>
            <span>Lives: ${player.lives || 0}</span>
            <span>Bombs: ${player.powerUps?.bombs || 1}</span>
          </div>
          <div class="controls-info">
            <p>Controls: Arrow keys or WASD to move, Space/Enter to place bomb</p>
          </div>
        </div>
        <div class="game-map" id="game-map">
          ${this.renderGameMap()}
        </div>
      </div>
    `;

    // Set up game controls
    this.setupGameControls();
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
          <div class="cell ${cell}">
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
      if (this.gameState?.gameStarted) {
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
    try {
      const response = await fetch('/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId: this.playerId, direction })
      });

      const data = await response.json();
      if (data.success && data.gameState) {
        this.gameState = data.gameState;
        this.updateGameMap();
      }
    } catch (error) {
      console.error('Error moving player:', error);
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

  // Clean up when the app is destroyed
  destroy() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }
    if (this.gameKeyHandler) {
      document.removeEventListener('keydown', this.gameKeyHandler);
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
