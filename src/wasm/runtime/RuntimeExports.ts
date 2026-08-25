export interface WasmInitInput {
  module_or_path?: string | URL | Request | Response | BufferSource | WebAssembly.Module;
}

export interface RuntimeLifecycleExports {
  memory: WebAssembly.Memory;
  init(seed: bigint): number;
  data_reset_runtime_generation(): number;
  ping(): number;
  capabilities(): number;
}

export interface MemoryAbiExports {
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
  host_buffer_alloc(len: number): number;
  host_buffer_dealloc(ptr: number, len: number): void;
  host_buffer_allocation_count(): number;
  fill_pattern(ptr: number, len: number): number;
  command_buffer_ptr(): number;
  update(deltaMs: number, timeMs: number): number;
}

export interface DatasetHandleExports {
  data_load_csv(ptr: number, len: number): number;
  data_load_json(ptr: number, len: number): number;
  data_load_dataset_json(ptr: number, len: number): number;
  data_load_sample(ptr: number, len: number): number;
  data_sample_keys(ptr: number, len: number): number;
  dataset_row_count(handle: number): number;
  dataset_column_count(handle: number): number;
  dataset_destroy(handle: number): void;
  dataset_to_json(handle: number, ptr: number, len: number): number;
  data_operation(handle: number, ptr: number, len: number): number;
  data_parse_arrow(ptr: number, len: number): number;
  dataset_fingerprint(handle: number, ptr: number, len: number): number;
  data_infer_topology(handle: number, ptr: number, len: number): number;
  data_infer_encodings(
    handle: number,
    topologyPtr: number,
    topologyLen: number,
    ptr: number,
    len: number
  ): number;
  data_infer_schema(handle: number, ptr: number, len: number): number;
  data_statistics(handle: number, ptr: number, len: number): number;
  data_compute_spectral_facts(
    handle: number,
    timePtr: number,
    timeLen: number,
    valuePtr: number,
    valueLen: number,
    ptr: number,
    len: number
  ): number;
  data_compute_structure_profile(handle: number, ptr: number, len: number): number;
  data_compute_mapper_graph(
    handle: number,
    paramsPtr: number,
    paramsLen: number,
    ptr: number,
    len: number
  ): number;
  data_compute_persistence_intervals(
    handle: number,
    paramsPtr: number,
    paramsLen: number,
    ptr: number,
    len: number
  ): number;
  data_compute_betti0_curve(
    handle: number,
    paramsPtr: number,
    paramsLen: number,
    ptr: number,
    len: number
  ): number;
}

export interface LayoutAbiExports {
  data_compute_radial_tree_3d(
    levelsPtr: number,
    levelsLen: number,
    ringSpacing: number,
    yStep: number,
    yOffset: number,
    ptr: number,
    len: number
  ): number;
  data_compute_time_ribbon_3d(
    seriesPtr: number,
    seriesLen: number,
    timesPtr: number,
    timesLen: number,
    valuesPtr: number,
    valuesLen: number,
    xScale: number,
    yScale: number,
    zSpacing: number,
    yOffset: number,
    ptr: number,
    len: number
  ): number;
  data_compute_geo_surface_3d(
    longitudesPtr: number,
    longitudesLen: number,
    latitudesPtr: number,
    latitudesLen: number,
    valuesPtr: number,
    valuesLen: number,
    roomWidth: number,
    roomDepth: number,
    heightScale: number,
    yOffset: number,
    ptr: number,
    len: number
  ): number;
  data_compute_streamline_3d(
    count: number,
    steps: number,
    stepSize: number,
    seed: bigint,
    ptr: number,
    len: number
  ): number;
  layout_grid_3d(count: number, spacing: number, yOffset: number, outPtr: number): number;
  layout_force_directed_3d(
    count: number,
    iterations: number,
    repulsion: number,
    attraction: number,
    damping: number,
    radius: number,
    yOffset: number,
    outPtr: number
  ): number;
}

export interface KernelContractExports {
  kernel_version(ptr: number, len: number): number;
  kernel_provenance(ptr: number, len: number): number;
  draco_solve(factsPtr: number, factsLen: number, outPtr: number, outLen: number): number;
  draco_evaluate_candidate(
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number
  ): number;
  draco_adjust_evidence(inputPtr: number, inputLen: number, outPtr: number, outLen: number): number;
  intent_compile(inputPtr: number, inputLen: number, outPtr: number, outLen: number): number;
  atlas_discover_structures(
    inputPtr: number,
    inputLen: number,
    outPtr: number,
    outLen: number
  ): number;
}

export interface WasmRuntimeExports
  extends
    RuntimeLifecycleExports,
    MemoryAbiExports,
    DatasetHandleExports,
    LayoutAbiExports,
    KernelContractExports {
  [key: string]: unknown;
}

export interface WasmModule {
  default(wasmUrl?: string | URL | WasmInitInput): Promise<void>;
  [key: string]: unknown;
}
