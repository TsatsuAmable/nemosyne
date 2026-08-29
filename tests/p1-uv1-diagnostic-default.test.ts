import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonetaDiagnosticHUD } from '../src/vr/ui/MonetaDiagnosticHUD.ts';

function createDiagnostic(): MonetaDiagnosticHUD {
  return new MonetaDiagnosticHUD(new THREE.Group(), {
    engine: { softConstraints: [] },
    solverResult: null,
    adjustWeight() {},
  } as never);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('P1-UV1 diagnostic visibility route', () => {
  it('constructs the Moneta diagnostic hidden in the normal product path', () => {
    vi.stubEnv('VITE_NEMOSYNE_DIAGNOSTICS', '0');
    const panel = createDiagnostic();
    expect(panel.mesh.visible).toBe(false);
    panel.dispose();
  });

  it('keeps the explicit instrumented diagnostics build visible across fresh construction', () => {
    vi.stubEnv('VITE_NEMOSYNE_DIAGNOSTICS', '1');
    const panel = createDiagnostic();
    expect(panel.mesh.visible).toBe(true);
    panel.dispose();
  });
});
