import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MonetaDiagnosticHUD } from '../src/vr/ui/MonetaDiagnosticHUD.ts';

describe('P1-UV1 diagnostic default', () => {
  it('constructs the Moneta diagnostic hidden and keeps explicit show available', () => {
    const panel = new MonetaDiagnosticHUD(new THREE.Group(), {
      engine: { softConstraints: [] },
      solverResult: null,
      adjustWeight() {},
    } as never);

    expect(panel.mesh.visible).toBe(false);
    panel.show();
    expect(panel.mesh.visible).toBe(true);
    panel.dispose();
  });
});
