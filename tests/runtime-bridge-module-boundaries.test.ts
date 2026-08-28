import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as facade from '../src/wasm/RuntimeBridge.ts';
import * as dataset from '../src/wasm/runtime/DatasetHandleBridge.ts';
import * as contract from '../src/wasm/runtime/KernelContractBridge.ts';
import * as layout from '../src/wasm/runtime/LayoutAbi.ts';
import * as memory from '../src/wasm/runtime/MemoryAbi.ts';
import * as state from '../src/wasm/runtime/RuntimeState.ts';

const runtimeDirectory = resolve(process.cwd(), 'src/wasm/runtime');
const facadeSource = readFileSync(resolve(process.cwd(), 'src/wasm/RuntimeBridge.ts'), 'utf8');
const layoutAuthoritySource = readFileSync(
  resolve(process.cwd(), 'src/wasm/LayoutAuthorityBridge.ts'),
  'utf8'
);
const columnarBoundarySource = readFileSync(
  resolve(process.cwd(), 'src/wasm/ColumnarBoundary.ts'),
  'utf8'
);
const runtimeSources = readdirSync(runtimeDirectory)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => ({ file, source: readFileSync(resolve(runtimeDirectory, file), 'utf8') }));

const publicStateExports = [
  'KernelAbiError',
  'KernelUnavailableError',
  'capabilities',
  'getKernelState',
  'getRuntimeGeneration',
  'getKernelUnavailableReason',
  'initRuntime',
  'invalidateRuntime',
  'isKernelFatalError',
  'isReady',
  'requireRuntime',
] as const;

const publicFacadeExports = [
  'CapabilityFlags',
  'KernelAbiError',
  'KernelUnavailableError',
  'UnsupportedAtScaleError',
  'adjustDracoEvidence',
  'adjustMonetaEvidence',
  'allocBuffer',
  'allocBytes',
  'call',
  'capabilities',
  'commandBufferPtr',
  'compileIntent',
  'computeBetti0Curve',
  'computeDatasetStructureProfile',
  'computeForceDirected3d',
  'computeGeoSurface3d',
  'computeGrid3d',
  'computeMapperGraph',
  'computePersistenceIntervals',
  'computeRadialTree3d',
  'computeSpectralFacts',
  'computeStreamline3d',
  'computeTimeRibbon3d',
  'datasetColumnCount',
  'datasetFingerprint',
  'datasetRowCount',
  'datasetRowView',
  'deallocBuffer',
  'deallocBytes',
  'debugFillPattern',
  'destroyDataset',
  'discoverStructures',
  'evaluateDracoCandidate',
  'evaluateMonetaCandidate',
  'executeOperation',
  'getCommandBufferBytes',
  'getDatasetJson',
  'getKernelState',
  'getRuntimeGeneration',
  'getKernelUnavailableReason',
  'getMemoryView',
  'hostBufferAllocationCount',
  'inferEncodings',
  'inferSchema',
  'inferTopology',
  'initRuntime',
  'invalidateRuntime',
  'isKernelFatalError',
  'isReady',
  'kernelProvenance',
  'kernelVersion',
  'loadCsv',
  'loadDatasetJson',
  'loadJson',
  'loadSample',
  'loadTypedColumns',
  'memory',
  'parseArrow',
  'parseDatasetBytes',
  'readBytes',
  'readF32',
  'readString',
  'readU32',
  'refreshMemoryView',
  'requireRuntime',
  'runOperation',
  'sampleKeys',
  'solveDraco',
  'solveMoneta',
  'statistics',
  'tdaResourcePreflight',
  'update',
] as const;

describe('RuntimeBridge module boundaries', () => {
  it('keeps the compatibility facade logic-free and preserves every family export', () => {
    expect(facadeSource).not.toMatch(/^(?:async\s+)?function\s|^class\s|^(?:let|const)\s/m);

    expect(Object.keys(facade).sort()).toEqual([...publicFacadeExports].sort());

    for (const name of publicStateExports) expect(facade[name]).toBe(state[name]);
    for (const family of [memory, dataset, layout, contract]) {
      for (const [name, implementation] of Object.entries(family)) {
        expect(facade[name as keyof typeof facade]).toBe(implementation);
      }
    }
  });

  it('has one runtime state owner and no internal dependency on the facade', () => {
    const stateOwners = runtimeSources.filter(({ source }) =>
      /let\s+(?:wasmInstance|wasmModule|kernelState|kernelUnavailableReason)\b/.test(source)
    );
    expect(stateOwners.map(({ file }) => file)).toEqual(['RuntimeState.ts']);

    for (const { file, source } of runtimeSources) {
      expect(source, file).not.toMatch(/from ['"]\.\.\/RuntimeBridge\.ts['"]/);
    }
  });

  it('keeps ABI contracts partitioned by resource family', () => {
    const contracts = readFileSync(resolve(runtimeDirectory, 'RuntimeExports.ts'), 'utf8');
    expect(contracts).toMatch(/interface RuntimeLifecycleExports/);
    expect(contracts).toMatch(/interface MemoryAbiExports/);
    expect(contracts).toMatch(/host_buffer_alloc/);
    expect(contracts).toMatch(/host_buffer_dealloc/);
    expect(contracts).toMatch(/host_buffer_allocation_count/);
    expect(contracts).toMatch(/interface DatasetHandleExports/);
    expect(contracts).toMatch(/data_tda_resource_preflight/);
    expect(contracts).toMatch(/interface LayoutAbiExports/);
    expect(contracts).toMatch(/interface KernelContractExports/);

    const sources = Object.fromEntries(runtimeSources.map(({ file, source }) => [file, source]));
    expect(sources['DatasetHandleBridge.ts']).toMatch(/getDatasetHandleExports/);
    expect(sources['DatasetHandleBridge.ts']).toMatch(/data_tda_resource_preflight/);
    expect(sources['DatasetHandleBridge.ts']).toMatch(/UnsupportedAtScaleError/);
    expect(sources['LayoutAbi.ts']).toMatch(/getLayoutAbiExports/);
    expect(sources['KernelContractBridge.ts']).toMatch(/getKernelContractExports/);
    for (const file of ['DatasetHandleBridge.ts', 'LayoutAbi.ts', 'KernelContractBridge.ts']) {
      expect(sources[file], file).not.toMatch(/\bWasmRuntimeExports\b/);
    }
  });

  it('keeps production bridge payloads on the Rust-tracked host-buffer allocator', () => {
    const sources = Object.fromEntries(runtimeSources.map(({ file, source }) => [file, source]));
    expect(sources['MemoryAbi.ts']).toMatch(/host_buffer_alloc/);
    expect(sources['MemoryAbi.ts']).toMatch(/host_buffer_dealloc/);
    expect(sources['MemoryAbi.ts']).toMatch(/host_buffer_allocation_count/);

    for (const file of ['DatasetHandleBridge.ts', 'LayoutAbi.ts', 'KernelContractBridge.ts']) {
      expect(sources[file], file).not.toMatch(/\bwasm\.alloc\(/);
      expect(sources[file], file).not.toMatch(/\bwasm\.dealloc\(/);
    }
    expect(layoutAuthoritySource).not.toMatch(/\bwasm\.alloc\(/);
    expect(layoutAuthoritySource).not.toMatch(/\bwasm\.dealloc\(/);
    expect(columnarBoundarySource).not.toMatch(/call\(['"]alloc['"]/);
    expect(columnarBoundarySource).not.toMatch(/call\(['"]dealloc['"]/);
    expect(columnarBoundarySource).toMatch(/allocBuffer/);
    expect(columnarBoundarySource).toMatch(/deallocBuffer/);
  });

  it('keeps compatibility aliases as identity-only adapters', () => {
    expect(facade.solveDraco).toBe(facade.solveMoneta);
    expect(facade.evaluateDracoCandidate).toBe(facade.evaluateMonetaCandidate);
    expect(facade.adjustDracoEvidence).toBe(facade.adjustMonetaEvidence);
  });
});
