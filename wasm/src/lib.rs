use wasm_bindgen::prelude::*;

pub mod command_buffer;
mod data;
pub mod layouts;

/// Shared memory constants. The WASM module starts at 128 MiB and is allowed
/// to grow to 512 MiB. These match the JS host's expectations.
pub const INITIAL_MEMORY_PAGES: u32 = 2048; // 128 MiB
pub const MAX_MEMORY_PAGES: u32 = 8192; // 512 MiB

/// Target-specific allocation helpers.
///
/// On `wasm32` this is a bump allocator over the shared WebAssembly memory,
/// using `core::arch::wasm32::memory_grow` to expand the heap. This is the
/// production implementation used by the JS host.
///
/// On the host (x86_64, etc.) this falls back to the system allocator so that
/// `cargo test` can exercise the same public API and pure-Rust logic without
/// requiring a WASM test runner in Phase 0.
mod allocator {
    #[cfg(target_arch = "wasm32")]
    pub use wasm::*;

    #[cfg(not(target_arch = "wasm32"))]
    pub use host::*;

    #[cfg(target_arch = "wasm32")]
    mod wasm {
        use crate::{INITIAL_MEMORY_PAGES, MAX_MEMORY_PAGES};

        static mut BUMP: usize = 0;

        pub fn reset() {
            let current_pages = unsafe { core::arch::wasm32::memory_grow(0, 0) };
            let base = (current_pages * 65536) as usize;
            unsafe { BUMP = base; }
        }

        pub fn alloc(len: u32) -> u32 {
            let len = len as usize;
            if len == 0 {
                return 0;
            }

            unsafe {
                let aligned_len = (len + 7) & !7;
                let ptr = BUMP;
                let end = ptr + aligned_len;
                let max = (MAX_MEMORY_PAGES as usize) * 65536;
                if end > max {
                    panic!("allocator out of memory");
                }

                let current_pages = core::arch::wasm32::memory_grow(0, 0);
                let current_bytes = current_pages * 65536;
                if end > current_bytes as usize {
                    let needed_pages = ((end - 1) / 65536 + 1) as usize;
                    let delta = needed_pages.saturating_sub(current_pages as usize);
                    let max_delta = (MAX_MEMORY_PAGES - current_pages as u32) as usize;
                    if delta > max_delta {
                        panic!("allocator cannot grow memory further");
                    }
                    core::arch::wasm32::memory_grow(0, delta as usize);
                }

                BUMP = end;
                ptr as u32
            }
        }

        pub fn dealloc(ptr: u32, len: u32) {
            unsafe {
                let aligned_len = ((len as usize) + 7) & !7;
                if (BUMP - aligned_len) == (ptr as usize) {
                    BUMP -= aligned_len;
                }
            }
        }

        /// View `len` bytes starting at `ptr` as a shared WASM memory slice.
        pub unsafe fn view<'a>(ptr: u32, len: u32) -> &'a [u8] {
            core::slice::from_raw_parts(ptr as *const u8, len as usize)
        }

        /// Mutable view into shared WASM memory.
        pub unsafe fn view_mut<'a>(ptr: u32, len: u32) -> &'a mut [u8] {
            core::slice::from_raw_parts_mut(ptr as *mut u8, len as usize)
        }

        /// Allocate and copy `src` into WASM memory. Returns `(ptr, len)`.
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
                if (self.bump - aligned_len) == (ptr as usize) {
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

        /// View `len` bytes starting at `ptr` as a slice into the host buffer.
        pub unsafe fn view<'a>(ptr: u32, len: u32) -> &'a [u8] {
            let base = HOST_MEMORY.lock().expect("host memory lock").buffer.as_ptr();
            core::slice::from_raw_parts(base.add(ptr as usize), len as usize)
        }

        /// Mutable view into the host buffer.
        pub unsafe fn view_mut<'a>(ptr: u32, len: u32) -> &'a mut [u8] {
            let base = HOST_MEMORY.lock().expect("host memory lock").buffer.as_mut_ptr();
            core::slice::from_raw_parts_mut(base.add(ptr as usize), len as usize)
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

/// Initialise the runtime and the WASM memory layout.
///
/// Returns a runtime handle. For Phase 0 this is always `1` because only one
/// runtime instance is supported per module. Future phases will return a real
/// generation-indexed handle.
///
/// # Safety
/// Must be called once before any other exported function.
#[wasm_bindgen]
pub fn init(_seed: u64) -> u32 {
    allocator::reset();
    1
}

// wasm-bindgen automatically exports `memory` on the module instance.

/// Allocate `len` bytes from the bump arena.
///
/// Returns the byte offset in WASM memory. The JS host must later call
/// `dealloc(ptr, len)` to release the region back to the arena.
///
/// # Safety
/// `len` must be > 0. The returned pointer is 8-byte aligned.
#[wasm_bindgen]
pub fn alloc(len: u32) -> u32 {
    allocator::alloc(len)
}

/// Release a previous `alloc` allocation back to the bump arena.
///
/// # Safety
/// `ptr` and `len` must match a previous successful call to `alloc` and the
/// caller must not use the memory afterwards. For Phase 0 this resets the
/// bump pointer if this allocation was the most recent one; otherwise it is a
/// no-op. Later phases replace this with a real heap allocator.
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

/// Write a test pattern into the allocation so the JS host can verify
/// zero-copy reads. Returns the number of bytes written.
///
/// # Safety
/// `ptr` must point to a region of at least `len` bytes that the JS host owns.
#[wasm_bindgen]
pub fn fill_pattern(ptr: u32, len: u32) -> u32 {
    let slice = unsafe { allocator::view_mut(ptr, len) };
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
// Reserved (defined for the invariant; NOT advertised until implemented):
const CAP_DRACO_RUST: u32 = 1 << 3; // reserved — only the layout generators are in
//   Rust so far (wasm/src/layouts/); the constraint solver + TDA remain JS, so
//   the Draco subsystem is not yet migrated. Phase 3.
const CAP_SCENE_RUST: u32 = 1 << 4; // reserved — scene graph still JS. Phase 2.
const CAP_INPUT_RUST: u32 = 1 << 5; // reserved — input still JS. Phase 4.
const CAP_NETWORK_RUST: u32 = 1 << 6; // reserved. Phase 5.
const CAP_COMMAND_BUFFER: u32 = 1 << 7; // reserved — dormant stub; enabled once
//   `SCENE_RUST` is set (ordering invariant). Phase 2.
const CAP_INSTANCING: u32 = 1 << 8; // reserved. Phase 2.
const CAP_WASM_TELEMETRY: u32 = 1 << 9; // reserved. Phase 6.

/// Return the enabled capability set for the current build — the spec Phase-1
/// set only (`DATASET_RUST | PARSER_RUST | OPERATIONS_RUST`). Higher bits are
/// reserved until their subsystem is genuinely migrated; see the constants
/// above. JS (`World`, `FileLoader`, `DataOperationController`) gates only on the
/// three advertised bits.
#[wasm_bindgen]
pub fn capabilities() -> u32 {
    CAP_DATASET_RUST | CAP_PARSER_RUST | CAP_OPERATIONS_RUST
}

/// Compute 3D grid layout positions in WASM memory.
/// Writes `count * 3` floats into `out_ptr`.
#[wasm_bindgen]
pub fn layout_grid_3d(count: u32, spacing: f32, y_offset: f32, out_ptr: u32) -> u32 {
    let positions = layouts::compute_grid_3d(count as usize, spacing, y_offset);
    let mut offset = out_ptr as usize;
    let slice = unsafe { allocator::view_mut(out_ptr, count * 12) };
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
    count * 12
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
    let slice = unsafe { allocator::view_mut(out_ptr, count * 12) };
    let mut offset = 0;
    for pos in positions {
        slice[offset..offset + 4].copy_from_slice(&pos[0].to_le_bytes());
        slice[offset + 4..offset + 8].copy_from_slice(&pos[1].to_le_bytes());
        slice[offset + 8..offset + 12].copy_from_slice(&pos[2].to_le_bytes());
        offset += 12;
    }
    count * 12
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
    let bytes = unsafe { allocator::view(ptr, len) };
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
    let bytes = unsafe { allocator::view(ptr, len) };
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

/// Serialize a dataset to a JS-compatible JSON string.
///
/// Call with `out_len == 0` to get the required byte length, allocate that
/// many bytes, then call again to write the JSON. Returns the number of bytes
/// written (or required).
#[wasm_bindgen]
pub fn dataset_to_json(handle: u32, out_ptr: u32, out_len: u32) -> u32 {
    data::with_dataset(handle, |ds| {
        let json = ds.to_js_json();
        let bytes = json.as_bytes();
        if out_len == 0 {
            return bytes.len() as u32;
        }
        let write_len = std::cmp::min(bytes.len(), out_len as usize);
        let slice = unsafe { allocator::view_mut(out_ptr, write_len as u32) };
        slice.copy_from_slice(&bytes[..write_len]);
        write_len as u32
    })
    .unwrap_or(0)
}

/// Load a JS `Dataset.toJSON()` object back into the Rust data layer and
/// return a dataset handle. Returns `0` if the JSON is invalid.
#[wasm_bindgen]
pub fn data_load_dataset_json(ptr: u32, len: u32) -> u32 {
    let bytes = unsafe { allocator::view(ptr, len) };
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
///
/// `op_ptr` / `op_len` point to a UTF-8 JSON object with a top-level `op`
/// field. See `data::operations_bridge::Operation` for supported shapes.
/// Returns `0` on parse or execution failure.
#[wasm_bindgen]
pub fn data_operation(handle: u32, op_ptr: u32, op_len: u32) -> u32 {
    let op_bytes = unsafe { allocator::view(op_ptr, op_len) };
    let op_json = match std::str::from_utf8(op_bytes) {
        Ok(s) => s,
        Err(_) => return 0,
    };
    let op: data::operations_bridge::Operation = match serde_json::from_str(op_json) {
        Ok(o) => o,
        Err(e) => {
            log_error(&format!("data_operation parse failed: {}", e));
            return 0;
        }
    };
    // Apply the operation inside the registry lock, then release the lock and only
    // then register the result. Calling `register_dataset` from inside the
    // `with_dataset` closure would re-enter the same `DATASET_REGISTRY` Mutex,
    // which is non-reentrant and would deadlock.
    let result = data::with_dataset(handle, |ds| data::operations_bridge::apply(ds, op));
    match result {
        Some(Ok(new_dataset)) => data::register_dataset(new_dataset),
        Some(Err(e)) => {
            log_error(&format!("data_operation failed: {}", e));
            0
        }
        None => 0,
    }
}

/// Load a built-in sample dataset by key and return a dataset handle.
/// Returns `0` if the key is unknown.
#[wasm_bindgen]
pub fn data_load_sample(key_ptr: u32, key_len: u32) -> u32 {
    let key_bytes = unsafe { allocator::view(key_ptr, key_len) };
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

/// Write the comma-separated list of available sample keys into `out_ptr`.
/// The host must `alloc` at least 256 bytes. Returns the number of bytes written.
#[wasm_bindgen]
pub fn data_sample_keys(out_ptr: u32, out_len: u32) -> u32 {
    let keys = "supply-chain,fraud-graph,sensor-stream,sales-table,org-chart,wind-field,social-graph,financial-series,geo-cities,flow-process";
    let bytes = keys.as_bytes();
    let write_len = std::cmp::min(bytes.len(), out_len as usize);
    let slice = unsafe { allocator::view_mut(out_ptr, write_len as u32) };
    slice.copy_from_slice(&bytes[..write_len]);
    write_len as u32
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
        // Phase-1 implemented subsystems are advertised.
        assert!(caps & CAP_DATASET_RUST != 0);
        assert!(caps & CAP_PARSER_RUST != 0);
        assert!(caps & CAP_OPERATIONS_RUST != 0);
        // Honesty lock: reserved / unimplemented bits are NOT advertised. This
        // catches a future regression that re-adds a premature or false claim.
        assert_eq!(caps & CAP_DRACO_RUST, 0, "DRACO_RUST not yet migrated");
        assert_eq!(caps & CAP_SCENE_RUST, 0, "SCENE_RUST not yet migrated");
        assert_eq!(caps & CAP_COMMAND_BUFFER, 0, "COMMAND_BUFFER is dormant");
        assert_eq!(caps & CAP_INSTANCING, 0, "INSTANCING not yet migrated");
    }

    /// The spec ordering invariant: `COMMAND_BUFFER` must not be advertised
    /// unless `SCENE_RUST` is also set (plan.md §751: "enabled once Scene is
    /// Rust"). Encoded here so a future PR that enables `COMMAND_BUFFER`
    /// without `SCENE_RUST` fails CI.
    fn enforce_command_buffer_ordering(caps: u32) -> bool {
        if caps & CAP_COMMAND_BUFFER != 0 {
            caps & CAP_SCENE_RUST != 0
        } else {
            true
        }
    }

    #[test]
    fn command_buffer_requires_scene_rust_invariant() {
        // The real advertised set satisfies the invariant (COMMAND_BUFFER is off).
        assert!(enforce_command_buffer_ordering(capabilities()));
        // A synthetic set with COMMAND_BUFFER but no SCENE_RUST violates it.
        assert!(!enforce_command_buffer_ordering(CAP_COMMAND_BUFFER));
        // COMMAND_BUFFER together with SCENE_RUST satisfies it.
        assert!(enforce_command_buffer_ordering(
            CAP_COMMAND_BUFFER | CAP_SCENE_RUST
        ));
    }

    #[test]
    fn command_buffer_ptr_is_dormant_zero() {
        // The command buffer is dormant: command_buffer_ptr() returns the 0
        // sentinel, not a Vec heap pointer. See command_buffer_ptr doc comment.
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
        let buf_len = 256;
        let buf = alloc(buf_len);
        let written = data_sample_keys(buf, buf_len);
        assert!(written > 0);
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
        dealloc(buf, buf_len);
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
