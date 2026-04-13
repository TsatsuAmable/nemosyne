/**
 * Jest setup file for Nemosyne tests
 * Sets up browser globals before tests run
 */

// Event and CustomEvent base classes
class Event {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
    this.bubbles = init.bubbles || false;
    this.cancelable = init.cancelable || false;
    this.composed = init.composed || false;
    this.timeStamp = Date.now();
    this.isTrusted = false;
  }
  preventDefault() {}
  stopPropagation() {}
  stopImmediatePropagation() {}
}

class CustomEvent extends Event {
  constructor(type, init = {}) {
    super(type, init);
    this.detail = init.detail;
  }
}

// EventTarget that accepts any event-like object
class EventTarget {
  constructor() {
    this._listeners = new Map();
  }
  addEventListener(type, callback, options) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push(callback);
  }
  removeEventListener(type, callback) {
    if (this._listeners.has(type)) {
      const arr = this._listeners.get(type);
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }
  dispatchEvent(event) {
    const type = event.type;
    if (this._listeners.has(type)) {
      this._listeners.get(type).forEach(cb => cb(event));
    }
    return !event.cancelable || !event.defaultPrevented;
  }
}

// Set up globals
global.Event = Event;
global.CustomEvent = CustomEvent;
global.EventTarget = EventTarget;

// Mock scene element with appendChild and dataset
const mockParent = {
  appendChild: () => ({ dataset: {} }),
  removeChild: () => {},
  parentNode: null,
};

const mockScene = {
  tagName: 'a-scene',
  setAttribute: () => {},
  getAttribute: () => null,
  style: {},
  dataset: {},
  parentNode: null,
  classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
  appendChild: (child) => {
    child.parentNode = mockScene;
    return child;
  },
  removeChild: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};

global.document = {
  querySelector: () => mockScene,
  querySelectorAll: () => [],
  createElement: (tag) => ({
    tagName: tag,
    setAttribute: () => {},
    getAttribute: () => null,
    style: {},
    dataset: {},
    classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
    appendChild: () => ({ dataset: {} }),
    removeChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
  body: { appendChild: () => {}, removeChild: () => {} },
  readyState: 'complete',
};

global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  navigator: {},
  location: { href: 'http://localhost/' },
  document: global.document,
};

global.navigator = global.window.navigator = {
  userAgent: 'node',
  getGamepads: () => [],
  xr: null,
};

global.performance = {
  now: () => Date.now(),
  mark: () => {},
  measure: () => {},
  getEntriesByName: () => [],
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};
