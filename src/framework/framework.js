export class Framework {
  constructor() {
    this.state = {};
    this.routes = {};
    this.currentRoute = '';
    this.subscribers = [];
    this.eventHandlers = new Map();
    this.errorComponent = null;
  }

  createElement(tag, props = {}, ...children) {
    return {
      tag,
      props,
      children: children.flat()
    };
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  getState() {
    return this.state;
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  notify() {
    this.subscribers.forEach(callback => callback(this.state));
  }

  route(path, component) {
    this.routes[path] = component;
  }

  // Set error page component
  setErrorPage(component) {
    this.errorComponent = component;
  }

  navigate(path) {
    window.history.pushState({}, '', path);
    this.currentRoute = path;
    this.render();
  }

  // Enhanced event handling
  on(eventType, selector, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
      // Set up delegation for this event type
      document.addEventListener(eventType, (e) => {
        const handlers = this.eventHandlers.get(eventType) || [];
        handlers.forEach(({ selector, handler }) => {
          try {
            if (e.target.matches && e.target.matches(selector)) {
              handler(e);
            } else if (e.target.closest && e.target.closest(selector)) {
              handler(e);
            }
          } catch (error) {
            console.error('Event handler error:', error);
            this.handleError(error);
          }
        });
      });
    }
    
    this.eventHandlers.get(eventType).push({ selector, handler });
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
}
