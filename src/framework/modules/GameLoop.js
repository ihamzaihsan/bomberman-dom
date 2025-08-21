export class GameLoop {
    constructor(performanceMonitor, selectiveRenderer, eventManager = null) {
        this.performanceMonitor = performanceMonitor;
        this.selectiveRenderer = selectiveRenderer;
        this.eventManager = eventManager;
        this.gameLoop = null;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.fpsUpdateTime = 0;
        this.updateCallback = null;
    }

    startGameLoop(updateCallback) {
        if (this.gameLoop) {
        this.stopGameLoop();
        }

        this.updateCallback = updateCallback;
        this.lastFrameTime = performance.now();

        const loop = (currentTime) => {
        const startTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        this.updateFPS(currentTime);

        if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark('frame-start');
        }

        try {
            if (this.updateCallback) {
            this.updateCallback(deltaTime, currentTime);
            }

            this.processSelectiveRendering();

            const endTime = performance.now();
            const frameTime = endTime - startTime;
            this.performanceMonitor.updateMetrics(frameTime);

            if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark('frame-end');
            performance.measure('frameTime', 'frame-start', 'frame-end');
            }

        } catch (error) {
            console.error('Game loop error:', error);
        }

        this.gameLoop = requestAnimationFrame(loop);
        };

        this.gameLoop = requestAnimationFrame(loop);
        return this;
    }

    stopGameLoop() {
        if (this.gameLoop) {
        cancelAnimationFrame(this.gameLoop);
        this.gameLoop = null;
        }
        return this;
    }

    updateFPS(currentTime) {
        this.frameCount++;
        if (currentTime - this.fpsUpdateTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsUpdateTime));
            this.frameCount = 0;
            this.fpsUpdateTime = currentTime;

            if (this.eventManager) {
                this.eventManager.emit('fps-update', this.fps);
            }

            this.performanceMonitor.notifyCallbacks(
                this.fps,
                this.selectiveRenderer.dirtyElements.size,
                this.selectiveRenderer.elementCache.size
            );
        }
    }

    processSelectiveRendering() {
        if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('selective-render-start');
        }

        this.selectiveRenderer.processDirtyElements();
        this.selectiveRenderer.processRenderQueue();

        if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('selective-render-end');
        performance.measure('selectiveRenderTime', 'selective-render-start', 'selective-render-end');
        }
    }

    getFPS() {
        return this.fps;
    }
}