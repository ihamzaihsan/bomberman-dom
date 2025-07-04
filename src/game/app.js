/**
 * Main Application Entry Point for Bomberman DOM Game
 * Initializes the framework, sets up routing, and manages application state
 */

import { Framework } from '../framework/framework.js';
import { GameConfig } from './core/config.js';
import { PerformanceMonitor } from './utils/performance-monitor.js';
import { LandingPage } from './ui/landing-page.js';
import { WaitingRoom } from './ui/waiting-room.js';
import { GameScreen } from './ui/game-screen.js';
import { ErrorHandler } from './utils/error-handler.js';
import { GameEngine } from './core/game-engine.js';

class BombermanApp {
  constructor() {
    this.framework = new Framework();
    this.performanceMonitor = new PerformanceMonitor();
    this.errorHandler = new ErrorHandler();
    this.gameEngine = new GameEngine();

    this.gameState = {
      currentScreen: 'landing',
      playerNickname: '',
      gameStarted: false,
      gameData: null
    };

    this.init();
  }

  init() {
    try {
      // Initialize error handling
      this.errorHandler.init();
      
      // Initialize performance monitoring
      this.performanceMonitor.init();
      
      // Set up framework state
      this.framework.setState(this.gameState);
      
      // Register components
      this.registerComponents();
      
      // Set up routes
      this.setupRoutes();
      
      // Set up event handlers
      this.setupEventHandlers();

      // Initialize the application
      this.framework.onReady(() => {
        this.start();
      });
      
    } catch (error) {
      this.errorHandler.handleError(error, 'Application initialization failed');
    }
  }

  registerComponents() {
    // Register UI components with the framework
    this.framework.component('landing-page', (props) => 
      LandingPage(this.framework, props, this.handleLandingActions.bind(this))
    );
    
    this.framework.component('waiting-room', (props) => 
      WaitingRoom(this.framework, props, this.handleWaitingActions.bind(this))
    );
    
    this.framework.component('game-screen', (props) => 
      GameScreen(this.framework, props, this.handleGameActions.bind(this))
    );
  }

  setupRoutes() {
    // Define application routes
    this.framework.route('/', () => {
      return this.framework.use('landing-page', this.framework.getState());
    });
    
    this.framework.route('/waiting', () => {
      return this.framework.use('waiting-room', this.framework.getState());
    });
    
    this.framework.route('/game', () => {
      return this.framework.use('game-screen', this.framework.getState());
    });
    
    // Set error page
    this.framework.setErrorPage((errorMessage) => {
      return this.framework.div({ class: 'error-page' }, [
        this.framework.h1({}, 'Oops! Something went wrong'),
        this.framework.p({}, errorMessage),
        this.framework.button({ 
          class: 'btn btn-primary',
          onclick: () => this.navigateToLanding()
        }, 'Back to Home')
      ]);
    });
  }

  setupEventHandlers() {
    // Global keyboard handlers
    document.addEventListener('keydown', (e) => {
      if (this.gameState.currentScreen === 'game') {
        this.handleGameInput(e);
      }
    });
    
    // Window focus/blur handlers for performance optimization
    window.addEventListener('focus', () => {
      this.performanceMonitor.resume();
    });
    
    window.addEventListener('blur', () => {
      this.performanceMonitor.pause();
    });
    
    // Handle window resize for responsive design
    window.addEventListener('resize', () => {
      this.handleResize();
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performanceMonitor.pause();
      } else {
        this.performanceMonitor.resume();
      }
    });
  }

  // Removed network handlers - single player mode

  // Action handlers for different screens
  handleLandingActions(action, data) {
    switch (action) {
      case 'start-game':
        this.startSinglePlayerGame(data.nickname);
        break;
      default:
        console.warn('Unknown landing action:', action);
    }
  }

  handleWaitingActions(action, data) {
    switch (action) {
      case 'start-game':
        this.navigateToGame();
        break;
      case 'back-to-menu':
        this.navigateToLanding();
        break;
      default:
        console.warn('Unknown waiting action:', action);
    }
  }

  handleGameActions(action, data) {
    switch (action) {
      case 'player-move':
        this.gameEngine.movePlayer(data.direction);
        this.updateGameDisplay();
        break;
      case 'place-bomb':
        this.gameEngine.placeBomb();
        this.updateGameDisplay();
        break;
      case 'back-to-menu':
        this.navigateToLanding();
        break;
      default:
        console.warn('Unknown game action:', action);
    }
  }

  // Single-player game flow methods
  startSinglePlayerGame(nickname) {
    try {
      this.updateState({
        playerNickname: nickname,
        currentScreen: 'waiting'
      });
      this.navigateToWaiting();

      // Auto-start game after a brief delay (simulate waiting room)
      setTimeout(() => {
        this.initializeGame();
      }, 2000);
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to start game');
    }
  }

  initializeGame() {
    try {
      // Initialize the game engine
      this.gameEngine.initializeBoard();
      this.gameEngine.spawnPlayer(this.gameState.playerNickname);

      this.updateState({
        currentScreen: 'game',
        gameStarted: true,
        gameData: this.gameEngine.getGameState()
      });
      this.navigateToGame();
    } catch (error) {
      this.errorHandler.handleError(error, 'Failed to initialize game');
    }
  }

  updateGameDisplay() {
    this.updateState({
      gameData: this.gameEngine.getGameState()
    });
  }

  handleGameOver(data) {
    console.log('Game over:', data);
    // TODO: Show game over screen
  }

  handleGameInput(event) {
    // Handle keyboard input for game controls
    if (this.gameState.currentScreen !== 'game' || !this.gameState.gameStarted) {
      return;
    }

    const keyMap = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      'Space': 'bomb',
      'Escape': 'menu'
    };

    const action = keyMap[event.code];
    if (action) {
      event.preventDefault();

      if (action === 'bomb') {
        this.handleGameActions('place-bomb');
      } else if (action === 'menu') {
        this.handleGameActions('back-to-menu');
      } else {
        this.handleGameActions('player-move', { direction: action });
      }
    }
  }

  handleResize() {
    // Handle responsive design adjustments
    this.framework.notify();
  }

  // Navigation methods
  navigateToLanding() {
    this.updateState({ currentScreen: 'landing' });
    this.framework.navigate('/');
  }

  navigateToWaiting() {
    this.updateState({ currentScreen: 'waiting' });
    this.framework.navigate('/waiting');
  }

  navigateToGame() {
    this.updateState({ currentScreen: 'game' });
    this.framework.navigate('/game');
  }

  // State management
  updateState(newState) {
    this.gameState = { ...this.gameState, ...newState };
    this.framework.setState(this.gameState);
  }

  start() {
    // Start the application
    this.framework.currentRoute = this.framework.getCurrentRoute();
    this.framework.render();

    // Start performance monitoring
    if (this.performanceMonitor.isMonitoringEnabled()) {
      this.performanceMonitor.start();
    }

    console.log('Bomberman DOM Game started!');
    console.log('Framework version:', '1.0.0');
    console.log('Performance monitoring:', this.performanceMonitor.isMonitoringEnabled());
  }
}

// Initialize the application when the script loads
const app = new BombermanApp();

// Export for debugging purposes
window.BombermanApp = app;
