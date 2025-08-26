export class PerformanceMonitor {
  constructor() {
    this.performanceMetrics = {
      frameTime: 0,
      renderTime: 0,
      updateTime: 0,
      totalFrames: 0,
      droppedFrames: 0,
      averageFrameTime: 0,
      minFrameTime: Infinity,
      maxFrameTime: 0,
    };

    this.targetFPS = 60;
    this.frameTimeThreshold = 1000 / this.targetFPS;

    this.performanceCounters = new Map();

    this.performanceObserver = null;
    this.performanceCallbacks = [];

    this.initPerformanceMonitoring();
  }

  initPerformanceMonitoring() {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
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

    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.duration > 50) {
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

  updateMetrics(frameTime) {
    this.performanceMetrics.frameTime = frameTime;
    this.performanceMetrics.totalFrames++;

    this.performanceMetrics.minFrameTime = Math.min(
      this.performanceMetrics.minFrameTime,
      frameTime,
    );
    this.performanceMetrics.maxFrameTime = Math.max(
      this.performanceMetrics.maxFrameTime,
      frameTime,
    );

    this.performanceMetrics.averageFrameTime =
      (this.performanceMetrics.averageFrameTime * (this.performanceMetrics.totalFrames - 1) +
        frameTime) /
      this.performanceMetrics.totalFrames;

    if (frameTime > this.frameTimeThreshold * 1.5) {
      this.performanceMetrics.droppedFrames++;
      console.warn(`Frame drop detected: ${frameTime.toFixed(2)}ms`);
    }
  }

  getPerformanceMetrics(fps = 0, dirtyElementsCount = 0, cachedElementsCount = 0) {
    return {
      ...this.performanceMetrics,
      fps: fps,
      frameDropPercentage:
        this.performanceMetrics.totalFrames > 0
          ? (this.performanceMetrics.droppedFrames / this.performanceMetrics.totalFrames) * 100
          : 0,
      dirtyElementsCount: dirtyElementsCount,
      cachedElementsCount: cachedElementsCount,
    };
  }

  onPerformanceUpdate(callback) {
    this.performanceCallbacks.push(callback);
    return () => {
      const index = this.performanceCallbacks.indexOf(callback);
      if (index > -1) {
        this.performanceCallbacks.splice(index, 1);
      }
    };
  }

  notifyCallbacks(fps = 0, dirtyElementsCount = 0, cachedElementsCount = 0) {
    const metrics = this.getPerformanceMetrics(fps, dirtyElementsCount, cachedElementsCount);
    this.performanceCallbacks.forEach((callback) => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Performance callback error:', error);
      }
    });
  }

  incrementCounter(counterName) {
    const current = this.performanceCounters.get(counterName) || 0;
    this.performanceCounters.set(counterName, current + 1);
    return this;
  }

  getCounter(counterName) {
    return this.performanceCounters.get(counterName) || 0;
  }

  resetCounter(counterName) {
    this.performanceCounters.set(counterName, 0);
    return this;
  }

  getAllCounters() {
    return Object.fromEntries(this.performanceCounters);
  }

  setCounter(counterName, value) {
    this.performanceCounters.set(counterName, value);
    return this;
  }
}
