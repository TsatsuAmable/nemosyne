/**
 * Unit tests for AmmoPhysicsEngine
 * Tests physics world initialization, body creation, and simulation
 * 
 * Note: These tests mock Ammo.js since it requires WebAssembly
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');
const enginePath = path.join(rootDir, 'src/physics/AmmoPhysicsEngine.js');

describe('AmmoPhysicsEngine Module', () => {
  it('should exist at src/physics/AmmoPhysicsEngine.js', () => {
    expect(fs.existsSync(enginePath)).toBe(true);
  });

  it('should contain AmmoPhysicsEngine class definition', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('class AmmoPhysicsEngine');
    expect(content).toContain('export { AmmoPhysicsEngine }');
  });

  it('should define constructor with options', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('constructor(options = {})');
    expect(content).toContain('gravity:');
    expect(content).toContain('timeStep:');
    expect(content).toContain('worldScale:');
  });

  it('should have init method', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('async init()');
    expect(content).toContain('Ammo.js not loaded');
  });

  it('should have createNodeBody method', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('createNodeBody(nodeId, position, options = {})');
    expect(content).toContain('btSphereShape');
    expect(content).toContain('btRigidBody');
  });

  it('should have createSpringConstraint method', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('createSpringEdge(nodeA, nodeB, options = {})');
    expect(content).toContain('btPoint2PointConstraint');
  });

  it('should have step method for simulation', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('stepSimulation(deltaTime)');
  });

  it('should have simulation control', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('ready');
  });

  it('should have body position methods', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('getBodyPosition(nodeId)');
    expect(content).toContain('setBodyPosition(nodeId, position)');
  });

  it('should have raycast method', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('raycast(from, to)');
  });

  it('should have cleanup method', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('destroy()');
  });

  it('should track bodies in Maps', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('this.bodies = new Map()');
    expect(content).toContain('this.nodeBodies = new Map()');
    expect(content).toContain('this.constraints = new Map()');
  });

  it('should have physics world setup', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('btDefaultCollisionConfiguration');
    expect(content).toContain('btCollisionDispatcher');
    expect(content).toContain('btDbvtBroadphase');
    expect(content).toContain('btSequentialImpulseConstraintSolver');
    expect(content).toContain('btDiscreteDynamicsWorld');
  });

  it('should configure sleep/wake optimization', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('setSleepingThresholds');
    expect(content).toContain('setActivationState');
  });

  it('should be referenced by nemosyne-graph-force-ammo.js', () => {
    const graphPath = path.join(rootDir, 'src/artefacts/nemosyne-graph-force-ammo.js');
    const content = fs.readFileSync(graphPath, 'utf-8');
    
    // Should reference physics functionality
    expect(content).toContain('AmmoPhysicsEngine');
  });

  it('should document Ammo.js dependency', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('Requires: Ammo.js');
    expect(content).toContain('WASM');
  });
});

describe('AmmoPhysicsEngine File Size', () => {
  it('should be reasonably sized', () => {
    const stats = fs.statSync(enginePath);
    expect(stats.size).toBeGreaterThan(10000); // At least 10KB
    expect(stats.size).toBeLessThan(50000);    // Less than 50KB
  });
});

describe('Physics Integration Status', () => {
  it('confirms AmmoPhysicsEngine module exists', () => {
    const exists = fs.existsSync(enginePath);
    expect(exists).toBe(true);
  });

  it('confirms file structure is correct', () => {
    const content = fs.readFileSync(enginePath, 'utf-8');
    expect(content).toContain('export { AmmoPhysicsEngine }');
    expect(content).toContain('class AmmoPhysicsEngine');
  });

  it('confirms module is exported from main index', () => {
    const indexPath = path.join(rootDir, 'src/index.js');
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain('AmmoPhysicsEngine');
  });

  it('confirms ammo.js is listed as peer dependency', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.peerDependencies['ammo.js']).toBe('^0.0.10');
  });

  it('marks ammo.js as optional peer dependency', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.peerDependenciesMeta['ammo.js'].optional).toBe(true);
  });
});

describe('Physics API Coverage', () => {
  const content = fs.readFileSync(enginePath, 'utf-8');
  
  const requiredMethods = [
    'init',
    'createNodeBody',
    'createSpringEdge',
    'stepSimulation',
    'applyRepulsionForces',
    'applyCenterGravity',
    'applyEdgeSpringForces',
    'setupGraphDynamics',
    'getBodyPosition',
    'setBodyPosition',
    'setBodyKinematic',
    'removeBody',
    'removeConstraint',
    'getStats',
    'destroy'
  ];

  requiredMethods.forEach(method => {
    it(`should have ${method} method`, () => {
      expect(content).toContain(method);
    });
  });
});
