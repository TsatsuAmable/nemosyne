use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{LazyLock, Mutex};
use wasm_bindgen::prelude::*;

const MAX_RESULTS: usize = 4;
const MAX_RESULT_BYTES: usize = crate::MAX_MEMORY_PAGES as usize * 65536;
static COMPUTATIONS: [AtomicU32; 12] = [const { AtomicU32::new(0) }; 12];
pub const STATISTICS: usize = 3;
pub const DATASET_JSON: usize = 4;
pub const AGGREGATE: usize = 5;
pub const DISTRIBUTION: usize = 6;
pub const DENSITY: usize = 7;
pub const CLUSTER: usize = 8;
pub const GRAPH: usize = 9;
pub const SEMANTIC_DETAIL: usize = 10;
pub const SPECTRAL_FACTS: usize = 11;

pub fn record_computation(operation: usize) {
    COMPUTATIONS[operation].fetch_add(1, Ordering::Relaxed);
}

#[wasm_bindgen]
pub fn tda_computation_count(operation: u32) -> u32 {
    if operation >= 3 {
        return 0;
    }
    prepared_computation_count(operation)
}

#[wasm_bindgen]
pub fn prepared_computation_count(operation: u32) -> u32 {
    COMPUTATIONS
        .get(operation as usize)
        .map(|count| count.load(Ordering::Relaxed))
        .unwrap_or(0)
}

struct Entry {
    dataset: u32,
    bytes: Option<Box<[u8]>>,
}

struct Registry {
    entries: HashMap<u32, Entry>,
    next: u32,
}

impl Registry {
    fn can_retain(&self, size: usize) -> bool {
        let retained: usize = self
            .entries
            .values()
            .filter_map(|entry| entry.bytes.as_ref())
            .map(|bytes| bytes.len())
            .sum();
        size <= MAX_RESULT_BYTES.saturating_sub(retained)
    }
    fn reserve(&mut self, dataset: u32) -> Option<u32> {
        if self.entries.len() >= MAX_RESULTS || self.next >= (1 << 20) - 1 {
            return None;
        }
        let token = 0x8000_0000 | (dataset & 0x7ff0_0000) | self.next;
        self.next += 1;
        self.entries.insert(
            token,
            Entry {
                dataset,
                bytes: None,
            },
        );
        Some(token)
    }
}

static REGISTRY: LazyLock<Mutex<Registry>> = LazyLock::new(|| {
    Mutex::new(Registry {
        entries: HashMap::new(),
        next: 1,
    })
});

struct Reservation(u32);

impl Drop for Reservation {
    fn drop(&mut self) {
        prepared_result_destroy(self.0);
    }
}

pub fn prepare(dataset: u32, compute: impl FnOnce() -> Option<String>) -> u32 {
    if crate::data::with_columnar_dataset(dataset, |_| ()).is_none() {
        return 0;
    }
    prepare_response(dataset, compute)
}

// Detail queries own a response even when the dataset is stale: Rust must
// serialize its structured refusal, rather than turning it into ABI null.
// The owner id is only a cleanup key, never authority to access a dataset.
pub(crate) fn prepare_response(dataset: u32, compute: impl FnOnce() -> Option<String>) -> u32 {
    let token = match REGISTRY.lock().expect("prepared results").reserve(dataset) {
        Some(token) => token,
        None => return u32::MAX,
    };
    let reservation = Reservation(token);
    let Some(result) = compute() else { return 0 };
    if result.is_empty() {
        return 0;
    }
    {
        let mut registry = REGISTRY.lock().expect("prepared results");
        if !registry.can_retain(result.len()) {
            return u32::MAX;
        }
        let Some(entry) = registry.entries.get_mut(&token) else {
            return 0;
        };
        entry.bytes = Some(result.into_bytes().into_boxed_slice());
    }
    std::mem::forget(reservation);
    token
}

pub fn release_dataset(dataset: u32) {
    REGISTRY
        .lock()
        .expect("prepared results")
        .entries
        .retain(|_, e| e.dataset != dataset);
}

pub fn clear() {
    REGISTRY.lock().expect("prepared results").entries.clear();
}

#[wasm_bindgen]
pub fn prepared_result_read(token: u32, out_ptr: u32, out_len: u32) -> u32 {
    let registry = REGISTRY.lock().expect("prepared results");
    registry
        .entries
        .get(&token)
        .and_then(|entry| entry.bytes.as_ref())
        .map(|bytes| crate::write_bytes_out(bytes, out_ptr, out_len))
        .unwrap_or(0)
}

#[wasm_bindgen]
pub fn prepared_result_destroy(token: u32) {
    REGISTRY
        .lock()
        .expect("prepared results")
        .entries
        .remove(&token);
}

#[wasm_bindgen]
pub fn prepared_result_count() -> u32 {
    REGISTRY.lock().expect("prepared results").entries.len() as u32
}

#[wasm_bindgen]
pub fn prepared_result_bytes() -> u32 {
    REGISTRY
        .lock()
        .expect("prepared results")
        .entries
        .values()
        .filter_map(|entry| entry.bytes.as_ref())
        .map(|bytes| bytes.len() as u32)
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn failed_or_oversized_computation_releases_its_reservation() {
        let dataset =
            crate::data::register_dataset(crate::data::Dataset::new("prepared", vec![], vec![]));
        assert_eq!(prepare(dataset, || None), 0);
        assert_eq!(prepared_result_count(), 0);
        assert!(!REGISTRY.lock().unwrap().can_retain(MAX_RESULT_BYTES + 1));
        assert_eq!(prepared_result_count(), 0);
        assert_eq!(prepared_result_bytes(), 0);
        let token = prepare(dataset, || Some("[]".into()));
        assert_ne!(token, 0);
        prepared_result_destroy(token);
        crate::data::destroy_dataset(dataset);
    }

    #[test]
    fn admission_is_bounded_and_tokens_are_not_reused() {
        let mut registry = Registry {
            entries: HashMap::new(),
            next: 1,
        };
        let first = registry.reserve(1 << 20).unwrap();
        for _ in 1..MAX_RESULTS {
            assert!(registry.reserve(1 << 20).is_some());
        }
        assert!(registry.reserve(1 << 20).is_none());
        registry.entries.clear();
        assert_ne!(registry.reserve(1 << 20).unwrap(), first);
        registry.next = 1 << 20;
        assert!(registry.reserve(1 << 20).is_none());
    }
}
