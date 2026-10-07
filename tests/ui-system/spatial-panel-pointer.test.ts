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

describe('SpatialPanel production pointer dispatch', () => {
  it('keeps a captured drag anchored to the capturing component (no foreign-uv jump)', () => {
    // Real geometry: a Slider drag whose ray drifts onto a neighbouring
    // component must hold its value (the captured track is re-raycast
    // alone; a miss carries no uv) rather than jumping to the foreign
    // component's fraction — and a full miss must hold as well.
    const scene = new THREE.Scene();
    const anchor = new THREE.Group();
    scene.add(anchor);
    const panel = new SpatialPanel({ width: 560, height: 400 }, anchor, scene);
    panel.position.set(0, 1.6, -1.2);
    const slider = new Slider({ value: 0, min: 0, max: 100, width: 160 });
    const foreign = new Container({ width: 160, height: 40 });
    panel.add(slider);
    panel.add(foreign);
    for (let i = 0; i < 12; i++) SpatialPanel.prototype.update.call(panel, 0.016);
    scene.updateMatrixWorld(true);

    const track = slider._trackBg;
    const origin = new THREE.Vector3(0, 1.6, 0);
    const raycaster = new THREE.Raycaster();
    const aim = (point: THREE.Vector3) => {
      raycaster.set(origin, point.clone().sub(origin).normalize());
    };
    const pointer = { index: 0 };
    // Quad units: ±0.5 spans the laid-out size.
    const trackPoint = (fraction: number) =>
      track.localToWorld(new THREE.Vector3(-0.5 + fraction, 0, 0));

    // Press at 25% of the track, drag along it to 75%: the value follows.
    aim(trackPoint(0.25));
    panel.handlePointerDown(raycaster, pointer as never);
    expect(slider.value).toBeCloseTo(25, 0);
    aim(trackPoint(0.75));
    panel.handlePointerMove(raycaster, pointer as never);
    expect(slider.value).toBeCloseTo(75, 0);

    // Drift onto the foreign neighbour: the value must hold, not jump.
    aim(foreign.getWorldPosition(new THREE.Vector3()));
    panel.handlePointerMove(raycaster, pointer as never);
    expect(slider.value).toBeCloseTo(75, 0);

    // Leave all geometry: the value must still hold.
    raycaster.set(origin, new THREE.Vector3(0, 1, 0));
    panel.handlePointerMove(raycaster, pointer as never);
    expect(slider.value).toBeCloseTo(75, 0);
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