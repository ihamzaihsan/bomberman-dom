/**
 * Performance Monitor for Bomberman DOM Game
 * Tracks FPS, memory usage, and other performance metrics
 */

import { GameConfig } from '../core/config.js';

export class PerformanceMonitor {
  constructor() {
    this.isEnabled = GameConfig.SHOW_PERFORMANCE_MONITOR;
    this.isRunning = false;
    this.isInitialized = false;
    
    // FPS tracking
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.fps = 0;
    this.fpsHistory = [];
    this.maxFpsHistory = 60; // Keep last 60 FPS measurements
    
    // Performance metrics
    this.metrics = {
      fps: 0,
      avgFps: 0,
      minFps: Infinity,
      maxFps: 0,
      frameTime: 0,
      memoryUsage: 0,
      domNodes: 0,
      renderTime: 0
    };
    
    // Timing
    this.updateInterval = null;
    this.lastUpdateTime = 0;
    
    // DOM elements
    this.fpsElement = null;
    this.pingElement = null;
    this.monitorElement = null;
    
    // Performance observers
    this.performanceObserver = null;
    
    this.init();
  }

  init() {
    if (!this.isEnabled || this.isInitialized) return;

    this.setupDOMElements();
    this.setupPerformanceObserver();
    this.isInitialized = true;

    if (GameConfig.DEBUG_MODE) {
      console.log('Performance Monitor initialized');
    }
  }

  setupDOMElements() {
    this.monitorElement = document.getElementById('performance-monitor');
    this.fpsElement = document.getElementById('fps-value');
    this.pingElement = document.getElementById('ping-value');
    
    if (!this.monitorElement) {
      console.warn('Performance monitor element not found');
      return;
    }
    
    // Show the monitor if enabled
    if (this.isEnabled) {
      this.monitorElement.classList.remove('hidden');
    }
  }

  setupPerformanceObserver() {
    // Set up Performance Observer for detailed metrics
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'measure') {
              this.metrics.renderTime = entry.duration;
            }
          });
        });
        
        this.performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }
  }

  start() {
    if (!this.isEnabled || this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.lastUpdateTime = performance.now();
    
    // Start the main monitoring loop
    this.monitorLoop();
    
    // Start periodic updates
    this.updateInterval = setInterval(() => {
      this.updateMetrics();
      this.updateDisplay();
    }, GameConfig.PERFORMANCE_MONITOR_INTERVAL);
    
    if (GameConfig.DEBUG_MODE) {
      console.log('Performance monitoring started');
    }
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (GameConfig.DEBUG_MODE) {
      console.log('Performance monitoring stopped');
    }
  }

  pause() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  resume() {
    if (this.isEnabled && this.isRunning && !this.updateInterval) {
      this.updateInterval = setInterval(() => {
        this.updateMetrics();
        this.updateDisplay();
      }, GameConfig.PERFORMANCE_MONITOR_INTERVAL);
    }
  }

  monitorLoop() {
    if (!this.isRunning) return;
    
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    // Calculate FPS
    this.frameCount++;
    if (deltaTime >= 1000) { // Update every second
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.fpsHistory.push(this.fps);
      
      // Keep history limited
      if (this.fpsHistory.length > this.maxFpsHistory) {
        this.fpsHistory.shift();
      }
      
      this.frameCount = 0;
      this.lastFrameTime = currentTime;
    }
    
    // Continue the loop
    requestAnimationFrame(() => this.monitorLoop());
  }

  updateMetrics() {
    // Update FPS metrics
    this.metrics.fps = this.fps;
    
    if (this.fpsHistory.length > 0) {
      this.metrics.avgFps = Math.round(
        this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length
      );
      this.metrics.minFps = Math.min(...this.fpsHistory);
      this.metrics.maxFps = Math.max(...this.fpsHistory);
    }
    
    // Update memory usage (if available)
    if (performance.memory) {
      this.metrics.memoryUsage = Math.round(
        performance.memory.usedJSHeapSize / 1024 / 1024
      ); // Convert to MB
    }
    
    // Count DOM nodes
    this.metrics.domNodes = document.querySelectorAll('*').length;
    
    // Frame time
    this.metrics.frameTime = this.fps > 0 ? Math.round(1000 / this.fps) : 0;
  }

  updateDisplay() {
    if (!this.isEnabled) return;
    
    // Update FPS display
    if (this.fpsElement) {
      this.fpsElement.textContent = this.metrics.fps;
      
      // Color code based on performance
      if (this.metrics.fps >= 55) {
        this.fpsElement.style.color = '#4caf50'; // Green
      } else if (this.metrics.fps >= 30) {
        this.fpsElement.style.color = '#ff9800'; // Orange
      } else {
        this.fpsElement.style.color = '#f44336'; // Red
      }
    }
  }

  updatePing(ping) {
    if (!this.isEnabled || !this.pingElement) return;
    
    this.pingElement.textContent = ping;
    
    // Color code based on ping
    if (ping <= 50) {
      this.pingElement.style.color = '#4caf50'; // Green
    } else if (ping <= 100) {
      this.pingElement.style.color = '#ff9800'; // Orange
    } else {
      this.pingElement.style.color = '#f44336'; // Red
    }
  }

  // Performance measurement utilities
  startMeasure(name) {
    if (!this.isEnabled) return;
    performance.mark(`${name}-start`);
  }

  endMeasure(name) {
    if (!this.isEnabled) return;
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
  }

  // Get performance report
  getReport() {
    return {
      ...this.metrics,
      isRunning: this.isRunning,
      fpsHistory: [...this.fpsHistory],
      timestamp: Date.now()
    };
  }

  // Performance warnings
  checkPerformance() {
    const warnings = [];
    
    if (this.metrics.fps < 30) {
      warnings.push('Low FPS detected');
    }
    
    if (this.metrics.memoryUsage > 100) {
      warnings.push('High memory usage');
    }
    
    if (this.metrics.domNodes > 1000) {
      warnings.push('High DOM node count');
    }
    
    if (this.metrics.frameTime > 33) {
      warnings.push('High frame time');
    }
    
    return warnings;
  }

  // Enable/disable monitoring
  enable() {
    this.isEnabled = true;
    if (this.monitorElement) {
      this.monitorElement.classList.remove('hidden');
    }
    this.start();
  }

  disable() {
    this.isEnabled = false;
    if (this.monitorElement) {
      this.monitorElement.classList.add('hidden');
    }
    this.stop();
  }

  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Check if performance monitoring is enabled
   * @returns {boolean} - True if enabled
   */
  isMonitoringEnabled() {
    return this.isEnabled;
  }

  // Debug methods
  logReport() {
    if (!GameConfig.DEBUG_MODE) return;
    
    console.group('Performance Report');
    console.log('FPS:', this.metrics.fps);
    console.log('Average FPS:', this.metrics.avgFps);
    console.log('Min FPS:', this.metrics.minFps);
    console.log('Max FPS:', this.metrics.maxFps);
    console.log('Frame Time:', this.metrics.frameTime + 'ms');
    console.log('Memory Usage:', this.metrics.memoryUsage + 'MB');
    console.log('DOM Nodes:', this.metrics.domNodes);
    console.log('Render Time:', this.metrics.renderTime + 'ms');
    
    const warnings = this.checkPerformance();
    if (warnings.length > 0) {
      console.warn('Performance Warnings:', warnings);
    }
    
    console.groupEnd();
  }

  // Static utility methods
  static measureFunction(fn, name = 'function') {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    if (GameConfig.DEBUG_MODE) {
      console.log(`${name} execution time: ${(end - start).toFixed(2)}ms`);
    }
    
    return result;
  }

  static async measureAsyncFunction(fn, name = 'async-function') {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    if (GameConfig.DEBUG_MODE) {
      console.log(`${name} execution time: ${(end - start).toFixed(2)}ms`);
    }
    
    return result;
  }
}
