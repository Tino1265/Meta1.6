class StateManager {
    constructor(initialState = {}) {
        this.state = new Proxy(initialState, {
            set: (target, prop, value) => {
                target[prop] = value;
                this.notify(prop, value);
                return true;
            }
        });
        this.listeners = [];
    }

    get(path) {
        return path.split('.').reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, this.state);
    }

    set(path, value) {
        const keys = path.split('.');
        let current = this.state;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify(prop, value) {
        this.listeners.forEach(listener => listener(prop, value));
    }
}

export { StateManager };