/**
 * Error Handler for Bomberman DOM Game
 * Centralized error handling and user feedback system
 */

import { GameConfig } from '../core/config.js';

export class ErrorHandler {
  constructor() {
    this.errorQueue = [];
    this.isInitialized = false;
    this.errorContainer = null;
    this.maxErrors = 10;
    this.errorTimeout = 5000; // 5 seconds
    
    // Error statistics
    this.errorStats = {
      total: 0,
      network: 0,
      game: 0,
      validation: 0,
      server: 0,
      unknown: 0
    };
  }

  init() {
    if (this.isInitialized) return;

    // Set up global error handlers
    this.setupGlobalHandlers();

    // Create error container if it doesn't exist
    this.setupErrorContainer();

    this.isInitialized = true;

    if (GameConfig.DEBUG_MODE) {
      console.log('Error Handler initialized');
    }
  }

  setupGlobalHandlers() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'Uncaught Error', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'Unhandled Promise Rejection');
      event.preventDefault(); // Prevent default browser handling
    });
    
    // Handle WebSocket errors (will be overridden by NetworkManager)
    window.addEventListener('offline', () => {
      this.showError('You are offline. Please check your internet connection.');
    });
    
    window.addEventListener('online', () => {
      this.showSuccess('Connection restored.');
    });
  }

  setupErrorContainer() {
    // Look for existing error container
    this.errorContainer = document.getElementById('error-container');
    
    if (!this.errorContainer) {
      // Create error container
      this.errorContainer = document.createElement('div');
      this.errorContainer.id = 'error-container';
      this.errorContainer.className = 'error-container';
      this.errorContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;
      `;
      
      document.body.appendChild(this.errorContainer);
    }
  }

  /**
   * Handle an error with context and user feedback
   * @param {Error|string} error - The error object or message
   * @param {string} context - Context where the error occurred
   * @param {Object} metadata - Additional error metadata
   */
  handleError(error, context = 'Unknown', metadata = {}) {
    const errorInfo = this.processError(error, context, metadata);
    
    // Log the error
    this.logError(errorInfo);
    
    // Update statistics
    this.updateStats(errorInfo.type);
    
    // Show user-friendly message
    this.showError(errorInfo.userMessage);
    
    // Store error for debugging
    this.storeError(errorInfo);
    
    // Report to external service if configured
    this.reportError(errorInfo);
  }

  processError(error, context, metadata) {
    let message = '';
    let stack = '';
    let type = GameConfig.ERROR_TYPES.UNKNOWN;
    
    if (error instanceof Error) {
      message = error.message;
      stack = error.stack || '';
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = 'Unknown error occurred';
    }
    
    // Determine error type
    if (context.toLowerCase().includes('network') || 
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('websocket')) {
      type = GameConfig.ERROR_TYPES.NETWORK_ERROR;
    } else if (context.toLowerCase().includes('game')) {
      type = GameConfig.ERROR_TYPES.GAME_ERROR;
    } else if (context.toLowerCase().includes('validation')) {
      type = GameConfig.ERROR_TYPES.VALIDATION_ERROR;
    } else if (context.toLowerCase().includes('server')) {
      type = GameConfig.ERROR_TYPES.SERVER_ERROR;
    }
    
    // Generate user-friendly message
    const userMessage = this.generateUserMessage(type, message, context);
    
    return {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      type,
      message,
      context,
      stack,
      userMessage,
      metadata: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...metadata
      }
    };
  }

  generateUserMessage(type, message, context) {
    switch (type) {
      case GameConfig.ERROR_TYPES.NETWORK_ERROR:
        return 'Connection problem. Please check your internet connection and try again.';
      
      case GameConfig.ERROR_TYPES.VALIDATION_ERROR:
        return message; // Validation errors are usually user-friendly
      
      case GameConfig.ERROR_TYPES.GAME_ERROR:
        return 'A game error occurred. The game will try to recover automatically.';
      
      case GameConfig.ERROR_TYPES.SERVER_ERROR:
        return 'Server error. Please try again in a moment.';
      
      default:
        return 'Something went wrong. Please refresh the page if the problem persists.';
    }
  }

  logError(errorInfo) {
    if (GameConfig.DEBUG_MODE) {
      console.group(`🚨 Error: ${errorInfo.context}`);
      console.error('Message:', errorInfo.message);
      console.error('Type:', errorInfo.type);
      console.error('Timestamp:', new Date(errorInfo.timestamp).toISOString());
      if (errorInfo.stack) {
        console.error('Stack:', errorInfo.stack);
      }
      if (Object.keys(errorInfo.metadata).length > 0) {
        console.error('Metadata:', errorInfo.metadata);
      }
      console.groupEnd();
    } else {
      console.error(`Error [${errorInfo.type}]: ${errorInfo.message}`);
    }
  }

  updateStats(type) {
    this.errorStats.total++;
    
    switch (type) {
      case GameConfig.ERROR_TYPES.NETWORK_ERROR:
        this.errorStats.network++;
        break;
      case GameConfig.ERROR_TYPES.GAME_ERROR:
        this.errorStats.game++;
        break;
      case GameConfig.ERROR_TYPES.VALIDATION_ERROR:
        this.errorStats.validation++;
        break;
      case GameConfig.ERROR_TYPES.SERVER_ERROR:
        this.errorStats.server++;
        break;
      default:
        this.errorStats.unknown++;
    }
  }

  storeError(errorInfo) {
    this.errorQueue.push(errorInfo);
    
    // Keep only recent errors
    if (this.errorQueue.length > this.maxErrors) {
      this.errorQueue.shift();
    }
  }

  reportError(errorInfo) {
    // TODO: Implement external error reporting service
    // This could send errors to a logging service like Sentry, LogRocket, etc.
    if (GameConfig.DEBUG_MODE) {
      console.log('Error would be reported to external service:', errorInfo);
    }
  }

  /**
   * Show an error message to the user
   * @param {string} message - Error message to display
   * @param {number} duration - How long to show the message (ms)
   */
  showError(message, duration = this.errorTimeout) {
    this.showMessage(message, 'error', duration);
  }

  /**
   * Show a success message to the user
   * @param {string} message - Success message to display
   * @param {number} duration - How long to show the message (ms)
   */
  showSuccess(message, duration = this.errorTimeout) {
    this.showMessage(message, 'success', duration);
  }

  /**
   * Show a warning message to the user
   * @param {string} message - Warning message to display
   * @param {number} duration - How long to show the message (ms)
   */
  showWarning(message, duration = this.errorTimeout) {
    this.showMessage(message, 'warning', duration);
  }

  /**
   * Show a message to the user
   * @param {string} message - Message to display
   * @param {string} type - Message type (error, success, warning)
   * @param {number} duration - How long to show the message (ms)
   */
  showMessage(message, type = 'error', duration = this.errorTimeout) {
    if (!this.errorContainer) {
      this.setupErrorContainer();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `message message-${type} fade-in`;
    messageElement.style.cssText = `
      background: ${this.getMessageColor(type)};
      color: white;
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      pointer-events: auto;
      cursor: pointer;
      animation: slideInRight 0.3s ease-out;
      max-width: 100%;
      word-wrap: break-word;
    `;
    
    messageElement.textContent = message;
    
    // Add close functionality
    messageElement.addEventListener('click', () => {
      this.removeMessage(messageElement);
    });
    
    this.errorContainer.appendChild(messageElement);
    
    // Auto-remove after duration
    setTimeout(() => {
      this.removeMessage(messageElement);
    }, duration);
  }

  removeMessage(messageElement) {
    if (messageElement && messageElement.parentNode) {
      messageElement.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageElement.parentNode.removeChild(messageElement);
        }
      }, 300);
    }
  }

  getMessageColor(type) {
    switch (type) {
      case 'error':
        return '#f44336';
      case 'success':
        return '#4caf50';
      case 'warning':
        return '#ff9800';
      default:
        return '#2196f3';
    }
  }

  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility methods

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getStats() {
    return { ...this.errorStats };
  }

  /**
   * Get recent errors
   * @param {number} count - Number of recent errors to return
   * @returns {Array} Recent errors
   */
  getRecentErrors(count = 5) {
    return this.errorQueue.slice(-count);
  }

  /**
   * Clear all stored errors
   */
  clearErrors() {
    this.errorQueue = [];
    this.errorStats = {
      total: 0,
      network: 0,
      game: 0,
      validation: 0,
      server: 0,
      unknown: 0
    };
  }

  /**
   * Check if there are critical errors
   * @returns {boolean} True if there are critical errors
   */
  hasCriticalErrors() {
    return this.errorStats.network > 3 || this.errorStats.server > 3;
  }
}
