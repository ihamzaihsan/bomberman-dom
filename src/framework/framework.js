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
  }

  // Enhanced element creation with more intuitive API
  createElement(tag, props = {}, ...children) {
    return {
      tag,
      props,
      children: children.flat()
    };
  }

  // Shorthand methods for common elements
  div(props = {}, ...children) {
    return this.createElement('div', props, ...children);
  }

  span(props = {}, ...children) {
    return this.createElement('span', props, ...children);
  }

  p(props = {}, ...children) {
    return this.createElement('p', props, ...children);
  }

  h1(props = {}, ...children) {
    return this.createElement('h1', props, ...children);
  }

  h2(props = {}, ...children) {
    return this.createElement('h2', props, ...children);
  }

  h3(props = {}, ...children) {
    return this.createElement('h3', props, ...children);
  }

  button(props = {}, ...children) {
    return this.createElement('button', props, ...children);
  }

  input(props = {}) {
    return this.createElement('input', props);
  }

  label(props = {}, ...children) {
    return this.createElement('label', props, ...children);
  }

  ul(props = {}, ...children) {
    return this.createElement('ul', props, ...children);
  }

  li(props = {}, ...children) {
    return this.createElement('li', props, ...children);
  }

  a(props = {}, ...children) {
    return this.createElement('a', props, ...children);
  }

  section(props = {}, ...children) {
    return this.createElement('section', props, ...children);
  }

  header(props = {}, ...children) {
    return this.createElement('header', props, ...children);
  }

  footer(props = {}, ...children) {
    return this.createElement('footer', props, ...children);
  }

  // Conditional rendering helper
  when(condition, element) {
    return condition ? element : null;
  }

  // List rendering helper
  map(array, callback) {
    return array.map(callback).filter(item => item !== null && item !== undefined);
  }

  // Enhanced state management with batching
  setState(newState, callback) {
    this.state = { ...this.state, ...newState };

    if (callback) {
      this.updateQueue.push(callback);
    }

    this.batchUpdate();
  }

  // Batch updates for better performance
  batchUpdate() {
    if (this.isUpdating) return;

    this.isUpdating = true;
    requestAnimationFrame(() => {
      this.notify();

      // Execute any queued callbacks
      while (this.updateQueue.length > 0) {
        const callback = this.updateQueue.shift();
        callback();
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
  }

  // Error handling
  handleError(error) {
    console.error('Framework Error:', error);
    if (this.errorComponent) {
      this.setState({ error: error.message });
      this.renderError();
    }
  }

  renderError() {
    if (this.errorComponent) {
      const errorVNode = typeof this.errorComponent === 'function' 
        ? this.errorComponent(this.state.error) 
        : this.errorComponent;
      
      document.body.innerHTML = '';
      const errorElement = this.createDOMElement(errorVNode);
      document.body.appendChild(errorElement);
    }
  }

  // Enhanced render method with better performance
  render(virtualNode = null, container = document.body) {
    try {
      // Get the component to render
      if (!virtualNode) {
        const component = this.routes[this.currentRoute];
        if (!component) {
          // Route not found - show error
          if (this.errorComponent) {
            const errorVNode = typeof this.errorComponent === 'function'
              ? this.errorComponent('Page not found')
              : this.errorComponent;
            virtualNode = errorVNode;
          } else {
            return;
          }
        } else {
          virtualNode = typeof component === 'function' ? component() : component;
        }
      }

      if (!virtualNode) return;

      if (container === document.body) {
        container.innerHTML = '';
      }

      const element = this.createDOMElement(virtualNode);
      container.appendChild(element);
      return element;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Render to specific container
  renderTo(container, virtualNode) {
    return this.render(virtualNode, container);
  }

  // Re-render current route
  rerender() {
    return this.render();
  }

  // Utility methods

  // Find element by selector
  find(selector) {
    return document.querySelector(selector);
  }

  // Find all elements by selector
  findAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  // Add CSS class to element
  addClass(selector, className) {
    const elements = this.findAll(selector);
    elements.forEach(el => el.classList.add(className));
    return this;
  }

  // Remove CSS class from element
  removeClass(selector, className) {
    const elements = this.findAll(selector);
    elements.forEach(el => el.classList.remove(className));
    return this;
  }

  // Toggle CSS class on element
  toggleClass(selector, className) {
    const elements = this.findAll(selector);
    elements.forEach(el => el.classList.toggle(className));
    return this;
  }

  // Set CSS style on element
  css(selector, property, value) {
    const elements = this.findAll(selector);
    elements.forEach(el => {
      if (typeof property === 'object') {
        Object.assign(el.style, property);
      } else {
        el.style[property] = value;
      }
    });
    return this;
  }

  // Show element
  show(selector) {
    return this.css(selector, 'display', 'block');
  }

  // Hide element
  hide(selector) {
    return this.css(selector, 'display', 'none');
  }

  // Focus element
  focusElement(selector) {
    const element = this.find(selector);
    if (element) element.focus();
    return this;
  }

  // Scroll to element
  scrollTo(selector) {
    const element = this.find(selector);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
    return this;
  }
  
  createDOMElement(virtualNode) {
    if (typeof virtualNode === 'string' || typeof virtualNode === 'number') {
      return document.createTextNode(String(virtualNode));
    }

    if (!virtualNode || !virtualNode.tag) {
      return document.createTextNode('');
    }

    const element = document.createElement(virtualNode.tag);

    // Set properties and attributes
    if (virtualNode.props) {
      Object.entries(virtualNode.props).forEach(([name, value]) => {
        if (name === 'checked' || name === 'autofocus') {
          element[name] = value;
        } else if (name === 'style') {
          element.style.cssText = value;
        } else if (name === 'for') {
          element.setAttribute('for', value);
        } else if (name === 'className') {
          element.className = value;
        } else {
          element.setAttribute(name, value);
        }
      });
    }

    // Add children
    if (Array.isArray(virtualNode.children)) {
      virtualNode.children.forEach(child => {
        if (child === null || child === undefined) return;
        const childElement = this.createDOMElement(child);
        element.appendChild(childElement);
      });
    }

    return element;
  }

  // Virtual DOM diffing for performance optimization
  diff(oldVNode, newVNode, container, index = 0) {
    // If no old node, add new node
    if (!oldVNode) {
      const newElement = this.createDOMElement(newVNode);
      container.appendChild(newElement);
      return;
    }

    // If no new node, remove old node
    if (!newVNode) {
      container.removeChild(container.childNodes[index]);
      return;
    }

    // If nodes are different types, replace
    if (this.hasChanged(oldVNode, newVNode)) {
      const newElement = this.createDOMElement(newVNode);
      container.replaceChild(newElement, container.childNodes[index]);
      return;
    }

    // If nodes are the same type, update properties and children
    if (newVNode.tag) {
      const element = container.childNodes[index];
      this.updateElement(element, oldVNode.props || {}, newVNode.props || {});

      // Diff children
      const oldChildren = oldVNode.children || [];
      const newChildren = newVNode.children || [];
      const maxLength = Math.max(oldChildren.length, newChildren.length);

      for (let i = 0; i < maxLength; i++) {
        this.diff(oldChildren[i], newChildren[i], element, i);
      }
    }
  }

  // Check if virtual nodes have changed
  hasChanged(oldVNode, newVNode) {
    return typeof oldVNode !== typeof newVNode ||
           (typeof oldVNode === 'string' && oldVNode !== newVNode) ||
           (typeof oldVNode === 'number' && oldVNode !== newVNode) ||
           oldVNode.tag !== newVNode.tag;
  }

  // Update element properties
  updateElement(element, oldProps, newProps) {
    // Remove old properties
    Object.keys(oldProps).forEach(name => {
      if (!(name in newProps)) {
        if (name === 'checked' || name === 'autofocus') {
          element[name] = false;
        } else if (name === 'style') {
          element.style.cssText = '';
        } else if (name === 'className') {
          element.className = '';
        } else {
          element.removeAttribute(name);
        }
      }
    });

    // Set new properties
    Object.entries(newProps).forEach(([name, value]) => {
      if (oldProps[name] !== value) {
        if (name === 'checked' || name === 'autofocus') {
          element[name] = value;
        } else if (name === 'style') {
          element.style.cssText = value;
        } else if (name === 'for') {
          element.setAttribute('for', value);
        } else if (name === 'className') {
          element.className = value;
        } else {
          element.setAttribute(name, value);
        }
      }
    });
  }

  // Optimized render with Virtual DOM diffing
  renderWithDiff(virtualNode = null, container = document.body) {
    try {
      // Get the component to render
      if (!virtualNode) {
        const component = this.routes[this.currentRoute];
        if (!component) {
          if (this.errorComponent) {
            const errorVNode = typeof this.errorComponent === 'function'
              ? this.errorComponent('Page not found')
              : this.errorComponent;
            virtualNode = errorVNode;
          } else {
            return;
          }
        } else {
          virtualNode = typeof component === 'function' ? component() : component;
        }
      }

      if (!virtualNode) return;

      // Store previous virtual DOM for diffing
      if (!this.previousVDOM) {
        // First render
        if (container === document.body) {
          container.innerHTML = '';
        }
        const element = this.createDOMElement(virtualNode);
        container.appendChild(element);
        this.previousVDOM = virtualNode;
      } else {
        // Diff and update
        this.diff(this.previousVDOM, virtualNode, container);
        this.previousVDOM = virtualNode;
      }

      return container.firstChild;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Initialize the framework
  init(options = {}) {
    const {
      initialState = {},
      routes = {},
      errorPage = null,
      autoStart = true
    } = options;

    // Set initial state
    if (Object.keys(initialState).length > 0) {
      this.setState(initialState);
    }

    // Set routes
    if (Object.keys(routes).length > 0) {
      this.routes(routes);
    }

    // Set error page
    if (errorPage) {
      this.setErrorPage(errorPage);
    }

    // Auto-start the application
    if (autoStart) {
      this.start();
    }

    return this;
  }

  // Start the application
  start() {
    this.onReady(() => {
      // Set initial route based on hash
      const hash = window.location.hash;
      this.currentRoute = hash ? hash.substring(1) : '/';

      // Initial render
      this.render();

      // Handle hash changes
      this.onHashChange(() => {
        const hash = window.location.hash;
        this.currentRoute = hash ? hash.substring(1) : '/';
        this.render();
      });
    });

    return this;
  }

  // Create a new framework instance (factory method)
  static create(options = {}) {
    return new Framework().init(options);
  }
}
