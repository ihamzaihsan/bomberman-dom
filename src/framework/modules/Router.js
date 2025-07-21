export class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = '';
        this.errorComponent = null;
        this.renderCallback = null;
    }

    route(path, component) {
        this.routes[path] = component;
        return this;
    }

    routes(routeMap) {
        Object.entries(routeMap).forEach(([path, component]) => {
        this.route(path, component);
        });
        return this;
    }

    setErrorPage(component) {
        this.errorComponent = component;
        return this;
    }

    navigate(path, state = {}) {
        window.history.pushState(state, '', path);
        this.currentRoute = path;
        // Trigger render if callback is available
        if (this.renderCallback) {
            this.renderCallback();
        }
        return this;
    }

    back() {
        window.history.back();
        return this;
    }

    forward() {
        window.history.forward();
        return this;
    }

    getCurrentRoute() {
        return this.currentRoute;
    }

    isRoute(pattern) {
        return this.currentRoute === pattern;
    }

    // Set render callback for navigation
    setRenderCallback(callback) {
        this.renderCallback = callback;
        return this;
    }
}