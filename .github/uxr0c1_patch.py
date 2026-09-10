from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match in {path}, got {count}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    'src/vr/ui/ContextualTaskSurface.ts',
    """  private _activeData: Record<string, unknown> | null = null;
  private _activeNode: THREE.Object3D | null = null;
  public callbacks: ContextualTaskSurfaceCallbacks;""",
    """  private _activeData: Record<string, unknown> | null = null;
  private _activeNode: THREE.Object3D | null = null;
  // UXR0C1: steady-state anchoring scratch. These objects are owned by this
  // synchronous surface update and are never retained by Three.js callers.
  private readonly _nodeWorld = new THREE.Vector3();
  private readonly _anchorWorld = new THREE.Vector3();
  private readonly _cameraWorld = new THREE.Vector3();
  private readonly _towardCamera = new THREE.Vector3();
  private readonly _anchorLocal = new THREE.Vector3();
  private readonly _anchorOffset = new THREE.Vector3(0, 0.18, 0);
  public callbacks: ContextualTaskSurfaceCallbacks;""",
    'ContextualTaskSurface scratch fields',
)

replace_once(
    'src/vr/ui/ContextualTaskSurface.ts',
    """  private _updateAnchorTransform(): void {
    if (!this._activeNode) return;

    const nodeWorld = new THREE.Vector3();
    this._activeNode.getWorldPosition(nodeWorld);

    // Keep the rail just above the evidence and slightly toward the viewer so
    // it remains readable without sitting directly on top of the selected mark.
    const anchorWorld = nodeWorld.clone().add(new THREE.Vector3(0, 0.18, 0));
    const cameraWorld = new THREE.Vector3();
    if (this.engine.camera) {
      this.engine.camera.getWorldPosition(cameraWorld);
      const towardCamera = cameraWorld.clone().sub(nodeWorld);
      towardCamera.y = 0;
      if (towardCamera.lengthSq() > 1e-6) {
        anchorWorld.add(towardCamera.normalize().multiplyScalar(0.08));
      }
    }

    // The surface is parented beneath analystAnchor. Convert from the selected
    // node's world-space locus into the parent's local coordinates instead of
    // copying world coordinates into a moving local frame.
    if (this.parent) {
      this.parent.updateWorldMatrix(true, false);
      this.position.copy(this.parent.worldToLocal(anchorWorld.clone()));
    } else {
      this.position.copy(anchorWorld);
    }

    if (this.engine.camera) {
      this.lookAt(cameraWorld);
    }
  }""",
    """  private _updateAnchorTransform(): void {
    if (!this._activeNode) return;

    this._activeNode.getWorldPosition(this._nodeWorld);

    // Keep the rail just above the evidence and slightly toward the viewer so
    // it remains readable without sitting directly on top of the selected mark.
    this._anchorWorld.copy(this._nodeWorld).add(this._anchorOffset);
    if (this.engine.camera) {
      this.engine.camera.getWorldPosition(this._cameraWorld);
      this._towardCamera.subVectors(this._cameraWorld, this._nodeWorld);
      this._towardCamera.y = 0;
      if (this._towardCamera.lengthSq() > 1e-6) {
        this._anchorWorld.add(this._towardCamera.normalize().multiplyScalar(0.08));
      }
    }

    // worldToLocal mutates its argument, so copy into a dedicated scratch
    // vector rather than mutating the world-space anchor used by the fallback.
    if (this.parent) {
      this.parent.updateWorldMatrix(true, false);
      this._anchorLocal.copy(this._anchorWorld);
      this.position.copy(this.parent.worldToLocal(this._anchorLocal));
    } else {
      this.position.copy(this._anchorWorld);
    }

    if (this.engine.camera) {
      this.lookAt(this._cameraWorld);
    }
  }""",
    'ContextualTaskSurface allocation-free anchor update',
)

replace_once(
    'src/vr/artifacts/HolographicInspector.ts',
    """  private _annotateButton: Button;

  // Tabs State""",
    """  private _annotateButton: Button;
  // UXR0C1: reused by the active per-frame facing update.
  private readonly _cameraWorld = new THREE.Vector3();

  // Tabs State""",
    'HolographicInspector camera scratch',
)

replace_once(
    'src/vr/artifacts/HolographicInspector.ts',
    """    // Face the user's head smoothly if we want
    if (this.engine.camera) {
      const camPos = new THREE.Vector3();
      this.engine.camera.getWorldPosition(camPos);
      this.lookAt(camPos);
    }""",
    """    // Face the user's head without allocating a Vector3 every active frame.
    if (this.engine.camera) {
      this.engine.camera.getWorldPosition(this._cameraWorld);
      this.lookAt(this._cameraWorld);
    }""",
    'HolographicInspector allocation-free facing update',
)

Path('src/validation/uxr0-hot-path-allocation-inventory.ts').write_text("""/**
 * UXR0 steady-state allocation inventory.
 *
 * This is an engineering evidence inventory, not a runtime profiler and not an
 * analytical authority. Entries are restricted to production paths inspected
 * against the UXR0 resource-efficiency contract. A `fixed` entry has a source
 * guard in `tests/uxr0-hot-path-allocation.test.ts`; residual entries stay
 * explicit until their own tranche can preserve interaction semantics safely.
 */
export type Uxr0AllocationDisposition =
  | 'fixed-c1'
  | 'residual-high-risk'
  | 'residual-follow-up';

export interface Uxr0HotPathAllocationEntry {
  readonly id: string;
  readonly source: string;
  readonly hotPath: string;
  readonly disposition: Uxr0AllocationDisposition;
  readonly finding: string;
  readonly nextAction: string | null;
}

export const UXR0_HOT_PATH_ALLOCATION_INVENTORY: readonly Uxr0HotPathAllocationEntry[] = [
  {
    id: 'contextual-task-anchor',
    source: 'src/vr/ui/ContextualTaskSurface.ts',
    hotPath: 'ContextualTaskSurface.update -> _updateAnchorTransform',
    disposition: 'fixed-c1',
    finding: 'Visible-frame anchoring allocated multiple Vector3/clone temporaries.',
    nextAction: null,
  },
  {
    id: 'holographic-inspector-facing',
    source: 'src/vr/artifacts/HolographicInspector.ts',
    hotPath: 'HolographicInspector.update',
    disposition: 'fixed-c1',
    finding: 'Active-frame camera facing allocated one Vector3 per frame.',
    nextAction: null,
  },
  {
    id: 'pointer-ray-filter',
    source: 'src/vr/input/PointerRayFilter.ts',
    hotPath: 'PointerRayFilter.filter',
    disposition: 'residual-high-risk',
    finding: 'Adaptive smoothing clones/allocates vectors and a Ray during active-pointer frames.',
    nextAction: 'UXR0C2: add allocation-free filterInto path with numerical/interaction equivalence falsifiers.',
  },
  {
    id: 'pointer-registry-rays',
    source: 'src/vr/input/PointerRegistry.ts',
    hotPath: 'getBestPointerRay/getBestHand/getActivePointerObject',
    disposition: 'residual-high-risk',
    finding: 'Active pointer selection creates temporary Ray objects while determining pointer authority.',
    nextAction: 'UXR0C2: reuse caller-owned scratch Rays without changing hand/controller precedence.',
  },
  {
    id: 'input-router-frame-state',
    source: 'src/vr/InputRouter.ts',
    hotPath: 'InputRouter.update/_resolveSceneHit/_pollSelection',
    disposition: 'residual-high-risk',
    finding: 'Per-frame active-pointer arrays, gaze scratch, and input-source materialisation remain.',
    nextAction: 'UXR0C2: remove allocations only under same-frame semantic-input parity tests.',
  },
  {
    id: 'desktop-cursor-update',
    source: 'src/vr/DesktopControls.ts',
    hotPath: 'DesktopControls.update',
    disposition: 'residual-follow-up',
    finding: 'Desktop cursor placement creates vector and panel-list temporaries each non-XR frame.',
    nextAction: 'Follow-up: reuse cursor/panel/raycast scratch while preserving desktop semantic parity.',
  },
] as const;
""")

Path('tests/uxr0-hot-path-allocation.test.ts').write_text("""import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UXR0_HOT_PATH_ALLOCATION_INVENTORY } from '../src/validation/uxr0-hot-path-allocation-inventory.ts';

function methodBody(path: string, signature: string): string {
  const source = readFileSync(path, 'utf8');
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing guarded method ${signature} in ${path}`);
  const open = source.indexOf('{', start);
  if (open < 0) throw new Error(`Missing method body for ${signature} in ${path}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`Unterminated guarded method ${signature} in ${path}`);
}

function expectNoVectorTemporaries(body: string): void {
  expect(body).not.toMatch(/new\s+THREE\.Vector3\s*\(/);
  expect(body).not.toMatch(/\.clone\s*\(/);
}

describe('UXR0 steady-state allocation inventory', () => {
  it('keeps the C1 contextual anchor path free of Vector3/clone temporaries', () => {
    const body = methodBody(
      'src/vr/ui/ContextualTaskSurface.ts',
      'private _updateAnchorTransform(): void'
    );
    expectNoVectorTemporaries(body);
    expect(body).toContain('this._anchorLocal.copy(this._anchorWorld)');
  });

  it('keeps the active holographic-inspector facing update on owned scratch state', () => {
    const body = methodBody(
      'src/vr/artifacts/HolographicInspector.ts',
      'update(delta: number, _time?: number): void'
    );
    expectNoVectorTemporaries(body);
    expect(body).toContain('this.engine.camera.getWorldPosition(this._cameraWorld)');
  });

  it('does not hide the known interaction-critical and desktop residuals', () => {
    const byId = new Map(UXR0_HOT_PATH_ALLOCATION_INVENTORY.map((entry) => [entry.id, entry]));
    expect(byId.get('pointer-ray-filter')?.disposition).toBe('residual-high-risk');
    expect(byId.get('pointer-registry-rays')?.disposition).toBe('residual-high-risk');
    expect(byId.get('input-router-frame-state')?.disposition).toBe('residual-high-risk');
    expect(byId.get('desktop-cursor-update')?.disposition).toBe('residual-follow-up');
  });
});
""")

replace_once(
    'tests/config/test-groups.ts',
    """  'tests/uv0-baseline-inventory.test.ts',
  'tests/uxr0-replacement-qualification.test.ts',""",
    """  'tests/uv0-baseline-inventory.test.ts',
  'tests/uxr0-hot-path-allocation.test.ts',
  'tests/uxr0-replacement-qualification.test.ts',""",
    'UXR0 allocation guard in fast-node shard',
)
