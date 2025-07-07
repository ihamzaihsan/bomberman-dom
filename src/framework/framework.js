export class Framework {
  constructor() {
    this.state = {};
    this.routes = {};
    this.currentRoute = '';
    this.subscribers = [];
    this.eventHandlers = new Map();
    this.errorComponent = null;
    this.updateQueue = [];
    this.isUpdating = false;
    
    // Add event emitter functionality
    this.eventEmitter = new Map();
    
    // Performance optimization properties
    this.gameLoop = null;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.fpsUpdateTime = 0;
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
    
    // Virtual DOM and rendering optimization
    this.previousVDOM = null;
    this.renderQueue = [];
    this.isRendering = false;
    this.dirtyComponents = new Set();
    this.renderCache = new Map();
    
    // Performance monitoring
    this.performanceObserver = null;
    this.performanceCallbacks = [];
    this.initPerformanceMonitoring();
  }

  // Event emitter methods
  emit(eventName, ...args) {
    const listeners = this.eventEmitter.get(eventName) || [];
    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${eventName}:`, error);
      }
    });
    return this;
  }

  addEventListener(eventName, listener) {
    if (!this.eventEmitter.has(eventName)) {
      this.eventEmitter.set(eventName, []);
    }
    this.eventEmitter.get(eventName).push(listener);
    return this;
  }

  removeEventListener(eventName, listener) {
    if (this.eventEmitter.has(eventName)) {
      const listeners = this.eventEmitter.get(eventName);
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
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

  // Enhanced game loop with requestAnimationFrame
  startGameLoop(callback) {
    if (this.gameLoop) {
      this.stopGameLoop();
    }

    const loop = (currentTime) => {
      const startTime = performance.now();
      
      // Calculate delta time
      const deltaTime = currentTime - this.lastFrameTime;
      this.lastFrameTime = currentTime;

      // Update FPS counter
      this.updateFPS(currentTime);

      // Check for frame drops
      if (deltaTime > this.frameTimeThreshold * 1.5) {
        this.performanceMetrics.droppedFrames++;
        console.warn(`Frame drop detected: ${deltaTime.toFixed(2)}ms`);
      }

      // Performance measurement start
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('frame-start');
      }
      
      try {
        // Execute game logic callback
        if (callback && typeof callback === 'function') {
          if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark('update-start');
          }
          callback(deltaTime, currentTime);
          if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark('update-end');
            performance.measure('updateTime', 'update-start', 'update-end');
          }
        }

        // Process render queue
        this.processRenderQueue();

        // Update performance metrics
        const endTime = performance.now();
        const frameTime = endTime - startTime;
        this.performanceMetrics.frameTime = frameTime;
        this.performanceMetrics.totalFrames++;
        
        // Track min/max frame times
        this.performanceMetrics.minFrameTime = Math.min(this.performanceMetrics.minFrameTime, frameTime);
        this.performanceMetrics.maxFrameTime = Math.max(this.performanceMetrics.maxFrameTime, frameTime);
        
        // Calculate average frame time
        this.performanceMetrics.averageFrameTime = 
          (this.performanceMetrics.averageFrameTime * (this.performanceMetrics.totalFrames - 1) + frameTime) / 
          this.performanceMetrics.totalFrames;

        if (typeof performance !== 'undefined' && performance.mark) {
          performance.mark('frame-end');
          performance.measure('frameTime', 'frame-start', 'frame-end');
        }

        // Notify performance callbacks
        this.notifyPerformanceCallbacks();

      } catch (error) {
        console.error('Game loop error:', error);
        this.handleError(error);
      }

      this.gameLoop = requestAnimationFrame(loop);
    };

    this.gameLoop = requestAnimationFrame(loop);
    return this;
  }

  stopGameLoop() {
    if (this.gameLoop) {
      cancelAnimationFrame(this.gameLoop);
      this.gameLoop = null;
    }
    return this;
  }

  // FPS calculation
  updateFPS(currentTime) {
    this.frameCount++;
    
    if (currentTime - this.fpsUpdateTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsUpdateTime));
      this.frameCount = 0;
      this.fpsUpdateTime = currentTime;
      
      // Emit FPS update event
      this.emit('fps-update', this.fps);
    }
  }

  // Add missing processRenderQueue method
  processRenderQueue() {
    if (this.renderQueue.length === 0) return;
    
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark('render-start');
    }
    
    // Process all queued render operations
    while (this.renderQueue.length > 0) {
      const renderOp = this.renderQueue.shift();
      try {
        renderOp();
      } catch (error) {
        console.error('Render operation error:', error);
      }
    }
    
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark('render-end');
      performance.measure('renderTime', 'render-start', 'render-end');
    }
  }

  // Add missing handleError method
  handleError(error) {
    console.error('Framework error:', error);
    
    // Emit error event
    this.emit('error', error);
    
    // Show error component if available
    if (this.errorComponent) {
      try {
        this.errorComponent(error);
      } catch (componentError) {
        console.error('Error component failed:', componentError);
      }
    }
  }

  // Get current FPS
  getFPS() {
    return this.fps;
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      fps: this.fps,
      frameDropPercentage: this.performanceMetrics.totalFrames > 0 
        ? (this.performanceMetrics.droppedFrames / this.performanceMetrics.totalFrames) * 100 
        : 0
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
  notifyPerformanceCallbacks() {
    const metrics = this.getPerformanceMetrics();
    this.performanceCallbacks.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Performance callback error:', error);
      }
    });
  }

  // Conditional rendering helper
  when(condition, element) {
    return condition ? element : null;
  }

  // List rendering helper with caching
  map(array, callback, keyExtractor = null) {
    if (!Array.isArray(array)) return [];
    
    return array.map((item, index) => {
      const key = keyExtractor ? keyExtractor(item, index) : index;
      
      // Use cache if available
      if (this.renderCache.has(key)) {
        const cached = this.renderCache.get(key);
        if (JSON.stringify(cached.item) === JSON.stringify(item)) {
          return cached.result;
        }
      }
      
      const result = callback(item, index);
      
      // Cache the result
      this.renderCache.set(key, { item: JSON.parse(JSON.stringify(item)), result });
      
      return result;
    }).filter(item => item !== null && item !== undefined);
  }

  // Clear render cache
  clearRenderCache() {
    this.renderCache.clear();
  }

  // Optimized state management with batching
  setState(newState, callback) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };

    // Mark components as dirty for selective re-rendering
    this.markDirty();

    if (callback) {
      this.updateQueue.push(callback);
    }

    this.batchUpdate();
    return this;
  }

  // Mark components as dirty for selective rendering
  markDirty(componentId = 'root') {
    this.dirtyComponents.add(componentId);
  }

  // Enhanced batch update with performance optimization
  batchUpdate() {
    if (this.isUpdating) return;

    this.isUpdating = true;
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('batch-update-start');
      }
      
      try {
        // Only notify if there are actual changes
        if (this.dirtyComponents.size > 0) {
          this.notify();
          this.dirtyComponents.clear();
        }

        // Execute queued callbacks
        while (this.updateQueue.length > 0) {
          const callback = this.updateQueue.shift();
          callback();
        }
      } catch (error) {
        console.error('Batch update error:', error);
      }

      if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('batch-update-end');
        performance.measure('batchUpdateTime', 'batch-update-start', 'batch-update-end');
      }
      
      this.isUpdating = false;
    });
  }

  getState() {
    return this.state;
  }

  // Get specific state property
  get(key) {
    return this.state[key];
  }

  // Update specific state property
  set(key, value, callback) {
    this.setState({ [key]: value }, callback);
  }

  // Merge object into state
  merge(key, object, callback) {
    const currentValue = this.state[key] || {};
    this.setState({ [key]: { ...currentValue, ...object } }, callback);
  }

  // Add item to array in state
  push(key, item, callback) {
    const currentArray = this.state[key] || [];
    this.setState({ [key]: [...currentArray, item] }, callback);
  }

  // Remove item from array in state
  remove(key, predicate, callback) {
    const currentArray = this.state[key] || [];
    this.setState({ [key]: currentArray.filter(predicate) }, callback);
  }

  // Update item in array
  updateItem(key, predicate, updater, callback) {
    const currentArray = this.state[key] || [];
    this.setState({
      [key]: currentArray.map(item => predicate(item) ? updater(item) : item)
    }, callback);
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  notify() {
    this.subscribers.forEach(callback => callback(this.state));
  }

  // Enhanced routing system
  route(path, component) {
    this.routes[path] = component;
    return this; // Allow chaining
  }

  // Multiple routes at once
  routes(routeMap) {
    Object.entries(routeMap).forEach(([path, component]) => {
      this.route(path, component);
    });
    return this;
  }

  // Set error page component
  setErrorPage(component) {
    this.errorComponent = component;
    return this;
  }

  // Enhanced navigation with optional state
  navigate(path, state = {}) {
    window.history.pushState(state, '', path);
    this.currentRoute = path;
    this.render();
    return this;
  }

  // Go back in history
  back() {
    window.history.back();
    return this;
  }

  // Go forward in history
  forward() {
    window.history.forward();
    return this;
  }

  // Get current route
  getCurrentRoute() {
    return this.currentRoute;
  }

  // Check if current route matches pattern
  isRoute(pattern) {
    return this.currentRoute === pattern;
  }

  // Enhanced event handling with more options
  on(eventType, selector, handler, options = {}) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
      // Set up delegation for this event type
      document.addEventListener(eventType, (e) => {
        const handlers = this.eventHandlers.get(eventType) || [];
        handlers.forEach(({ selector, handler, options }) => {
          try {
            let target = null;
            if (e.target.matches && e.target.matches(selector)) {
              target = e.target;
            } else if (e.target.closest && e.target.closest(selector)) {
              target = e.target.closest(selector);
            }

            if (target) {
              if (options.once) {
                this.off(eventType, selector, handler);
              }
              handler(e, target);
            }
          } catch (error) {
            console.error('Event handler error:', error);
            this.handleError(error);
          }
        });
      });
    }

    this.eventHandlers.get(eventType).push({ selector, handler, options });
    return this; // Allow chaining
  }

  // Remove event handler
  off(eventType, selector, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.findIndex(h =>
        h.selector === selector && h.handler === handler
      );
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
    return this;
  }

  // One-time event handler
  once(eventType, selector, handler) {
    return this.on(eventType, selector, handler, { once: true });
  }

  // Shorthand event methods
  click(selector, handler) {
    return this.on('click', selector, handler);
  }

  change(selector, handler) {
    return this.on('change', selector, handler);
  }

  input(selector, handler) {
    return this.on('input', selector, handler);
  }

  keydown(selector, handler) {
    return this.on('keydown', selector, handler);
  }

  keyup(selector, handler) {
    return this.on('keyup', selector, handler);
  }

  keypress(selector, handler) {
    return this.on('keypress', selector, handler);
  }

  submit(selector, handler) {
    return this.on('submit', selector, handler);
  }

  focus(selector, handler) {
    return this.on('focus', selector, handler);
  }

  blur(selector, handler) {
    return this.on('blur', selector, handler);
  }

  // Handle hash changes
  onHashChange(handler) {
    window.addEventListener('hashchange', handler);
  }

  // Handle DOM ready
  onReady(handler) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handler);
    } else {
      handler();
    }
    return this;
  }
}