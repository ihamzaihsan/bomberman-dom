export class PerformanceMonitor {
  constructor(framework) {
    this.framework = framework;
    
    // Performance state
    this.performanceMonitor = null;
    this.performanceDisplay = null;
    this.domObserver = null;
    this.isMonitoringEnabled = false;
    
    // Performance metrics
    this.lastUpdateTime = 0;
    this.frameCounter = 0;
    this.domMutationCount = 0;
    this.lastLayoutThrashingWarning = 0;
    
    // Display state
    this.showPerformanceStats = localStorage.getItem('showPerformanceStats') === 'true';
    
    // Movement tracking
    this.lastInvalidMoveTime = 0;
    this.lastInvalidMove = null;
    
    this.init();
  }

  init() {
    this.initPerformanceMonitoring();
    this.setupKeyboardShortcuts();
  }

  // ===== PERFORMANCE MONITORING INITIALIZATION =====

  initPerformanceMonitoring() {
    console.log('🔍 Initializing comprehensive performance monitoring...');
    
    // Create performance display overlay
    this.createPerformanceDisplay();
    
    // Setup framework performance callbacks
    this.framework.onPerformanceUpdate((metrics) => {
      this.updatePerformanceDisplay(metrics);
      this.triggerPerformanceWarnings(metrics);
    });
    
    // Monitor DOM performance
    this.monitorDOMPerformance();
    
    this.isMonitoringEnabled = true;
    console.log('✅ Performance monitoring initialized successfully');
  }

  createPerformanceDisplay() {
    // Create performance overlay container
    this.performanceDisplay = document.createElement('div');
    this.performanceDisplay.id = 'performance-monitor';
    this.performanceDisplay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      display: ${this.showPerformanceStats ? 'block' : 'none'};
      min-width: 250px;
    `;
    
    document.body.appendChild(this.performanceDisplay);
    
    // Create movement checker stats overlay
    this.createMovementStatsDisplay();
  }

  createMovementStatsDisplay() {
    const movementStatsDisplay = document.createElement('div');
    movementStatsDisplay.id = 'movement-performance-stats';
    movementStatsDisplay.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      display: ${this.showPerformanceStats ? 'block' : 'none'};
      min-width: 280px;
    `;
    
    document.body.appendChild(movementStatsDisplay);
    this.movementStatsDisplay = movementStatsDisplay;
  }

  updatePerformanceDisplay(metrics) {
    if (!this.performanceDisplay || !this.showPerformanceStats) return;
    
    const {
      fps,
      frameTime,
      renderTime,
      updateTime,
      droppedFrames,
      totalFrames
    } = metrics;
    
    // Calculate percentages and color coding
    const dropPercentage = totalFrames > 0 ? (droppedFrames / totalFrames * 100).toFixed(1) : '0.0';
    const fpsColor = fps >= 55 ? '#4CAF50' : fps >= 30 ? '#FF9800' : '#F44336';
    const frameTimeColor = frameTime <= 16.7 ? '#4CAF50' : frameTime <= 33.3 ? '#FF9800' : '#F44336';
    
    this.performanceDisplay.innerHTML = `
      <div style="border-bottom: 1px solid #444; margin-bottom: 8px; padding-bottom: 4px;">
        <strong>🔍 Performance Monitor</strong>
      </div>
      <div style="color: ${fpsColor}">FPS: ${fps.toFixed(1)}</div>
      <div style="color: ${frameTimeColor}">Frame Time: ${frameTime.toFixed(1)}ms</div>
      <div>Render Time: ${renderTime.toFixed(1)}ms</div>
      <div>Update Time: ${updateTime.toFixed(1)}ms</div>
      <div>Dropped Frames: ${droppedFrames} (${dropPercentage}%)</div>
      <div>DOM Mutations: ${this.domMutationCount}</div>
      <div style="margin-top: 8px; padding-top: 4px; border-top: 1px solid #444;">
        <small>F12: Toggle | Framework v${this.framework.version || '1.0'}</small>
      </div>
    `;
    
    // Update movement stats
    this.updateMovementStatsDisplay();
  }

  updateMovementStatsDisplay() {
    if (!this.movementStatsDisplay || !this.showPerformanceStats) return;
    
    const skippedInvalidMove = this.framework.getCounter('skipped-renders-invalid-move') || 0;
    const skippedNoChanges = this.framework.getCounter('skipped-renders-no-changes') || 0;
    const skippedRepeated = this.framework.getCounter('skipped-renders-repeated-invalid') || 0;
    const validMoves = this.framework.getCounter('valid-moves') || 0;
    const invalidMoves = this.framework.getCounter('invalid-moves-total') || 0;
    
    const totalSkipped = skippedInvalidMove + skippedNoChanges + skippedRepeated;
    const timeSinceInvalidMove = this.lastInvalidMoveTime ? Date.now() - this.lastInvalidMoveTime : 0;
    
    this.movementStatsDisplay.innerHTML = `
      <div style="border-bottom: 1px solid #444; margin-bottom: 8px; padding-bottom: 4px;">
        <strong>🎮 Movement Performance</strong>
      </div>
      <div>Valid Moves: <span style="color: #4CAF50">${validMoves}</span></div>
      <div>Invalid Moves: <span style="color: #F44336">${invalidMoves}</span></div>
      <div style="margin-top: 4px; font-size: 11px;">
        <div>Skipped Renders:</div>
        <div style="margin-left: 8px;">
          • Invalid Move: ${skippedInvalidMove}
          • No Changes: ${skippedNoChanges}
          • Repeated: ${skippedRepeated}
          • Total: <strong>${totalSkipped}</strong>
        </div>
      </div>
      <div style="margin-top: 4px; font-size: 11px;">
        <div>Last Invalid: ${this.lastInvalidMove || 'None'}</div>
        <div>Time Since: ${timeSinceInvalidMove}ms ago</div>
      </div>
    `;
  }

  triggerPerformanceWarnings(metrics) {
    const { fps, droppedFrames, totalFrames } = metrics;
    
    // Warn about low FPS
    if (fps < 30) {
      console.warn(`⚠️ Low FPS detected: ${fps.toFixed(1)} FPS`);
    }
    
    // Warn about high frame drop percentage
    const dropPercentage = totalFrames > 0 ? (droppedFrames / totalFrames * 100) : 0;
    if (dropPercentage > 10) {
      console.warn(`⚠️ High frame drop rate: ${dropPercentage.toFixed(1)}%`);
    }
  }

  monitorDOMPerformance() {
    // Monitor DOM mutations to detect potential performance issues
    this.domObserver = new MutationObserver((mutations) => {
      this.domMutationCount += mutations.length;
      
      // Check for rapid DOM changes that could indicate layout thrashing
      const now = Date.now();
      if (mutations.length > 10 && (now - this.lastLayoutThrashingWarning) > 5000) {
        console.warn('⚠️ Potential layout thrashing detected:', mutations.length, 'DOM changes');
        this.lastLayoutThrashingWarning = now;
      }
    });
    
    this.domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        this.togglePerformanceStats();
      }
    });
  }

  // ===== PUBLIC INTERFACE =====

  togglePerformanceStats() {
    this.showPerformanceStats = !this.showPerformanceStats;
    localStorage.setItem('showPerformanceStats', this.showPerformanceStats.toString());
    
    if (this.performanceDisplay) {
      this.performanceDisplay.style.display = this.showPerformanceStats ? 'block' : 'none';
    }
    
    if (this.movementStatsDisplay) {
      this.movementStatsDisplay.style.display = this.showPerformanceStats ? 'block' : 'none';
    }
    
    console.log(`Performance stats ${this.showPerformanceStats ? 'enabled' : 'disabled'}`);
  }

  resetPerformanceCounters() {
    // Reset framework counters individually
    const counters = this.framework.getAllCounters();
    Object.keys(counters).forEach(counterName => {
      this.framework.resetCounter(counterName);
    });
    
    // Reset local counters
    this.domMutationCount = 0;
    this.frameCounter = 0;
    this.lastInvalidMoveTime = 0;
    this.lastInvalidMove = null;
    
    console.log('🔄 Performance counters reset');
  }

  getMovementStats() {
    return {
      skippedRendersInvalidMove: this.framework.getCounter('skipped-renders-invalid-move') || 0,
      skippedRendersNoChanges: this.framework.getCounter('skipped-renders-no-changes') || 0,
      skippedRendersRepeated: this.framework.getCounter('skipped-renders-repeated-invalid') || 0,
      validMoves: this.framework.getCounter('valid-moves') || 0,
      invalidMoves: this.framework.getCounter('invalid-moves-total') || 0,
      lastInvalidMoveTime: this.lastInvalidMoveTime,
      lastInvalidMove: this.lastInvalidMove,
      timeSinceLastInvalidMove: this.lastInvalidMoveTime ? Date.now() - this.lastInvalidMoveTime : 0
    };
  }

  // ===== MOVEMENT TRACKING =====

  trackInvalidMove(move, time) {
    this.lastInvalidMove = move;
    this.lastInvalidMoveTime = time;
    this.framework.incrementCounter('invalid-moves-total');
  }

  trackValidMove() {
    this.framework.incrementCounter('valid-moves');
  }

  trackSkippedRender(reason) {
    switch (reason) {
      case 'invalid-move':
        this.framework.incrementCounter('skipped-renders-invalid-move');
        break;
      case 'no-changes':
        this.framework.incrementCounter('skipped-renders-no-changes');
        break;
      case 'repeated-invalid':
        this.framework.incrementCounter('skipped-renders-repeated-invalid');
        break;
    }
  }

  // ===== DEBUG INTERFACE =====

  getDebugInterface() {
    return {
      togglePerformanceStats: () => this.togglePerformanceStats(),
      resetPerformanceCounters: () => this.resetPerformanceCounters(),
      getMovementStats: () => this.getMovementStats(),
      getFrameworkCounters: () => this.framework.getAllCounters(),
      getDOMStats: () => ({
        mutationCount: this.domMutationCount,
        observerActive: !!this.domObserver
      }),
      simulateInvalidMoves: (count = 10) => {
        const directions = ['up', 'down', 'left', 'right'];
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            const dir = directions[Math.floor(Math.random() * directions.length)];
            console.log(`Simulating invalid move: ${dir}`);
            this.trackInvalidMove(dir, Date.now());
          }, i * 100);
        }
      }
    };
  }

  // ===== CLEANUP =====

  destroy() {
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }
    
    if (this.performanceDisplay) {
      this.performanceDisplay.remove();
      this.performanceDisplay = null;
    }
    
    if (this.movementStatsDisplay) {
      this.movementStatsDisplay.remove();
      this.movementStatsDisplay = null;
    }
    
    this.isMonitoringEnabled = false;
    console.log('🗑️ Performance monitor destroyed');
  }
}
