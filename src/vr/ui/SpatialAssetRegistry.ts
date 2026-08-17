/**
 * SpatialAssetRegistry.ts
 *
 * Centralized registry and loader for Blender-crafted 3D WebXR UX assets.
 * Manages caching, cloning, and procedural fallbacks for headless/test environments.
 */

import * as THREE from 'three';

export interface SpatialAssetOptions {
  scale?: number | [number, number, number];
  color?: number;
  emissiveColor?: number;
  emissiveIntensity?: number;
}

export class SpatialAssetRegistry {
  private static _instance: SpatialAssetRegistry | null = null;
  private _modelCache = new Map<string, THREE.Object3D>();

  static getInstance(): SpatialAssetRegistry {
    if (!SpatialAssetRegistry._instance) {
      SpatialAssetRegistry._instance = new SpatialAssetRegistry();
    }
    return SpatialAssetRegistry._instance;
  }

  /**
   * Create a 3D Beveled Panel Housing mesh hierarchy.
   * Contains:
   * - `Panel_Chassis`: Beveled frame with metallic finish
   * - `Grab_Handle`: Cylindrical grab bar for VR direct/ray manipulation
   * - `Status_LED`: Emissive status jewel
   * - `Screen_Face`: Dedicated plane geometry for 2D Canvas mapping
   */
  createSpatialPanelHousing(width = 1.1, height = 0.66, depth = 0.03): THREE.Group {
    const group = new THREE.Group();
    group.name = 'SpatialPanelHousing';

    // 1. Panel Chassis (Outer beveled frame)
    const chassisGeo = new THREE.BoxGeometry(width + 0.06, height + 0.06, depth);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0b1626,
      roughness: 0.25,
      metalness: 0.85,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.name = 'Panel_Chassis';
    chassis.position.set(0, 0, -depth * 0.5);
    group.add(chassis);

    // 2. Top Grab Handle (Affordance for dragging)
    const grabGeo = new THREE.CylinderGeometry(0.015, 0.015, width * 0.8, 16);
    grabGeo.rotateZ(Math.PI / 2);
    const grabMesh = new THREE.Mesh(grabGeo, chassisMat);
    grabMesh.name = 'Grab_Handle';
    grabMesh.position.set(0, height * 0.5 + 0.04, 0);
    group.add(grabMesh);

    // 3. Status LED Jewel
    const ledGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.01, 16);
    ledGeo.rotateX(Math.PI / 2);
    const ledMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.name = 'Status_LED';
    led.position.set(0, height * 0.5 + 0.015, 0.01);
    group.add(led);

    // 4. Screen Face (Submesh where CanvasTexture is displayed)
    const screenGeo = new THREE.PlaneGeometry(width, height);
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x0b1626,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const screenFace = new THREE.Mesh(screenGeo, screenMat);
    screenFace.name = 'Screen_Face';
    screenFace.position.set(0, 0, 0.002);
    group.add(screenFace);

    return group;
  }

  /**
   * Create a 3D Cybernetic TechnoCore Monolith landmark.
   */
  createTechnoCoreMonolith(scale = 1): THREE.Group {
    const group = new THREE.Group();
    group.name = 'TechnoCoreMonolith';
    group.scale.setScalar(scale);

    // Pedestal Base
    const baseGeo = new THREE.CylinderGeometry(1.0, 1.4, 0.6, 8);
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0x0a1424,
      metalness: 0.9,
      roughness: 0.2,
    });
    const base = new THREE.Mesh(baseGeo, chromeMat);
    base.name = 'Monolith_Base';
    base.position.set(0, -1.8, 0);
    group.add(base);

    // Outer Gimbal Ring
    const outerRingGeo = new THREE.TorusGeometry(2.2, 0.06, 16, 48);
    const outerRing = new THREE.Mesh(outerRingGeo, chromeMat);
    outerRing.name = 'Gimbal_Ring_Outer';
    outerRing.rotation.x = Math.PI / 4;
    group.add(outerRing);

    // Inner Gimbal Ring
    const innerRingGeo = new THREE.TorusGeometry(1.75, 0.05, 16, 48);
    const innerRing = new THREE.Mesh(innerRingGeo, chromeMat);
    innerRing.name = 'Gimbal_Ring_Inner';
    innerRing.rotation.y = Math.PI / 3;
    group.add(innerRing);

    // Central Computational Prism (Dual Layer Core + Wireframe Exocage)
    const coreGeo = new THREE.IcosahedronGeometry(0.7, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.85,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.name = 'Central_Prism_Core';
    group.add(core);

    const cageGeo = new THREE.IcosahedronGeometry(1.05, 1);
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cage = new THREE.Mesh(cageGeo, cageMat);
    cage.name = 'Central_Prism_Cage';
    group.add(cage);

    return group;
  }

  /**
   * Create a 3D Farcaster Gate teleportation archway.
   */
  createFarcasterGate(scale = 1): THREE.Group {
    const group = new THREE.Group();
    group.name = 'FarcasterGate';
    group.scale.setScalar(scale);

    // Pedestal
    const pedGeo = new THREE.BoxGeometry(2.2, 0.4, 0.8);
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x060409,
      metalness: 0.88,
      roughness: 0.22,
    });
    const pedestal = new THREE.Mesh(pedGeo, darkMat);
    pedestal.name = 'Gate_Pedestal';
    pedestal.position.set(0, -1.8, 0);
    group.add(pedestal);

    // Stargate Ring
    const ringGeo = new THREE.TorusGeometry(1.8, 0.1, 16, 48);
    const ring = new THREE.Mesh(ringGeo, darkMat);
    ring.name = 'Gate_Outer_Ring';
    group.add(ring);

    // 6 Chevron Emitters
    const chevGeo = new THREE.BoxGeometry(0.22, 0.32, 0.22);
    const chevMat = new THREE.MeshBasicMaterial({
      color: 0xff00d9,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI * 2) / 6;
      const chev = new THREE.Mesh(chevGeo, chevMat);
      chev.name = `Gate_Chevron_${i}`;
      chev.position.set(Math.cos(angle) * 1.8, Math.sin(angle) * 1.8, 0);
      chev.rotation.z = angle;
      group.add(chev);
    }

    // Horizon Aperture Disc
    const horizonGeo = new THREE.CircleGeometry(1.65, 32);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0x8800ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const horizon = new THREE.Mesh(horizonGeo, horizonMat);
    horizon.name = 'Gate_Horizon_Aperture';
    group.add(horizon);

    return group;
  }

  /**
   * Create a 3D IceVault Glyph security node.
   */
  createIceVaultGlyph(scale = 1): THREE.Group {
    const group = new THREE.Group();
    group.name = 'IceVaultGlyph';
    group.scale.setScalar(scale);

    // Faceted Outer Shell
    const shellGeo = new THREE.IcosahedronGeometry(0.65, 1);
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x140508,
      metalness: 0.9,
      roughness: 0.3,
    });
    const shell = new THREE.Mesh(shellGeo, armorMat);
    shell.name = 'Vault_Shell_Plates';
    group.add(shell);

    // Exoskeleton Wireframe Rims
    const wireGeo = new THREE.IcosahedronGeometry(0.68, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xff0033,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });
    const rims = new THREE.Mesh(wireGeo, wireMat);
    rims.name = 'Vault_Conduit_Rims';
    group.add(rims);

    // Central Data Core
    const coreGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.name = 'Vault_Core';
    group.add(core);

    return group;
  }

  /**
   * Create a Volumetric 3D Spatial Action Puck for in-place operations.
   */
  createSpatialActionPuck(radius = 0.08, depth = 0.022): THREE.Group {
    const group = new THREE.Group();
    group.name = 'SpatialActionPuck';

    // Base Puck Body
    const bodyGeo = new THREE.CylinderGeometry(radius, radius, depth, 32);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0b1626,
      metalness: 0.85,
      roughness: 0.25,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.name = 'Puck_Base';
    group.add(body);

    // Glowing Bezel Ring
    const ringGeo = new THREE.TorusGeometry(radius * 0.9, 0.004, 8, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
    });
    const glowRing = new THREE.Mesh(ringGeo, glowMat);
    glowRing.name = 'Puck_Bezel_Glow';
    glowRing.position.z = depth * 0.5 + 0.001;
    group.add(glowRing);

    // Face Plate
    const faceGeo = new THREE.CircleGeometry(radius * 0.82, 32);
    const face = new THREE.Mesh(faceGeo, bodyMat);
    face.name = 'Puck_Face';
    face.position.z = depth * 0.5 + 0.002;
    group.add(face);

    return group;
  }

  /**
   * Create a 3D HandWheelHub center constellation socket.
   */
  createHandWheelHub(radius = 0.045, depth = 0.015): THREE.Group {
    const group = new THREE.Group();
    group.name = 'HandWheelHub';

    // Core Dial
    const coreGeo = new THREE.CylinderGeometry(radius, radius, depth, 32);
    coreGeo.rotateX(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x071120,
      metalness: 0.9,
      roughness: 0.2,
    });
    const core = new THREE.Mesh(coreGeo, hubMat);
    core.name = 'Hub_Core';
    group.add(core);

    // Glow Ring
    const ringGeo = new THREE.TorusGeometry(radius * 0.85, 0.003, 8, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
    });
    const glowRing = new THREE.Mesh(ringGeo, glowMat);
    glowRing.name = 'Hub_Glow_Ring';
    glowRing.position.z = depth * 0.5 + 0.001;
    group.add(glowRing);

    // 4 Docking Sockets
    const sockGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.008, 16);
    sockGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const angle = i * (Math.PI / 2);
      const sock = new THREE.Mesh(sockGeo, hubMat);
      sock.name = `Hub_Docking_Socket_${i}`;
      sock.position.set(Math.cos(angle) * (radius * 1.3), Math.sin(angle) * (radius * 1.3), 0.004);
      group.add(sock);
    }

    return group;
  }
}
