import type { Provenance } from '../../data/types.ts';
import { allocBytes, readBytes, readString } from './MemoryAbi.ts';
import { getKernelContractExports as getRuntimeExports } from './RuntimeState.ts';
import type { KernelContractExports, MemoryAbiExports } from './RuntimeExports.ts';

type KernelContractRuntime = KernelContractExports & MemoryAbiExports;

function readStringExport(
  wasm: KernelContractRuntime,
  invoke: (outPtr: number, outLen: number) => number
): string | null {
  const required = invoke(0, 0);
  if (required === 0) return null;
  const ptr = wasm.alloc(required);
  try {
    const written = invoke(ptr, required);
    if (written === 0) return null;
    return readString(ptr, written);
  } finally {
    wasm.dealloc(ptr, required);
  }
}

function callJsonAbi(
  wasm: KernelContractRuntime,
  fn: (inPtr: number, inLen: number, outPtr: number, outLen: number) => number,
  input: unknown
): unknown | null {
  const inputBytes = new TextEncoder().encode(JSON.stringify(input));
  const { ptr: inPtr, len: inLen } = allocBytes(inputBytes);
  try {
    const needed = fn(inPtr, inLen, 0, 0);
    if (needed === 0) return null;
    const outPtr = wasm.alloc(needed);
    fn(inPtr, inLen, outPtr, needed);
    const resultBytes = readBytes(outPtr, needed);
    wasm.dealloc(outPtr, needed);
    return JSON.parse(new TextDecoder().decode(resultBytes));
  } finally {
    wasm.dealloc(inPtr, inLen);
  }
}

export function kernelVersion(): string | null {
  const wasm = getRuntimeExports();
  return readStringExport(wasm, (ptr, len) => wasm.kernel_version(ptr, len));
}

export function kernelProvenance(): Provenance | null {
  const wasm = getRuntimeExports();
  const json = readStringExport(wasm, (ptr, len) => wasm.kernel_provenance(ptr, len));
  if (!json) return null;
  return JSON.parse(json) as Provenance;
}

export function solveMoneta(facts: Record<string, unknown>): Record<string, unknown> | null {
  let wasm: KernelContractRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  const factsBytes = new TextEncoder().encode(JSON.stringify(facts));
  const { ptr: factsPtr, len: factsLen } = allocBytes(factsBytes);
  try {
    const needed = wasm.draco_solve(factsPtr, factsLen, 0, 0);
    if (needed === 0) return null;
    const outPtr = wasm.alloc(needed);
    wasm.draco_solve(factsPtr, factsLen, outPtr, needed);
    const resultBytes = readBytes(outPtr, needed);
    wasm.dealloc(outPtr, needed);
    return JSON.parse(new TextDecoder().decode(resultBytes)) as Record<string, unknown>;
  } finally {
    wasm.dealloc(factsPtr, factsLen);
  }
}

export const solveDraco = solveMoneta;

export function evaluateMonetaCandidate(
  facts: Record<string, unknown>,
  spec: Record<string, unknown>
): { valid: boolean; cost: number; violations: string[] } | null {
  let wasm: KernelContractRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  return callJsonAbi(wasm, wasm.draco_evaluate_candidate.bind(wasm), { facts, spec }) as {
    valid: boolean;
    cost: number;
    violations: string[];
  } | null;
}

export const evaluateDracoCandidate = evaluateMonetaCandidate;

export function adjustMonetaEvidence(
  baseCost: number,
  evidence: { sampleCount: number; compositeUtility: number } | null
): { adjustedCost: number; delta: number } | null {
  let wasm: KernelContractRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  return callJsonAbi(wasm, wasm.draco_adjust_evidence.bind(wasm), {
    baseCost,
    evidence,
  }) as { adjustedCost: number; delta: number } | null;
}

export const adjustDracoEvidence = adjustMonetaEvidence;

export function compileIntent(
  query: string,
  schema: { columns: { name: string; kind?: string }[] }
): Record<string, unknown> | null {
  let wasm: KernelContractRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  return callJsonAbi(wasm, wasm.intent_compile.bind(wasm), { query, schema }) as Record<
    string,
    unknown
  > | null;
}

export function discoverStructures(
  assignments: number[],
  datumIds: string[],
  fingerprint: string,
  version: number,
  algorithmVersion: string,
  parameters: Record<string, unknown>
): Record<string, unknown> | null {
  let wasm: KernelContractRuntime;
  try {
    wasm = getRuntimeExports();
  } catch {
    return null;
  }
  return callJsonAbi(wasm, wasm.atlas_discover_structures.bind(wasm), {
    assignments,
    datumIds,
    fingerprint,
    version,
    algorithmVersion,
    parameters,
  }) as Record<string, unknown> | null;
}
