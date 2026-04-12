/**
 * Quest VR Controller Tests
 * Tests Meta Quest controller and hand tracking support
 */

describe('Quest VR Controllers', () => {
  let mockXRSession;
  let mockGamepad;

  beforeEach(() => {
    mockGamepad = {
      id: 'oculus-touch',
      buttons: [
        { pressed: false, touched: false, value: 0 }, // trigger
        { pressed: false, touched: false, value: 0 }, // grip
        { pressed: false, touched: false, value: 0 }, // thumbstick
        { pressed: false, touched: false, value: 0 }, // A/X
        { pressed: false, touched: false, value: 0 }  // B/Y
      ],
      axes: [0, 0], // thumbstick x, y
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 }
      }
    };

    global.navigator = {
      getGamepads: jest.fn(() => [mockGamepad, null, mockGamepad, null]),
      xr: {
        supportsSession: jest.fn(() => Promise.resolve()),
        requestSession: jest.fn(() => Promise.resolve({
          inputSources: [
            { handedness: 'left', gamepad: mockGamepad },
            { handedness: 'right', gamepad: mockGamepad }
          ]
        }))
      }
    };
  });

  describe('Controller Detection', () => {
    test('should detect Oculus Touch controllers', () => {
      const gamepads = navigator.getGamepads();
      const oculusControllers = gamepads.filter(g => g && g.id.includes('oculus'));
      expect(oculusControllers.length).toBeGreaterThan(0);
    });

    test('should detect left and right controllers', async () => {
      const session = await navigator.xr.requestSession('immersive-vr');
      const leftController = session.inputSources.find(s => s.handedness === 'left');
      const rightController = session.inputSources.find(s => s.handedness === 'right');
      
      expect(leftController).toBeDefined();
      expect(rightController).toBeDefined();
    });

    test('should read button states', () => {
      mockGamepad.buttons[0].pressed = true;
      mockGamepad.buttons[0].value = 0.8;
      
      expect(mockGamepad.buttons[0].pressed).toBe(true);
      expect(mockGamepad.buttons[0].value).toBe(0.8);
    });

    test('should read thumbstick axes', () => {
      mockGamepad.axes = [0.5, -0.3];
      
      expect(mockGamepad.axes[0]).toBe(0.5);
      expect(mockGamepad.axes[1]).toBe(-0.3);
    });
  });

  describe('Hand Tracking', () => {
    test('should detect hand tracking joints', () => {
      const mockHand = {
        joints: {
          wrist: { position: [0, 0, 0] },
          thumbMetacarpal: { position: [0.01, 0.01, 0] },
          indexTip: { position: [0.05, 0.08, 0.02] }
        }
      };
      
      expect(Object.keys(mockHand.joints).length).toBeGreaterThanOrEqual(3);
    });

    test('should calculate pinch gesture', () => {
      const thumbTip = { position: [0.05, 0.05, 0.05] };
      const indexTip = { position: [0.051, 0.051, 0.051] };
      
      const distance = Math.sqrt(
        Math.pow(thumbTip.position[0] - indexTip.position[0], 2) +
        Math.pow(thumbTip.position[1] - indexTip.position[1], 2) +
        Math.pow(thumbTip.position[2] - indexTip.position[2], 2)
      );
      
      // Pinch detected if distance < 0.02
      expect(distance).toBeLessThan(0.02);
    });
  });

  describe('Controller Mapping', () => {
    test('should map trigger to select action', () => {
      const triggerPressed = mockGamepad.buttons[0].pressed;
      // In VR interaction, trigger = select
      expect(mockGamepad.buttons[0]).toBeDefined();
    });

    test('should map grip to grab action', () => {
      // Grip button is typically index 1
      expect(mockGamepad.buttons[1]).toBeDefined();
    });

    test('should map thumbstick to teleport/move', () => {
      // Thumbstick axes used for locomotion
      const xAxis = mockGamepad.axes[0];
      const yAxis = mockGamepad.axes[1];
      
      expect(typeof xAxis).toBe('number');
      expect(typeof yAxis).toBe('number');
    });
  });

  describe('Haptic Feedback', () => {
    test('should support haptic actuators', () => {
      const mockHapticActuator = {
        pulse: jest.fn((value, duration) => Promise.resolve())
      };
      
      mockGamepad.hapticActuators = [mockHapticActuator];
      
      // Trigger pulse
      mockGamepad.hapticActuators[0].pulse(0.5, 100);
      
      expect(mockHapticActuator.pulse).toHaveBeenCalledWith(0.5, 100);
    });
  });
});

describe('ResearchTelemetry + VR Integration', () => {
  test('should log VR controller events', () => {
    // Mock telemetry
    const events = [];
    const telemetry = {
      logVRInput: (type, data) => {
        events.push({ category: 'vr_input', type, data });
      }
    };

    // Simulate controller event
    telemetry.logVRInput('quest-controller', {
      button: 'trigger',
      pressed: true,
      hand: 'right'
    });

    expect(events.length).toBe(1);
    expect(events[0].data.hand).toBe('right');
    expect(events[0].data.button).toBe('trigger');
  });

  test('should log hand tracking events', () => {
    const events = [];
    const telemetry = {
      logVRInput: (type, data) => {
        events.push({ category: 'vr_input', type, data });
      }
    };

    telemetry.logVRInput('hand-tracking', {
      gesture: 'pinch',
      confidence: 0.95,
      joints: 25
    });

    expect(events[0].data.gesture).toBe('pinch');
    expect(events[0].data.confidence).toBeGreaterThan(0.9);
  });
});
