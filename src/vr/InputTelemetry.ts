import * as THREE from 'three';
import { Group } from 'three';
import { MovablePanel } from './ui/MovablePanel.ts';
import type { EngineLike, HandLike, PointerLike } from './coordinators/types.ts';
import { WorldSpatialContext } from './trace/WorldSpatialContext.ts';

/**
 * A small camera-rig-attached canvas panel that displays live WebXR input state.
 * Inherits from MovablePanel so it can be dragged and minimized.
 */
export class InputTelemetry extends MovablePanel {
  engine: EngineLike;
  lines: string[];
  private _worldContext: WorldSpatialContext;

  constructor(engine: EngineLike, parent?: Group) {
    super(parent ?? engine.cameraGroup, {
      title: 'INPUT TELEMETRY',
      width: 960,
      height: 640,
      position: [0.85, 1.5, -1.2],
      worldSize: [1.1, 0.73],
      titleBarHeight: 44,
    });

    this.engine = engine;
    this.lines = [];

    this._worldContext = new WorldSpatialContext();
  }

  log(line: string): void {
    this.lines.push(line);
    if (this.lines.length > 18) this.lines.shift();
  }

  update(_delta?: number, _time?: number): void {
    try {
      this._doUpdate();
    } catch (err) {
      this.lines = [];
      this.log(`TELEMETRY ERROR: ${(err as Error)?.message ?? err}`);
      this.render();
    }
  }

  _doUpdate(): void {
    const session = this.engine.renderer?.xr?.getSession?.() ?? null;
    const input = this.engine.input;
    const pos = this.engine.headWorldPos ?? new THREE.Vector3(0, 1.6, 0);

    const handPositions: Array<{ pos: THREE.Vector3; handedness: string }> = [];
    for (const h of input?.hands ?? []) {
      if (h.rayOrigin && typeof h.rayOrigin === 'object') {
        const originVec = (h.rayOrigin as THREE.Vector3).clone
          ? (h.rayOrigin as THREE.Vector3).clone()
          : new THREE.Vector3((h.rayOrigin as { x?: number }).x ?? 0, (h.rayOrigin as { y?: number }).y ?? 0, (h.rayOrigin as { z?: number }).z ?? 0);
        handPositions.push({ pos: originVec, handedness: h.handedness ?? `#${h.index ?? '?'}` });
      }
    }
    const worldSnap = this._worldContext.buildSnapshot(this.engine.camera, pos, handPositions);

    this.lines = [];
    this.log(`ZONE: ${worldSnap.zone} | NEAR: ${worldSnap.nearestLandmark ? `${worldSnap.nearestLandmark.name} (${worldSnap.nearestLandmark.distance.toFixed(1)}m, ${worldSnap.nearestLandmark.bearingDeg.toFixed(0)}°)` : 'none'}`);
    this.log(`HEAD: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`);
    this.log(
      `PRES: ${this.engine.renderer?.xr?.isPresenting ? 'Y' : 'N'} SRCS: ${session?.inputSources?.length ?? 0}`
    );

    // XRInputSourceArray is array-like but may not implement Array.prototype
    // methods in every runtime, so convert to a real array once.
    const sources = session?.inputSources ? Array.from(session.inputSources) : [];

    // One line per active XR input source, with world-space position.
    const coveredHands = new Set<HandLike>();
    const coveredControllers = new Set<PointerLike>();
    const trackedHandSides = new Set<string>();
    for (const h of input!.hands) {
      const poseValid =
        typeof (h as { isPoseValid?: unknown }).isPoseValid === 'function'
          ? (h as { isPoseValid: () => boolean }).isPoseValid()
          : h.jointsValid;
      if (h.handedness && poseValid) trackedHandSides.add(h.handedness);
    }
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const p = this._getSourcePosition(src);
      const posStr = p ? `[${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}]` : '[---]';
      if (src.hand) {
        const hand = this._findHand(src, sources, input!.hands);
        if (hand) coveredHands.add(hand);
        const pinch = hand ? (hand.isPinched?.() ? 'YES' : 'no ') : '???';
        const dist = hand && typeof hand.pinchDistance === 'number' ? hand.pinchDistance.toFixed(3) : '-';
        const sideKey = src.handedness ?? `hand${i}`;
        const ergo = worldSnap.ergonomics[sideKey];
        const ergoStr = ergo ? ` [${ergo.reachZone} ergo:${ergo.ergonomicScore}%]` : '';
        this.log(
          `HAND${i} ${src.handedness?.toUpperCase() ?? '?'} ${posStr} pinch=${pinch} d=${dist}${ergoStr}`
        );
      } else {
        const controller = this._findController(src, sources, input!.controllers);
        if (controller) coveredControllers.add(controller);
        const gp = src.gamepad;
        const axes = gp?.axes?.length ? gp.axes.map((a) => a.toFixed(2)).join(',') : '-';
        const trig = gp?.buttons?.[0]?.pressed ? 'TRIG' : '---';
        const grip = gp?.buttons?.[1]?.pressed ? 'GRIP' : '---';
        // Quest reports controller sources alongside tracked hands; mark them
        // so the two data streams are distinguishable at a glance.
        const dup =
          src.handedness && trackedHandSides.has(src.handedness) ? ' [hand live]' : '';
        this.log(
          `CTRL${i} ${src.handedness?.toUpperCase() ?? '?'} ${posStr} axes=[${axes}] ${trig} ${grip}${dup}`
        );
      }
    }

    // Status for any HandPointer/ControllerPointer that is not represented in
    // session.inputSources yet (e.g. requested but not active).
    for (const h of input!.hands) {
      if (coveredHands.has(h)) continue;
      if (h.ray?.visible && h.jointsValid) {
        const origin = h.getWorldPosition!(new THREE.Vector3());
        const pinch = h.isPinched?.() ? 'YES' : 'no ';
        const dist = typeof h.pinchDistance === 'number' ? h.pinchDistance.toFixed(3) : '-';
        this.log(
          `HAND${h.index ?? '?'} ${h.handedness?.toUpperCase() ?? '?'} [${origin.x.toFixed(2)}, ${origin.y.toFixed(2)}, ${origin.z.toFixed(2)}] pinch=${pinch} d=${dist}`
        );
      } else {
        this.log(
          `HAND${h.index ?? '?'} ${h.handedness?.toUpperCase() ?? '?'} not tracked (jointsValid=${h.jointsValid ? 'Y' : 'N'} ray=${h.ray?.visible ? 'Y' : 'N'})`
        );
      }
    }
    for (const c of input!.controllers) {
      if (coveredControllers.has(c)) continue;
      const origin = c.getRay(new THREE.Ray()).origin;
      this.log(
        `CTRL${c.index ?? '?'} ${c.handedness?.toUpperCase() ?? '?'} [${origin.x.toFixed(2)}, ${origin.y.toFixed(2)}, ${origin.z.toFixed(2)}] no source`
      );
    }

    this.render();
  }

  /** Query the world-space position of an XRInputSource from the current frame. */
  _getSourcePosition(src: XRInputSource): THREE.Vector3 | DOMPointReadOnly | null {
    const frame = this.engine.xrFrame;
    const refSpace = this.engine.xrRefSpace;
    if (!frame || !refSpace || !src || !src.targetRaySpace) return null;
    try {
      const pose = frame.getPose(src.targetRaySpace, refSpace);
      if (!pose) return null;
      return pose.transform.position;
    } catch (_err) {
      // getPose can throw on transient or invalid spaces; treat as unavailable.
      return null;
    }
  }

  /**
   * Match a hand input source to our internal HandPointer by handedness.
   * If handedness is not available, fall back to the source's order among
   * hand sources in the session.
   */
  _findHand(src: XRInputSource, allSources: XRInputSource[], hands: HandLike[]): HandLike | null {
    if (src?.handedness) {
      const match = hands.find((h) => h.handedness === src.handedness);
      if (match) return match;
    }
    const handIdx = allSources.filter((s) => s.hand).indexOf(src);
    return hands[handIdx] ?? null;
  }

  /**
   * Match a controller input source to our internal ControllerPointer by
   * handedness, falling back to source order among non-hand sources.
   */
  _findController(src: XRInputSource, allSources: XRInputSource[], controllers: PointerLike[]): PointerLike | null {
    if (src?.handedness) {
      const match = controllers.find((c) => c.handedness === src.handedness);
      if (match) return match;
    }
    const ctrlIdx = allSources.filter((s) => !s.hand).indexOf(src);
    return controllers[ctrlIdx] ?? null;
  }

  renderContent(ctx: CanvasRenderingContext2D, _w: number, _contentH: number): void {
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffffff';

    const lineH = 26;
    const topPad = 14;
    let y = topPad + lineH;
    const lines = this.lines ?? [];
    for (const line of lines) {
      ctx.fillText(line, 20, y);
      y += lineH;
    }
  }
}
