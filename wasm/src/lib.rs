use wasm_bindgen::prelude::*;

/// Shared memory constants. The WASM module starts at 128 MiB and is allowed
/// to grow to 512 MiB. These match the JS host's expectations.
pub const INITIAL_MEMORY_PAGES: u32 = 2048; // 128 MiB
pub const MAX_MEMORY_PAGES: u32 = 8192; // 512 MiB

/// A simple bump allocator for Phase 0. It is replaced by the two-tier arena +
/// heap design in Phase 1, but it is enough to prove the build loop and ABI.
static mut BUMP: usize = 0;

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
    // Reset the bump allocator to the end of the static data section.
    // `memory_grow(0)` returns the current size in pages; multiply by page size.
    let current_pages = unsafe { core::arch::wasm32::memory_grow(0, 0) };
    let base = (current_pages * 65536) as usize;
    unsafe {
        BUMP = base;
    }
    1
}

/// Return a reference to the WASM memory buffer so the JS host can create
/// typed-array views directly.
#[wasm_bindgen]
pub fn memory() -> JsValue {
    wasm_bindgen::memory()
}

/// Allocate `len` bytes from the bump arena.
///
/// Returns the byte offset in WASM memory. The JS host must later call
/// `dealloc(ptr, len)` to release the region back to the arena.
///
/// # Safety
/// `len` must be > 0. The returned pointer is 8-byte aligned.
#[wasm_bindgen]
pub fn alloc(len: u32) -> u32 {
    let len = len as usize;
    if len == 0 {
        return 0;
    }

    unsafe {
        // Keep 8-byte alignment for future SIMD-friendly layouts.
        let aligned_len = (len + 7) & !7;
        let ptr = BUMP;
        let end = ptr + aligned_len;
        let max = (MAX_MEMORY_PAGES as usize) * 65536;
        if end > max {
            panic!("allocator out of memory");
        }

        // Grow memory if needed. memory_grow(0, delta) returns previous pages.
        let current_pages = core::arch::wasm32::memory_grow(0, 0);
        let current_bytes = current_pages * 65536;
        if end > current_bytes as usize {
            let needed_pages = ((end - 1) / 65536 + 1) as usize;
            let delta = needed_pages.saturating_sub(current_pages as usize);
            let max_delta = (MAX_MEMORY_PAGES - current_pages as u32) as usize;
            if delta > max_delta {
                panic!("allocator cannot grow memory further");
            }
            core::arch::wasm32::memory_grow(0, delta as i32);
        }

        BUMP = end;
        ptr as u32
    }
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
    unsafe {
        let aligned_len = ((len as usize) + 7) & !7;
        if (BUMP - aligned_len) == (ptr as usize) {
            BUMP -= aligned_len;
        }
    }
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
    let slice = unsafe { core::slice::from_raw_parts_mut(ptr as *mut u8, len as usize) };
    for (i, byte) in slice.iter_mut().enumerate() {
        *byte = (i % 256) as u8;
    }
    len
}

/// Return the current command-buffer pointer. For Phase 0 this always returns
/// a sentinel `0` because no command encoder exists yet. The JS host uses this
/// to confirm the export exists and the ABI is stable.
#[wasm_bindgen]
pub fn command_buffer_ptr() -> u32 {
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_returns_42() {
        assert_eq!(ping(), 42);
    }

    #[test]
    fn alloc_returns_non_zero_and_bump_increases() {
        let ptr = alloc(16);
        assert!(ptr > 0);
        let ptr2 = alloc(8);
        assert!(ptr2 > ptr);
        dealloc(ptr2, 8);
        dealloc(ptr, 16);
    }

    #[test]
    fn fill_pattern_writes_modulo_bytes() {
        let len = 16;
        let ptr = alloc(len as u32);
        let written = fill_pattern(ptr, len as u32);
        assert_eq!(written, len as u32);
        let slice = unsafe { core::slice::from_raw_parts(ptr as *const u8, len) };
        for (i, byte) in slice.iter().enumerate() {
            assert_eq!(*byte, (i % 256) as u8);
        }
        dealloc(ptr, len as u32);
    }
}
