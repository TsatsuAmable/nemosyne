// @ts-nocheck
// @vitest-environment jsdom
//
// Quest panel geometry regressions. All ray tests use REAL UIKit panel
// geometry through the production `PointerEventMachine -> SpatialPanel`
// path: no mocked `intersectObject`, no direct `click` dispatch. The bounds
// tests measure rendered world boxes, and the scrollbar test drags a real
// ray across a scrollable container and releases outside bounds.

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { Container, Component, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../../src/vr/ui-system/SpatialPanel.ts';
import { Button } from '../../src/vr/ui-system/components/Button.ts';
import { Toggle } from '../../src/vr/ui-system/components/Toggle.ts';
import { ScrollContainer } from '../../src/vr/ui-system/components/ScrollContainer.ts';
import { panelWorldScale } from '../../src/vr/ui-system/uikitScale.ts';
import {
  intersectUIKitComponents,
  resolveActionableHit,
} from '../../src/vr/ui-system/raycastUIKit.ts';
import { InteractableRegistry } from '../../src/vr/input/InteractableRegistry.ts';
import { PointerEventMachine } from '../../src/vr/input/PointerEventMachine.ts';

import { TelemetryPanel } from '../../src/vr/ui/TelemetryPanel.ts';
import { PerformancePanel } from '../../src/vr/ui/PerformancePanel.ts';
import { NetworkPanel } from '../../src/vr/ui/NetworkPanel.ts';
import { DataSourcePanel } from '../../src/vr/ui/DataSourcePanel.ts';
import { VaultPanel } from '../../src/vr/ui/VaultPanel.ts';
import { LoadTestPanel } from '../../src/vr/ui/LoadTestPanel.ts';
import { InteractionCoach } from '../../src/vr/ui/InteractionCoach.ts';
import { RecommendationPanel } from '../../src/vr/ui/RecommendationPanel.ts';
import { NarrativeStrip } from '../../src/vr/ui/NarrativeStrip.ts';
import { OperationLogPanel } from '../../src/vr/ui/OperationLogPanel.ts';
import { ValidationOperatorPanel } from '../../src/vr/ui/ValidationOperatorPanel.ts';
import { StatusStripPanel } from '../../src/vr/ui/StatusStripPanel.ts';
import { ChartPlanePanel } from '../../src/vr/ui/ChartPlanePanel.ts';
import { InvestigationContinuityPanel } from '../../src/vr/ui/InvestigationContinuityPanel.ts';
import { InvestigationJourneyPanel } from '../../src/vr/ui/InvestigationJourneyPanel.ts';
import { MonetaDiagnosticHUD } from '../../src/vr/ui/MonetaDiagnosticHUD.ts';
import { GestureConfidenceHUD } from '../../src/vr/ui/GestureConfidenceHUD.ts';
import { MonetaExplainerPanel } from '../../src/vr/ui/MonetaExplainerPanel.ts';
import { VRConsole } from '../../src/vr/ui/VRConsole.ts';
import { CapabilityGuidePanel } from '../../src/vr/ui/CapabilityGuidePanel.ts';
import { ContextualTaskSurface } from '../../src/vr/ui/ContextualTaskSurface.ts';
import { SchemaMappingPanel } from '../../src/vr/ui/SchemaMappingPanel.ts';
import { SettingsPanel } from '../../src/vr/ui/SettingsPanel.ts';
import { HolographicInspector } from '../../src/vr/artifacts/HolographicInspector.ts';
import { InputTelemetry } from '../../src/vr/InputTelemetry.ts';

const disposables: Array<{ dispose?: () => void }> = [];
afterEach(() => {
  while (disposables.length) {
    const d = disposables.pop();
    try {
      d?.dispose?.();
    } catch {
      // Best-effort cleanup only.
    }
  }
});

function makePointer(origin: THREE.Vector3, direction: THREE.Vector3, index = 0) {
  return {
    index,
    getRay: (target: THREE.Ray) => target.set(origin.clone(), direction.clone().normalize()),
  };
}

/**
 * A re-aimable pointer for press/move/release sequences. PointerEventMachine
 * routes moves only to the identical pointer object captured on press
 * (`downPointer === pointer`), like a real XR controller, so drag tests
 * must re-aim one object rather than constructing a fresh one per move.
 */
function makeLivePointer(origin: THREE.Vector3, direction: THREE.Vector3, index = 0) {
  const state = {
    origin: origin.clone(),
    direction: direction.clone().normalize(),
  };
  return {
    index,
    getRay: (target: THREE.Ray) => target.set(state.origin, state.direction),
    aimAtPoint: (nextOrigin: THREE.Vector3, point: THREE.Vector3) => {
      state.origin.copy(nextOrigin);
      state.direction.copy(point).sub(nextOrigin).normalize();
    },
    aimDirection: (nextOrigin: THREE.Vector3, direction: THREE.Vector3) => {
      state.origin.copy(nextOrigin);
      state.direction.copy(direction).normalize();
    },
  };
}

function aimAt(origin: THREE.Vector3, target: THREE.Vector3) {
  return target.clone().sub(origin).normalize();
}

/**
 * Drive UIKit layout without live data polling (base-class update only).
 * Yoga converges one generation per frame, so deep subtrees need several
 * passes before child matrices settle; afterwards every component matrix
 * is refreshed from the converged layout. Production XR converges over
 * real frames long before the first interaction.
 */
function layout(panel: SpatialPanel, scene: THREE.Scene): void {
  for (let i = 0; i < 12; i++) SpatialPanel.prototype.update.call(panel, 0.016);
  scene.updateMatrixWorld(true);
  panel.traverse((node) => {
    if (node instanceof Component) node.updateWorldMatrix(false, false);
  });
  scene.updateMatrixWorld(true);
}

/**
 * Union of per-Component mesh bounds. Each UIKit `Component` is a Mesh whose
 * `matrixWorld` encodes its laid-out size and position; the union over the
 * subtree is the rendered panel box. Instanced render children
 * (`InstancedPanelMesh`/`InstancedGlyphMesh`) are deliberately excluded —
 * they share unit geometry with identity-side transforms and would corrupt
 * a naive `Box3.setFromObject` union.
 */
function componentBounds(panel: THREE.Object3D): THREE.Box3 {
  panel.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  panel.traverse((node) => {
    if (!(node instanceof Component)) return;
    const geometry = (node as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!geometry) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return;
    tmp.copy(geometry.boundingBox).applyMatrix4(node.matrixWorld);
    box.union(tmp);
  });
  return box;
}

function pressRelease(
  machine: PointerEventMachine,
  pointer: ReturnType<typeof makePointer>
): void {
  machine.press(pointer);
  machine.release(pointer);
}

describe('Quest panel real-geometry pointer traversal', () => {
  function clickRig() {
    const scene = new THREE.Scene();
    const anchor = new THREE.Group();
    scene.add(anchor);
    const panel = new SpatialPanel({ width: 560, height: 400 }, anchor, scene);
    panel.scale.setScalar(panelWorldScale(1.0, 560));
    panel.position.set(0, 1.6, -1.2);
    const onClick = vi.fn();
    const button = new Button({ label: 'FIRE', width: 200, height: 60, onClick });
    panel.add(button);
    layout(panel, scene);
    const registry = new InteractableRegistry();
    registry.panels = [panel];
    const sceneSelect = vi.fn();
    const machine = new PointerEventMachine(registry, { onTriggerSelect: sceneSelect });
    const origin = new THREE.Vector3(0, 1.6, 0);
    return { scene, anchor, panel, button, onClick, registry, machine, sceneSelect, origin };
  }

  it('clicks a Button through PointerEventMachine with a real ray (no mocks)', () => {
    const rig = clickRig();
    const target = rig.button.getWorldPosition(new THREE.Vector3());
    const pointer = makePointer(rig.origin, aimAt(rig.origin, target));
    expect(rig.machine.press(pointer)).toBe(true);
    rig.machine.release(pointer);
    expect(rig.onClick).toHaveBeenCalledOnce();
    expect(rig.sceneSelect).not.toHaveBeenCalled();
  });

  it('hits the occluding control, not the panel background', () => {
    const rig = clickRig();
    const target = rig.button.getWorldPosition(new THREE.Vector3());
    const raycaster = new THREE.Raycaster(
      rig.origin,
      aimAt(rig.origin, target)
    );
    const hits = intersectUIKitComponents(rig.panel, raycaster);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].object).toBe(rig.button);
  });

  it('a hidden panel never consumes a press (falls through to scene)', () => {
    const rig = clickRig();
    rig.panel.visible = false;
    const target = new THREE.Vector3(0, 1.6, -1.2);
    const pointer = makePointer(rig.origin, aimAt(rig.origin, target));
    expect(rig.machine.press(pointer)).toBe(true);
    rig.machine.release(pointer);
    expect(rig.onClick).not.toHaveBeenCalled();
    expect(rig.sceneSelect).toHaveBeenCalledOnce();
  });

  it('pointerEvents-none Toggle children do not intercept the real ray', () => {
    const scene = new THREE.Scene();
    const anchor = new THREE.Group();
    scene.add(anchor);
    const panel = new SpatialPanel({ width: 560, height: 400 }, anchor, scene);
    panel.scale.setScalar(panelWorldScale(1.0, 560));
    panel.position.set(0, 1.6, -1.2);
    const onChange = vi.fn();
    const toggle = new Toggle({ value: false, onChange });
    panel.add(toggle);
    layout(panel, scene);
    const registry = new InteractableRegistry();
    registry.panels = [panel];
    const machine = new PointerEventMachine(registry, { onTriggerSelect: () => {} });
    const origin = new THREE.Vector3(0, 1.6, 0);
    const target = toggle.getWorldPosition(new THREE.Vector3());
    pressRelease(machine, makePointer(origin, aimAt(origin, target)));
    expect(toggle.value).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('release outside bounds sends pointerup without click', () => {
    const rig = clickRig();
    const target = rig.button.getWorldPosition(new THREE.Vector3());
    const downPointer = makePointer(rig.origin, aimAt(rig.origin, target));
    expect(rig.machine.press(downPointer)).toBe(true);
    const away = makePointer(rig.origin, new THREE.Vector3(0, 1, 0), downPointer.index);
    rig.machine.release(away);
    expect(rig.onClick).not.toHaveBeenCalled();
    expect(rig.machine.state).toBe('idle');
  });
});

describe('Quest panel rendered world bounds', () => {
  function measure(panel: SpatialPanel, scene: THREE.Scene): THREE.Vector3 {
    panel.visible = true;
    layout(panel, scene);
    return componentBounds(panel).getSize(new THREE.Vector3());
  }

  function worldSizeCase(
    name: string,
    make: (anchor: THREE.Group) => SpatialPanel,
    expectedWidth: number
  ): void {
    it(`${name} renders at the requested world width`, () => {
      const scene = new THREE.Scene();
      const anchor = new THREE.Group();
      scene.add(anchor);
      const panel = make(anchor);
      disposables.push(panel);
      const size = measure(panel, scene);
      expect(size.x).toBeGreaterThan(0.5);
      expect(size.x).toBeCloseTo(expectedWidth, 1);
    });
  }

  const WORLD = 2.0;
  worldSizeCase('TelemetryPanel', (a) => new TelemetryPanel(a, { worldSize: [WORLD, 1] }), WORLD);
  worldSizeCase('PerformancePanel', (a) => new PerformancePanel(a, { worldSize: [WORLD, 1] }), WORLD);
  worldSizeCase('NetworkPanel', (a) => new NetworkPanel(a, { worldSize: [WORLD, 1] }), WORLD);
  worldSizeCase('DataSourcePanel', (a) => new DataSourcePanel(a, { worldSize: [WORLD, 1] }), WORLD);
  worldSizeCase('VaultPanel', (a) => new VaultPanel(a, { worldSize: [WORLD, 1] }), WORLD);
  const stubBus = { on: () => () => {} };
  worldSizeCase(
    'LoadTestPanel',
    (a) => new LoadTestPanel(a, { worldSize: [WORLD, 1], eventBus: stubBus }),
    WORLD
  );
  worldSizeCase('InteractionCoach', (a) => new InteractionCoach(a, { worldSize: [WORLD, 1] }), WORLD);
  worldSizeCase(
    'RecommendationPanel',
    (a) => new RecommendationPanel(a, { worldSize: [WORLD, 1], getRecommendation: () => null }),
    WORLD
  );
  worldSizeCase('NarrativeStrip', (a) => new NarrativeStrip(a, { worldSize: [WORLD, 1] }), WORLD);
  worldSizeCase(
    'OperationLogPanel',
    (a) => new OperationLogPanel(a, { worldSize: [WORLD, 1] }),
    WORLD
  );
  worldSizeCase(
    'ValidationOperatorPanel',
    (a) =>
      new ValidationOperatorPanel(a, {
        worldSize: [WORLD, 1],
        eventBus: stubBus,
        context: {
          manifest: {
            deviceIdentity: 'test',
            validationMode: 'test',
            promotionEligible: false,
            invalidations: [],
            gates: [],
            sessionLabel: 'test',
            buildId: '0123456789abcdef',
            worktree: 'test',
          },
          attributable: false,
        },
        onStartPerformance: () => {},
        onStartBoundary: () => {},
        onStop: () => {},
        onFlush: () => {},
        onDownload: async () => {},
        onRefreshStatus: async () => {},
        onSubmitUx: async () => {},
      }),
    WORLD
  );
  worldSizeCase(
    'StatusStripPanel',
    (a) =>
      new StatusStripPanel(a, {
        statusStrip: { formatInvestigationLines: () => [] },
        worldSize: [WORLD, 1],
      }),
    WORLD
  );
  worldSizeCase(
    'ChartPlanePanel',
    (a) => new ChartPlanePanel(a, null, { worldSize: [WORLD, 1] }),
    WORLD
  );
  worldSizeCase(
    'HolographicInspector',
    (a) => {
      const panel = new HolographicInspector({}, { worldSize: [WORLD, 1] });
      a.add(panel);
      return panel;
    },
    WORLD
  );

  worldSizeCase(
    'InvestigationContinuityPanel',
    (a) =>
      new InvestigationContinuityPanel(a, {
        summary: async () => ({
          latestCheckpoint: null,
          canRecoverAutosave: false,
          checkpointCount: 0,
        }),
      }),
    0.86
  );
  worldSizeCase(
    'InvestigationJourneyPanel',
    (a) => new InvestigationJourneyPanel(a, { snapshot: () => ({ discoveries: [] }) }),
    0.9
  );
  worldSizeCase(
    'MonetaDiagnosticHUD',
    (a) =>
      new MonetaDiagnosticHUD(a, {
        solverResult: null,
        engine: { softConstraints: [] },
        adjustWeight: () => {},
      }),
    1.3
  );
  worldSizeCase('GestureConfidenceHUD', (a) => new GestureConfidenceHUD(a), 0.85);
  worldSizeCase('MonetaExplainerPanel', (a) => new MonetaExplainerPanel(a, null), 1.1);
  worldSizeCase('VRConsole', (a) => new VRConsole(a), 1.2);
  worldSizeCase(
    'CapabilityGuidePanel',
    (a) =>
      new CapabilityGuidePanel({
        parent: a,
        getWheelCategories: () => [],
        contextualTaskSurface: {},
      }),
    0.82
  );
  worldSizeCase('ContextualTaskSurface', (a) => {
    const panel = new ContextualTaskSurface({});
    a.add(panel);
    return panel;
  }, 0.52);
  worldSizeCase(
    'SchemaMappingPanel',
    (a) =>
      new SchemaMappingPanel({
        torsoAnchor: a,
        worldScene: new THREE.Group(),
        dataset: { columns: [] },
      }),
    0.95
  );
  worldSizeCase(
    'SettingsPanel',
    (a) => new SettingsPanel({ torsoAnchor: a, worldScene: new THREE.Group() }),
    1.3
  );
  worldSizeCase('InputTelemetry', (a) => new InputTelemetry({}, a), 1.1);
});

describe('Quest scrollbar real-ray drag', () => {
  it('drags scroll offset with compatible nativeEvent and releases outside cleanly', () => {
    const scene = new THREE.Scene();
    const anchor = new THREE.Group();
    scene.add(anchor);
    const panel = new SpatialPanel({ width: 400, height: 500 }, anchor, scene);
    panel.scale.setScalar(panelWorldScale(0.5, 400));
    panel.position.set(0, 1.6, -1.2);
    const scroller = new ScrollContainer({ scrollHeight: 200, width: 360 });
    for (let i = 0; i < 8; i++) {
      scroller.add(new Container({ width: 300, height: 60 }));
    }
    const onClick = vi.fn();
    scroller.addEventListener('click', onClick);
    panel.add(scroller);
    layout(panel, scene);

    expect(scroller.scrollable.value).toEqual([false, true]);
    expect(scroller.maxScrollPosition.value[1]).toBeGreaterThan(0);
    const before = scroller.scrollPosition.value[1];

    const registry = new InteractableRegistry();
    registry.panels = [panel];
    const machine = new PointerEventMachine(registry, { onTriggerSelect: () => {} });
    const origin = new THREE.Vector3(0, 1.6, 0);
    const target = scroller.getWorldPosition(new THREE.Vector3());

    // Down on the scroll container with a real ray.
    const pointer = makeLivePointer(origin, aimAt(origin, target));
    expect(machine.press(pointer)).toBe(true);
    expect(scroller.downPointerMap.size).toBe(1);

    // Drag the ray upward in world space; the scroll offset must move and the
    // UIKit scroll handler must not throw on the synthetic nativeEvent.
    const moved = new THREE.Vector3(target.x, target.y + 0.06, target.z);
    pointer.aimAtPoint(origin, moved);
    expect(() => machine.move(pointer)).not.toThrow();
    expect(scroller.scrollPosition.value[1]).not.toBeCloseTo(before, 6);

    // Release with the ray aimed outside bounds: capture clears, no click.
    pointer.aimDirection(origin, new THREE.Vector3(0, 1, 0));
    expect(() => machine.release(pointer)).not.toThrow();
    expect(scroller.downPointerMap.size).toBe(0);
    expect(onClick).not.toHaveBeenCalled();
    expect(machine.state).toBe('idle');
  });

  it('drags the scrollbar thumb down and the offset stays in range', () => {
    const scene = new THREE.Scene();
    const anchor = new THREE.Group();
    scene.add(anchor);
    const panel = new SpatialPanel({ width: 400, height: 500 }, anchor, scene);
    panel.scale.setScalar(panelWorldScale(0.5, 400));
    panel.position.set(0, 1.6, -1.2);
    const scroller = new ScrollContainer({ scrollHeight: 200, width: 360 });
    for (let i = 0; i < 8; i++) {
      scroller.add(new Container({ width: 300, height: 60 }));
    }
    panel.add(scroller);
    layout(panel, scene);

    expect(scroller.scrollable.value[1]).toBe(true);
    const maxY = scroller.maxScrollPosition.value[1];
    expect(maxY).toBeGreaterThan(0);

    const registry = new InteractableRegistry();
    registry.panels = [panel];
    const machine = new PointerEventMachine(registry, { onTriggerSelect: () => {} });
    const origin = new THREE.Vector3(0, 1.6, 0);
    const pointer = makeLivePointer(origin, new THREE.Vector3(0, 0, -1));

    // Sweep the scrollbar gutter for the thumb through the production press
    // path: the press that records a scroll-bar drag (not a content drag)
    // is on the thumb. localToWorld takes quad units (±0.5 spans the
    // laid-out size), so pixel offsets are normalized by the size.
    const size = scroller.size.value;
    const gutterX = 0.5 - 5 / size[0];
    let thumbFound = false;
    for (let i = 0; i <= 20 && !thumbFound; i++) {
      const quadY = 0.45 - (0.9 * i) / 20;
      const probe = scroller.localToWorld(new THREE.Vector3(gutterX, quadY, 0));
      pointer.aimAtPoint(origin, probe);
      machine.press(pointer);
      const recorded = scroller.downPointerMap.get(pointer.index);
      if (recorded?.type === 'scroll-bar') {
        thumbFound = true;
      } else {
        machine.release(pointer);
      }
    }
    expect(thumbFound).toBe(true);

    // Drag the thumb downward in steps: the offset must increase and stay
    // clamped to the valid range (thumb drags never rubber-band).
    for (let step = 1; step <= 5; step++) {
      const probe = scroller.localToWorld(
        new THREE.Vector3(gutterX, 0.45 - (0.9 * step) / 5, 0)
      );
      pointer.aimAtPoint(origin, probe);
      machine.move(pointer);
    }
    const offset = scroller.scrollPosition.value[1];
    expect(offset).toBeGreaterThan(0);
    expect(offset).toBeLessThanOrEqual(maxY);

    // Release outside bounds clears the drag without throwing.
    pointer.aimDirection(origin, new THREE.Vector3(0, 1, 0));
    expect(() => machine.release(pointer)).not.toThrow();
    expect(scroller.downPointerMap.size).toBe(0);
    expect(machine.state).toBe('idle');
  });
});

describe('Quest Text hit resolution', () => {
  it('maps a Text leaf hit to its actionable ancestor with local geometry', () => {
    const scene = new THREE.Scene();
    const anchor = new THREE.Group();
    scene.add(anchor);
    const panel = new SpatialPanel({ width: 560, height: 400 }, anchor, scene);
    panel.scale.setScalar(panelWorldScale(1.0, 560));
    panel.position.set(0, 1.6, -1.2);
    const button = new Button({ label: 'FIRE', width: 200, height: 60, onClick: () => {} });
    panel.add(button);
    layout(panel, scene);

    let textNode: Text | null = null;
    panel.traverse((node) => {
      if (!textNode && node instanceof Text) textNode = node;
    });
    expect(textNode).not.toBeNull();

    // Resolve a hit on the real Text leaf: the dispatch target must be the
    // Button, with a fresh Button-local intersection from real geometry.
    const origin = new THREE.Vector3(0, 1.6, 0);
    const target = textNode.getWorldPosition(new THREE.Vector3());
    const raycaster = new THREE.Raycaster(origin, aimAt(origin, target));
    const resolved = resolveActionableHit(panel, raycaster, {
      object: textNode,
    } as THREE.Intersection);
    expect(resolved.object).toBe(button);
    expect(resolved.uv).toBeDefined();
  });
});

describe('Quest panel detection preserves generic meshes', () => {
  it('raycastPanels still hits legacy non-UIKit panel meshes', () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.1),
      new THREE.MeshBasicMaterial()
    );
    mesh.position.set(0, 1.6, -1.2);
    scene.add(mesh);
    scene.updateMatrixWorld(true);
    const entry = { mesh };
    const registry = new InteractableRegistry();
    registry.panels = [entry];
    registry.raycaster.set(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 0, -1));
    expect(registry.raycastPanels()?.panel).toBe(entry);

    mesh.visible = false;
    expect(registry.raycastPanels()).toBeNull();
  });

  it('raycastPanels ignores a hidden UIKit panel', () => {
    const scene = new THREE.Scene();
    const anchor = new THREE.Group();
    scene.add(anchor);
    const panel = new TelemetryPanel(anchor, { worldSize: [2, 1] });
    disposables.push(panel);
    layout(panel, scene);
    const registry = new InteractableRegistry();
    registry.panels = [panel];
    registry.raycaster.set(
      new THREE.Vector3(0, 1.6, 0),
      new THREE.Vector3(0, 0, -1)
    );
    panel.visible = false;
    expect(registry.raycastPanels()).toBeNull();
  });
});

describe('Quest SettingsPanel real controls through PointerEventMachine', () => {
  function settingsRig() {
    const scene = new THREE.Scene();
    const anchor = new THREE.Group();
    scene.add(anchor);
    const onChange = vi.fn();
    const panel = new SettingsPanel({
      torsoAnchor: anchor,
      worldScene: new THREE.Group(),
      onChange,
    });
    disposables.push(panel);
    panel.show();
    layout(panel, scene);
    const registry = new InteractableRegistry();
    registry.panels = [panel];
    const machine = new PointerEventMachine(registry, { onTriggerSelect: () => {} });
    return { scene, anchor, panel, onChange, registry, machine };
  }

  it('flips a real Settings toggle with a real ray', () => {
    const rig = settingsRig();
    const toggle = rig.panel._controls.get('gesturesEnabled');
    expect(toggle).toBeDefined();
    const before = rig.panel.getSetting('gesturesEnabled');
    const origin = new THREE.Vector3(0.65, 1.55, 0);
    const target = toggle.getWorldPosition(new THREE.Vector3());
    pressRelease(rig.machine, makePointer(origin, aimAt(origin, target)));
    expect(rig.panel.getSetting('gesturesEnabled')).toBe(!before);
    expect(rig.onChange).toHaveBeenCalledWith('gesturesEnabled', !before);
  });

  it('drags the real Settings scrollbar with a real ray', () => {
    const rig = settingsRig();
    const scroller = rig.panel._contentContainer;
    expect(scroller.scrollable.value[1]).toBe(true);
    const before = scroller.scrollPosition.value[1];
    const origin = new THREE.Vector3(0.65, 1.55, 0);
    const target = scroller.getWorldPosition(new THREE.Vector3());
    const pointer = makeLivePointer(origin, aimAt(origin, target));
    expect(rig.machine.press(pointer)).toBe(true);
    expect(scroller.downPointerMap.size).toBe(1);
    const moved = new THREE.Vector3(target.x, target.y + 0.08, target.z);
    pointer.aimAtPoint(origin, moved);
    expect(() => rig.machine.move(pointer)).not.toThrow();
    expect(scroller.scrollPosition.value[1]).not.toBeCloseTo(before, 6);
    pointer.aimDirection(origin, new THREE.Vector3(0, 1, 0));
    expect(() => rig.machine.release(pointer)).not.toThrow();
    expect(scroller.downPointerMap.size).toBe(0);
    expect(rig.machine.state).toBe('idle');
  });
});
