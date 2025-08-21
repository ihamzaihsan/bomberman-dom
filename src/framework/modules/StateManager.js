export class StateManager {
    constructor() {
        this.state = {};
        this.subscribers = [];
        this.updateQueue = [];
        this.isUpdating = false;
        this.dirtyComponents = new Set();
    }

    setState(newState, callback) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...newState };

        this.markDirty();

        if (callback) {
            this.updateQueue.push(callback);
        }

        this.batchUpdate();
        return this;
    }

    getState() {
        return this.state;
    }

    get(key) {
        return this.state[key];
    }

    set(key, value, callback) {
        this.setState({ [key]: value }, callback);
    }

    merge(key, object, callback) {
        const currentValue = this.state[key] || {};
        this.setState({ [key]: { ...currentValue, ...object } }, callback);
    }

    push(key, item, callback) {
        const currentArray = this.state[key] || [];
        this.setState({ [key]: [...currentArray, item] }, callback);
    }

    remove(key, predicate, callback) {
        const currentArray = this.state[key] || [];
        this.setState({ [key]: currentArray.filter(predicate) }, callback);
    }

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

    executeUpdateQueue() {
        while (this.updateQueue.length > 0) {
            const callback = this.updateQueue.shift();
            callback();
        }
    }

    markDirty(componentId = 'root') {
        this.dirtyComponents.add(componentId);
    }

    batchUpdate() {
        if (this.isUpdating) return;

        this.isUpdating = true;

        requestAnimationFrame(() => {
            if (typeof performance !== 'undefined' && performance.mark) {
                performance.mark('batch-update-start');
            }

            try {
                if (this.dirtyComponents.size > 0) {
                    this.notify();
                    this.dirtyComponents.clear();
                }

                this.executeUpdateQueue();
            } catch (error) {
                console.error('Batch update error:', error);
            }

            if (typeof performance !== 'undefined' && performance.mark) {
                performance.mark('batch-update-end');
                performance.measure('batchUpdateTime', 'batch-update-start', 'batch-update-end');
            }

            this.isUpdating = false;
        });
    }
}