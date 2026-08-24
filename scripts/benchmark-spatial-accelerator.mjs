import os from 'node:os';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';

const nativeRaycast = THREE.Mesh.prototype.raycast;
const [{ BVHSpatialAccelerator }, { ObjectBVH }] = await Promise.all([
  import('../src/vr/scalability/BVHSpatialAccelerator.ts'),
  import('three-mesh-bvh'),
]);

const DEFAULT_GEOMETRY_TIERS = [128, 512, 2_048, 8_192, 32_768, 131_072];
const DEFAULT_OBJECT_TIERS = [16, 64, 256, 1_024, 4_096, 16_384];

function parsePositiveInteger(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = { suite: 'objects', tiers: null, rays: 64, repeat: 5, json: false };
  for (const arg of argv) {
    if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('--suite=')) {
      const suite = arg.slice('--suite='.length);
      if (suite !== 'geometry' && suite !== 'objects') {
        throw new Error("--suite must be 'geometry' or 'objects'");
      }
      options.suite = suite;
    } else if (arg.startsWith('--tiers=')) {
      const values = arg.slice('--tiers='.length).split(',');
      options.tiers = values.map((value) => parsePositiveInteger(value, '--tiers'));
    } else if (arg.startsWith('--rays=')) {
      options.rays = parsePositiveInteger(arg.slice('--rays='.length), '--rays');
    } else if (arg.startsWith('--repeat=')) {
      options.repeat = parsePositiveInteger(arg.slice('--repeat='.length), '--repeat');
    } else {
      throw new Error(`Unknown argument '${arg}'`);
    }
  }
  options.tiers ??= options.suite === 'geometry' ? DEFAULT_GEOMETRY_TIERS : DEFAULT_OBJECT_TIERS;
  return options;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

function makeRaycasters(count) {
  return Array.from({ length: count }, (_, index) => {
    const u = ((index * 37 + 17) % 997) / 997;
    const v = ((index * 61 + 29) % 991) / 991;
    return new THREE.Raycaster(
      new THREE.Vector3((u - 0.5) * 9.5, (v - 0.5) * 9.5, 5),
      new THREE.Vector3(0, 0, -1)
    );
  });
}

function cast(mesh, raycasters, raycast, firstHitOnly) {
  const intersections = [];
  let hitRays = 0;
  let distanceChecksum = 0;
  for (const raycaster of raycasters) {
    raycaster.firstHitOnly = firstHitOnly;
    intersections.length = 0;
    raycast.call(mesh, raycaster, intersections);
    if (intersections.length === 0) continue;
    hitRays += 1;
    let nearest = intersections[0].distance;
    for (let index = 1; index < intersections.length; index += 1) {
      nearest = Math.min(nearest, intersections[index].distance);
    }
    distanceChecksum += nearest;
  }
  return { hitRays, distanceChecksum };
}

function measure(run, repeat) {
  const durations = [];
  let outcome;
  for (let index = 0; index < repeat; index += 1) {
    const started = performance.now();
    outcome = run();
    durations.push(performance.now() - started);
  }
  return { durationMs: median(durations), outcome };
}

function benchmarkGeometryTier(targetPrimitiveCount, rayCount, repeat) {
  const segments = Math.max(1, Math.ceil(Math.sqrt(targetPrimitiveCount / 2)));
  const geometry = new THREE.PlaneGeometry(10, 10, segments, segments);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const primitiveCount = geometry.index ? geometry.index.count / 3 : 0;
  const raycasters = makeRaycasters(rayCount);
  mesh.updateMatrixWorld(true);

  cast(mesh, raycasters.slice(0, Math.min(8, raycasters.length)), nativeRaycast, false);
  const buildStarted = performance.now();
  BVHSpatialAccelerator.buildTree(mesh);
  const buildMs = performance.now() - buildStarted;
  cast(mesh, raycasters.slice(0, Math.min(8, raycasters.length)), mesh.raycast, true);

  const native = measure(() => cast(mesh, raycasters, nativeRaycast, false), repeat);
  const accelerated = measure(() => cast(mesh, raycasters, mesh.raycast, true), repeat);
  const parity =
    native.outcome.hitRays === accelerated.outcome.hitRays &&
    Math.abs(native.outcome.distanceChecksum - accelerated.outcome.distanceChecksum) < 1e-6;

  BVHSpatialAccelerator.disposeTree(mesh);
  geometry.dispose();
  mesh.material.dispose();

  return {
    targetPrimitiveCount,
    primitiveCount,
    buildMs: round(buildMs),
    nativeMedianMs: round(native.durationMs),
    acceleratedMedianMs: round(accelerated.durationMs),
    speedup: round(native.durationMs / accelerated.durationMs),
    parity,
  };
}

function castObjects(objects, raycasters, objectBvh) {
  const intersections = [];
  let hitRays = 0;
  let distanceChecksum = 0;
  for (const raycaster of raycasters) {
    raycaster.firstHitOnly = objectBvh !== null;
    intersections.length = 0;
    if (objectBvh) {
      objectBvh.raycast(raycaster, intersections);
    } else {
      raycaster.intersectObjects(objects, false, intersections);
    }
    if (intersections.length === 0) continue;
    hitRays += 1;
    distanceChecksum += intersections[0].distance;
  }
  return { hitRays, distanceChecksum };
}

function benchmarkObjectTier(objectCount, rayCount, repeat) {
  const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const material = new THREE.MeshBasicMaterial();
  const columns = Math.ceil(Math.sqrt(objectCount));
  const objects = Array.from({ length: objectCount }, (_, index) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set((index % columns) * 0.5, Math.floor(index / columns) * 0.5, 0);
    mesh.updateMatrixWorld(true);
    return mesh;
  });
  const raycasters = Array.from({ length: rayCount }, (_, index) => {
    const object = objects[(index * 67 + 11) % objects.length];
    return new THREE.Raycaster(
      new THREE.Vector3(object.position.x, object.position.y, 5),
      new THREE.Vector3(0, 0, -1)
    );
  });

  castObjects(objects, raycasters.slice(0, Math.min(8, raycasters.length)), null);
  const buildStarted = performance.now();
  const objectBvh = new ObjectBVH(objects, { includeInstances: true });
  const buildMs = performance.now() - buildStarted;
  castObjects(objects, raycasters.slice(0, Math.min(8, raycasters.length)), objectBvh);

  const native = measure(() => castObjects(objects, raycasters, null), repeat);
  const accelerated = measure(() => castObjects(objects, raycasters, objectBvh), repeat);
  const parity =
    native.outcome.hitRays === accelerated.outcome.hitRays &&
    Math.abs(native.outcome.distanceChecksum - accelerated.outcome.distanceChecksum) < 1e-6;

  geometry.dispose();
  material.dispose();

  return {
    targetPrimitiveCount: objectCount,
    primitiveCount: objectCount,
    buildMs: round(buildMs),
    nativeMedianMs: round(native.durationMs),
    acceleratedMedianMs: round(accelerated.durationMs),
    speedup: round(native.durationMs / accelerated.durationMs),
    parity,
  };
}

function printHuman(result) {
  console.log(
    `Host: ${result.environment.cpu} (${result.environment.arch}, Node ${result.environment.node})`
  );
  console.log(`Rays: ${result.config.rays}; median of ${result.config.repeat} runs`);
  console.table(result.results);
  if (result.crossoverPrimitiveCount === null) {
    console.log('Measured crossover: not observed in the requested tiers');
  } else {
    console.log(`Measured crossover: ${result.crossoverPrimitiveCount} primitives`);
  }
  console.log('Scope: host characterization only; this is not Quest device qualification.');
}

try {
  const options = parseArgs(process.argv.slice(2));
  const benchmarkTier = options.suite === 'geometry' ? benchmarkGeometryTier : benchmarkObjectTier;
  const results = options.tiers.map((tier) => benchmarkTier(tier, options.rays, options.repeat));
  if (!results.every((result) => result.parity)) {
    throw new Error('Accelerated and native first-hit results diverged');
  }
  const crossover = results.find((result) => result.speedup > 1);
  const result = {
    schemaVersion: 1,
    benchmark: 'nemosyne-spatial-accelerator-crossover',
    suite: options.suite,
    scope: 'host-characterization-not-device-qualification',
    environment: {
      cpu: os.cpus()[0]?.model ?? 'unknown',
      arch: process.arch,
      platform: process.platform,
      node: process.versions.node,
    },
    config: {
      tiers: options.tiers,
      rays: options.rays,
      repeat: options.repeat,
    },
    results,
    crossoverPrimitiveCount: crossover?.primitiveCount ?? null,
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
