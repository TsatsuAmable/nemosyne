// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SpatialAssetRegistry } from '../src/vr/ui/SpatialAssetRegistry.ts';
import { MovablePanel } from '../src/vr/ui/MovablePanel.ts';

describe('SpatialAssetRegistry', () => {
  it('creates a singleton instance', () => {
    const r1 = SpatialAssetRegistry.getInstance();
    const r2 = SpatialAssetRegistry.getInstance();
    expect(r1).toBe(r2);
  });

  it('creates 3D spatial panel housing with expected submeshes', () => {
    const registry = SpatialAssetRegistry.getInstance();
    const housing = registry.createSpatialPanelHousing(1.1, 0.66, 0.03);

    expect(housing.isGroup).toBe(true);
    const chassis = housing.getObjectByName('Panel_Chassis');
    const grab = housing.getObjectByName('Grab_Handle');
    const led = housing.getObjectByName('Status_LED');
    const screen = housing.getObjectByName('Screen_Face');

    expect(chassis).toBeDefined();
    expect(grab).toBeDefined();
    expect(led).toBeDefined();
    expect(screen).toBeDefined();
  });

  it('creates TechnoCore monolith landmark hierarchy', () => {
    const registry = SpatialAssetRegistry.getInstance();
    const monolith = registry.createTechnoCoreMonolith(1);

    expect(monolith.getObjectByName('Monolith_Base')).toBeDefined();
    expect(monolith.getObjectByName('Gimbal_Ring_Outer')).toBeDefined();
    expect(monolith.getObjectByName('Gimbal_Ring_Inner')).toBeDefined();
    expect(monolith.getObjectByName('Central_Prism_Core')).toBeDefined();
    expect(monolith.getObjectByName('Central_Prism_Cage')).toBeDefined();
  });

  it('creates Farcaster gate archway hierarchy', () => {
    const registry = SpatialAssetRegistry.getInstance();
    const gate = registry.createFarcasterGate(1);

    expect(gate.getObjectByName('Gate_Pedestal')).toBeDefined();
    expect(gate.getObjectByName('Gate_Outer_Ring')).toBeDefined();
    expect(gate.getObjectByName('Gate_Horizon_Aperture')).toBeDefined();
    expect(gate.getObjectByName('Gate_Chevron_0')).toBeDefined();
  });

  it('creates IceVault glyph security node hierarchy', () => {
    const registry = SpatialAssetRegistry.getInstance();
    const glyph = registry.createIceVaultGlyph(1);

    expect(glyph.getObjectByName('Vault_Shell_Plates')).toBeDefined();
    expect(glyph.getObjectByName('Vault_Conduit_Rims')).toBeDefined();
    expect(glyph.getObjectByName('Vault_Core')).toBeDefined();
  });

  it('creates SpatialActionPuck hierarchy', () => {
    const registry = SpatialAssetRegistry.getInstance();
    const puck = registry.createSpatialActionPuck(0.08, 0.022);

    expect(puck.getObjectByName('Puck_Base')).toBeDefined();
    expect(puck.getObjectByName('Puck_Bezel_Glow')).toBeDefined();
    expect(puck.getObjectByName('Puck_Face')).toBeDefined();
  });

  it('creates HandWheelHub constellation center socket', () => {
    const registry = SpatialAssetRegistry.getInstance();
    const hub = registry.createHandWheelHub(0.045, 0.015);

    expect(hub.getObjectByName('Hub_Core')).toBeDefined();
    expect(hub.getObjectByName('Hub_Glow_Ring')).toBeDefined();
    expect(hub.getObjectByName('Hub_Docking_Socket_0')).toBeDefined();
  });

  it('integrates 3D housing into MovablePanel and cleans up upon dispose', () => {
    const cameraGroup = new THREE.Group();
    const panel = new MovablePanel(cameraGroup, {
      title: 'TEST_PANEL',
      worldSize: [1.1, 0.66],
    });

    expect(panel.housing).toBeDefined();
    expect(panel.housing.name).toBe('SpatialPanelHousing');
    expect(panel.mesh.children).toContain(panel.housing);

    expect(() => panel.dispose()).not.toThrow();
  });
});
