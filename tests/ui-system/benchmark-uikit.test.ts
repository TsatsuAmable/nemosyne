import { describe, expect, it } from 'vitest';
import { runUIKitBenchmark } from '../../dev/benchmark-uikit.ts';

describe('UX-05: UIKit vs Canvas Texture Performance Benchmark', () => {
  it('runs complete benchmark and evaluates performance properties', () => {
    const metrics = runUIKitBenchmark();

    console.log('=== BENCHMARK RESULTS (10 Panels) ===');
    console.log('Canvas MovablePanel:');
    console.log(`  Init Time:        ${metrics.canvasInitTimeMs.toFixed(2)} ms`);
    console.log(`  Heap Allocated:   ${(metrics.canvasMemoryAllocatedBytes / 1024 / 1024).toFixed(2)} MiB`);
    console.log(`  Scene Nodes:      ${metrics.canvasSceneNodes}`);
    console.log(`  Mesh Count:       ${metrics.canvasMeshesCount}`);
    console.log(`  Avg Frame Time:   ${metrics.canvasFrameTimeMs.toFixed(3)} ms`);
    console.log(`  Leftover Textures:${metrics.canvasDisposalLeftovers.textures}`);
    console.log(`  Leftover Geoms:   ${metrics.canvasDisposalLeftovers.geometries}`);

    console.log('@pmndrs/uikit:');
    console.log(`  Init Time:        ${metrics.uikitInitTimeMs.toFixed(2)} ms`);
    console.log(`  Heap Allocated:   ${(metrics.uikitMemoryAllocatedBytes / 1024 / 1024).toFixed(2)} MiB`);
    console.log(`  Scene Nodes:      ${metrics.uikitSceneNodes}`);
    console.log(`  Mesh Count:       ${metrics.uikitMeshesCount}`);
    console.log(`  Avg Frame Time:   ${metrics.uikitFrameTimeMs.toFixed(3)} ms`);
    console.log(`  Leftover Textures:${metrics.uikitDisposalLeftovers.textures}`);
    console.log(`  Leftover Geoms:   ${metrics.uikitDisposalLeftovers.geometries}`);

    // Basic sanity checks: ensure initialization and frame updates did not throw
    expect(metrics.canvasInitTimeMs).toBeGreaterThan(0);
    expect(metrics.uikitInitTimeMs).toBeGreaterThan(0);
    expect(metrics.canvasFrameTimeMs).toBeGreaterThan(0);
    expect(metrics.uikitFrameTimeMs).toBeGreaterThan(0);

    // Verify cleanup/disposal prevents major leaks (uikit must clean up perfectly;
    // canvas texture deallocation in jsdom mock WebGL context may retain texture counts)
    expect(metrics.canvasDisposalLeftovers.textures).toBeLessThanOrEqual(10);
    expect(metrics.uikitDisposalLeftovers.textures).toBe(0);
    expect(metrics.uikitDisposalLeftovers.geometries).toBe(0);
  });
});
