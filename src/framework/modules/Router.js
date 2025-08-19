export class Router {
    constructor() {
        // Internal route table; avoid naming collision with routes(routeMap) method
        this.routeTable = {};
        this.currentRoute = '';
        this.errorComponent = null;
        this.renderCallback = null;
        this.initialized = false;
        this.params = {};
        this.query = {};

        // Bind methods to preserve context
        this.handlePopState = this.handlePopState.bind(this);
        this.handleRouteChange = this.handleRouteChange.bind(this);
        this.handleHashChange = this.handleHashChange.bind(this);
    }

    // Initialize the router - should be called after routes are defined
    init() {
        if (this.initialized) return this;

        // Set up popstate listener for browser back/forward navigation
        window.addEventListener('popstate', this.handlePopState);

        // Set up hashchange listener to handle hash fragments as invalid routes
        window.addEventListener('hashchange', this.handleHashChange);

        // Initialize with current URL (including hash detection)
        this.initializeCurrentRoute();

        this.initialized = true;
        return this;
    }

    // Initialize the current route based on URL
    initializeCurrentRoute() {
        const fullUrl = window.location.href;
        const hasHash = window.location.hash && window.location.hash !== '#';

        if (hasHash) {
            // If there's a hash fragment, treat it as an invalid route
            this.handleInvalidRoute(fullUrl);
        } else {
            // Normal route handling
            const path = window.location.pathname + window.location.search;
            this.handleRouteChange(path);
        }
    }

    // Handle browser back/forward navigation
    handlePopState(event) {
        const hasHash = window.location.hash && window.location.hash !== '#';

        if (hasHash) {
            // Hash fragments are not valid routes
            this.handleInvalidRoute(window.location.href);
        } else {
            const path = window.location.pathname + window.location.search;
            this.handleRouteChange(path, event.state);
        }
    }

    // Handle hash changes (treat as invalid routes)
    handleHashChange(event) {
        const hasHash = window.location.hash && window.location.hash !== '#';

        if (hasHash) {
            // Remove the hash and show 404
            const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
            window.history.replaceState(null, '', cleanUrl);
            this.handleInvalidRoute(event.oldURL || window.location.href);
        }
    }

    // Handle invalid routes (show 404)
    handleInvalidRoute(requestedUrl) {
        this.currentRoute = requestedUrl;
        this.params = {};
        this.query = {};

        if (this.errorComponent && this.renderCallback) {
            this.renderCallback(this.errorComponent, {}, {}, false);
        }
    }

    // Parse URL parameters and query strings
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

    // Match a path against route patterns (supports :param syntax)
    matchRoute(path) {
        const { pathname, query } = this.parseUrl(path);

        // Try exact match first
        if (this.routeTable[pathname]) {
            return {
                component: this.routeTable[pathname],
                params: {},
                query,
                matched: true
            };
        }

        // Try pattern matching for parameterized routes
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

        // No match found
        return {
            component: this.errorComponent,
            params: {},
            query,
            matched: false
        };
    }

    // Match a pathname against a route pattern
    matchPattern(pathname, pattern) {
        // Convert pattern to regex (e.g., "/user/:id" -> "/user/([^/]+)")
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

    // Handle route changes (internal method)
    handleRouteChange(path, state = null) {
        const routeMatch = this.matchRoute(path);

        this.currentRoute = path;
        this.params = routeMatch.params;
        this.query = routeMatch.query;

        // Store state if provided
        if (state) {
            this.currentState = state;
        }

        // Always render - either the matched component or 404
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

    // Force check current route (useful for debugging or manual checks)
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
        // Don't add to history if we're already on this path
        if (this.currentRoute !== path) {
            window.history.pushState(state, '', path);
        }

        this.handleRouteChange(path, state);
        return this;
    }

    // Replace current history entry instead of adding new one
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

    // Get current route parameters
    getParams() {
        return { ...this.params };
    }

    // Get current query parameters
    getQuery() {
        return { ...this.query };
    }

    // Get a specific parameter
    getParam(name) {
        return this.params[name];
    }

    // Get a specific query parameter
    getQueryParam(name) {
        return this.query[name];
    }

    isRoute(pattern) {
        if (pattern === this.currentRoute) {
            return true;
        }

        // Check if current route matches the pattern
        const match = this.matchPattern(this.parseUrl(this.currentRoute).pathname, pattern);
        return match.matched;
    }

    // Set render callback for navigation
    setRenderCallback(callback) {
        this.renderCallback = callback;
        return this;
    }

    // Clean up event listeners
    destroy() {
        if (this.initialized) {
            window.removeEventListener('popstate', this.handlePopState);
            window.removeEventListener('hashchange', this.handleHashChange);
            this.initialized = false;
        }
        return this;
    }
}