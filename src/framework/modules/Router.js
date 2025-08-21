export class Router {
    constructor() {
        this.routeTable = {};
        this.currentRoute = '';
        this.errorComponent = null;
        this.renderCallback = null;
        this.initialized = false;
        this.params = {};
        this.query = {};

        this.handlePopState = this.handlePopState.bind(this);
        this.handleRouteChange = this.handleRouteChange.bind(this);
        this.handleHashChange = this.handleHashChange.bind(this);
    }

    init() {
        if (this.initialized) return this;

        window.addEventListener('popstate', this.handlePopState);

        window.addEventListener('hashchange', this.handleHashChange);

        this.initializeCurrentRoute();

        this.initialized = true;
        return this;
    }

    initializeCurrentRoute() {
        const fullUrl = window.location.href;
        const hasHash = window.location.hash && window.location.hash !== '#';

        if (hasHash) {
            this.handleInvalidRoute(fullUrl);
        } else {
            const path = window.location.pathname + window.location.search;
            this.handleRouteChange(path);
        }
    }

    handlePopState(event) {
        const hasHash = window.location.hash && window.location.hash !== '#';

        if (hasHash) {
            this.handleInvalidRoute(window.location.href);
        } else {
            const path = window.location.pathname + window.location.search;
            this.handleRouteChange(path, event.state);
        }
    }

    handleHashChange(event) {
        const hasHash = window.location.hash && window.location.hash !== '#';

        if (hasHash) {
            const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
            window.history.replaceState(null, '', cleanUrl);
            this.handleInvalidRoute(event.oldURL || window.location.href);
        }
    }

    handleInvalidRoute(requestedUrl) {
        this.currentRoute = requestedUrl;
        this.params = {};
        this.query = {};

        if (this.errorComponent && this.renderCallback) {
            this.renderCallback(this.errorComponent, {}, {}, false);
        }
    }

    parseUrl(path) {
        const [pathname, search] = path.split('?');
        const query = {};

        if (search) {
            const searchParams = new URLSearchParams(search);
            for (const [key, value] of searchParams) {
                query[key] = value;
            }
        }

        return { pathname, query };
    }

    matchRoute(path) {
        const { pathname, query } = this.parseUrl(path);

        if (this.routeTable[pathname]) {
            return {
                component: this.routeTable[pathname],
                params: {},
                query,
                matched: true
            };
        }

        for (const [pattern, component] of Object.entries(this.routeTable)) {
            const match = this.matchPattern(pathname, pattern);
            if (match.matched) {
                return {
                    component,
                    params: match.params,
                    query,
                    matched: true
                };
            }
        }

        return {
            component: this.errorComponent,
            params: {},
            query,
            matched: false
        };
    }

    matchPattern(pathname, pattern) {
        const paramNames = [];
        const regexPattern = pattern.replace(/:([^/]+)/g, (_, paramName) => {
            paramNames.push(paramName);
            return '([^/]+)';
        });

        const regex = new RegExp(`^${regexPattern}$`);
        const match = pathname.match(regex);

        if (match) {
            const params = {};
            paramNames.forEach((name, index) => {
                params[name] = match[index + 1];
            });

            return { matched: true, params };
        }

        return { matched: false, params: {} };
    }

    handleRouteChange(path, state = null) {
        const routeMatch = this.matchRoute(path);

        this.currentRoute = path;
        this.params = routeMatch.params;
        this.query = routeMatch.query;

        if (state) {
            this.currentState = state;
        }

        if (this.renderCallback) {
            if (routeMatch.matched && routeMatch.component) {
                this.renderCallback(routeMatch.component, routeMatch.params, routeMatch.query, true);
            } else {
                // Show 404 page for unmatched routes
                const errorComponent = this.errorComponent || (() => '<div>404 - Page Not Found</div>');
                this.renderCallback(errorComponent, {}, {}, false);
            }
        }

        return this;
    }

    checkCurrentRoute() {
        const hasHash = window.location.hash && window.location.hash !== '#';

        if (hasHash) {
            this.handleInvalidRoute(window.location.href);
        } else {
            const path = window.location.pathname + window.location.search;
            this.handleRouteChange(path);
        }

        return this;
    }

    route(path, component) {
        this.routeTable[path] = component;
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
        if (this.currentRoute !== path) {
            window.history.pushState(state, '', path);
        }

        this.handleRouteChange(path, state);
        return this;
    }

    replace(path, state = {}) {
        window.history.replaceState(state, '', path);
        this.handleRouteChange(path, state);
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

    getParams() {
        return { ...this.params };
    }

    getQuery() {
        return { ...this.query };
    }

    getParam(name) {
        return this.params[name];
    }

    getQueryParam(name) {
        return this.query[name];
    }

    isRoute(pattern) {
        if (pattern === this.currentRoute) {
            return true;
        }

        const match = this.matchPattern(this.parseUrl(this.currentRoute).pathname, pattern);
        return match.matched;
    }

    setRenderCallback(callback) {
        this.renderCallback = callback;
        return this;
    }

    destroy() {
        if (this.initialized) {
            window.removeEventListener('popstate', this.handlePopState);
            window.removeEventListener('hashchange', this.handleHashChange);
            this.initialized = false;
        }
        return this;
    }
}