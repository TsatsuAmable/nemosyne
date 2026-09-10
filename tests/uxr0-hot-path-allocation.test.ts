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
