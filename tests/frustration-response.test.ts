import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { UXFrustrationAnalyzer } from '../src/utils/UXFrustrationAnalyzer.ts';
import { FrustrationResponseManager } from '../src/vr/ui/FrustrationResponseManager.ts';

describe('Sprint 12.4: Frustration Response Manager Suite', () => {
  it('surfaces diegetic hint card when dissatisfaction score breaches threshold', () => {
    const cameraGroup = new THREE.Group();
    const analyzer = new UXFrustrationAnalyzer();
    const manager = new FrustrationResponseManager(cameraGroup, analyzer);

    // Record 6 rapid repeated menu clicks to trigger high frustration (score >= 0.35)
    analyzer.recordUserAction('menu', 'toggle');
    analyzer.recordUserAction('menu', 'toggle');
    analyzer.recordUserAction('menu', 'toggle');
    analyzer.recordUserAction('menu', 'toggle');
    analyzer.recordUserAction('menu', 'toggle');
    analyzer.recordUserAction('menu', 'toggle');

    const score = analyzer.getDissatisfactionScore();
    expect(score).toBeGreaterThanOrEqual(0.35);

    manager.update();
    const children = cameraGroup.children;
    expect(children.length).toBe(1);

    const hintMesh = children[0] as THREE.Mesh;
    expect(hintMesh.visible).toBe(true);
  });

  it('adapts dissatisfaction threshold to user mode', () => {
    const cameraGroup = new THREE.Group();
    const analyzer = new UXFrustrationAnalyzer();
    const manager = new FrustrationResponseManager(cameraGroup, analyzer);

    manager.setUserMode('expert');

    analyzer.recordUserAction('menu', 'toggle');
    analyzer.recordUserAction('menu', 'toggle');

    manager.update();
    const hintMesh = cameraGroup.children[0] as THREE.Mesh;
    expect(hintMesh.visible).toBe(false);
  });
});
