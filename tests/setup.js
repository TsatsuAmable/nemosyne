// Jest setup file for global mocks and polyfills

// Polyfill for EventTarget if not available
global.EventTarget = global.EventTarget || class EventTarget {
  constructor() {
    this._listeners = new Map();
  }
  addEventListener(type, callback) {
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
    if (this._listeners.has(event.type)) {
      this._listeners.get(event.type).forEach(cb => cb(event));
    }
    return true;
  }
};

// Polyfill for CustomEvent
global.CustomEvent = global.CustomEvent || class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
    this.bubbles = init.bubbles || false;
    this.cancelable = init.cancelable || false;
  }
  preventDefault() {}
  stopPropagation() {}
};

// Mock document
global.document = {
  querySelector: jest.fn(() => null),
  querySelectorAll: jest.fn(() => []),
  createElement: jest.fn((tag) => ({
    tagName: tag,
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    style: {},
    classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
  body: { appendChild: jest.fn(), removeChild: jest.fn() },
};

// Mock window
global.window = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  requestAnimationFrame: jest.fn((cb) => setTimeout(cb, 16)),
  cancelAnimationFrame: jest.fn((id) => clearTimeout(id)),
  navigator: {},
  location: { href: 'http://localhost/' },
};

// Mock navigator
global.navigator = {
  userAgent: 'node',
  getGamepads: jest.fn(() => []),
  xr: null,
};

// Mock performance
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
};

// Mock console methods that might clutter test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
