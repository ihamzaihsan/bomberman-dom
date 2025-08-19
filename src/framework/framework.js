import {
  StateManager,
  EventManager,
  PerformanceMonitor,
  SelectiveRenderer,
  GameLoop,
  Router,
  VirtualDOM
} from './modules/index.js';
import { NotFound404 } from './components/index.js';

export class Framework {
  constructor() {
    // Initialize all modules
    this.stateManager = new StateManager();
    this.eventManager = new EventManager();
    this.performanceMonitor = new PerformanceMonitor();
    this.selectiveRenderer = new SelectiveRenderer();
    this.router = new Router();
    this.virtualDOM = new VirtualDOM();

    // Initialize GameLoop with dependencies
    this.gameLoop = new GameLoop(
      this.performanceMonitor,
      this.selectiveRenderer,
      this.eventManager
    );

    // Set up cross-module connections
    this.router.setRenderCallback((component, params, query, matched) => {
      this.currentComponent = component;
      this.currentParams = params;
      this.currentQuery = query;
      this.routeMatched = matched;
      this.render();
    });

    // Set default 404 component
    this.router.setErrorPage(NotFound404);

    // Legacy compatibility properties - delegate to modules
    // These maintain the existing API for BombermanApp
  }

  // ===== STATE MANAGEMENT DELEGATION =====
  get state() { return this.stateManager.state; }
  set state(value) { this.stateManager.state = value; }

  setState(newState, callback) { return this.stateManager.setState(newState, callback); }
  getState() { return this.stateManager.getState(); }
  get(key) { return this.stateManager.get(key); }
  set(key, value, callback) { return this.stateManager.set(key, value, callback); }
  merge(key, object, callback) { return this.stateManager.merge(key, object, callback); }
  push(key, item, callback) { return this.stateManager.push(key, item, callback); }
  remove(key, predicate, callback) { return this.stateManager.remove(key, predicate, callback); }
  updateItem(key, predicate, updater, callback) { return this.stateManager.updateItem(key, predicate, updater, callback); }
  subscribe(callback) { return this.stateManager.subscribe(callback); }
  notify() { return this.stateManager.notify(); }

  // ===== EVENT MANAGEMENT DELEGATION =====
  emit(eventName, ...args) { return this.eventManager.emit(eventName, ...args); }
  addEventListener(eventName, listener) { return this.eventManager.addEventListener(eventName, listener); }
  removeEventListener(eventName, listener) { return this.eventManager.removeEventListener(eventName, listener); }
  on(eventType, selector, handler, options) { return this.eventManager.on(eventType, selector, handler, options); }
  off(eventType, selector, handler) { return this.eventManager.off(eventType, selector, handler); }
  once(eventType, selector, handler) { return this.eventManager.once(eventType, selector, handler); }
  click(selector, handler) { return this.eventManager.click(selector, handler); }
  change(selector, handler) { return this.eventManager.change(selector, handler); }
  input(selector, handler) { return this.eventManager.input(selector, handler); }
  keydown(selector, handler) { return this.eventManager.keydown(selector, handler); }
  keyup(selector, handler) { return this.eventManager.keyup(selector, handler); }
  keypress(selector, handler) { return this.eventManager.keypress(selector, handler); }
  submit(selector, handler) { return this.eventManager.submit(selector, handler); }
  focus(selector, handler) { return this.eventManager.focus(selector, handler); }
  blur(selector, handler) { return this.eventManager.blur(selector, handler); }
  onHashChange(handler) { return this.eventManager.onHashChange(handler); }
  onReady(handler) { return this.eventManager.onReady(handler); }

  // ===== ROUTER DELEGATION =====
  route(path, component) { return this.router.route(path, component); }
  routes(routeMap) {
    this.router.routes(routeMap);
    // Auto-initialize router after routes are defined
    if (!this.router.initialized) {
      this.router.init();
    }
    return this;
  }
  setErrorPage(component) { return this.router.setErrorPage(component); }
  navigate(path, state) { return this.router.navigate(path, state); }
  replace(path, state) { return this.router.replace(path, state); }
  back() { return this.router.back(); }
  forward() { return this.router.forward(); }
  getCurrentRoute() { return this.router.getCurrentRoute(); }
  getParams() { return this.router.getParams(); }
  getQuery() { return this.router.getQuery(); }
  getParam(name) { return this.router.getParam(name); }
  getQueryParam(name) { return this.router.getQueryParam(name); }
  isRoute(pattern) { return this.router.isRoute(pattern); }
  initRouter() { return this.router.init(); }
  checkCurrentRoute() { return this.router.checkCurrentRoute(); }

  // ===== SELECTIVE RENDERER DELEGATION =====
  markElementDirty(elementId, data) { return this.selectiveRenderer.markElementDirty(elementId, data); }
  shouldUpdateElement(elementId, currentData) { return this.selectiveRenderer.shouldUpdateElement(elementId, currentData); }
  cacheElement(elementId, element) { return this.selectiveRenderer.cacheElement(elementId, element); }
  getCachedElement(elementId) { return this.selectiveRenderer.getCachedElement(elementId); }
  updateElement(elementId, updateFunction, forceUpdate) { return this.selectiveRenderer.updateElement(elementId, updateFunction, forceUpdate); }
  processDirtyElements() { return this.selectiveRenderer.processDirtyElements(); }
  clearAllCaches() { return this.selectiveRenderer.clearAllCaches(); }
  when(condition, element) { return this.selectiveRenderer.when(condition, element); }
  map(array, callback, keyExtractor) { return this.selectiveRenderer.map(array, callback, keyExtractor); }
  clearRenderCache() { return this.selectiveRenderer.clearRenderCache(); }

  // ✅ NEW: DOM manipulation methods
  createElement(tagName, attributes) { return this.selectiveRenderer.createElement(tagName, attributes); }
  find(selector) { return document.querySelector(selector); }
  findAll(selector) { return document.querySelectorAll(selector); }

  // ===== PERFORMANCE MONITOR DELEGATION =====
  getPerformanceMetrics() {
    return this.performanceMonitor.getPerformanceMetrics(
      this.gameLoop.getFPS(),
      this.selectiveRenderer.dirtyElements.size,
      this.selectiveRenderer.elementCache.size
    );
  }
  onPerformanceUpdate(callback) { return this.performanceMonitor.onPerformanceUpdate(callback); }
  incrementCounter(counterName) { return this.performanceMonitor.incrementCounter(counterName); }
  getCounter(counterName) { return this.performanceMonitor.getCounter(counterName); }
  resetCounter(counterName) { return this.performanceMonitor.resetCounter(counterName); }
  getAllCounters() { return this.performanceMonitor.getAllCounters(); }
  setCounter(counterName, value) { return this.performanceMonitor.setCounter(counterName, value); }

  // ===== GAME LOOP DELEGATION =====
  startGameLoop(callback) { return this.gameLoop.startGameLoop(callback); }
  stopGameLoop() { return this.gameLoop.stopGameLoop(); }
  getFPS() { return this.gameLoop.getFPS(); }

  // ===== LEGACY COMPATIBILITY PROPERTIES =====
  // These properties maintain backward compatibility with existing code
  // Renamed to avoid conflict with the routes(routeMap) method
  get routeTable() { return this.router.routeTable; }
  get currentRoute() { return this.router.currentRoute; }
  get subscribers() { return this.stateManager.subscribers; }
  get eventHandlers() { return this.eventManager.eventHandlers; }
  get eventEmitter() { return this.eventManager.eventEmitter; }
  get errorComponent() { return this.router.errorComponent; }
  get updateQueue() { return this.stateManager.updateQueue; }
  get isUpdating() { return this.stateManager.isUpdating; }
  get previousVDOM() { return this.virtualDOM.previousVDOM; }
  get renderQueue() { return this.selectiveRenderer.renderQueue; }
  get isRendering() { return this.selectiveRenderer.isRendering; }
  get dirtyComponents() { return this.stateManager.dirtyComponents; }
  get renderCache() { return this.selectiveRenderer.renderCache; }
  get elementCache() { return this.selectiveRenderer.elementCache; }
  get dirtyElements() { return this.selectiveRenderer.dirtyElements; }
  get renderingStrategy() { return this.selectiveRenderer.renderingStrategy; }
  get lastRenderState() { return this.selectiveRenderer.lastRenderState; }
  get performanceCounters() { return this.performanceMonitor.performanceCounters; }
  get performanceObserver() { return this.performanceMonitor.performanceObserver; }
  get performanceCallbacks() { return this.performanceMonitor.performanceCallbacks; }
  get performanceMetrics() { return this.performanceMonitor.performanceMetrics; }
  get targetFPS() { return this.performanceMonitor.targetFPS; }
  get frameTimeThreshold() { return this.performanceMonitor.frameTimeThreshold; }
  get lastFrameTime() { return this.gameLoop.lastFrameTime; }
  get frameCount() { return this.gameLoop.frameCount; }
  get fps() { return this.gameLoop.fps; }
  get fpsUpdateTime() { return this.gameLoop.fpsUpdateTime; }

  // ===== ADDITIONAL METHODS =====

  // Add any additional methods that don't fit into the modules
  // For now, we'll add a render method placeholder
  render() {
    const container = document.getElementById('app');
    if (!container) return;

    // Only render when the router did NOT match a route (i.e., show error component)
    if (this.routeMatched === false && this.currentComponent) {
      try {
        const output = typeof this.currentComponent === 'function'
          ? this.currentComponent(this)
          : '';
        this.virtualDOM.render(output, container);
      } catch (err) {
        console.error('Framework render error:', err);
      }
    }
  }


}