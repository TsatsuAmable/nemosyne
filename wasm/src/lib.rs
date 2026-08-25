use wasm_bindgen::prelude::*;

pub mod command_buffer;
mod data;
pub mod moneta;
pub use moneta as draco;
pub mod intent;
pub mod layouts;

/// Shared memory constants. The WASM module starts at 128 MiB and is allowed
/// to grow to 512 MiB. These match the JS host's expectations.
pub const INITIAL_MEMORY_PAGES: u32 = 2048; // 128 MiB
pub const MAX_MEMORY_PAGES: u32 = 8192; // 512 MiB

/// Target-specific allocation helpers.
///
/// On `wasm32`, host-visible allocations are owned by the Rust host-buffer
/// registry. Raw pointer views are accepted only when the requested range lies
/// inside one live tracked allocation. On native test targets, the historical
/// bounded arena remains available so pure Rust tests can exercise the ABI
/// without a WASM runner.
mod allocator {
    #[cfg(target_arch = "wasm32")]
    pub use wasm::*;

    #[cfg(not(target_arch = "wasm32"))]
    pub use host::*;

    #[cfg(target_arch = "wasm32")]
    mod wasm {
        pub fn reset() {
            crate::data::column_view::host_buffer_reset();
        }

        pub fn alloc(len: u32) -> u32 {
            crate::data::column_view::host_buffer_alloc(len)
        }

        pub fn dealloc(ptr: u32, len: u32) {
            crate::data::column_view::host_buffer_dealloc(ptr, len);
        }

        /// Fallible shared view over a live Rust-tracked host allocation.
        /// Zero-length reads are represented by the canonical empty slice and
        /// never construct a Rust reference from a null host pointer.
        pub unsafe fn try_view<'a>(ptr: u32, len: u32) -> Option<&'a [u8]> {
            if len == 0 {
                return Some(&[]);
            }
            if !crate::data::column_view::host_buffer_contains_range(ptr, len) {
                return None;
            }
            Some(core::slice::from_raw_parts(ptr as *const u8, len as usize))
        }

        /// Fallible mutable view over a live Rust-tracked host allocation.
        pub unsafe fn try_view_mut<'a>(ptr: u32, len: u32) -> Option<&'a mut [u8]> {
            if len == 0 {
                return Some(core::slice::from_raw_parts_mut(
                    core::ptr::NonNull::<u8>::dangling().as_ptr(),
                    0,
                ));
            }
            if !crate::data::column_view::host_buffer_contains_range(ptr, len) {
                return None;
            }
            Some(core::slice::from_raw_parts_mut(ptr as *mut u8, len as usize))
        }

        /// Internal compatibility view. Production host-facing ABIs should use
        /// `try_view` and return a sentinel on failure rather than trapping.
        pub unsafe fn view<'a>(ptr: u32, len: u32) -> &'a [u8] {
            try_view(ptr, len).expect("unowned or stale WASM input range")
        }

        /// Internal compatibility mutable view. Production host-facing ABIs
        /// should use `try_view_mut` so malformed output pointers fail closed.
        pub unsafe fn view_mut<'a>(ptr: u32, len: u32) -> &'a mut [u8] {
            try_view_mut(ptr, len).expect("unowned or stale WASM output range")
        }

        /// Allocate and copy `src` into tracked WASM memory. Returns `(ptr, len)`.
        pub fn copy_bytes(src: &[u8]) -> (u32, u32) {
            let len = src.len() as u32;
            let ptr = alloc(len);
            let dst = unsafe { view_mut(ptr, len) };
            dst.copy_from_slice(src);
            (ptr, len)
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    mod host {
        use std::sync::Mutex;

        use crate::INITIAL_MEMORY_PAGES;

        const CAPACITY: usize = (INITIAL_MEMORY_PAGES as usize) * 65536;

        struct HostMemory {
            buffer: Vec<u8>,
            bump: usize,
        }

        impl HostMemory {
            const fn new() -> Self {
                Self {
                    buffer: Vec::new(),
                    bump: 0,
                }
            }

            fn reset(&mut self) {
                self.buffer = Vec::with_capacity(CAPACITY);
                self.bump = 0;
            }

            fn alloc(&mut self, len: u32) -> u32 {
                let len = len as usize;
                if len == 0 {
                    return 0;
                }
                if self.buffer.capacity() == 0 {
                    self.reset();
                }
                let aligned_len = (len + 7) & !7;
                let ptr = self.bump;
                let end = ptr + aligned_len;
                if end > self.buffer.capacity() {
                    panic!("allocator out of memory");
                }
                unsafe {
                    std::ptr::write_bytes(self.buffer.as_mut_ptr().add(ptr), 0, aligned_len);
                    self.buffer.set_len(end);
                }
                self.bump = end;
                ptr as u32
            }

            fn dealloc(&mut self, ptr: u32, len: u32) {
                let aligned_len = ((len as usize) + 7) & !7;
                if aligned_len <= self.bump && (self.bump - aligned_len) == (ptr as usize) {
                    self.bump -= aligned_len;
                }
            }
        }

        static HOST_MEMORY: Mutex<HostMemory> = Mutex::new(HostMemory::new());

        pub fn reset() {
            HOST_MEMORY.lock().expect("host memory lock").reset();
        }

        pub fn alloc(len: u32) -> u32 {
            HOST_MEMORY.lock().expect("host memory lock").alloc(len)
        }

        pub fn dealloc(ptr: u32, len: u32) {
            HOST_MEMORY.lock().expect("host memory lock").dealloc(ptr, len);
        }

        pub unsafe fn try_view<'a>(ptr: u32, len: u32) -> Option<&'a [u8]> {
            if len == 0 {
                return Some(&[]);
            }
            let guard = HOST_MEMORY.lock().expect("host memory lock");
            let cap = guard.buffer.len();
            let base = guard.buffer.as_ptr();
            let end = (ptr as usize).checked_add(len as usize)?;
            if end > cap {
                return None;
            }
            Some(core::slice::from_raw_parts(base.add(ptr as usize), len as usize))
        }

        pub unsafe fn try_view_mut<'a>(ptr: u32, len: u32) -> Option<&'a mut [u8]> {
            if len == 0 {
                return Some(core::slice::from_raw_parts_mut(
                    core::ptr::NonNull::<u8>::dangling().as_ptr(),
                    0,
                ));
            }
            let mut guard = HOST_MEMORY.lock().expect("host memory lock");
            let cap = guard.buffer.len();
            let base = guard.buffer.as_mut_ptr();
            let end = (ptr as usize).checked_add(len as usize)?;
            if end > cap {
                return None;
            }
            Some(core::slice::from_raw_parts_mut(base.add(ptr as usize), len as usize))
        }

        /// View `len` bytes starting at `ptr` as a slice into the host buffer.
        pub unsafe fn view<'a>(ptr: u32, len: u32) -> &'a [u8] {
            try_view(ptr, len).expect("host view out of bounds")
        }

        /// Mutable view into the host buffer.
        pub unsafe fn view_mut<'a>(ptr: u32, len: u32) -> &'a mut [u8] {
            try_view_mut(ptr, len).expect("host view_mut out of bounds")
        }

        /// Allocate and copy `src` into the host buffer. Returns `(ptr, len)`.
        pub fn copy_bytes(src: &[u8]) -> (u32, u32) {
            let len = src.len() as u32;
            let ptr = alloc(len);
            let dst = unsafe { view_mut(ptr, len) };
            dst.copy_from_slice(src);
            (ptr, len)
        }
    }
}

/// Initialise the runtime and invalidate every host-buffer capability issued by
/// the previous generation.
#[wasm_bindgen]
pub fn init(_seed: u64) -> u32 {
    allocator::reset();
    1
}

// wasm-bindgen automatically exports `memory` on the module instance.

/// Compatibility allocation export. On WASM this is now an alias of the
/// Rust-tracked host-buffer allocator rather than a separate bump arena.
#[wasm_bindgen]
pub fn alloc(len: u32) -> u32 {
    allocator::alloc(len)
}

/// Compatibility deallocation export. Unknown, stale or mismatched WASM frees
/// are ignored by the tracked ownership registry.
#[wasm_bindgen]
pub fn dealloc(ptr: u32, len: u32) {
    allocator::dealloc(ptr, len);
}

/// Health-check echo. Returns `42` so the JS host can verify the ABI in one
/// console call. This intentionally returns a primitive, not a managed handle.
#[wasm_bindgen]
pub fn ping() -> u32 {
    42
}

/// Write a test pattern into a live host allocation. Malformed or stale ranges
/// fail closed with `0` rather than constructing an invalid Rust slice.
#[wasm_bindgen]
pub fn fill_pattern(ptr: u32, len: u32) -> u32 {
    let Some(slice) = (unsafe { allocator::try_view_mut(ptr, len) }) else {
        return 0;
    };
    for (i, byte) in slice.iter_mut().enumerate() {
        *byte = (i % 256) as u8;
    }
    len
}

/// Return the command-buffer pointer offset in shared WASM linear memory.
///
/// **Dormant:** the command buffer is not implemented — `update()` only resets
/// the buffer to its header and nothing encodes commands. Returns `0` as the
/// "not implemented" sentinel; the JS host (`RuntimeBridge.getCommandBufferBytes`)
/// treats `ptr === 0` as an empty buffer. The previous implementation returned a
/// `Vec` heap pointer, which is NOT a linear-memory offset — the JS host would
/// have interpreted it as one and read garbage/OOB. Copying the buffer into the
/// linear-memory arena belongs in the implement phase; this sentinel is the
/// honest minimal fix.
#[wasm_bindgen]
pub fn command_buffer_ptr() -> u32 {
    0
}

/// Phase 1 per-frame tick. Encodes scene transform and lifecycle commands into
/// the command buffer and returns the total byte length of the command buffer.
#[wasm_bindgen]
pub fn update(_delta_ms: f32, _time_ms: f32) -> u32 {
    command_buffer::with_global_buffer(|cb| {
        cb.reset();
        cb.bytes().len() as u32
    })
}

// ---------------------------------------------------------------------------
// Capability flags — gradual cutover registry (realigned to .claude/plan.md §6)
// ---------------------------------------------------------------------------
//
// The bitfield matches the spec exactly. Only subsystems whose primary path is
// genuinely migrated to Rust AND exercised by JS routing are *advertised* in
// `capabilities()`; the rest are defined so the ordering invariant
// (`COMMAND_BUFFER` requires `SCENE_RUST`) is expressible and testable, but are
// NOT advertised until their subsystem is implemented. See plan.md §758-766 for
// the per-phase default set (Phase 1 = `DATASET_RUST | PARSER_RUST |
// OPERATIONS_RUST`).
//
// Implemented + advertised (Phase 1):
const CAP_DATASET_RUST: u32 = 1 << 0; // wasm/src/data/dataset.rs
const CAP_PARSER_RUST: u32 = 1 << 1; // wasm/src/data/parsers.rs
const CAP_OPERATIONS_RUST: u32 = 1 << 2; // wasm/src/data/operations.rs
const CAP_MONETA_RUST: u32 = 1 << 3; // wasm/src/moneta/ (formerly Draco)
const CAP_DRACO_RUST: u32 = CAP_MONETA_RUST; // backward-compat alias
const CAP_SCENE_RUST: u32 = 1 << 4; // reserved — scene graph still JS. Phase 2.
const CAP_INPUT_RUST: u32 = 1 << 5; // reserved — input still JS. Phase 4.
const CAP_NETWORK_RUST: u32 = 1 << 6; // reserved. Phase 5.
const CAP_COMMAND_BUFFER: u32 = 1 << 7; // reserved — dormant stub; enabled once
//   `SCENE_RUST` is set (ordering invariant). Phase 2.
const CAP_INSTANCING: u32 = 1 << 8; // reserved. Phase 2.
const CAP_WASM_TELEMETRY: u32 = 1 << 9; // reserved. Phase 6.
// Wave 1 analytical-kernel subsystems — implemented and exported now. These
// remain *diagnostic telemetry only* until Wave 2 removes the JS routing: the
// bits describe what the kernel can do, not what `src/` chooses at runtime.
const CAP_TOPOLOGY_RUST: u32 = 1 << 10; // wasm/src/data/topology.rs (infer + TDA)
const CAP_TDA_RUST: u32 = 1 << 11; // mapper / persistence / betti0
const CAP_ENCODINGS_RUST: u32 = 1 << 12; // wasm/src/data/encodings.rs
const CAP_STATS_RUST: u32 = 1 << 13; // wasm/src/data/statistics.rs (Facts)
const CAP_SPECTRAL_RUST: u32 = 1 << 14; // wasm/src/data/spectral.rs (FFT)

/// Return the enabled capability set for the current build. Wave 1 advertises
/// the data/parser/operations subsystems plus the newly-exported
/// topology/TDA/encodings/stats/spectral subsystems. The remaining bits (Draco, scene,
/// input, network, command buffer, instancing, telemetry) are reserved until
/// their subsystem is genuinely migrated; see the constants above.
#[wasm_bindgen]
pub fn capabilities() -> u32 {
    CAP_DATASET_RUST
        | CAP_PARSER_RUST
        | CAP_OPERATIONS_RUST
        | CAP_TOPOLOGY_RUST
        | CAP_TDA_RUST
        | CAP_ENCODINGS_RUST
        | CAP_STATS_RUST
        | CAP_SPECTRAL_RUST
}

/// Compute 3D grid layout positions in WASM memory.
/// Writes `count * 3` floats into `out_ptr`.
#[wasm_bindgen]
pub fn layout_grid_3d(count: u32, spacing: f32, y_offset: f32, out_ptr: u32) -> u32 {
    let byte_len = match count.checked_mul(12) {
        Some(len) => len,
        None => return 0,
    };
    let positions = layouts::compute_grid_3d(count as usize, spacing, y_offset);
    let mut offset = out_ptr as usize;
    let Some(slice) = (unsafe { allocator::try_view_mut(out_ptr, byte_len) }) else {
        return 0;
    };
    for pos in positions {
        let bx = pos[0].to_le_bytes();
        let by = pos[1].to_le_bytes();
        let bz = pos[2].to_le_bytes();
        let rel = offset - out_ptr as usize;
        slice[rel..rel + 4].copy_from_slice(&bx);
        slice[rel + 4..rel + 8].copy_from_slice(&by);
        slice[rel + 8..rel + 12].copy_from_slice(&bz);
        offset += 12;
    }
    byte_len
}

/// Compute 3D force-directed layout positions in WASM memory.
#[wasm_bindgen]
pub fn layout_force_directed_3d(
    count: u32,
    iterations: u32,
    repulsion: f32,
    attraction: f32,
    damping: f32,
    radius: f32,
    y_offset: f32,
    out_ptr: u32,
) -> u32 {
    let byte_len = match count.checked_mul(12) {
        Some(len) => len,
        None => return 0,
    };
    let edges = &[];
    let positions = layouts::compute_force_directed_3d(
        count as usize,
        edges,
        iterations as usize,
        repulsion,
        attraction,
        damping,
        radius,
        y_offset,
        1.0,
    );
    let Some(slice) = (unsafe { allocator::try_view_mut(out_ptr, byte_len) }) else {
        return 0;
    };
    let mut offset = 0;
    for pos in positions {
        slice[offset..offset + 4].copy_from_slice(&pos[0].to_le_bytes());
        slice[offset + 4..offset + 8].copy_from_slice(&pos[1].to_le_bytes());
        slice[offset + 8..offset + 12].copy_from_slice(&pos[2].to_le_bytes());
        offset += 12;
    }
    byte_len
}

// ---------------------------------------------------------------------------
// Phase 1 — data layer exports
// ---------------------------------------------------------------------------

/// Parse CSV bytes from shared WASM memory and return a dataset handle.
///
/// # Safety
/// `ptr` must point to `len` valid UTF-8 bytes readable by the JS host.
#[wasm_bindgen]
pub fn data_load_csv(ptr: u32, len: u32) -> u32 {
    let Some(bytes) = (unsafe { allocator::try_view(ptr, len) }) else {
        return 0;
    };
    let name = "csv";
    match data::parsers::parse_csv(bytes, name) {
        Ok(dataset) => data::register_dataset(dataset),
        Err(e) => {
            log_error(&format!("data_load_csv failed: {}", e));
            0
        }
    }
}

/// Parse JSON bytes from shared WASM memory and return a dataset handle.
///
/// # Safety
/// `ptr` must point to `len` valid UTF-8 bytes readable by the JS host.
#[wasm_bindgen]
pub fn data_load_json(ptr: u32, len: u32) -> u32 {
    let Some(bytes) = (unsafe { allocator::try_view(ptr, len) }) else {
        return 0;
    };
    let name = "json";
    match data::parsers::parse_json(bytes, name) {
        Ok(dataset) => data::register_dataset(dataset),
        Err(e) => {
            log_error(&format!("data_load_json failed: {}", e));
            0
        }
    }
}

/// Return the number of rows in a dataset. Returns `0` for invalid handles.
#[wasm_bindgen]
pub fn dataset_row_count(handle: u32) -> u32 {
    data::with_dataset(handle, |ds| ds.row_count() as u32).unwrap_or(0)
}

/// Return the number of columns in a dataset. Returns `0` for invalid handles.
#[wasm_bindgen]
pub fn dataset_column_count(handle: u32) -> u32 {
    data::with_dataset(handle, |ds| ds.column_count() as u32).unwrap_or(0)
}

/// Release a dataset handle and its Rust-owned resources.
#[wasm_bindgen]
pub fn dataset_destroy(handle: u32) {
    data::destroy_dataset(handle);
}

fn write_bytes_out(bytes: &[u8], out_ptr: u32, out_len: u32) -> u32 {
    let Ok(required) = u32::try_from(bytes.len()) else {
        return 0;
    };
    if required == 0 {
        return 0;
    }
    if out_ptr == 0 || out_len < required {
        return required;
    }
    let Some(slice) = (unsafe { allocator::try_view_mut(out_ptr, required) }) else {
        return 0;
    };
    slice.copy_from_slice(bytes);
    required
}

/// Serialize a dataset to a JS-compatible JSON string using the atomic two-call
/// output contract: an undersized or zero output buffer receives no partial data
/// and the function returns the required byte count.
#[wasm_bindgen]
pub fn dataset_to_json(handle: u32, out_ptr: u32, out_len: u32) -> u32 {
    data::with_dataset(handle, |ds| {
        let json = ds.to_js_json();
        write_bytes_out(json.as_bytes(), out_ptr, out_len)
    })
    .unwrap_or(0)
}

/// Load a JS `Dataset.toJSON()` object back into the Rust data layer and
/// return a dataset handle. Returns `0` if the JSON or host range is invalid.
#[wasm_bindgen]
pub fn data_load_dataset_json(ptr: u32, len: u32) -> u32 {
    let Some(bytes) = (unsafe { allocator::try_view(ptr, len) }) else {
        return 0;
    };
    let json = match std::str::from_utf8(bytes) {
        Ok(s) => s,
        Err(_) => return 0,
    };
    match data::dataset::Dataset::from_js_json(json) {
        Ok(dataset) => data::register_dataset(dataset),
        Err(e) => {
            log_error(&format!("data_load_dataset_json failed: {}", e));
            0
        }
    }
}

/// Apply a generic data operation to a dataset and return a new dataset handle.
#[wasm_bindgen]
pub fn data_operation(handle: u32, op_ptr: u32, op_len: u32) -> u32 {
    let Some(op_bytes) = (unsafe { allocator::try_view(op_ptr, op_len) }) else {
        return 0;
    };
    let op_json = match std::str::from_utf8(op_bytes) {
        Ok(s) => s,
        Err(_) => return 0,
    };
    let raw: serde_json::Value = match serde_json::from_str(op_json) {
        Ok(v) => v,
        Err(e) => {
            log_error(&format!("data_operation parse failed: {}", e));
            return 0;
        }
    };
    let op: data::operations_bridge::Operation = match serde_json::from_value(raw.clone()) {
        Ok(o) => o,
        Err(e) => {
            log_error(&format!("data_operation parse failed: {}", e));
            return 0;
        }
    };
    let operation_name = raw
        .get("op")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let input_fp = data::with_dataset(handle, |ds| ds.fingerprint()).unwrap_or_default();
    let result = data::with_dataset(handle, |ds| data::operations_bridge::apply(ds, op));
    match result {
        Some(Ok(new_dataset)) => {
            let output_fp = new_dataset.fingerprint();
            data::provenance::record(&operation_name, raw, &input_fp, &output_fp);
            data::register_dataset(new_dataset)
        }
        Some(Err(e)) => {
            log_error(&format!("data_operation failed: {}", e));
            0
        }
        None => 0,
    }
}

/// Load a built-in sample dataset by key and return a dataset handle.
#[wasm_bindgen]
pub fn data_load_sample(key_ptr: u32, key_len: u32) -> u32 {
    let Some(key_bytes) = (unsafe { allocator::try_view(key_ptr, key_len) }) else {
        return 0;
    };
    let key = match std::str::from_utf8(key_bytes) {
        Ok(k) => k,
        Err(_) => return 0,
    };
    match data::synthetic::make_sample(key) {
        Some(dataset) => data::register_dataset(dataset),
        None => {
            log_error(&format!("data_load_sample unknown key: {}", key));
            0
        }
    }
}

/// Write the comma-separated list of available sample keys using the standard
/// atomic two-call output contract.
#[wasm_bindgen]
pub fn data_sample_keys(out_ptr: u32, out_len: u32) -> u32 {
    let keys = "supply-chain,fraud-graph,sensor-stream,sales-table,org-chart,wind-field,social-graph,financial-series,geo-cities,flow-process";
    write_bytes_out(keys.as_bytes(), out_ptr, out_len)
}

// ---------------------------------------------------------------------------
// Wave 1 — analytical kernel exports (topology / TDA / encodings / stats /
// arrow / radial tree / fingerprint / provenance)
// ---------------------------------------------------------------------------

fn write_str_out(s: &str, out_ptr: u32, out_len: u32) -> u32 {
    write_bytes_out(s.as_bytes(), out_ptr, out_len)
}

#[wasm_bindgen]
pub fn kernel_version(out_ptr: u32, out_len: u32) -> u32 {
    write_str_out(data::provenance::KERNEL_VERSION, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn kernel_provenance(out_ptr: u32, out_len: u32) -> u32 {
    write_str_out(&data::provenance::last_json(), out_ptr, out_len)
}

#[wasm_bindgen]
pub fn dataset_fingerprint(handle: u32, out_ptr: u32, out_len: u32) -> u32 {
    let fp = data::with_dataset(handle, |ds| ds.fingerprint()).unwrap_or_default();
    write_str_out(&fp, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_typed_dataset_fingerprint(handle: u32, out_ptr: u32, out_len: u32) -> u32 {
    let fingerprint = data::typed_ingest::typed_dataset_fingerprint(handle);
    write_str_out(&fingerprint, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_infer_topology(handle: u32, out_ptr: u32, out_len: u32) -> u32 {
    let (topo, input_fp) = match data::with_dataset(handle, |ds| {
        (data::topology::infer(ds), ds.fingerprint())
    }) {
        Some(v) => v,
        None => return 0,
    };
    let name = topo.as_str().to_string();
    let output_fp = data::fingerprint::fnv1a_hex(&name);
    data::provenance::record(
        "infer_topology",
        serde_json::Value::Null,
        &input_fp,
        &output_fp,
    );
    write_str_out(&name, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_infer_encodings(
    handle: u32,
    topo_ptr: u32,
    topo_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let explicit = if topo_len > 0 {
        let Some(bytes) = (unsafe { allocator::try_view(topo_ptr, topo_len) }) else {
            return 0;
        };
        std::str::from_utf8(bytes)
            .ok()
            .and_then(data::topology::parse_topology)
    } else {
        None
    };
    let (enc, input_fp, params) = match data::with_dataset(handle, |ds| {
        let enc = match explicit {
            Some(t) => data::encodings::infer_encodings_for_topology(ds, t),
            None => data::encodings::infer_encodings(ds),
        };
        let params = match explicit {
            Some(t) => serde_json::json!({ "topology": t.as_str() }),
            None => serde_json::Value::Null,
        };
        (enc, ds.fingerprint(), params)
    }) {
        Some(v) => v,
        None => return 0,
    };
    let json = serde_json::to_string(&enc).unwrap_or_else(|_| "{}".to_string());
    let output_fp = data::fingerprint::fnv1a_hex(&json);
    data::provenance::record("infer_encodings", params, &input_fp, &output_fp);
    write_str_out(&json, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_infer_schema(handle: u32, out_ptr: u32, out_len: u32) -> u32 {
    let (schema_json, input_fp) = match data::with_dataset(handle, |ds| {
        let arr: Vec<serde_json::Value> = ds
            .columns
            .iter()
            .map(|c| serde_json::json!({ "name": c.name, "type": c.ty.as_str() }))
            .collect();
        (serde_json::Value::Array(arr), ds.fingerprint())
    }) {
        Some(v) => v,
        None => return 0,
    };
    let json = serde_json::to_string(&schema_json).unwrap_or_else(|_| "[]".to_string());
    let output_fp = data::fingerprint::fnv1a_hex(&json);
    data::provenance::record("infer_schema", serde_json::Value::Null, &input_fp, &output_fp);
    write_str_out(&json, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_statistics(handle: u32, out_ptr: u32, out_len: u32) -> u32 {
    let (facts, input_fp) = match data::with_dataset(handle, |ds| {
        (data::statistics::compute_statistics(ds), ds.fingerprint())
    }) {
        Some(v) => v,
        None => return 0,
    };
    let json = serde_json::to_string(&facts).unwrap_or_else(|_| "{}".to_string());
    let output_fp = data::fingerprint::fnv1a_hex(&json);
    data::provenance::record("statistics", serde_json::Value::Null, &input_fp, &output_fp);
    write_str_out(&json, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_compute_spectral_facts(
    handle: u32,
    time_ptr: u32,
    time_len: u32,
    val_ptr: u32,
    val_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let time_col = if time_len > 0 {
        let Some(bytes) = (unsafe { allocator::try_view(time_ptr, time_len) }) else {
            return 0;
        };
        match std::str::from_utf8(bytes) {
            Ok(value) => value.to_string(),
            Err(_) => return 0,
        }
    } else {
        String::new()
    };
    let val_col = if val_len > 0 {
        let Some(bytes) = (unsafe { allocator::try_view(val_ptr, val_len) }) else {
            return 0;
        };
        match std::str::from_utf8(bytes) {
            Ok(value) => value.to_string(),
            Err(_) => return 0,
        }
    } else {
        String::new()
    };
    let (facts_json, input_fp) = match data::with_dataset(handle, |ds| {
        let facts = data::spectral::compute_spectral_facts(ds, &time_col, &val_col);
        (facts, ds.fingerprint())
    }) {
        Some(v) => v,
        None => return 0,
    };
    let json = match facts_json {
        Some(f) => serde_json::to_string(&f).unwrap_or_else(|_| "null".to_string()),
        None => "null".to_string(),
    };
    let output_fp = data::fingerprint::fnv1a_hex(&json);
    data::provenance::record("spectral_facts", serde_json::Value::Null, &input_fp, &output_fp);
    write_str_out(&json, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_compute_structure_profile(
    handle: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    if let Some(json) = data::cached_structure_profile_json(handle) {
        return write_str_out(&json, out_ptr, out_len);
    }
    let Some((snapshot_name, snapshot_columns, snapshot_columnar)) = data::columnar_snapshot(handle)
    else {
        return 0;
    };
    let row_profile = data::with_dataset(handle, |ds| {
        let fingerprint = ds.fingerprint();
        let profile = data::profile::compute_dataset_structure_profile(ds, &fingerprint, "0.1.0");
        (profile, fingerprint)
    });
    let (profile_json, input_fp) = match row_profile {
        Some(value) => value,
        None => {
            let input_fp = if let Some(fingerprint) = data::cached_fingerprint(handle) {
                fingerprint
            } else {
                let fingerprint = match data::columnar_fingerprint::columnar_dataset_fingerprint(
                    &snapshot_name,
                    &snapshot_columns,
                    snapshot_columnar.as_ref(),
                ) {
                    Ok(fingerprint) => fingerprint,
                    Err(error) => {
                        log_error(&format!(
                            "data_compute_structure_profile fingerprint failed for handle {handle}: {error}"
                        ));
                        return 0;
                    }
                };
                if !data::cache_fingerprint(handle, &snapshot_columnar, fingerprint.clone()) {
                    return 0;
                }
                fingerprint
            };
            let profile = match data::profile::compute_columnar_dataset_structure_profile(
                &snapshot_name,
                &snapshot_columns,
                snapshot_columnar.as_ref(),
                &input_fp,
                "0.1.0",
            ) {
                Ok(profile) => profile,
                Err(error) => {
                    log_error(&format!(
                        "data_compute_structure_profile failed for handle {handle}: {error}"
                    ));
                    return 0;
                }
            };
            (profile, input_fp)
        }
    };
    let json = serde_json::to_string(&profile_json).unwrap_or_else(|_| "null".to_string());
    let output_fp = data::fingerprint::fnv1a_hex(&json);
    data::provenance::record("structure_profile", serde_json::Value::Null, &input_fp, &output_fp);
    if !data::cache_structure_profile_json(handle, &snapshot_columnar, json.clone()) {
        return 0;
    }
    write_str_out(&json, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_parse_arrow(ptr: u32, len: u32) -> u32 {
    let Some(bytes) = (unsafe { allocator::try_view(ptr, len) }) else {
        return 0;
    };
    match data::parsers::parse_arrow(bytes, "arrow") {
        Ok(dataset) => data::register_dataset(dataset),
        Err(e) => {
            log_error(&format!("data_parse_arrow failed: {}", e));
            0
        }
    }
}

fn parse_string_array(v: &serde_json::Value) -> Vec<String> {
    v.as_array()
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

fn parse_f64_array(v: &serde_json::Value) -> Vec<f64> {
    v.as_array()
        .map(|a| a.iter().filter_map(|x| x.as_f64()).collect())
        .unwrap_or_default()
}

fn parse_usize_array(v: &serde_json::Value) -> Vec<usize> {
    v.as_array()
        .map(|a| a.iter().filter_map(|x| x.as_u64().map(|n| n as usize)).collect())
        .unwrap_or_default()
}

#[wasm_bindgen]
pub fn data_compute_mapper_graph(
    handle: u32,
    params_ptr: u32,
    params_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(params_bytes) = (unsafe { allocator::try_view(params_ptr, params_len) }) else {
        return 0;
    };
    let params: serde_json::Value = match serde_json::from_slice(params_bytes) {
        Ok(v) => v,
        Err(e) => {
            log_error(&format!("data_compute_mapper_graph params: {}", e));
            return 0;
        }
    };
    let feature_columns = parse_string_array(params.get("featureColumns").unwrap_or(&serde_json::Value::Null));
    let filter_values = parse_f64_array(params.get("filterValues").unwrap_or(&serde_json::Value::Null));
    let bins = params.get("bins").and_then(|v| v.as_u64()).unwrap_or(10) as usize;
    let overlap = params.get("overlap").and_then(|v| v.as_f64()).unwrap_or(0.3);
    let fc_refs: Vec<&str> = feature_columns.iter().map(|s| s.as_str()).collect();

    let (graph, input_fp) = match data::with_dataset(handle, |ds| {
        (
            data::topology::compute_mapper_graph(ds, &fc_refs, &filter_values, bins, overlap),
            ds.fingerprint(),
        )
    }) {
        Some(v) => v,
        None => return 0,
    };
    let json = serde_json::to_string(&graph).unwrap_or_else(|_| "{}".to_string());
    let output_fp = data::fingerprint::fnv1a_hex(&json);
    data::provenance::record("compute_mapper_graph", params, &input_fp, &output_fp);
    write_str_out(&json, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_compute_persistence_intervals(
    handle: u32,
    params_ptr: u32,
    params_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(params_bytes) = (unsafe { allocator::try_view(params_ptr, params_len) }) else {
        return 0;
    };
    let params: serde_json::Value = match serde_json::from_slice(params_bytes) {
        Ok(v) => v,
        Err(e) => {
            log_error(&format!("data_compute_persistence_intervals params: {}", e));
            return 0;
        }
    };
    let feature_columns = parse_string_array(params.get("featureColumns").unwrap_or(&serde_json::Value::Null));
    let filter_values = parse_f64_array(params.get("filterValues").unwrap_or(&serde_json::Value::Null));
    let max_distance = params.get("maxDistance").and_then(|v| v.as_f64()).unwrap_or(1.0);
    let fc_refs: Vec<&str> = feature_columns.iter().map(|s| s.as_str()).collect();

    let (intervals, input_fp) = match data::with_dataset(handle, |ds| {
        (
            data::topology::compute_persistence_intervals(ds, &fc_refs, &filter_values, max_distance),
            ds.fingerprint(),
        )
    }) {
        Some(v) => v,
        None => return 0,
    };
    let json = serde_json::to_string(&intervals).unwrap_or_else(|_| "[]".to_string());
    let output_fp = data::fingerprint::fnv1a_hex(&json);
    data::provenance::record("compute_persistence_intervals", params, &input_fp, &output_fp);
    write_str_out(&json, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_compute_betti0_curve(
    handle: u32,
    params_ptr: u32,
    params_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(params_bytes) = (unsafe { allocator::try_view(params_ptr, params_len) }) else {
        return 0;
    };
    let params: serde_json::Value = match serde_json::from_slice(params_bytes) {
        Ok(v) => v,
        Err(e) => {
            log_error(&format!("data_compute_betti0_curve params: {}", e));
            return 0;
        }
    };
    let feature_columns = parse_string_array(params.get("featureColumns").unwrap_or(&serde_json::Value::Null));
    let steps = params.get("steps").and_then(|v| v.as_u64()).unwrap_or(10) as usize;
    let fc_refs: Vec<&str> = feature_columns.iter().map(|s| s.as_str()).collect();

    let (curve, input_fp) = match data::with_dataset(handle, |ds| {
        (
            data::topology::compute_betti0_curve(ds, &fc_refs, steps),
            ds.fingerprint(),
        )
    }) {
        Some(v) => v,
        None => return 0,
    };
    let json = serde_json::to_string(&curve).unwrap_or_else(|_| "[]".to_string());
    let output_fp = data::fingerprint::fnv1a_hex(&json);
    data::provenance::record("compute_betti0_curve", params, &input_fp, &output_fp);
    write_str_out(&json, out_ptr, out_len)
}

#[wasm_bindgen]
pub fn data_compute_radial_tree_3d(
    levels_ptr: u32,
    levels_len: u32,
    ring_spacing: f32,
    y_step: f32,
    y_offset: f32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(level_bytes) = (unsafe { allocator::try_view(levels_ptr, levels_len) }) else {
        return 0;
    };
    let levels_json: serde_json::Value = match serde_json::from_slice(level_bytes) {
        Ok(v) => v,
        Err(_) => return 0,
    };
    let levels = parse_usize_array(&levels_json);
    if levels.is_empty() {
        return 0;
    }
    let positions = layouts::compute_radial_tree_3d(&levels, ring_spacing, y_step, y_offset);
    let needed = positions.len().saturating_mul(12);
    let Ok(needed) = u32::try_from(needed) else {
        return 0;
    };
    if out_ptr == 0 || out_len < needed {
        return needed;
    }
    let Some(slice) = (unsafe { allocator::try_view_mut(out_ptr, needed) }) else {
        return 0;
    };
    let mut offset = 0usize;
    for pos in positions {
        slice[offset..offset + 4].copy_from_slice(&pos[0].to_le_bytes());
        slice[offset + 4..offset + 8].copy_from_slice(&pos[1].to_le_bytes());
        slice[offset + 8..offset + 12].copy_from_slice(&pos[2].to_le_bytes());
        offset += 12;
    }
    needed
}

#[wasm_bindgen]
pub fn data_compute_time_ribbon_3d(
    series_ptr: u32,
    series_len: u32,
    times_ptr: u32,
    times_len: u32,
    values_ptr: u32,
    values_len: u32,
    x_scale: f32,
    y_scale: f32,
    z_spacing: f32,
    y_offset: f32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(series_bytes) = (unsafe { allocator::try_view(series_ptr, series_len) }) else {
        return 0;
    };
    let series_json: serde_json::Value = match serde_json::from_slice(series_bytes) {
        Ok(v) => v,
        Err(_) => return 0,
    };
    let series = parse_usize_array(&series_json);
    if series.is_empty() {
        return 0;
    }

    let Some(times_bytes) = (unsafe { allocator::try_view(times_ptr, times_len) }) else {
        return 0;
    };
    let times_json: serde_json::Value = match serde_json::from_slice(times_bytes) {
        Ok(value) => value,
        Err(_) => return 0,
    };
    let times = parse_f64_array(&times_json);

    let Some(values_bytes) = (unsafe { allocator::try_view(values_ptr, values_len) }) else {
        return 0;
    };
    let values_json: serde_json::Value = match serde_json::from_slice(values_bytes) {
        Ok(value) => value,
        Err(_) => return 0,
    };
    let values = parse_f64_array(&values_json);

    let positions = layouts::compute_time_ribbon_3d(&series, &times, &values, x_scale, y_scale, z_spacing, y_offset);
    let needed = positions.len().saturating_mul(12);
    let Ok(needed) = u32::try_from(needed) else {
        return 0;
    };
    if out_ptr == 0 || out_len < needed {
        return needed;
    }
    let Some(slice) = (unsafe { allocator::try_view_mut(out_ptr, needed) }) else {
        return 0;
    };
    let mut offset = 0usize;
    for pos in positions {
        slice[offset..offset + 4].copy_from_slice(&pos[0].to_le_bytes());
        slice[offset + 4..offset + 8].copy_from_slice(&pos[1].to_le_bytes());
        slice[offset + 8..offset + 12].copy_from_slice(&pos[2].to_le_bytes());
        offset += 12;
    }
    needed
}

#[wasm_bindgen]
pub fn data_compute_geo_surface_3d(
    lons_ptr: u32,
    lons_len: u32,
    lats_ptr: u32,
    lats_len: u32,
    values_ptr: u32,
    values_len: u32,
    room_width: f32,
    room_depth: f32,
    height_scale: f32,
    y_offset: f32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(lons_bytes) = (unsafe { allocator::try_view(lons_ptr, lons_len) }) else {
        return 0;
    };
    let lons_json: serde_json::Value = match serde_json::from_slice(lons_bytes) {
        Ok(v) => v,
        Err(_) => return 0,
    };
    let lons = parse_f64_array(&lons_json);
    if lons.is_empty() {
        return 0;
    }

    let Some(lats_bytes) = (unsafe { allocator::try_view(lats_ptr, lats_len) }) else {
        return 0;
    };
    let lats_json: serde_json::Value = match serde_json::from_slice(lats_bytes) {
        Ok(value) => value,
        Err(_) => return 0,
    };
    let lats = parse_f64_array(&lats_json);

    let Some(values_bytes) = (unsafe { allocator::try_view(values_ptr, values_len) }) else {
        return 0;
    };
    let values_json: serde_json::Value = match serde_json::from_slice(values_bytes) {
        Ok(value) => value,
        Err(_) => return 0,
    };
    let values = parse_f64_array(&values_json);

    let positions = layouts::compute_geo_surface_3d(&lons, &lats, &values, room_width, room_depth, height_scale, y_offset);
    let needed = positions.len().saturating_mul(12);
    let Ok(needed) = u32::try_from(needed) else {
        return 0;
    };
    if out_ptr == 0 || out_len < needed {
        return needed;
    }
    let Some(slice) = (unsafe { allocator::try_view_mut(out_ptr, needed) }) else {
        return 0;
    };
    let mut offset = 0usize;
    for pos in positions {
        slice[offset..offset + 4].copy_from_slice(&pos[0].to_le_bytes());
        slice[offset + 4..offset + 8].copy_from_slice(&pos[1].to_le_bytes());
        slice[offset + 8..offset + 12].copy_from_slice(&pos[2].to_le_bytes());
        offset += 12;
    }
    needed
}

#[wasm_bindgen]
pub fn data_compute_streamline_3d(
    count: u32,
    steps: u32,
    step_size: f32,
    seed: u64,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let lines = layouts::compute_streamlines_3d(
        count as usize,
        steps as usize,
        step_size,
        [-5.0, 0.5, -8.0],
        [5.0, 4.0, -2.0],
        seed,
    );
    let total_points: usize = lines.iter().map(|l| l.len()).sum();
    let needed = total_points.saturating_mul(12);
    let Ok(needed) = u32::try_from(needed) else {
        return 0;
    };
    if out_ptr == 0 || out_len < needed {
        return needed;
    }
    let Some(slice) = (unsafe { allocator::try_view_mut(out_ptr, needed) }) else {
        return 0;
    };
    let mut offset = 0usize;
    for line in lines {
        for pos in line {
            slice[offset..offset + 4].copy_from_slice(&pos[0].to_le_bytes());
            slice[offset + 4..offset + 8].copy_from_slice(&pos[1].to_le_bytes());
            slice[offset + 8..offset + 12].copy_from_slice(&pos[2].to_le_bytes());
            offset += 12;
        }
    }
    needed
}

#[cfg(target_arch = "wasm32")]
fn log_error(msg: &str) {
    use wasm_bindgen::JsValue;
    web_sys::console::error_1(&JsValue::from_str(msg));
}

#[cfg(not(target_arch = "wasm32"))]
fn log_error(msg: &str) {
    eprintln!("{}", msg);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_returns_42() {
        assert_eq!(ping(), 42);
    }

    #[test]
    fn capabilities_returns_phase_1_flags() {
        let caps = capabilities();
        assert!(caps & CAP_DATASET_RUST != 0);
        assert!(caps & CAP_PARSER_RUST != 0);
        assert!(caps & CAP_OPERATIONS_RUST != 0);
        assert!(caps & CAP_TOPOLOGY_RUST != 0, "TOPOLOGY_RUST implemented in Wave 1");
        assert!(caps & CAP_TDA_RUST != 0, "TDA_RUST implemented in Wave 1");
        assert!(caps & CAP_ENCODINGS_RUST != 0, "ENCODINGS_RUST implemented in Wave 1");
        assert!(caps & CAP_STATS_RUST != 0, "STATS_RUST implemented in Phase 5");
        assert!(caps & CAP_SPECTRAL_RUST != 0, "SPECTRAL_RUST implemented in Phase 5");
        assert_eq!(caps & CAP_DRACO_RUST, 0, "DRACO_RUST not yet migrated");
        assert_eq!(caps & CAP_SCENE_RUST, 0, "SCENE_RUST not yet migrated");
        assert_eq!(caps & CAP_COMMAND_BUFFER, 0, "COMMAND_BUFFER is dormant");
        assert_eq!(caps & CAP_INSTANCING, 0, "INSTANCING not yet migrated");
    }

    fn enforce_command_buffer_ordering(caps: u32) -> bool {
        if caps & CAP_COMMAND_BUFFER != 0 {
            caps & CAP_SCENE_RUST != 0
        } else {
            true
        }
    }

    #[test]
    fn command_buffer_requires_scene_rust_invariant() {
        assert!(enforce_command_buffer_ordering(capabilities()));
        assert!(!enforce_command_buffer_ordering(CAP_COMMAND_BUFFER));
        assert!(enforce_command_buffer_ordering(CAP_COMMAND_BUFFER | CAP_SCENE_RUST));
    }

    #[test]
    fn command_buffer_ptr_is_dormant_zero() {
        assert_eq!(command_buffer_ptr(), 0);
    }

    #[test]
    fn alloc_returns_increasing_offsets() {
        let ptr = alloc(16);
        let ptr2 = alloc(8);
        assert!(ptr2 > ptr, "second allocation should be at a higher offset");
        dealloc(ptr2, 8);
        dealloc(ptr, 16);
    }

    #[test]
    fn fill_pattern_writes_modulo_bytes() {
        let len = 16;
        let ptr = alloc(len as u32);
        let written = fill_pattern(ptr, len as u32);
        assert_eq!(written, len as u32);
        let slice = unsafe { allocator::view(ptr, len as u32) };
        for (i, byte) in slice.iter().enumerate() {
            assert_eq!(*byte, (i % 256) as u8);
        }
        dealloc(ptr, len as u32);
    }

    #[test]
    fn data_load_csv_creates_dataset() {
        let csv = b"name,age,city\nAlice,30,NYC\nBob,25,LA\n";
        let (ptr, len) = allocator::copy_bytes(csv);
        let handle = data_load_csv(ptr, len);
        assert!(handle > 0);
        assert_eq!(dataset_row_count(handle), 2);
        assert_eq!(dataset_column_count(handle), 3);
        dataset_destroy(handle);
        dealloc(ptr, len);
    }

    #[test]
    fn data_load_json_creates_dataset() {
        let json = br#"[{"x":1,"y":2},{"x":3,"y":4}]"#;
        let (ptr, len) = allocator::copy_bytes(json);
        let handle = data_load_json(ptr, len);
        assert!(handle > 0);
        assert_eq!(dataset_row_count(handle), 2);
        assert_eq!(dataset_column_count(handle), 2);
        dataset_destroy(handle);
        dealloc(ptr, len);
    }

    #[test]
    fn data_load_sample_creates_dataset() {
        let key = b"supply-chain";
        let (ptr, len) = allocator::copy_bytes(key);
        let handle = data_load_sample(ptr, len);
        assert!(handle > 0);
        assert_eq!(dataset_row_count(handle), 12);
        assert_eq!(dataset_column_count(handle), 5);
        dataset_destroy(handle);
        dealloc(ptr, len);
    }

    #[test]
    fn data_load_sample_returns_zero_for_unknown_key() {
        let key = b"not-a-key";
        let (ptr, len) = allocator::copy_bytes(key);
        let handle = data_load_sample(ptr, len);
        assert_eq!(handle, 0);
        dealloc(ptr, len);
    }

    #[test]
    fn data_sample_keys_writes_list() {
        let required = data_sample_keys(0, 0);
        assert!(required > 0);
        let buf = alloc(required);
        let written = data_sample_keys(buf, required);
        assert_eq!(written, required);
        let slice = unsafe { allocator::view(buf, written) };
        let s = std::str::from_utf8(slice).expect("utf8");
        for key in [
            "supply-chain",
            "fraud-graph",
            "sensor-stream",
            "sales-table",
            "org-chart",
            "wind-field",
            "social-graph",
            "financial-series",
            "geo-cities",
            "flow-process",
        ] {
            assert!(s.contains(key), "missing sample key: {}", key);
        }
        dealloc(buf, required);
    }

    #[test]
    fn data_load_sample_financial_series_has_rows() {
        let key = b"financial-series";
        let (ptr, len) = allocator::copy_bytes(key);
        let handle = data_load_sample(ptr, len);
        assert!(handle > 0);
        assert_eq!(dataset_row_count(handle), 48);
        assert_eq!(dataset_column_count(handle), 7);
        dataset_destroy(handle);
        dealloc(ptr, len);
    }

    #[test]
    fn columnar_structure_profile_abi_is_row_free() {
        let columns = vec![
            data::column::Column::new("x", data::column::ColumnType::Numeric),
            data::column::Column::new("cohort", data::column::ColumnType::Categorical),
        ];
        let columnar = data::columnar::ColumnarDataset::from_parts(
            4,
            std::collections::HashMap::from([(
                0,
                data::columnar::PrimitiveColumn {
                    values: vec![1.0, 2.0, 3.0, 4.0],
                    validity: vec![1, 1, 1, 1],
                },
            )]),
            std::collections::HashMap::from([(
                1,
                data::columnar::CategoricalColumn {
                    dictionary: vec!["A".to_string(), "B".to_string()],
                    codes: vec![0, 1, 0, 1],
                    validity: vec![1, 1, 1, 1],
                },
            )]),
        )
        .expect("valid columnar dataset");
        let handle = data::register_columnar_dataset("row-free".to_string(), columns, columnar);
        let materialisations_before = data::row_materialisation_count();

        let required = data_compute_structure_profile(handle, 0, 0);
        assert!(required > 0);
        assert!(data::cached_structure_profile_json(handle).is_some());
        let out = alloc(required);
        assert_eq!(data_compute_structure_profile(handle, out, required), required);
        let profile: serde_json::Value = serde_json::from_slice(unsafe {
            allocator::view(out, required)
        })
        .expect("profile JSON");

        assert_eq!(profile["rowCount"], 4);
        assert_eq!(profile["columnCount"], 2);
        assert_eq!(profile["categorical"]["summaries"][0]["cardinality"], 2);
        assert_eq!(data::row_materialisation_count(), materialisations_before);
        dealloc(out, required);
        dataset_destroy(handle);
    }

    #[test]
    fn typed_fingerprint_uses_the_output_buffer_abi() {
        let columns = vec![data::column::Column::new(
            "x",
            data::column::ColumnType::Numeric,
        )];
        let columnar = data::columnar::ColumnarDataset::from_parts(
            2,
            std::collections::HashMap::from([(
                0,
                data::columnar::PrimitiveColumn {
                    values: vec![1.0, 2.0],
                    validity: vec![1, 1],
                },
            )]),
            std::collections::HashMap::new(),
        )
        .expect("valid columnar dataset");
        let handle = data::register_columnar_dataset("typed-fingerprint".to_string(), columns, columnar);

        let required = data_typed_dataset_fingerprint(handle, 0, 0);
        assert_eq!(required, 64);
        let out = alloc(required);
        assert_eq!(data_typed_dataset_fingerprint(handle, out, required), required);
        let fingerprint = std::str::from_utf8(unsafe { allocator::view(out, required) })
            .expect("fingerprint utf8");
        assert!(fingerprint.bytes().all(|byte| byte.is_ascii_hexdigit()));

        dealloc(out, required);
        dataset_destroy(handle);
    }

    #[test]
    fn dataset_to_json_round_trips() {
        let key = b"fraud-graph";
        let (key_ptr, key_len) = allocator::copy_bytes(key);
        let handle = data_load_sample(key_ptr, key_len);
        assert!(handle > 0);

        let required = dataset_to_json(handle, 0, 0);
        assert!(required > 0);
        let buf = alloc(required);
        let written = dataset_to_json(handle, buf, required);
        assert_eq!(written, required);

        let slice = unsafe { allocator::view(buf, written) };
        let json = std::str::from_utf8(slice).expect("utf8");
        assert!(json.contains("\"name\":\"Transaction Fraud Graph\""));
        assert!(json.contains("\"edges\""));

        dealloc(buf, required);
        dataset_destroy(handle);
        dealloc(key_ptr, key_len);
    }

    #[test]
    fn data_operation_sorts_dataset() {
        let key = b"sensor-stream";
        let (ptr, len) = allocator::copy_bytes(key);
        let handle = data_load_sample(ptr, len);
        assert!(handle > 0);

        let op = b"{\"op\":\"sort\",\"column\":\"temperature\"}";
        let (op_ptr, op_len) = allocator::copy_bytes(op);
        let result = data_operation(handle, op_ptr, op_len);
        assert!(result > 0);
        assert_eq!(dataset_row_count(result), dataset_row_count(handle));

        dealloc(op_ptr, op_len);
        dataset_destroy(handle);
        dataset_destroy(result);
        dealloc(ptr, len);
    }

    #[test]
    fn data_load_dataset_json_round_trips() {
        let key = b"fraud-graph";
        let (key_ptr, key_len) = allocator::copy_bytes(key);
        let handle = data_load_sample(key_ptr, key_len);
        assert!(handle > 0);

        let required = dataset_to_json(handle, 0, 0);
        let buf = alloc(required);
        let written = dataset_to_json(handle, buf, required);
        assert_eq!(written, required);

        let json_bytes = unsafe { allocator::view(buf, written) };
        let (json_ptr, json_len) = allocator::copy_bytes(json_bytes);
        let handle2 = data_load_dataset_json(json_ptr, json_len);
        assert!(handle2 > 0);
        assert_eq!(dataset_row_count(handle2), dataset_row_count(handle));
        assert_eq!(dataset_column_count(handle2), dataset_column_count(handle));

        dealloc(buf, required);
        dealloc(json_ptr, json_len);
        dataset_destroy(handle);
        dataset_destroy(handle2);
    }
}

// ─── Draco Constraint Solver ABI ────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn draco_solve(
    facts_ptr: u32,
    facts_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(facts_bytes) = (unsafe { allocator::try_view(facts_ptr, facts_len) }) else {
        return 0;
    };
    let facts: draco::types::DracoFacts = match serde_json::from_slice(facts_bytes) {
        Ok(f) => f,
        Err(_) => return 0,
    };
    let result = match draco::solver::solve_draco(facts) {
        Some(r) => r,
        None => return 0,
    };
    let json = match serde_json::to_vec(&result) {
        Ok(j) => j,
        Err(_) => return 0,
    };
    write_bytes_out(&json, out_ptr, out_len)
}

#[no_mangle]
pub extern "C" fn draco_evaluate_candidate(
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(bytes) = (unsafe { allocator::try_view(input_ptr, input_len) }) else {
        return 0;
    };
    #[derive(serde::Deserialize)]
    struct Input {
        facts: draco::types::DracoFacts,
        spec: draco::types::DracoSpec,
    }
    let input: Input = match serde_json::from_slice(bytes) {
        Ok(i) => i,
        Err(_) => return 0,
    };
    let (valid, cost, violations) = draco::solver::evaluate_candidate(&input.facts, &input.spec);
    let output = serde_json::json!({
        "valid": valid,
        "cost": cost,
        "violations": violations,
    });
    let json = serde_json::to_vec(&output).unwrap_or_default();
    write_bytes_out(&json, out_ptr, out_len)
}

#[no_mangle]
pub extern "C" fn draco_adjust_evidence(
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(bytes) = (unsafe { allocator::try_view(input_ptr, input_len) }) else {
        return 0;
    };
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Input {
        base_cost: f64,
        evidence: Option<draco::evidence::EmpiricalUtilityEvidence>,
    }
    let input: Input = match serde_json::from_slice(bytes) {
        Ok(i) => i,
        Err(_) => return 0,
    };
    let (adjusted, delta) = draco::evidence::adjust_candidate_cost_with_evidence(
        input.base_cost,
        input.evidence.as_ref(),
    );
    let output = serde_json::json!({
        "adjustedCost": adjusted,
        "delta": delta,
    });
    let json = serde_json::to_vec(&output).unwrap_or_default();
    write_bytes_out(&json, out_ptr, out_len)
}

// ─── Intent Compiler ABI ────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn intent_compile(
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(bytes) = (unsafe { allocator::try_view(input_ptr, input_len) }) else {
        return 0;
    };
    #[derive(serde::Deserialize)]
    struct Input {
        query: String,
        schema: intent::compiler::DatasetSchema,
    }
    let input: Input = match serde_json::from_slice(bytes) {
        Ok(i) => i,
        Err(_) => return 0,
    };
    let result = intent::compiler::compile_intent(&input.query, &input.schema);
    let json = serde_json::to_vec(&result).unwrap_or_default();
    write_bytes_out(&json, out_ptr, out_len)
}

// ─── Structure Discovery ABI ────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn atlas_discover_structures(
    input_ptr: u32,
    input_len: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let Some(bytes) = (unsafe { allocator::try_view(input_ptr, input_len) }) else {
        return 0;
    };
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Input {
        assignments: Vec<i32>,
        datum_ids: Vec<String>,
        fingerprint: String,
        version: u32,
        algorithm_version: String,
        parameters: serde_json::Value,
    }
    let input: Input = match serde_json::from_slice(bytes) {
        Ok(i) => i,
        Err(_) => return 0,
    };
    let result = data::structure_discovery::map_cluster_structures(
        &input.assignments,
        &input.datum_ids,
        &input.fingerprint,
        input.version,
        &input.algorithm_version,
        &input.parameters,
    );
    let json = serde_json::to_vec(&result).unwrap_or_default();
    write_bytes_out(&json, out_ptr, out_len)
}
