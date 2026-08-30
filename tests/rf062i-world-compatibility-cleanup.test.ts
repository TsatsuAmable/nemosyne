import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('RF-062I World compatibility cleanup', () => {
  it('keeps analytical runtime state owned by AnalyticalRuntimeOwner', () => {
    const world = source('src/vr/World.ts');
    const owner = source('src/vr/runtime/AnalyticalRuntimeOwner.ts');
    const resourceEvidence = source('src/app/resourceEnvelopeDiagnostics.ts');
    const uv0 = source('src/app/uv0TestHandle.ts');

    expect(world).not.toMatch(/\b_wasm(?:Runtime|Capabilities|Unavailable)\b/);
    expect(owner).not.toMatch(/setCompatibility(?:Runtime|Unavailable)/);
    expect(resourceEvidence).toMatch(/world\.analyticalRuntime\.runtime/);
    expect(resourceEvidence).not.toMatch(/world\._wasmRuntime/);
    expect(uv0).toMatch(/analyticalRuntime:\s*\{[\s\S]*isUnavailable/);
    expect(uv0).not.toMatch(/_wasmUnavailable/);
  });

  it('keeps Atlas dataset and history state out of World facade properties', () => {
    const world = source('src/vr/World.ts');
    const story = source('src/vr/coordinators/AnalysisStoryExporter.ts');

    expect(world).not.toMatch(/Object\.defineProperty\(this, ['"]analysisHistory['"]/);
    expect(world).not.toMatch(/Object\.defineProperty\(this, ['"]_originalDataset['"]/);
    expect(world).not.toMatch(/Object\.defineProperty\(this, ['"]_transformedDataset['"]/);
    expect(world).not.toMatch(/\bthis\._(?:original|transformed)Dataset\b/);
    expect(world).not.toMatch(/\bthis\.analysisHistory\b/);
    expect(story).toMatch(/world\.atlas\?\.analysisHistory/);
    expect(story).not.toMatch(/_originalDataset|_transformedDataset/);
  });

  it('does not proxy input or live-stream implementation state through World', () => {
    const world = source('src/vr/World.ts');

    expect(world).not.toMatch(/Object\.defineProperty\(this, ['"]_inputPaused['"]/);
    expect(world).not.toMatch(/Object\.defineProperty\(this, ['"]_handNear(?:Artefact|WheelMenu)['"]/);
    expect(world).not.toMatch(/get _liveFlushTimer\(/);
    expect(world).not.toMatch(/get _pendingRows\(/);
  });
});