/**
 * 404 Not Found Component - Bomberman Theme
 * A user-friendly error page for invalid routes that matches the Bomberman game design
 */
export class NotFoundComponent {
    constructor(framework) {
        this.framework = framework;
    }

    render() {
        const currentPath = this.framework.getCurrentRoute();
        const displayPath = currentPath || window.location.href;

        return `
            <div class="bomberman-not-found-container">
                <div class="bomberman-not-found-content">
                    <div class="bomberman-error-icon">💣</div>
                    <div class="bomberman-error-code">404</div>
                    <h1 class="bomberman-error-title">Route Exploded!</h1>
                    <p class="bomberman-error-message">
                        The page you're looking for was blown up by a bomb!
                    </p>
                    <div class="bomberman-error-details">
                        <p>Requested URL:</p>
                        <code class="bomberman-url-code">${displayPath}</code>
                    </div>
                    <div class="bomberman-error-actions">
                        <button class="bomberman-btn-primary" onclick="window.history.back()">
                             Go Back
                        </button>
                        <button class="bomberman-btn-secondary" onclick="window.location.href = '/'">
                               Play Bomberman
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Static method to create a simple 404 component function
    static create(framework) {
        const component = new NotFoundComponent(framework);
        return () => component.render();
    }
}

// Default 404 component function that can be used without instantiation
export const createNotFoundComponent = (framework) => {
    return () => {
        const currentPath = framework ? framework.getCurrentRoute() : window.location.href;

        return `
            <div class="bomberman-not-found-container">
                <div class="bomberman-not-found-content">
                    <div class="bomberman-error-icon">💣</div>
                    <div class="bomberman-error-code">404</div>
                    <h1 class="bomberman-error-title">Route Exploded!</h1>
                    <p class="bomberman-error-message">
                        The page you're looking for was blown up by a bomb!
                    </p>
                    <div class="bomberman-error-details">
                        <p>Requested URL:</p>
                        <code class="bomberman-url-code">${currentPath}</code>
                    </div>
                    <div class="bomberman-error-actions">
                        <button class="bomberman-btn-primary" onclick="window.history.back()">
                             Go Back
                        </button>
                        <button class="bomberman-btn-secondary" onclick="window.location.href = '/'">
                         Play Bomberman
                        </button>
                    </div>
                </div>
            </div>
        `;
    };
};

// Simple function-based 404 component with Bomberman theme
export const NotFound404 = () => {
    const currentPath = window.location.href;

    return `
        <div class="bomberman-not-found-container">
            <div class="bomberman-not-found-content">
                <div class="bomberman-error-icon">💣</div>
                <div class="bomberman-error-code">404</div>
                <h1 class="bomberman-error-title">Route Exploded!</h1>
                <p class="bomberman-error-message">
                    The page you're looking for was blown up by a bomb!
                </p>
                <div class="bomberman-error-details">
                    <p>Requested URL:</p>
                    <code class="bomberman-url-code">${currentPath}</code>
                </div>
                <div class="bomberman-error-actions">
                    <button class="bomberman-btn-primary" onclick="window.history.back()">
                         Go Back
                    </button>
                    <button class="bomberman-btn-secondary" onclick="window.location.href = '/'">
                         Play Bomberman
                    </button>
                </div>
            </div>
        </div>
    `;
};
