export class SelectiveRenderer {
  constructor() {
    this.elementCache = new Map();
    this.dirtyElements = new Set();
    this.renderingStrategy = 'selective';
    this.lastRenderState = new Map();
    this.renderQueue = [];
    this.isRendering = false;
    this.renderCache = new Map();
  }

  markElementDirty(elementId, data = null) {
    this.dirtyElements.add(elementId);
    if (data) {
      this.lastRenderState.set(elementId, data);
    }
    return this;
  }

  shouldUpdateElement(elementId, currentData) {
    if (!this.lastRenderState.has(elementId)) {
      return true;
    }

    const lastData = this.lastRenderState.get(elementId);
    return JSON.stringify(currentData) !== JSON.stringify(lastData);
  }

  cacheElement(elementId, element) {
    this.elementCache.set(elementId, element);
    return element;
  }

  getCachedElement(elementId) {
    if (this.elementCache.has(elementId)) {
      const element = this.elementCache.get(elementId);
      if (element && element.isConnected && document.contains(element)) {
        return element;
      } else {
        this.elementCache.delete(elementId);
      }
    }

    const element = document.getElementById(elementId);
    if (element) {
      this.cacheElement(elementId, element);
    }
    return element;
  }

  updateElement(elementId, updateFunction, forceUpdate = false) {
    const element = this.getCachedElement(elementId);
    if (!element) {
      console.warn(`Element ${elementId} not found for update`);
      return false;
    }

    if (forceUpdate || this.dirtyElements.has(elementId)) {
      try {
        updateFunction(element);
        this.dirtyElements.delete(elementId);
        return true;
      } catch (error) {
        console.error(`Error updating element ${elementId}:`, error);
        return false;
      }
    }
    return false;
  }

  processDirtyElements() {
    if (this.dirtyElements.size === 0) return;

    const startTime = performance.now();
    const batchSize = 10;
    const dirtyArray = Array.from(this.dirtyElements);

    for (let i = 0; i < dirtyArray.length; i += batchSize) {
      const batch = dirtyArray.slice(i, i + batchSize);

      batch.forEach((elementId) => {
        const element = this.getCachedElement(elementId);
        if (!element) {
          this.dirtyElements.delete(elementId);
        }
      });

      if (performance.now() - startTime > 8) {
        if (i + batchSize < dirtyArray.length) {
          requestAnimationFrame(() => {
            this.processDirtyElements();
          });
        }
        break;
      }
    }
  }

  processRenderQueue() {
    if (this.renderQueue.length === 0) return;

    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark('render-start');
    }

    const startTime = performance.now();
    const maxRenderTime = 8;

    while (this.renderQueue.length > 0 && performance.now() - startTime < maxRenderTime) {
      const renderOp = this.renderQueue.shift();
      try {
        renderOp();
      } catch (error) {
        console.error('Render operation error:', error);
      }
    }

    if (this.renderQueue.length > 0) {
      requestAnimationFrame(() => this.processRenderQueue());
    }

    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark('render-end');
      performance.measure('renderTime', 'render-start', 'render-end');
      performance.clearMeasures('renderTime');
      performance.clearMarks('render-start');
      performance.clearMarks('render-end');
    }
  }

  clearAllCaches() {
    this.elementCache.clear();
    this.renderCache.clear();
    this.dirtyElements.clear();
    this.lastRenderState.clear();
  }

  createElement(tagName, attributes = {}) {
    const element = document.createElement(tagName);

    Object.keys(attributes).forEach((key) => {
      if (key === 'innerHTML') {
        element.innerHTML = attributes[key];
      } else if (key === 'textContent') {
        element.textContent = attributes[key];
      } else if (key === 'className') {
        element.className = attributes[key];
      } else if (key === 'style') {
        element.style.cssText = attributes[key];
      } else {
        element.setAttribute(key, attributes[key]);
      }
    });

    return element;
  }

  when(condition, element) {
    return condition ? element : null;
  }

  map(array, callback, keyExtractor = null) {
    if (!Array.isArray(array)) return [];

    return array
      .map((item, index) => {
        const key = keyExtractor ? keyExtractor(item, index) : index;

        if (this.renderCache.has(key)) {
          const cached = this.renderCache.get(key);
          if (JSON.stringify(cached.item) === JSON.stringify(item)) {
            return cached.result;
          }
        }

        const result = callback(item, index);

        this.renderCache.set(key, { item: JSON.parse(JSON.stringify(item)), result });

        return result;
      })
      .filter((item) => item !== null && item !== undefined);
  }

  clearRenderCache() {
    this.renderCache.clear();
  }

  appendChild(parent, child) {
    if (parent && child) {
      parent.appendChild(child);
    }
    return this;
  }

  removeChild(parent, child) {
    if (parent && child) {
      parent.removeChild(child);
    }
    return this;
  }

  setContent(element, content) {
    if (element) {
      if (typeof content === 'string') {
        element.textContent = content;
      } else {
        element.innerHTML = '';
        this.appendChild(element, content);
      }
    }
    return this;
  }

  processSelectiveRendering() {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark('selective-render-start');
    }

    this.processDirtyElements();

    this.processRenderQueue();

    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark('selective-render-end');
      performance.measure('selectiveRenderTime', 'selective-render-start', 'selective-render-end');
      performance.clearMeasures('selectiveRenderTime');
      performance.clearMarks('selective-render-start');
      performance.clearMarks('selective-render-end');
    }
  }
}
