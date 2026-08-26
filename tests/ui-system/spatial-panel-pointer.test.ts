// @ts-nocheck
// @vitest-environment jsdom
//
// Production-path evidence for the SpatialPanel pointer-dispatch contract that
// the shared controls rely on. The unit tests for Toggle/Slider dispatch
// synthetic events directly on the components; these tests exercise the live
// `SpatialPanel.handlePointer*` raycast-dispatch path that runs in VR.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Container } from '@pmndrs/uikit';
import { SpatialPanel } from '../../src/vr/ui-system/SpatialPanel.ts';
import { Toggle } from '../../src/vr/ui-system/components/Toggle.ts';
import { Slider } from '../../src/vr/ui-system/components/Slider.ts';

interface FakeHit {
  object: Container;
  uv: THREE.Vector2;
  point: THREE.Vector3;
}

function makeRaycaster() {
  // State the test mutates between pointerdown / pointermove to model the ray
  // grazing different components over time.
  const singleByObj = new Map<Container, FakeHit[]>();
  let panelWide: FakeHit[] = [];
  return {
    ray: new THREE.Ray(),
    _setPanelWide(hits: FakeHit[]): void {
      panelWide = hits;
    },
    _setSingle(obj: Container, hits: FakeHit[]): void {
      singleByObj.set(obj, hits);
    },
    intersectObject(obj: Container, recursive: boolean): FakeHit[] {
      if (recursive && obj === (this as unknown as { _panel: Container })._panel) return panelWide;
      if (!recursive) return singleByObj.get(obj) ?? [];
      return [];
    },
  } as unknown as THREE.Raycaster & {
    _setPanelWide(hits: FakeHit[]): void;
    _setSingle(obj: Container, hits: FakeHit[]): void;
    _panel: Container;
  };
}

describe('SpatialPanel production pointer dispatch', () => {
  it('keeps a captured drag anchored to the capturing component (no foreign-uv jump)', () => {
    const anchor = new THREE.Group();
    const scene = new THREE.Group();
    const panel = new SpatialPanel({}, anchor, scene);

    const track = new Container({ width: 160, height: 8 });
    const foreign = new Container({ width: 160, height: 8 });
    panel.add(track);
    panel.add(foreign);

    const trackHit: FakeHit = {
      object: track,
      uv: new THREE.Vector2(0.4, 0.5),
      point: new THREE.Vector3(),
    };
    const foreignHit: FakeHit = {
      object: foreign,
      uv: new THREE.Vector2(0.9, 0.5),
      point: new THREE.Vector3(),
    };

    const received: { uv?: THREE.Vector2 }[] = [];
    track.addEventListener('pointermove', (e: { uv?: THREE.Vector2 }) => {
      received.push({ uv: e.uv });
    });

    const raycaster = makeRaycaster();
    raycaster._panel = panel;
    const pointer = { index: 0 };

    // pointerdown lands on the track → track is captured.
    raycaster._setPanelWide([trackHit]);
    panel.handlePointerDown(raycaster, pointer as never);

    // pointermove: the panel-wide ray now grazes a foreign component, but the
    // captured track must receive a track-local uv (0.4), not the foreign 0.9.
    raycaster._setPanelWide([foreignHit]);
    raycaster._setSingle(track, [trackHit]);
    panel.handlePointerMove(raycaster, pointer as never);

    expect(received).toHaveLength(1);
    expect(received[0].uv).toBeDefined();
    expect(received[0].uv!.x).toBeCloseTo(0.4, 5);

    // When the pointer leaves the captured component entirely (single-ray
    // miss), the move event carries no uv so the control's guard leaves the
    // value unchanged rather than jumping to a foreign component.
    received.length = 0;
    raycaster._setSingle(track, []);
    panel.handlePointerMove(raycaster, pointer as never);
    expect(received).toHaveLength(1);
    expect(received[0].uv).toBeUndefined();
  });

  it('targets the Toggle panel mesh, not its non-bubbling track/thumb children', () => {
    // The production path dispatches `click` to the hit Component and
    // THREE.EventDispatcher does not bubble. For a Toggle tap to fire its
    // listener (registered on the Toggle itself), the track/thumb must not
    // intercept the ray. The production fallback path uses
    // `raycaster.intersectObject` which does NOT consult uikit's
    // `pointerEvents` signal, so marking them `pointerEvents: 'none'` is not
    // enough — their `raycast` is also no-op'd (the uikit InstancedGlyphMesh
    // trick) so they push no intersections and the Toggle's own panel mesh is
    // the hit. Assert both invariants.
    const t = new Toggle({ value: false });
    const track = (t as unknown as { _track: Container & { pointerEvents: string } })._track;
    const thumb = (t as unknown as { _thumb: Container & { pointerEvents: string } })._thumb;
    expect(track.pointerEvents).toBe('none');
    expect(thumb.pointerEvents).toBe('none');

    // The no-op raycast pushes no intersections — proving the children cannot be
    // the production hit target.
    const raycaster = new THREE.Raycaster();
    const intersects: THREE.Intersection[] = [];
    const before = intersects.length;
    track.raycast(raycaster, intersects);
    thumb.raycast(raycaster, intersects);
    expect(intersects.length).toBe(before);
  });

  it('no-ops the Slider fill/thumb raycast so the track owns the drag hit and uv', () => {
    const s = new Slider({ value: 0, min: 0, max: 100, width: 160 });
    const fill = (s as unknown as { _trackFill: Container })._trackFill;
    const thumb = (s as unknown as { _thumb: Container })._thumb;
    const raycaster = new THREE.Raycaster();
    const intersects: THREE.Intersection[] = [];
    const before = intersects.length;
    fill.raycast(raycaster, intersects);
    thumb.raycast(raycaster, intersects);
    expect(intersects.length).toBe(before);
  });
});