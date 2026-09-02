import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

describe('Project Administration & Documentation Governance', () => {
  it('validates FEATURES.md exists at repository root and reflects current architecture', () => {
    const featuresPath = join(rootDir, 'FEATURES.md');
    expect(existsSync(featuresPath)).toBe(true);
    const content = readFileSync(featuresPath, 'utf-8');

    expect(content).toContain('personal, experimental');
    expect(content).toContain('WebXR Spatial Render Engine');
    expect(content).toContain('Moneta Representation Intelligence & Semantic Embodiment');
    expect(content).toContain('Rust / WASM Analytical Kernel');
    expect(content).toContain('Investigation UX & Interaction');
    expect(content).toContain('WebRTC Multi-User Collaboration');
    expect(content).not.toContain('Draco Constraint Recommender');
  });
});
