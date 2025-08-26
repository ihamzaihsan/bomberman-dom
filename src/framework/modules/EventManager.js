export class EventManager {
  constructor() {
    this.eventHandlers = new Map();
    this.eventEmitter = new Map();
  }

  emit(eventName, ...args) {
    const listeners = this.eventEmitter.get(eventName) || [];
    listeners.forEach((listener) => {
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

  handleError(error) {
    console.error('Framework error:', error);
    this.emit('error', error);

    if (this.errorComponent) {
      try {
        this.errorComponent(error);
      } catch (componentError) {
        console.error('Error component failed:', componentError);
      }
    }
  }

  setErrorComponent(component) {
    this.errorComponent = component;
    return this;
  }

  on(eventType, selector, handler, options = {}) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
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
    return this;
  }

  off(eventType, selector, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.findIndex((h) => h.selector === selector && h.handler === handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
    return this;
  }

  once(eventType, selector, handler) {
    return this.on(eventType, selector, handler, { once: true });
  }

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

  onHashChange(handler) {
    window.addEventListener('hashchange', handler);
  }

  onReady(handler) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handler);
    } else {
      handler();
    }
    return this;
  }
}
