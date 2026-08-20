pub mod column;
pub mod dataset;
pub mod encodings;
pub mod fingerprint;
pub mod operations;
pub mod operations_bridge;
pub mod parsers;
pub mod profile;
pub mod provenance;
pub mod spectral;
pub mod statistics;
pub mod structure_discovery;
pub mod synthetic;
pub mod topology;
pub mod value;

pub use dataset::{Dataset, Edge};

use std::sync::Mutex;

/// Global dataset handle registry.
///
/// Handles are 1-indexed `u32` values; `0` is reserved for "invalid".
/// A deleted slot is left as `None` so re-use is safe for stale JS references.
static DATASET_REGISTRY: Mutex<DatasetRegistry> = Mutex::new(DatasetRegistry::new());

pub struct DatasetRegistry {
    slots: Vec<Option<Dataset>>,
    free: Vec<u32>,
}

impl DatasetRegistry {
    pub const fn new() -> Self {
        Self {
            slots: Vec::new(),
            free: Vec::new(),
        }
    }

    pub fn insert(&mut self, dataset: Dataset) -> u32 {
        if let Some(handle) = self.free.pop() {
            let idx = (handle - 1) as usize;
            self.slots[idx] = Some(dataset);
            return handle;
        }
        let handle = self.slots.len() as u32 + 1;
        self.slots.push(Some(dataset));
        handle
    }

    pub fn get(&self, handle: u32) -> Option<&Dataset> {
        let idx = (handle.wrapping_sub(1)) as usize;
        self.slots.get(idx).and_then(|s| s.as_ref())
    }

    pub fn get_mut(&mut self, handle: u32) -> Option<&mut Dataset> {
        let idx = (handle.wrapping_sub(1)) as usize;
        self.slots.get_mut(idx).and_then(|s| s.as_mut())
    }

    pub fn remove(&mut self, handle: u32) {
        let idx = (handle.wrapping_sub(1)) as usize;
        if let Some(slot) = self.slots.get_mut(idx) {
            if slot.is_some() {
                *slot = None;
                self.free.push(handle);
            }
        }
    }
}

/// Insert a dataset into the global registry and return a handle.
pub fn register_dataset(dataset: Dataset) -> u32 {
    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    reg.insert(dataset)
}

/// Look up a dataset by handle.
pub fn with_dataset<T>(handle: u32, f: impl FnOnce(&Dataset) -> T) -> Option<T> {
    let reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    reg.get(handle).map(f)
}

/// Mutably access a dataset by handle.
pub fn with_dataset_mut<T>(handle: u32, f: impl FnOnce(&mut Dataset) -> T) -> Option<T> {
    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    reg.get_mut(handle).map(f)
}

/// Release a dataset handle.
pub fn destroy_dataset(handle: u32) {
    let mut reg = DATASET_REGISTRY.lock().expect("dataset registry poisoned");
    reg.remove(handle);
}
