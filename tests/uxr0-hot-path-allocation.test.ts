import { readFileSync } from 'node:fs';
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

function expectNoRayTemporaries(body: string): void {
  expect(body).not.toMatch(/new\s+THREE\.Ray\s*\(/);
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

  it('keeps the C2 pointer smoothing and authority paths free of steady-state Ray/vector temporaries', () => {
    const filterBody = methodBody(
      'src/vr/input/PointerRayFilter.ts',
      'filterInto(ray: THREE.Ray, target: THREE.Ray, timestamp: number = performance.now()): THREE.Ray'
    );
    expectNoVectorTemporaries(filterBody);
    expectNoRayTemporaries(filterBody);

    for (const signature of [
      'getBestPointerRay(timestamp?: number): THREE.Ray | null',
      'getActivePointerObject(): PointerLike | null',
      'getBestHand(): PointerLike | null',
    ]) {
      expectNoRayTemporaries(methodBody('src/vr/input/PointerRegistry.ts', signature));
    }
  });

  it('keeps the C2 InputRouter frame-state path on owned scratch storage', () => {
    const updateBody = methodBody('src/vr/InputRouter.ts', 'update(');
    expect(updateBody).toContain('this._activePointers.length = 0');
    expect(updateBody).not.toContain('const activePointers: PointerLike[] = []');

    const resolveBody = methodBody(
      'src/vr/InputRouter.ts',
      'private _resolveSceneHit(): SceneHit | null'
    );
    expectNoVectorTemporaries(resolveBody);
    expect(resolveBody).toContain('this._gazeDirection');

    const pollBody = methodBody(
      'src/vr/InputRouter.ts',
      '_pollSelection(session: XRSession | null): void'
    );
    expect(pollBody).not.toContain('Array.from(session.inputSources)');
    expect(pollBody).toContain('const sources = session.inputSources');
  });

  it('keeps near-field direct-touch on reusable Nemosyne-owned raycast containers', () => {
    const updateBody = methodBody(
      'src/vr/interactions/near/NearFieldInteractor.ts',
      'update(pointers: PointerLike[], panels: PanelLike[]): void'
    );
    expectNoRayTemporaries(updateBody);
    expect(updateBody).toContain('pointer.getRay(this._ray)');

    const intersectBody = methodBody(
      'src/vr/interactions/near/NearFieldInteractor.ts',
      'private _intersectFirst(mesh: THREE.Object3D): THREE.Intersection | null'
    );
    expect(intersectBody).toContain('this._hits.length = 0');
    expect(intersectBody).toContain('this._raycaster.intersectObject(mesh, true, this._hits)');
  });

  it('records C2 as fixed without hiding the remaining desktop residual', () => {
    const byId = new Map(UXR0_HOT_PATH_ALLOCATION_INVENTORY.map((entry) => [entry.id, entry]));
    expect(byId.get('pointer-ray-filter')?.disposition).toBe('fixed-c2');
    expect(byId.get('pointer-registry-rays')?.disposition).toBe('fixed-c2');
    expect(byId.get('input-router-frame-state')?.disposition).toBe('fixed-c2');
    expect(byId.get('near-field-raycast-containers')?.disposition).toBe('fixed-c2');
    expect(byId.get('semantic-target-ranking')?.disposition).toBe('residual-high-risk');
    expect(byId.get('desktop-cursor-update')?.disposition).toBe('residual-follow-up');
  });
});
