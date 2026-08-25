import {
  allocBuffer,
  allocBytes,
  deallocBuffer,
  deallocBytes,
} from './MemoryAbi.ts';
import { getLayoutAbiExports as getRuntimeExports } from './RuntimeState.ts';
import type {
  LayoutAbiExports,
  MemoryAbiExports,
  RuntimeLifecycleExports,
} from './RuntimeExports.ts';

type LayoutRuntime = RuntimeLifecycleExports & MemoryAbiExports & LayoutAbiExports;

export function computeRadialTree3d(
  levels: number[],
  ringSpacing: number,
  yStep: number,
  yOffset: number
): Float32Array | null {
  let wasm: LayoutRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  if (levels.length === 0) return null;
  const levelBytes = new TextEncoder().encode(JSON.stringify(levels));
  const { ptr: levelPtr, len: levelLen } = allocBytes(levelBytes);
  try {
    const needed = wasm.data_compute_radial_tree_3d(
      levelPtr,
      levelLen,
      ringSpacing,
      yStep,
      yOffset,
      0,
      0
    );
    if (needed === 0) return null;
    const { ptr: outPtr, len: outLen } = allocBuffer(needed);
    try {
      const written = wasm.data_compute_radial_tree_3d(
        levelPtr,
        levelLen,
        ringSpacing,
        yStep,
        yOffset,
        outPtr,
        outLen
      );
      if (written === 0 || written > outLen) return null;
      return new Float32Array(wasm.memory.buffer, outPtr, written / 4).slice();
    } finally {
      deallocBuffer(outPtr, outLen);
    }
  } finally {
    deallocBytes(levelPtr, levelLen);
  }
}

export function computeGrid3d(
  count: number,
  spacing: number,
  yOffset: number
): Float32Array | null {
  let wasm: LayoutRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  if (count <= 0) return null;
  const needed = count * 12;
  const { ptr: outPtr, len: outLen } = allocBuffer(needed);
  try {
    const written = wasm.layout_grid_3d(count, spacing, yOffset, outPtr);
    if (written !== outLen) return null;
    return new Float32Array(wasm.memory.buffer, outPtr, count * 3).slice();
  } finally {
    deallocBuffer(outPtr, outLen);
  }
}

export function computeForceDirected3d(
  count: number,
  iterations = 120,
  repulsion = 120,
  attraction = 0.02,
  damping = 0.08,
  radius = 4,
  yOffset = 1.2
): Float32Array | null {
  let wasm: LayoutRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  if (count <= 0) return null;
  const needed = count * 12;
  const { ptr: outPtr, len: outLen } = allocBuffer(needed);
  try {
    const written = wasm.layout_force_directed_3d(
      count,
      iterations,
      repulsion,
      attraction,
      damping,
      radius,
      yOffset,
      outPtr
    );
    if (written !== outLen) return null;
    return new Float32Array(wasm.memory.buffer, outPtr, count * 3).slice();
  } finally {
    deallocBuffer(outPtr, outLen);
  }
}

export function computeTimeRibbon3d(
  seriesIds: number[],
  timestamps: number[],
  values: number[],
  xScale = 0.8,
  yScale = 0.2,
  zSpacing = 1.5,
  yOffset = 1.2
): Float32Array | null {
  let wasm: LayoutRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  if (seriesIds.length === 0) return null;
  const seriesBytes = new TextEncoder().encode(JSON.stringify(seriesIds));
  const timesBytes = new TextEncoder().encode(JSON.stringify(timestamps));
  const valuesBytes = new TextEncoder().encode(JSON.stringify(values));
  const { ptr: seriesPtr, len: seriesLen } = allocBytes(seriesBytes);
  const { ptr: timePtr, len: timeLen } = allocBytes(timesBytes);
  const { ptr: valuePtr, len: valueLen } = allocBytes(valuesBytes);

  try {
    const needed = wasm.data_compute_time_ribbon_3d(
      seriesPtr,
      seriesLen,
      timePtr,
      timeLen,
      valuePtr,
      valueLen,
      xScale,
      yScale,
      zSpacing,
      yOffset,
      0,
      0
    );
    if (needed === 0) return null;
    const { ptr: outPtr, len: outLen } = allocBuffer(needed);
    try {
      const written = wasm.data_compute_time_ribbon_3d(
        seriesPtr,
        seriesLen,
        timePtr,
        timeLen,
        valuePtr,
        valueLen,
        xScale,
        yScale,
        zSpacing,
        yOffset,
        outPtr,
        outLen
      );
      if (written === 0 || written > outLen) return null;
      return new Float32Array(wasm.memory.buffer, outPtr, written / 4).slice();
    } finally {
      deallocBuffer(outPtr, outLen);
    }
  } finally {
    deallocBytes(seriesPtr, seriesLen);
    deallocBytes(timePtr, timeLen);
    deallocBytes(valuePtr, valueLen);
  }
}

export function computeGeoSurface3d(
  longitudes: number[],
  latitudes: number[],
  values: number[],
  roomWidth = 6,
  roomDepth = 3,
  heightScale = 0.05,
  yOffset = 0.5
): Float32Array | null {
  let wasm: LayoutRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  if (longitudes.length === 0) return null;
  const longitudeBytes = new TextEncoder().encode(JSON.stringify(longitudes));
  const latitudeBytes = new TextEncoder().encode(JSON.stringify(latitudes));
  const valuesBytes = new TextEncoder().encode(JSON.stringify(values));
  const { ptr: longitudePtr, len: longitudeLen } = allocBytes(longitudeBytes);
  const { ptr: latitudePtr, len: latitudeLen } = allocBytes(latitudeBytes);
  const { ptr: valuePtr, len: valueLen } = allocBytes(valuesBytes);

  try {
    const needed = wasm.data_compute_geo_surface_3d(
      longitudePtr,
      longitudeLen,
      latitudePtr,
      latitudeLen,
      valuePtr,
      valueLen,
      roomWidth,
      roomDepth,
      heightScale,
      yOffset,
      0,
      0
    );
    if (needed === 0) return null;
    const { ptr: outPtr, len: outLen } = allocBuffer(needed);
    try {
      const written = wasm.data_compute_geo_surface_3d(
        longitudePtr,
        longitudeLen,
        latitudePtr,
        latitudeLen,
        valuePtr,
        valueLen,
        roomWidth,
        roomDepth,
        heightScale,
        yOffset,
        outPtr,
        outLen
      );
      if (written === 0 || written > outLen) return null;
      return new Float32Array(wasm.memory.buffer, outPtr, written / 4).slice();
    } finally {
      deallocBuffer(outPtr, outLen);
    }
  } finally {
    deallocBytes(longitudePtr, longitudeLen);
    deallocBytes(latitudePtr, latitudeLen);
    deallocBytes(valuePtr, valueLen);
  }
}

export function computeStreamline3d(
  count: number,
  steps = 3,
  stepSize = 2,
  seed = 1
): Float32Array | null {
  let wasm: LayoutRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  if (count <= 0) return null;
  const totalPoints = count * (steps + 1);
  const needed = totalPoints * 12;
  const { ptr: outPtr, len: outLen } = allocBuffer(needed);
  try {
    const written = wasm.data_compute_streamline_3d(
      count,
      steps,
      stepSize,
      BigInt(seed),
      outPtr,
      outLen
    );
    if (written === 0 || written > outLen) return null;
    return new Float32Array(wasm.memory.buffer, outPtr, written / 4).slice();
  } finally {
    deallocBuffer(outPtr, outLen);
  }
}
