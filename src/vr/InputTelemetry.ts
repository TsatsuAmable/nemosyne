import * as THREE from 'three';
import { Group } from 'three';
import { Text } from '@pmndrs/uikit';
import { SpatialPanel } from './ui-system/SpatialPanel.ts';
import { getTheme } from './ui-system/theme.ts';
import type { AccessibilityOptions, EngineLike, HandLike, PointerLike } from './coordinators/types.ts';
import { WorldSpatialContext } from './trace/WorldSpatialContext.ts';

const PANEL_WIDTH = 960;
const PANEL_HEIGHT = 640;

/**
 * Developer-facing live WebXR input diagnostic.
 *
 * UXR1 moves the final production MovablePanel consumer onto SpatialPanel/UIKit.
 * InputTelemetry remains a pure projection of engine/input state and owns no
 * input authority.
 */
export class InputTelemetry extends SpatialPanel {
  readonly title = 'INPUT TELEMETRY';
  readonly defaultPosition = new THREE.Vector3(0.85, 1.5, -1.2);
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  engine: EngineLike;
  lines: string[];

  private readonly _worldContext: WorldSpatialContext;
  private readonly _content: Text;
  textScale = 1;
  highContrast = false;
  colorblindMode: string | boolean = 'none';

  constructor(engine: EngineLike, parent?: Group) {
    const theme = getTheme(false);
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        padding: 20,
        backgroundColor: Number(theme.backgroundColor),
        borderColor: Number(theme.borderColor),
        borderWidth: 2,
        borderRadius: 8,
      },
      parent ?? engine.cameraGroup,
      null
    );

    this.name = 'input-telemetry';
    this.engine = engine;
    this.lines = [];
    this._worldContext = new WorldSpatialContext();

    this.scale.setScalar(1.1 / PANEL_WIDTH);
    this.position.copy(this.defaultPosition);

    this._content = new Text({
      text: '',
      fontSize: 20,
      color: Number(theme.textPrimary),
    });
    this.add(this._content);
    this.render();
  }

  log(line: string): void {
    this.lines.push(line);
    if (this.lines.length > 18) this.lines.shift();
  }

  update(delta = 0, _time?: number): void {
    super.update(delta);
    try {
      this._doUpdate();
    } catch (err) {
      this.lines = [];
      this.log('TELEMETRY ERROR: ' + ((err as Error)?.message ?? String(err)));
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
          : new THREE.Vector3(
              (h.rayOrigin as { x?: number }).x ?? 0,
              (h.rayOrigin as { y?: number }).y ?? 0,
              (h.rayOrigin as { z?: number }).z ?? 0
            );
        handPositions.push({
          pos: originVec,
          handedness: h.handedness ?? '#' + (h.index ?? '?'),
        });
      }
    }

    const worldSnap = this._worldContext.buildSnapshot(this.engine.camera, pos, handPositions);

    this.lines = [];
    this.log(
      'ZONE: ' +
        worldSnap.zone +
        ' | NEAR: ' +
        (worldSnap.nearestLandmark
          ? worldSnap.nearestLandmark.name +
            ' (' +
            worldSnap.nearestLandmark.distance.toFixed(1) +
            'm, ' +
            worldSnap.nearestLandmark.bearingDeg.toFixed(0) +
            '°)'
          : 'none')
    );
    this.log('HEAD: ' + pos.x.toFixed(2) + ', ' + pos.y.toFixed(2) + ', ' + pos.z.toFixed(2));
    this.log(
      'PRES: ' +
        (this.engine.renderer?.xr?.isPresenting ? 'Y' : 'N') +
        ' SRCS: ' +
        (session?.inputSources?.length ?? 0)
    );

    const sources = session?.inputSources ? Array.from(session.inputSources) : [];
    const coveredHands = new Set<HandLike>();
    const coveredControllers = new Set<PointerLike>();
    const trackedHandSides = new Set<string>();

    for (const h of input?.hands ?? []) {
      const poseValid =
        typeof (h as { isPoseValid?: unknown }).isPoseValid === 'function'
          ? (h as { isPoseValid: () => boolean }).isPoseValid()
          : h.jointsValid;
      if (h.handedness && poseValid) trackedHandSides.add(h.handedness);
    }

    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      const p = this._getSourcePosition(src);
      const posStr = p
        ? '[' + p.x.toFixed(2) + ', ' + p.y.toFixed(2) + ', ' + p.z.toFixed(2) + ']'
        : '[---]';

      if (src.hand) {
        const hand = this._findHand(src, sources, input?.hands ?? []);
        if (hand) coveredHands.add(hand);
        const pinch = hand ? (hand.isPinched?.() ? 'YES' : 'no ') : '???';
        const dist =
          hand && typeof hand.pinchDistance === 'number' ? hand.pinchDistance.toFixed(3) : '-';
        const sideKey = src.handedness ?? 'hand' + i;
        const ergo = worldSnap.ergonomics[sideKey];
        const ergoStr = ergo
          ? ' [' + ergo.reachZone + ' ergo:' + ergo.ergonomicScore + '%]'
          : '';
        this.log(
          'HAND' +
            i +
            ' ' +
            (src.handedness?.toUpperCase() ?? '?') +
            ' ' +
            posStr +
            ' pinch=' +
            pinch +
            ' d=' +
            dist +
            ergoStr
        );
      } else {
        const controller = this._findController(src, sources, input?.controllers ?? []);
        if (controller) coveredControllers.add(controller);
        const gp = src.gamepad;
        const axes = gp?.axes?.length ? gp.axes.map((a) => a.toFixed(2)).join(',') : '-';
        const trig = gp?.buttons?.[0]?.pressed ? 'TRIG' : '---';
        const grip = gp?.buttons?.[1]?.pressed ? 'GRIP' : '---';
        const dup =
          src.handedness && trackedHandSides.has(src.handedness) ? ' [hand live]' : '';
        this.log(
          'CTRL' +
            i +
            ' ' +
            (src.handedness?.toUpperCase() ?? '?') +
            ' ' +
            posStr +
            ' axes=[' +
            axes +
            '] ' +
            trig +
            ' ' +
            grip +
            dup
        );
      }
    }

    for (const h of input?.hands ?? []) {
      if (coveredHands.has(h)) continue;
      if (h.ray?.visible && h.jointsValid) {
        const origin = h.getWorldPosition!(new THREE.Vector3());
        const pinch = h.isPinched?.() ? 'YES' : 'no ';
        const dist =
          typeof h.pinchDistance === 'number' ? h.pinchDistance.toFixed(3) : '-';
        this.log(
          'HAND' +
            (h.index ?? '?') +
            ' ' +
            (h.handedness?.toUpperCase() ?? '?') +
            ' [' +
            origin.x.toFixed(2) +
            ', ' +
            origin.y.toFixed(2) +
            ', ' +
            origin.z.toFixed(2) +
            '] pinch=' +
            pinch +
            ' d=' +
            dist
        );
      } else {
        this.log(
          'HAND' +
            (h.index ?? '?') +
            ' ' +
            (h.handedness?.toUpperCase() ?? '?') +
            ' not tracked (jointsValid=' +
            (h.jointsValid ? 'Y' : 'N') +
            ' ray=' +
            (h.ray?.visible ? 'Y' : 'N') +
            ')'
        );
      }
    }

    for (const c of input?.controllers ?? []) {
      if (coveredControllers.has(c)) continue;
      const origin = c.getRay(new THREE.Ray()).origin;
      this.log(
        'CTRL' +
          (c.index ?? '?') +
          ' ' +
          (c.handedness?.toUpperCase() ?? '?') +
          ' [' +
          origin.x.toFixed(2) +
          ', ' +
          origin.y.toFixed(2) +
          ', ' +
          origin.z.toFixed(2) +
          '] no source'
      );
    }

    this.render();
  }

  _getSourcePosition(src: XRInputSource): THREE.Vector3 | DOMPointReadOnly | null {
    const frame = this.engine.xrFrame;
    const refSpace = this.engine.xrRefSpace;
    if (!frame || !refSpace || !src || !src.targetRaySpace) return null;
    try {
      const pose = frame.getPose(src.targetRaySpace, refSpace);
      if (!pose) return null;
      return pose.transform.position;
    } catch {
      return null;
    }
  }

  _findHand(src: XRInputSource, allSources: XRInputSource[], hands: HandLike[]): HandLike | null {
    if (src?.handedness) {
      const match = hands.find((h) => h.handedness === src.handedness);
      if (match) return match;
    }
    const handIdx = allSources.filter((s) => s.hand).indexOf(src);
    return hands[handIdx] ?? null;
  }

  _findController(
    src: XRInputSource,
    allSources: XRInputSource[],
    controllers: PointerLike[]
  ): PointerLike | null {
    if (src?.handedness) {
      const match = controllers.find((c) => c.handedness === src.handedness);
      if (match) return match;
    }
    const ctrlIdx = allSources.filter((s) => !s.hand).indexOf(src);
    return controllers[ctrlIdx] ?? null;
  }

  applyAccessibility(options: AccessibilityOptions): void {
    this.textScale = options.textScale;
    this.highContrast = options.highContrast;
    this.colorblindMode = options.colorblindMode;
    const theme = getTheme(this.highContrast);
    this.setProperties({
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
    });
    this.render();
  }

  show(): void {
    this.visible = true;
    this.isMinimized = false;
  }

  hide(): void {
    const changed = this.visible;
    this.visible = false;
    if (changed) this.onHide?.();
  }

  render(): void {
    const theme = getTheme(this.highContrast);
    this._content.setProperties({
      text: this.lines.join('\n'),
      fontSize: 20 * this.textScale,
      color: Number(theme.textPrimary),
    });
  }
}
