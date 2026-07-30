// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { InputRouter } from '../src/vr/InputRouter.js';
import { Locomotion } from '../src/vr/Locomotion.js';
import { DracoDiagnosticHUD } from '../src/draco/DracoDiagnosticHUD.js';
import { ConstraintEngine, TopologyTypes } from '../src/draco/ConstraintEngine.js';
import { Dataset, ColumnType } from '../src/data/Dataset.js';
import { InputTelemetry } from '../src/vr/InputTelemetry.js';

/**
 * Minimal mock EventTarget for controller spaces.
 */
class MockEventTarget {
  constructor() {
    this.listeners = {};
  }

  addEventListener(name, fn) {
    this.listeners[name] = this.listeners[name] ?? [];
    this.listeners[name].push(fn);
  }

  dispatchEvent(event) {
    const list = this.listeners[event.type] ?? [];
    for (const fn of list) fn(event);
  }
}

/**
 * Mock controller pointer with a poseable ray.
 */
function makeMockController({ origin = new THREE.Vector3(0, 0, 0), direction = new THREE.Vector3(0, 0, -1) } = {}) {
  const group = new MockEventTarget();
  const rayLength = { value: 4 };
  const rayVisible = { value: true };

  const pointer = {
    index: 0,
    group,
    ray: { visible: true },
    origin: origin.clone(),
    direction: direction.clone(),
    setRayLength(length) {
      rayLength.value = length;
    },
    getRayLength() {
      return rayLength.value;
    },
    setRayVisible(visible) {
      rayVisible.value = visible;
    },
    isRayVisible() {
      return rayVisible.value;
    },
    getRay(target) {
      target.origin.copy(this.origin);
      target.direction.copy(this.direction);
      return target;
    },
  };

  return pointer;
}

/**
 * Mock hand pointer with a poseable ray and pinch state.
 */
function makeMockHand({
  origin = new THREE.Vector3(0, 0, 0),
  direction = new THREE.Vector3(0, 0, -1),
  pinched = false,
} = {}) {
  return {
    index: 0,
    group: new MockEventTarget(),
    ray: { visible: true },
    jointsValid: true,
    origin: origin.clone(),
    direction: direction.clone(),
    pinched,
    pinchDistance: pinched ? 0.02 : 0.1,
    setRayLength(length) {},
    getRay(target) {
      target.origin.copy(this.origin);
      target.direction.copy(this.direction);
      return target;
    },
    isPinched() {
      return this.pinched;
    },
    getWorldPosition(target) {
      return target.copy(this.origin);
    },
    update() {},
  };
}

/**
 * Mock XR session with configurable input sources.
 */
function makeMockEngine(session = null, hands = [], controllers = []) {
  const scene = new THREE.Scene();
  return {
    renderer: {
      xr: {
        getSession: () => session,
        isPresenting: !!session,
      },
    },
    input: { hands, controllers },
    camera: new THREE.PerspectiveCamera(75, 1, 0.05, 200),
    cameraGroup: new THREE.Group(),
    scene,
    headWorldPos: new THREE.Vector3(),
    xrFrame: null,
    xrRefSpace: null,
  };
}

/**
 * Create a small plane mesh facing the user so raycasting behaves predictably.
 */
function makeInteractablePlane(position = new THREE.Vector3(0, 0, -2)) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.updateMatrixWorld(true);
  return mesh;
}

/**
 * Create a mock XR input source.
 */
function makeInputSource({
  handedness = 'left',
  axes = [0, 0],
  buttons = [{ pressed: false }],
  hand = false,
  position = new THREE.Vector3(0, 0, 0),
} = {}) {
  return {
    handedness,
    hand,
    targetRaySpace: { __handedness: handedness, __position: position.clone() },
    gamepad: hand
      ? null
      : {
          axes: axes.slice(),
          buttons: buttons.map((b) => ({ ...b })),
        },
  };
}

/**
 * Create a mock XR frame whose getPose returns a position based on the
 * source's targetRaySpace marker.
 */
function makeMockFrame() {
  return {
    getPose(space, _refSpace) {
      if (!space?.__position) return null;
      return {
        transform: {
          position: space.__position.clone(),
        },
      };
    },
  };
}

describe('InputRouter', () => {
  let engine;
  let router;

  beforeEach(() => {
    engine = makeMockEngine();
    router = new InputRouter(engine);
  });

  it('detects hover when a controller ray intersects an interactable', () => {
    const controller = makeMockController({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    router.addController(controller);

    const plane = makeInteractablePlane(new THREE.Vector3(0, 0, -2));
    let entered = false;
    let left = false;

    router.addInteractable(plane, {
      onEnter: () => (entered = true),
      onLeave: () => (left = true),
    });

    router.update(null, null);

    expect(entered).toBe(true);
    expect(router.hovered).not.toBeNull();

    // Move ray away; should trigger onLeave.
    controller.origin.set(10, 10, 0);
    controller.direction.set(1, 0, 0);
    router.update(null, null);

    expect(left).toBe(true);
    expect(router.hovered).toBeNull();
  });

  it('fires onSelect via the controller event fallback when hovered', () => {
    const controller = makeMockController({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    router.addController(controller);

    const plane = makeInteractablePlane(new THREE.Vector3(0, 0, -2));
    let selected = false;
    router.addInteractable(plane, { onSelect: () => (selected = true) });

    // Establish hover first; the event fallback relies on the current hover state.
    router.update(null, null);
    expect(router.hovered).not.toBeNull();

    // No session means no trigger polling, so use the fallback callback path.
    controller.onSelect(controller);

    expect(selected).toBe(true);
  });

  it('wires a controller onSelect callback that triggers selection', () => {
    const controller = makeMockController({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    router.addController(controller);

    const plane = makeInteractablePlane(new THREE.Vector3(0, 0, -2));
    let selected = false;
    router.addInteractable(plane, { onSelect: () => (selected = true) });

    router.update(null, null);
    expect(router.hovered).not.toBeNull();

    // The wiring itself is the feature under test.
    expect(controller.onSelect).toBeTypeOf('function');
    controller.onSelect(controller);

    expect(selected).toBe(true);
  });

  it('wires a hand onPinchStart callback that triggers selection', () => {
    const hand = makeMockHand({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    router.addHand(hand);

    const plane = makeInteractablePlane(new THREE.Vector3(0, 0, -2));
    let selected = false;
    router.addInteractable(plane, { onSelect: () => (selected = true) });

    router.update(null, null);

    expect(hand.onPinchStart).toBeTypeOf('function');
    hand.onPinchStart(hand);

    expect(selected).toBe(true);
  });

  it('fires onSelectCallback via the fallback callback path', () => {
    const controller = makeMockController({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    router.addController(controller);

    let callbackRay = null;
    router.onSelectCallback = (ray) => (callbackRay = ray);

    controller.onSelect(controller);

    expect(callbackRay).not.toBeNull();
  });

  it('selects HUD objects before scene interactables', () => {
    const controller = makeMockController({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    router.addController(controller);

    const plane = makeInteractablePlane(new THREE.Vector3(0, 0, -2));
    let sceneSelected = false;
    let hudSelected = false;

    router.addInteractable(plane, { onSelect: () => (sceneSelected = true) });

    const hudPlane = makeInteractablePlane(new THREE.Vector3(0, 0, -1));
    const hud = {
      mesh: hudPlane,
      handlePointerClick: (raycaster) => {
        const hits = raycaster.intersectObject(hudPlane, false);
        if (hits.length > 0) {
          hudSelected = true;
          return true;
        }
        return false;
      },
    };
    router.addHudObject(hud);

    // Establish hover first.
    router.update(null, null);

    controller.onSelect(controller);

    expect(hudSelected).toBe(true);
    expect(sceneSelected).toBe(false);
  });

  it('hides controller rays when a valid hand is tracked', () => {
    const controller = makeMockController({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    const hand = makeMockHand({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });

    router.addController(controller);
    router.addHand(hand);

    router.update(null, null);

    expect(controller.isRayVisible()).toBe(false);
  });

  it('shows controller rays when no hand is tracked', () => {
    const controller = makeMockController({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });

    router.addController(controller);

    router.update(null, null);

    expect(controller.isRayVisible()).toBe(true);
  });

  it('scales the active pointer line to the nearest hit distance', () => {
    const controller = makeMockController({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    router.addController(controller);

    const plane = makeInteractablePlane(new THREE.Vector3(0, 0, -3));
    router.addInteractable(plane, {});

    router.update(null, null);

    expect(controller.getRayLength()).toBeCloseTo(3, 1);
  });

  it('prefers hand rays over controller rays for hovering', () => {
    const hand = makeMockHand({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });
    const controller = makeMockController({
      origin: new THREE.Vector3(10, 0, 0),
      direction: new THREE.Vector3(1, 0, 0),
    });

    router.addController(controller);
    router.addHand(hand);

    const handTarget = makeInteractablePlane(new THREE.Vector3(0, 0, -2));
    let handEntered = false;
    router.addInteractable(handTarget, { onEnter: () => (handEntered = true) });

    router.update(null, null);

    expect(handEntered).toBe(true);
  });

  it('polls hand pinch state for selection', () => {
    const hand = makeMockHand({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
      pinched: true,
    });
    router.addHand(hand);

    const plane = makeInteractablePlane(new THREE.Vector3(0, 0, -2));
    let selected = false;
    router.addInteractable(plane, { onSelect: () => (selected = true) });

    // Poll path needs a session.
    const session = { inputSources: [] };
    engine = makeMockEngine(session);
    const polledRouter = new InputRouter(engine);
    polledRouter.addHand(hand);
    polledRouter.addInteractable(plane, { onSelect: () => (selected = true) });
    polledRouter.update(null, null);

    expect(selected).toBe(true);
  });

  it('polls controller trigger buttons when a session is active', () => {
    const controller = makeMockController({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });

    const session = {
      inputSources: [makeInputSource({ handedness: 'right', buttons: [{ pressed: true }] })],
    };
    engine = makeMockEngine(session);
    router = new InputRouter(engine);
    router.addController(controller);

    const plane = makeInteractablePlane(new THREE.Vector3(0, 0, -2));
    let selected = false;
    router.addInteractable(plane, { onSelect: () => (selected = true) });

    router.update(null, null);

    expect(selected).toBe(true);
  });

  it('only fires controller selection on the rising edge of the trigger', () => {
    const controller = makeMockController({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
    });

    const button = { pressed: true };
    const session = {
      inputSources: [makeInputSource({ handedness: 'right', buttons: [button] })],
    };
    engine = makeMockEngine(session);
    router = new InputRouter(engine);
    router.addController(controller);

    const plane = makeInteractablePlane(new THREE.Vector3(0, 0, -2));
    let selections = 0;
    router.addInteractable(plane, { onSelect: () => selections++ });

    router.update(null, null);
    expect(selections).toBe(1);

    router.update(null, null);
    expect(selections).toBe(1); // still held, should not re-fire
  });

  it('only fires hand selection on the rising edge of a pinch', () => {
    const hand = makeMockHand({
      origin: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
      pinched: true,
    });

    const session = { inputSources: [] };
    engine = makeMockEngine(session);
    router = new InputRouter(engine);
    router.addHand(hand);

    const plane = makeInteractablePlane(new THREE.Vector3(0, 0, -2));
    let selections = 0;
    router.addInteractable(plane, { onSelect: () => selections++ });

    router.update(null, null);
    expect(selections).toBe(1);

    router.update(null, null);
    expect(selections).toBe(1); // pinch still held, should not re-fire
  });
});

describe('Locomotion', () => {
  let engine;
  let locomotion;

  beforeEach(() => {
    engine = makeMockEngine();
    locomotion = new Locomotion(engine);
  });

  afterEach(() => {
    // Clear keyboard listeners so they do not leak between tests.
    locomotion.dispose();
  });

  it('moves forward when left thumbstick is pushed forward', () => {
    const session = {
      inputSources: [makeInputSource({ handedness: 'left', axes: [0, -1] })],
    };
    engine = makeMockEngine(session);
    locomotion = new Locomotion(engine);

    const startZ = engine.cameraGroup.position.z;
    locomotion.update(0.1, 0);

    // Negative Z is forward in Three.js camera space.
    expect(engine.cameraGroup.position.z).toBeLessThan(startZ);
  });

  it('strafes right when left thumbstick is pushed right', () => {
    const session = {
      inputSources: [makeInputSource({ handedness: 'left', axes: [1, 0] })],
    };
    engine = makeMockEngine(session);
    locomotion = new Locomotion(engine);

    const startX = engine.cameraGroup.position.x;
    locomotion.update(0.1, 0);

    expect(engine.cameraGroup.position.x).toBeGreaterThan(startX);
  });

  it('ignores thumbstick values inside the dead zone', () => {
    const session = {
      inputSources: [makeInputSource({ handedness: 'left', axes: [0.05, 0.05] })],
    };
    engine = makeMockEngine(session);
    locomotion = new Locomotion(engine);

    const start = engine.cameraGroup.position.clone();
    locomotion.update(0.1, 0);

    expect(engine.cameraGroup.position.distanceTo(start)).toBe(0);
  });

  it('snap-turns right on right thumbstick', () => {
    const session = {
      inputSources: [makeInputSource({ handedness: 'right', axes: [1, 0, 1, 0] })],
    };
    engine = makeMockEngine(session);
    locomotion = new Locomotion(engine);

    const startRotation = engine.cameraGroup.rotation.y;
    locomotion.update(0.1, 0);

    expect(engine.cameraGroup.rotation.y).not.toBe(startRotation);
  });

  it('respects snap-turn cooldown', () => {
    const session = {
      inputSources: [makeInputSource({ handedness: 'right', axes: [1, 0, 1, 0] })],
    };
    engine = makeMockEngine(session);
    locomotion = new Locomotion(engine);

    locomotion.update(0.1, 0);
    const rotationAfterFirst = engine.cameraGroup.rotation.y;

    locomotion.update(0.05, 0);
    const rotationAfterSecond = engine.cameraGroup.rotation.y;

    expect(rotationAfterSecond).toBe(rotationAfterFirst);
  });

  it('moves backward when left thumbstick is pulled back', () => {
    const session = {
      inputSources: [makeInputSource({ handedness: 'left', axes: [0, 1] })],
    };
    engine = makeMockEngine(session);
    locomotion = new Locomotion(engine);

    const startZ = engine.cameraGroup.position.z;
    locomotion.update(0.1, 0);

    expect(engine.cameraGroup.position.z).toBeGreaterThan(startZ);
  });

  it('snap-turns left on negative right thumbstick', () => {
    const session = {
      inputSources: [makeInputSource({ handedness: 'right', axes: [-1, 0, -1, 0] })],
    };
    engine = makeMockEngine(session);
    locomotion = new Locomotion(engine);

    const startRotation = engine.cameraGroup.rotation.y;
    locomotion.update(0.1, 0);

    expect(engine.cameraGroup.rotation.y).not.toBe(startRotation);
  });

  it('uses hand-grab locomotion when a hand is pinched', () => {
    const hand = makeMockHand({
      origin: new THREE.Vector3(0, 0, -2),
      pinched: true,
    });
    engine = makeMockEngine(null, [hand]);
    locomotion = new Locomotion(engine);

    const startZ = engine.cameraGroup.position.z;
    locomotion.update(0.1, 0);

    // First frame only anchors; second frame applies movement.
    hand.origin.set(0, 0, -2.5);
    locomotion.update(0.1, 0);

    expect(engine.cameraGroup.position.z).toBeGreaterThan(startZ);
  });

  it('moves with WASD keys on desktop', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    locomotion.update(0.1, 0);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));

    expect(engine.cameraGroup.position.z).toBeLessThan(0);
  });
});

describe('DracoDiagnosticHUD', () => {
  let engine;
  let dracoNode;
  let cameraGroup;
  let originalCreateElement;
  let mockCtx;

  beforeEach(() => {
    originalCreateElement = document.createElement.bind(document);

    mockCtx = {
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      measureText: () => ({ width: 0 }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
    };

    // jsdom does not implement the 2D canvas context without the native
    // `canvas` package, so we provide a minimal mock context for the HUD tests.
    document.createElement = (tag) => {
      if (tag === 'canvas') {
        const canvas = originalCreateElement('canvas');
        canvas.getContext = (type) => (type === '2d' ? mockCtx : null);
        return canvas;
      }
      return originalCreateElement(tag);
    };

    engine = new ConstraintEngine();
    const dataset = new Dataset('Test', [
      { name: 'a', type: ColumnType.NUMERIC },
    ], [{ a: 1 }]);

    dracoNode = {
      engine,
      solverResult: engine.solve({ topology: TopologyTypes.TABULAR, dataset }),
      adjustWeight: (name, delta) => engine.adjustWeight(name, delta),
    };

    cameraGroup = { add: () => {}, remove: () => {} };
  });

  afterEach(() => {
    document.createElement = originalCreateElement;
  });

  it('registers one INC and one DEC button per soft constraint', () => {
    const hud = new DracoDiagnosticHUD(cameraGroup, dracoNode);
    const inc = hud.buttons.filter((b) => b.action === 'INC');
    const dec = hud.buttons.filter((b) => b.action === 'DEC');

    expect(inc.length).toBe(engine.softConstraints.length);
    expect(dec.length).toBe(engine.softConstraints.length);
  });

  it('handles a click on the INC button by increasing the weight', () => {
    const hud = new DracoDiagnosticHUD(cameraGroup, dracoNode);
    const firstRule = engine.softConstraints[0];
    const startWeight = firstRule.weight;

    const incButton = hud.buttons.find((b) => b.action === 'INC' && b.ruleName === firstRule.name);

    // Build a ray that hits the center of the INC button.
    const raycaster = makeRaycasterForButton(hud, incButton);
    const consumed = hud.handleContentClick(raycaster);

    expect(consumed).toBe(true);
    expect(firstRule.weight).toBe(startWeight + 5);
  });

  it('handles a click on the DEC button by decreasing the weight', () => {
    const hud = new DracoDiagnosticHUD(cameraGroup, dracoNode);
    const firstRule = engine.softConstraints[0];
    // Start high enough that a -5 decrement is allowed.
    engine.setWeight(firstRule.name, 20);
    const startWeight = firstRule.weight;

    const decButton = hud.buttons.find((b) => b.action === 'DEC' && b.ruleName === firstRule.name);
    const raycaster = makeRaycasterForButton(hud, decButton);
    const consumed = hud.handleContentClick(raycaster);

    expect(consumed).toBe(true);
    expect(firstRule.weight).toBe(startWeight - 5);
  });

  it('returns false when the ray misses the panel', () => {
    const hud = new DracoDiagnosticHUD(cameraGroup, dracoNode);
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0)
    );

    const consumed = hud.handleContentClick(raycaster);
    expect(consumed).toBe(false);
  });

  it('returns false when the ray hits the panel but not a button', () => {
    const hud = new DracoDiagnosticHUD(cameraGroup, dracoNode);

    // Hit the panel in the top-left corner, far from any button.
    const raycaster = makeRaycasterForUV(hud, 0.05, 0.95);
    const consumed = hud.handleContentClick(raycaster);

    expect(consumed).toBe(false);
  });

  it('does not decrement a weight below zero', () => {
    const hud = new DracoDiagnosticHUD(cameraGroup, dracoNode);
    const firstRule = engine.softConstraints[0];
    engine.setWeight(firstRule.name, 3);

    const decButton = hud.buttons.find((b) => b.action === 'DEC' && b.ruleName === firstRule.name);
    const raycaster = makeRaycasterForButton(hud, decButton);

    hud.handleContentClick(raycaster); // -5 would go below 0

    expect(firstRule.weight).toBe(0);
  });
});

describe('InputTelemetry', () => {
  function makeMockHand(index, handedness, pinched) {
    const origin = new THREE.Vector3(index + 1, index + 2, index + 3);
    return {
      index,
      handedness,
      ray: { visible: true },
      jointsValid: true,
      pinched,
      pinchDistance: pinched ? 0.02 : 0.1,
      isPinched() {
        return this.pinched;
      },
      getWorldPosition(target) {
        return target.copy(origin);
      },
    };
  }

  function makeMockController(index, handedness) {
    const origin = new THREE.Vector3(index + 10, index + 11, index + 12);
    return {
      index,
      handedness,
      getRay(target) {
        target.origin.copy(origin);
        target.direction.set(0, 0, -1);
        return target;
      },
    };
  }

  it('logs one line per input source with live world-space position', () => {
    const session = {
      inputSources: [
        makeInputSource({ handedness: 'left', position: new THREE.Vector3(1, 2, 3) }),
        makeInputSource({ handedness: 'right', position: new THREE.Vector3(4, 5, 6), hand: true }),
      ],
    };
    const engine = makeMockEngine(session);
    engine.xrFrame = makeMockFrame();
    engine.xrRefSpace = {};

    const telemetry = new InputTelemetry(engine);
    telemetry.update(0, 0);

    const ctrlLine = telemetry.lines.find((l) => l.startsWith('CTRL0'));
    const handLine = telemetry.lines.find((l) => l.startsWith('HAND1'));

    expect(ctrlLine).toContain('[1.00, 2.00, 3.00]');
    expect(handLine).toContain('[4.00, 5.00, 6.00]');
  });

  it('matches hand pinch state to the correct handedness, not source index', () => {
    // Internal hand list is intentionally out of order vs. the session source.
    const leftHand = makeMockHand(0, 'left', false);
    const rightHand = makeMockHand(1, 'right', true);

    const session = {
      inputSources: [makeInputSource({ handedness: 'right', hand: true, position: new THREE.Vector3(0, 0, 0) })],
    };
    const engine = makeMockEngine(session, [leftHand, rightHand]);
    engine.xrFrame = makeMockFrame();
    engine.xrRefSpace = {};

    const telemetry = new InputTelemetry(engine);
    telemetry.update(0, 0);

    const handLine = telemetry.lines.find((l) => l.startsWith('HAND0'));
    expect(handLine).toContain('RIGHT');
    expect(handLine).toContain('pinch=YES');
    expect(handLine).toContain('d=0.020');
  });

  it('matches controller axes to the correct handedness, not source index', () => {
    const leftCtrl = makeMockController(0, 'left');
    const rightCtrl = makeMockController(1, 'right');

    const session = {
      inputSources: [
        makeInputSource({ handedness: 'right', axes: [0, 0, 0.75, 0] }),
        makeInputSource({ handedness: 'left', axes: [-0.5, 0, 0, 0] }),
      ],
    };
    const engine = makeMockEngine(session, [], [leftCtrl, rightCtrl]);
    engine.xrFrame = makeMockFrame();
    engine.xrRefSpace = {};

    const telemetry = new InputTelemetry(engine);
    telemetry.update(0, 0);

    const rightLine = telemetry.lines.find((l) => l.startsWith('CTRL0') && l.includes('RIGHT'));
    const leftLine = telemetry.lines.find((l) => l.startsWith('CTRL1') && l.includes('LEFT'));

    expect(rightLine).toContain('axes=[0.00,0.00,0.75,0.00]');
    expect(leftLine).toContain('axes=[-0.50,0.00,0.00,0.00]');
  });

  it('reports untracked internal hands when no matching source is active', () => {
    const leftHand = makeMockHand(0, 'left', false);
    leftHand.ray.visible = false;
    leftHand.jointsValid = false;

    const engine = makeMockEngine(null, [leftHand]);
    const telemetry = new InputTelemetry(engine);
    telemetry.update(0, 0);

    const line = telemetry.lines.find((l) => l.startsWith('HAND0'));
    expect(line).toContain('not tracked');
    expect(line).toContain('jointsValid=N');
  });
});

/**
 * Build a Raycaster whose ray intersects the HUD mesh at the center of a
 * given button in canvas coordinates.
 */
function makeRaycasterForButton(hud, button) {
  const u = (button.x + button.w / 2) / hud.canvas.width;
  const v = 1 - (button.y + button.h / 2) / hud.canvas.height;
  return makeRaycasterForUV(hud, u, v);
}

/**
 * Build a Raycaster that hits the HUD mesh at the given UV coordinates.
 *
 * PlaneGeometry vertices (with default UVs):
 *   0: (-w/2,  h/2, 0)  uv(0,1)
 *   1: ( w/2,  h/2, 0)  uv(1,1)
 *   2: (-w/2, -h/2, 0)  uv(0,0)
 *   3: ( w/2, -h/2, 0)  uv(1,0)
 */
function makeRaycasterForUV(hud, u, v) {
  const geom = hud.mesh.geometry;
  const posAttr = geom.attributes.position;
  const topLeft = new THREE.Vector3().fromBufferAttribute(posAttr, 0);      // uv(0,1)
  const topRight = new THREE.Vector3().fromBufferAttribute(posAttr, 1);      // uv(1,1)
  const bottomLeft = new THREE.Vector3().fromBufferAttribute(posAttr, 2);   // uv(0,0)
  const bottomRight = new THREE.Vector3().fromBufferAttribute(posAttr, 3);  // uv(1,0)

  const localPoint = new THREE.Vector3()
    .addScaledVector(bottomLeft, (1 - u) * (1 - v))
    .addScaledVector(bottomRight, u * (1 - v))
    .addScaledVector(topLeft, (1 - u) * v)
    .addScaledVector(topRight, u * v);

  hud.mesh.updateMatrixWorld(true);
  const worldPoint = localPoint.applyMatrix4(hud.mesh.matrixWorld);

  // Start slightly in front of the panel along its local +Z normal so the
  // ray reliably intersects the front face.
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(hud.mesh.getWorldQuaternion(new THREE.Quaternion()));
  const origin = worldPoint.clone().add(normal.multiplyScalar(0.1));
  const direction = worldPoint.clone().sub(origin).normalize();
  return new THREE.Raycaster(origin, direction);
}
