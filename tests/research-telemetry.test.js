/**
 * ResearchTelemetry Unit Tests
 * Tests privacy-preserving telemetry for VR research studies
 */

const { ResearchTelemetry } = require('../src/core/ResearchTelemetry.js');

describe('ResearchTelemetry', () => {
  let telemetry;
  let mockStorage;

  beforeEach(() => {
    mockStorage = {};
    global.localStorage = {
      getItem: (key) => mockStorage[key] || null,
      setItem: (key, value) => { mockStorage[key] = value; },
      removeItem: (key) => { delete mockStorage[key]; }
    };
    global.document = { hidden: false };
    global.window = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    global.navigator = { userAgent: 'test-agent' };
    
    telemetry = new ResearchTelemetry({ sessionId: 'test-session-123' });
  });

  describe('Initialization', () => {
    test('should create telemetry instance with config', () => {
      expect(telemetry).toBeDefined();
      expect(telemetry.config.enabled).toBe(true);
    });

    test('should hash session ID for privacy', () => {
      expect(telemetry.sessionId).toBeDefined();
      expect(typeof telemetry.sessionId).toBe('string');
      // Should be hashed (not original)
      expect(telemetry.sessionId).not.toBe('test-session-123');
    });

    test('should not collect PII', () => {
      expect(telemetry.config.anonymize).toBe(true);
      expect(telemetry.config.collectIP).toBe(false);
    });
  });

  describe('Event Logging', () => {
    test('should log navigation events', () => {
      telemetry.logNavigation('/test', 'test-section');
      const events = telemetry.getEvents('navigation');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('timestamp');
      expect(events[0]).toHaveProperty('path', '/test');
    });

    test('should log interaction events', () => {
      telemetry.logInteraction('button-click', { target: 'test-btn' });
      const events = telemetry.getEvents('interaction');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('type', 'button-click');
    });

    test('should log gaze events', () => {
      telemetry.logGaze('test-entity', 1500);
      const events = telemetry.getEvents('gaze');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('entityId', 'test-entity');
      expect(events[0]).toHaveProperty('duration', 1500);
    });

    test('should log VR controller events', () => {
      telemetry.logVRInput('quest-controller', { button: 'trigger', pressed: true });
      const events = telemetry.getEvents('vr_input');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('controllerType', 'quest-controller');
    });
  });

  describe('Export Formats', () => {
    test('should export to JSON', () => {
      telemetry.logNavigation('/test', 'section');
      const json = telemetry.exportToJSON();
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('sessionId');
      expect(parsed).toHaveProperty('events');
      expect(parsed.events.length).toBeGreaterThan(0);
    });

    test('should export to CSV', () => {
      telemetry.logNavigation('/test', 'section');
      const csv = telemetry.exportToCSV();
      expect(typeof csv).toBe('string');
      expect(csv).toContain('timestamp');
      expect(csv).toContain('category');
    });

    test('should export with date range filter', () => {
      telemetry.logNavigation('/test1', 'section1');
      const yesterday = new Date(Date.now() - 86400000);
      const tomorrow = new Date(Date.now() + 86400000);
      const csv = telemetry.exportToCSV(yesterday, tomorrow);
      expect(csv).toContain('/test1');
    });
  });

  describe('Session Management', () => {
    test('should start session', () => {
      telemetry.startSession();
      expect(telemetry.sessionStart).toBeInstanceOf(Date);
    });

    test('should end session', () => {
      telemetry.startSession();
      const duration = telemetry.endSession();
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    test('should clear events', () => {
      telemetry.logNavigation('/test', 'section');
      telemetry.clearEvents();
      expect(telemetry.getEvents().length).toBe(0);
    });
  });

  describe('Privacy Compliance', () => {
    test('should not collect IP address', () => {
      const consent = telemetry.getConsentStatus();
      expect(consent.collectIP).toBe(false);
    });

    test('should anonymize session IDs', () => {
      const hash1 = telemetry._hashString('session-1');
      const hash2 = telemetry._hashString('session-1');
      expect(hash1).toBe(hash2); // Deterministic
      expect(hash1).not.toBe('session-1');
    });
  });
});

describe('ResearchTelemetry Performance', () => {
  test('should handle high-frequency logging', () => {
    const telemetry = new ResearchTelemetry();
    const startTime = Date.now();
    
    for (let i = 0; i < 1000; i++) {
      telemetry.logInteraction('rapid-event', { index: i });
    }
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should be fast
    expect(telemetry.getEvents().length).toBe(1000);
  });
});
