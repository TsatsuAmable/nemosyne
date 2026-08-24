import { allocBytes, deallocBytes } from './runtime/MemoryAbi.ts';
import { requireRuntime } from './runtime/RuntimeState.ts';

interface LayoutAuthorityExports {
  memory: WebAssembly.Memory;
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
  layout_force_directed_edges_3d(
    count: number,
    edgesPtr: number,
    edgesLen: number,
    iterations: number,
    repulsion: number,
    attraction: number,
    damping: number,
    radius: number,
    yOffset: number,
    seed: number,
    outPtr: number,
    outLen: number
  ): number;
  layout_spectral_volume_3d(
    inputPtr: number,
    inputLen: number,
    radialScale: number,
    heightScale: number,
    yOffset: number,
    outPtr: number,
    outLen: number
  ): number;
}

function runtime(): LayoutAuthorityExports {
  return requireRuntime() as unknown as LayoutAuthorityExports;
}

function readF32Result(invoke: (outPtr: number, outLen: number) => number): Float32Array | null {
  const wasm = runtime();
  const needed = invoke(0, 0);
  if (!Number.isSafeInteger(needed) || needed <= 0 || needed % 4 !== 0) return null;

  const outPtr = wasm.alloc(needed);
  if (outPtr === 0) return null;
  try {
    const written = invoke(outPtr, needed);
    if (written !== needed) return null;
    return new Float32Array(wasm.memory.buffer, outPtr, written / 4).slice();
  } finally {
    wasm.dealloc(outPtr, needed);
  }
}

export interface IndexedWeightedEdge {
  source: number;
  target: number;
  weight: number;
}

export function computeForceDirectedEdges3d(
  count: number,
  edges: readonly IndexedWeightedEdge[],
  iterations = 120,
  repulsion = 120,
  attraction = 0.02,
  damping = 0.08,
  radius = 4,
  yOffset = 1.2,
  seed = 1
): Float32Array | null {
  if (count <= 0) return null;
  const edgeBytes = new TextEncoder().encode(JSON.stringify(edges));
  const { ptr, len } = allocBytes(edgeBytes);
  try {
    return readF32Result((outPtr, outLen) =>
      runtime().layout_force_directed_edges_3d(
        count,
        ptr,
        len,
        iterations,
        repulsion,
        attraction,
        damping,
        radius,
        yOffset,
        seed,
        outPtr,
        outLen
      )
    );
  } finally {
    deallocBytes(ptr, len);
  }
}

export function computeSpectralVolume3d(
  frequencies: readonly number[],
  powers: readonly number[],
  phases: readonly number[],
  radialScale: number,
  heightScale: number,
  yOffset: number
): Float32Array | null {
  if (frequencies.length === 0) return null;
  const inputBytes = new TextEncoder().encode(JSON.stringify({ frequencies, powers, phases }));
  const { ptr, len } = allocBytes(inputBytes);
  try {
    return readF32Result((outPtr, outLen) =>
      runtime().layout_spectral_volume_3d(
        ptr,
        len,
        radialScale,
        heightScale,
        yOffset,
        outPtr,
        outLen
      )
    );
  } finally {
    deallocBytes(ptr, len);
  }
}
