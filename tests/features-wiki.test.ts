import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Project Administration & Documentation Governance', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('validates FEATURES.md exists at repository root and is populated', () => {
    const featuresPath = path.join(rootDir, 'FEATURES.md');
    expect(fs.existsSync(featuresPath)).toBe(true);
    const content = fs.readFileSync(featuresPath, 'utf-8');
    expect(content).toContain('Nemosyne Features & Capability Matrix');
    expect(content).toContain('WebXR Spatial Render Engine');
    expect(content).toContain('Rust / WASM Performance Core');
    expect(content).toContain('AI Gesture Recognition');
    expect(content).toContain('WebRTC Multi-User Collaboration');
  });

  it('validates docs/wiki/ Home.md and API-Reference.md exist and are up to date', () => {
    const homePath = path.join(rootDir, 'docs', 'wiki', 'Home.md');
    const apiPath = path.join(rootDir, 'docs', 'wiki', 'API-Reference.md');
    expect(fs.existsSync(homePath)).toBe(true);
    expect(fs.existsSync(apiPath)).toBe(true);

    const homeContent = fs.readFileSync(homePath, 'utf-8');
    expect(homeContent).toContain('Nemosyne Wiki');
    expect(homeContent).toContain('API Reference');

    const apiContent = fs.readFileSync(apiPath, 'utf-8');
    expect(apiContent).toContain('Nemosyne API Reference');
    expect(apiContent).toContain('GestureClassifierModel');
    expect(apiContent).toContain('SpatialAudioSynthesizer');
    expect(apiContent).toContain('NetworkManager');
    expect(apiContent).toContain('UserCloudAvatar');
  });
});
