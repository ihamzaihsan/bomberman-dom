export class Framework {
  constructor() {
    this.state = {};
    this.routes = {};
    this.currentRoute = '';
    this.subscribers = [];
    this.eventHandlers = new Map();
    this.errorComponent = null;
    this.components = new Map();
  }

  // Enhanced createElement with multiple syntax options
  createElement(tag, props = {}, ...children) {
    // Handle string-based syntax: "div.class#id[attr=value]"
    if (typeof tag === 'string' && (tag.includes('.') || tag.includes('#') || tag.includes('['))) {
      const parsed = this.parseSelector(tag);
      tag = parsed.tag;
      props = { ...parsed.props, ...props };
    }

    return {
      tag,
      props,
      children: children.flat().filter(child => child !== null && child !== undefined)
    };
  }

  // Parse CSS-like selectors for easier element creation
  parseSelector(selector) {
    let tag = 'div';
    const props = {};
    
    // Extract tag name
    const tagMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
    if (tagMatch) {
      tag = tagMatch[1];
      selector = selector.substring(tagMatch[0].length);
    }

    // Extract classes
    const classMatches = selector.match(/\.([a-zA-Z0-9_-]+)/g);
    if (classMatches) {
      props.class = classMatches.map(c => c.substring(1)).join(' ');
    }

    // Extract ID
    const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      props.id = idMatch[1];
    }

    // Extract attributes [attr=value]
    const attrMatches = selector.match(/\[([^=\]]+)=([^\]]+)\]/g);
    if (attrMatches) {
      attrMatches.forEach(attr => {
        const [, key, value] = attr.match(/\[([^=\]]+)=([^\]]+)\]/);
        props[key] = value.replace(/['"]/g, '');
      });
    }

    return { tag, props };
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

  header(props = {}, ...children) {
    return this.createElement('header', props, ...children);
  }

  section(props = {}, ...children) {
    return this.createElement('section', props, ...children);
  }

  footer(props = {}, ...children) {
    return this.createElement('footer', props, ...children);
  }

  // Template literal support for JSX-like syntax
  html(strings, ...values) {
    let result = '';
    strings.forEach((string, i) => {
      result += string + (values[i] || '');
    });
    return this.parseHTML(result);
  }

  // Component system
  component(name, componentFunction) {
    this.components.set(name, componentFunction);
    return this;
  }

  // Use a registered component
  use(name, props = {}) {
    const component = this.components.get(name);
    if (!component) {
      throw new Error(`Component '${name}' not found`);
    }
    return component(props);
  }

  // Conditional rendering helper
  when(condition, trueElement, falseElement = null) {
    return condition ? trueElement : falseElement;
  }

  // List rendering helper
  each(array, callback) {
    return array.map(callback).filter(item => item !== null && item !== undefined);
  }

  // Style helper
  style(styleObject) {
    return Object.entries(styleObject)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
      .join('; ');
  }

  // Class helper
  classes(...classNames) {
    return classNames
      .filter(Boolean)
      .map(cls => typeof cls === 'object' ? 
        Object.entries(cls).filter(([, condition]) => condition).map(([name]) => name).join(' ') : 
        cls
      )
      .join(' ');
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

  setErrorPage(component) {
    this.errorComponent = component;
  }

  isValidRoute(route) {
    return this.routes.hasOwnProperty(route);
  }

  getCurrentRoute() {
    const hash = window.location.hash;
    if (hash.startsWith('#/')) {
      return hash.substring(1);
    } else if (hash === '' || hash === '#') {
      return '/';
    }
    return hash.substring(1);
  }

  navigate(path) {
    window.history.pushState({}, '', path);
    this.currentRoute = path;
    this.render();
  }

  on(eventType, selector, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
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

  onHashChange(handler) {
    window.addEventListener('hashchange', handler);
  }

  onReady(handler) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handler);
    } else {
      handler();
    }
  }

  handleError(error) {
    console.error('Framework Error:', error);
    if (this.errorComponent) {
      this.setState({ error: error.message });
      this.renderError();
    }
  }

  renderError(errorMessage = 'Something went wrong') {
    if (this.errorComponent) {
      const errorVNode = typeof this.errorComponent === 'function' 
        ? this.errorComponent(errorMessage) 
        : this.errorComponent;
      
      document.body.innerHTML = '';
      const errorElement = this.createDOMElement(errorVNode);
      document.body.appendChild(errorElement);
    }
  }

  render(virtualNode = null, container = document.body) {
    try {
      if (!virtualNode) {
        if (!this.isValidRoute(this.currentRoute)) {
          if (this.errorComponent) {
            this.renderError(`Page not found: ${window.location.pathname}${window.location.hash || ''}`);
            return;
          } else {
            console.error('Route not found and no error component set');
            return;
          }
        }

        const component = this.routes[this.currentRoute];
        if (!component) {
          if (this.errorComponent) {
            this.renderError('Page not found');
            return;
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
        } else if (name.startsWith('on') && typeof value === 'function') {
          // Handle event handlers like onclick, onsubmit, etc.
          const eventType = name.substring(2).toLowerCase();
          element.addEventListener(eventType, value);
        } else {
          element.setAttribute(name, value);
        }
      });
    }

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
