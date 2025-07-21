export class PerformanceMonitor {
   constructor() {
    // Performance metrics
    this.performanceMetrics = {
        frameTime: 0,
        renderTime: 0,
        updateTime: 0,
        totalFrames: 0,
        droppedFrames: 0,
        averageFrameTime: 0,
        minFrameTime: Infinity,
        maxFrameTime: 0
    };

    this.targetFPS = 60;
    this.frameTimeThreshold = 1000 / this.targetFPS; // 16.67ms for 60fps

    // Performance counters for optimization tracking
    this.performanceCounters = new Map();

    // Performance monitoring
    this.performanceObserver = null;
    this.performanceCallbacks = [];

    this.initPerformanceMonitoring();
    }

  // Performance monitoring initialization
    initPerformanceMonitoring() {
    if (typeof PerformanceObserver !== 'undefined') {
        try {
        this.performanceObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
            if (entry.entryType === 'measure') {
                this.performanceMetrics[entry.name] = entry.duration;
            }
            });
        });

        this.performanceObserver.observe({ entryTypes: ['measure'] });
        } catch (e) {
        console.warn('Performance Observer not fully supported:', e.message);
        }
    }

    // Monitor long tasks
    if (typeof PerformanceObserver !== 'undefined') {
        try {
        const longTaskObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
            if (entry.duration > 50) { // Tasks longer than 50ms
                console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
                this.performanceMetrics.droppedFrames++;
            }
            });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        } catch (e) {
        console.warn('Long task observer not supported:', e.message);
        }
    }
    }

  // Update performance metrics
    updateMetrics(frameTime) {
    this.performanceMetrics.frameTime = frameTime;
    this.performanceMetrics.totalFrames++;

    // Track min/max frame times
    this.performanceMetrics.minFrameTime = Math.min(this.performanceMetrics.minFrameTime, frameTime);
    this.performanceMetrics.maxFrameTime = Math.max(this.performanceMetrics.maxFrameTime, frameTime);

    // Calculate average frame time
    this.performanceMetrics.averageFrameTime =
      (this.performanceMetrics.averageFrameTime * (this.performanceMetrics.totalFrames - 1) + frameTime) /
        this.performanceMetrics.totalFrames;

    // Check for frame drops
    if (frameTime > this.frameTimeThreshold * 1.5) {
        this.performanceMetrics.droppedFrames++;
        console.warn(`Frame drop detected: ${frameTime.toFixed(2)}ms`);
    }
    }

  // Get performance metrics
    getPerformanceMetrics(fps = 0, dirtyElementsCount = 0, cachedElementsCount = 0) {
    return {
        ...this.performanceMetrics,
        fps: fps,
        frameDropPercentage: this.performanceMetrics.totalFrames > 0
        ? (this.performanceMetrics.droppedFrames / this.performanceMetrics.totalFrames) * 100
        : 0,
        dirtyElementsCount: dirtyElementsCount,
        cachedElementsCount: cachedElementsCount
    };
    }

  // Add performance callback
    onPerformanceUpdate(callback) {
    this.performanceCallbacks.push(callback);
    return () => {
        const index = this.performanceCallbacks.indexOf(callback);
        if (index > -1) {
        this.performanceCallbacks.splice(index, 1);
        }
    };
    }

  // Notify performance callbacks
    notifyCallbacks(fps = 0, dirtyElementsCount = 0, cachedElementsCount = 0) {
    const metrics = this.getPerformanceMetrics(fps, dirtyElementsCount, cachedElementsCount);
    this.performanceCallbacks.forEach(callback => {
        try {
        callback(metrics);
        } catch (error) {
        console.error('Performance callback error:', error);
        }
    });
    }

  // Performance counter methods for optimization tracking

    /**
   * Increment a performance counter
   */
    incrementCounter(counterName) {
    const current = this.performanceCounters.get(counterName) || 0;
    this.performanceCounters.set(counterName, current + 1);
    return this;
    }

    /**
   * Get current value of a performance counter
   */
    getCounter(counterName) {
    return this.performanceCounters.get(counterName) || 0;
    }

    /**
   * Reset a performance counter
   */
    resetCounter(counterName) {
    this.performanceCounters.set(counterName, 0);
    return this;
    }

    /**
   * Get all performance counters
   */
    getAllCounters() {
    return Object.fromEntries(this.performanceCounters);
    }

    /**
   * Set a counter to a specific value
   */
    setCounter(counterName, value) {
    this.performanceCounters.set(counterName, value);
    return this;
    }
}