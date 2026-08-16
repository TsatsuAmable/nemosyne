import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Project Administration & Documentation Governance', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('validates FEATURES.md exists at repository root and is populated', () => {
    const featuresPath = path.join(rootDir, 'FEATURES.md');
    expect(fs.existsSync(featuresPath)).toBe(true);
    const content = fs.readFileSync(featuresPath, 'utf-8');
    // Reframed as a private, experimental project with honest per-area status tags.
    expect(content).toContain('personal, experimental');
    expect(content).toContain('WebXR Spatial Render Engine');
    expect(content).toContain('Draco Constraint Recommender');
    expect(content).toContain('Rust / WASM Compute Layer');
    expect(content).toContain('Gesture Recognition & JIT Hints');
    expect(content).toContain('WebRTC Multi-User Collaboration');
  });
});