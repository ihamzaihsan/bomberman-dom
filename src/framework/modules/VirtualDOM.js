export class VirtualDOM {
    constructor() {
        this.previousVDOM = null;
        this.dirtyComponents = new Set();
    }


    diff(oldVDOM, newVDOM) {
        return [];
    }

    patch(element, patches) {
        patches.forEach(patch => {
        });
    }

    render(vdom, container) {
        if (!vdom) return;
        
        if (typeof vdom === 'string') {
            container.innerHTML = vdom;
        }
    }

    markComponentDirty(componentId) {
        this.dirtyComponents.add(componentId);
    }

    clearDirtyComponents() {
        this.dirtyComponents.clear();
    }

    getDirtyComponents() {
        return Array.from(this.dirtyComponents);
    }
}
