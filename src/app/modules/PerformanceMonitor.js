import { PerformanceMonitor as FrameworkPerformanceMonitor } from '../../framework/modules/PerformanceMonitor.js';

export class PerformanceMonitor extends FrameworkPerformanceMonitor {
  constructor(framework) {
    super();

    this.framework = framework;

    this.performanceDisplay = null;
    this.domObserver = null;
    this.isMonitoringEnabled = false;

    this.domMutationCount = 0;
    this.lastLayoutThrashingWarning = 0;

    this.showPerformanceStats = localStorage.getItem('showPerformanceStats') === 'true';

    this.lastInvalidMoveTime = 0;
    this.lastInvalidMove = null;

    this.init();
  }

  init() {
    this.initAppPerformanceMonitoring();
    this.setupKeyboardShortcuts();
  }

  initAppPerformanceMonitoring() {
    console.log('🔍 Initializing app-specific performance monitoring...');

    this.createPerformanceDisplay();

    this.framework.onPerformanceUpdate((metrics) => {
      this.updatePerformanceDisplay(metrics);
      this.triggerPerformanceWarnings(metrics);
    });

    this.monitorDOMPerformance();

    this.isMonitoringEnabled = true;
    console.log('✅ App performance monitoring initialized successfully');
  }

  createPerformanceDisplay() {
    this.performanceDisplay = this.framework.selectiveRenderer.createElement('div', {
        id: 'performance-monitor',
        style: `
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
      `
    });
    
    document.body.appendChild(this.performanceDisplay);
    
    this.createMovementStatsDisplay();
  }

  createMovementStatsDisplay() {
    const movementStatsDisplay = this.framework.selectiveRenderer.createElement('div', {
        id: 'movement-performance-stats',
        style: `
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
      `
    });
    
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
    
    const dropPercentage = totalFrames > 0 ? (droppedFrames / totalFrames * 100).toFixed(1) : '0.0';
    const fpsColor = fps >= 55 ? '#4CAF50' : fps >= 30 ? '#FF9800' : '#F44336';
    const frameTimeColor = frameTime <= 16.7 ? '#4CAF50' : frameTime <= 33.3 ? '#FF9800' : '#F44336';
    
    this.performanceDisplay.innerHTML = '';

    const title = this.framework.selectiveRenderer.createElement('div', { style: 'border-bottom: 1px solid #444; margin-bottom: 8px; padding-bottom: 4px;' });
    const titleStrong = this.framework.selectiveRenderer.createElement('strong', { textContent: '🔍 Performance Monitor' });
    title.appendChild(titleStrong);

    const fpsDiv = this.framework.selectiveRenderer.createElement('div', { style: `color: ${fpsColor}`, textContent: `FPS: ${fps.toFixed(1)}` });
    const frameTimeDiv = this.framework.selectiveRenderer.createElement('div', { style: `color: ${frameTimeColor}`, textContent: `Frame Time: ${frameTime.toFixed(1)}ms` });
    const renderTimeDiv = this.framework.selectiveRenderer.createElement('div', { textContent: `Render Time: ${renderTime.toFixed(1)}ms` });
    const updateTimeDiv = this.framework.selectiveRenderer.createElement('div', { textContent: `Update Time: ${updateTime.toFixed(1)}ms` });
    const droppedFramesDiv = this.framework.selectiveRenderer.createElement('div', { textContent: `Dropped Frames: ${droppedFrames} (${dropPercentage}%)` });
    const domMutationsDiv = this.framework.selectiveRenderer.createElement('div', { textContent: `DOM Mutations: ${this.domMutationCount}` });

    const footer = this.framework.selectiveRenderer.createElement('div', { style: 'margin-top: 8px; padding-top: 4px; border-top: 1px solid #444;' });
    const footerSmall = this.framework.selectiveRenderer.createElement('small', { textContent: `F12: Toggle | Framework v${this.framework.version || '1.0'}` });
    footer.appendChild(footerSmall);

    this.performanceDisplay.appendChild(title);
    this.performanceDisplay.appendChild(fpsDiv);
    this.performanceDisplay.appendChild(frameTimeDiv);
    this.performanceDisplay.appendChild(renderTimeDiv);
    this.performanceDisplay.appendChild(updateTimeDiv);
    this.performanceDisplay.appendChild(droppedFramesDiv);
    this.performanceDisplay.appendChild(domMutationsDiv);
    this.performanceDisplay.appendChild(footer);
    
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
    
    this.movementStatsDisplay.innerHTML = '';

    const title = this.framework.selectiveRenderer.createElement('div', { style: 'border-bottom: 1px solid #444; margin-bottom: 8px; padding-bottom: 4px;' });
    const titleStrong = this.framework.selectiveRenderer.createElement('strong', { textContent: '🎮 Movement Performance' });
    title.appendChild(titleStrong);

    const validMovesDiv = this.framework.selectiveRenderer.createElement('div', { innerHTML: `Valid Moves: <span style="color: #4CAF50">${validMoves}</span>` });
    const invalidMovesDiv = this.framework.selectiveRenderer.createElement('div', { innerHTML: `Invalid Moves: <span style="color: #F44336">${invalidMoves}</span>` });

    const skippedRendersContainer = this.framework.selectiveRenderer.createElement('div', { style: 'margin-top: 4px; font-size: 11px;' });
    const skippedRendersTitle = this.framework.selectiveRenderer.createElement('div', { textContent: 'Skipped Renders:' });
    const skippedRendersList = this.framework.selectiveRenderer.createElement('div', { style: 'margin-left: 8px;' });
    const skippedInvalidMoveDiv = this.framework.selectiveRenderer.createElement('div', { textContent: `• Invalid Move: ${skippedInvalidMove}` });
    const skippedNoChangesDiv = this.framework.selectiveRenderer.createElement('div', { textContent: `• No Changes: ${skippedNoChanges}` });
    const skippedRepeatedDiv = this.framework.selectiveRenderer.createElement('div', { textContent: `• Repeated: ${skippedRepeated}` });
    const totalSkippedDiv = this.framework.selectiveRenderer.createElement('div', { innerHTML: `• Total: <strong>${totalSkipped}</strong>` });
    skippedRendersList.appendChild(skippedInvalidMoveDiv);
    skippedRendersList.appendChild(skippedNoChangesDiv);
    skippedRendersList.appendChild(skippedRepeatedDiv);
    skippedRendersList.appendChild(totalSkippedDiv);
    skippedRendersContainer.appendChild(skippedRendersTitle);
    skippedRendersContainer.appendChild(skippedRendersList);

    const lastInvalidContainer = this.framework.selectiveRenderer.createElement('div', { style: 'margin-top: 4px; font-size: 11px;' });
    const lastInvalidMoveDiv = this.framework.selectiveRenderer.createElement('div', { textContent: `Last Invalid: ${this.lastInvalidMove || 'None'}` });
    const timeSinceInvalidMoveDiv = this.framework.selectiveRenderer.createElement('div', { textContent: `Time Since: ${timeSinceInvalidMove}ms ago` });
    lastInvalidContainer.appendChild(lastInvalidMoveDiv);
    lastInvalidContainer.appendChild(timeSinceInvalidMoveDiv);

    this.movementStatsDisplay.appendChild(title);
    this.movementStatsDisplay.appendChild(validMovesDiv);
    this.movementStatsDisplay.appendChild(invalidMovesDiv);
    this.movementStatsDisplay.appendChild(skippedRendersContainer);
    this.movementStatsDisplay.appendChild(lastInvalidContainer);
  }

  triggerPerformanceWarnings(metrics) {
    const { fps, droppedFrames, totalFrames } = metrics;
    
    if (fps < 30) {
      console.warn(`⚠️ Low FPS detected: ${fps.toFixed(1)} FPS`);
    }
    
    const dropPercentage = totalFrames > 0 ? (droppedFrames / totalFrames * 100) : 0;
    if (dropPercentage > 10) {
      console.warn(`⚠️ High frame drop rate: ${dropPercentage.toFixed(1)}%`);
    }
  }

  monitorDOMPerformance() {
    this.domObserver = new MutationObserver((mutations) => {
      this.domMutationCount += mutations.length;
      
      const now = Date.now();
      if (mutations.length > 10 && (now - this.lastLayoutThrashingWarning) > 5000) {
        console.warn('Potential layout thrashing detected:', mutations.length, 'DOM changes');
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
    this.framework.eventManager.on('keydown', 'body', (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        this.togglePerformanceStats();
      }
    });
  }


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
    const counters = this.framework.getAllCounters();
    Object.keys(counters).forEach(counterName => {
      this.framework.resetCounter(counterName);
    });

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