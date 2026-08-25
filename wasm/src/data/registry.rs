use std::sync::Arc;

use super::column::Column;
use super::columnar::ColumnarDataset;
use super::dataset::Dataset;

const HANDLE_INDEX_BITS: u32 = 20;
const HANDLE_GENERATION_BITS: u32 = 11;
const HANDLE_INDEX_MASK: u32 = (1 << HANDLE_INDEX_BITS) - 1;
const HANDLE_MAX_GENERATION: u32 = (1 << HANDLE_GENERATION_BITS) - 1;
const HANDLE_RESERVED_MASK: u32 = 1 << 31;
const MAX_DATASET_SLOTS: usize = HANDLE_INDEX_MASK as usize;

pub(super) struct RegisteredDataset {
    pub(super) dataset: Option<Dataset>,
    pub(super) name: String,
    pub(super) columns: Vec<Column>,
    pub(super) columnar: Arc<ColumnarDataset>,
    pub(super) fingerprint: Option<String>,
    pub(super) structure_profile_json: Option<String>,
}

impl RegisteredDataset {
    pub(super) fn new(dataset: Dataset) -> Self {
        let name = dataset.name.clone();
        let columns = dataset.columns.clone();
        let columnar = Arc::new(ColumnarDataset::from_dataset(&dataset));
        Self {
            dataset: Some(dataset),
            name,
            columns,
            columnar,
            fingerprint: None,
            structure_profile_json: None,
        }
    }

    pub(super) fn columnar_only(
        name: String,
        columns: Vec<Column>,
        columnar: ColumnarDataset,
    ) -> Self {
        Self {
            dataset: None,
            name,
            columns,
            columnar: Arc::new(columnar),
            fingerprint: None,
            structure_profile_json: None,
        }
    }

    pub(super) fn rebuild_columnar(&mut self) {
        if let Some(dataset) = &self.dataset {
            self.name = dataset.name.clone();
            self.columns = dataset.columns.clone();
            self.columnar = Arc::new(ColumnarDataset::from_dataset(dataset));
            self.fingerprint = None;
            self.structure_profile_json = None;
        }
    }
}

struct DatasetSlot {
    generation: u32,
    registered: Option<RegisteredDataset>,
}

pub(super) struct DatasetRegistry {
    slots: Vec<DatasetSlot>,
    free: Vec<u32>,
    capacity_limit: usize,
}

impl DatasetRegistry {
    pub(super) const fn new() -> Self {
        Self {
            slots: Vec::new(),
            free: Vec::new(),
            capacity_limit: MAX_DATASET_SLOTS,
        }
    }

    #[cfg(test)]
    fn with_capacity_limit(capacity_limit: usize) -> Self {
        Self {
            slots: Vec::new(),
            free: Vec::new(),
            capacity_limit: capacity_limit.min(MAX_DATASET_SLOTS),
        }
    }

    fn encode(index: usize, generation: u32) -> Option<u32> {
        if index >= MAX_DATASET_SLOTS || generation == 0 || generation > HANDLE_MAX_GENERATION {
            return None;
        }
        let index_part = u32::try_from(index).ok()?.checked_add(1)?;
        let handle = (generation << HANDLE_INDEX_BITS) | index_part;
        if handle == 0 || handle & HANDLE_RESERVED_MASK != 0 {
            return None;
        }
        Some(handle)
    }

    fn decode(handle: u32) -> Option<(usize, u32)> {
        if handle == 0 || handle & HANDLE_RESERVED_MASK != 0 {
            return None;
        }
        let index_part = handle & HANDLE_INDEX_MASK;
        let generation = (handle >> HANDLE_INDEX_BITS) & HANDLE_MAX_GENERATION;
        if index_part == 0 || generation == 0 {
            return None;
        }
        Some(((index_part - 1) as usize, generation))
    }

    pub(super) fn insert_registered(&mut self, registered: RegisteredDataset) -> u32 {
        while let Some(index) = self.free.pop() {
            let Some(slot) = self.slots.get_mut(index as usize) else {
                continue;
            };
            if slot.registered.is_some() {
                continue;
            }
            let Some(handle) = Self::encode(index as usize, slot.generation) else {
                continue;
            };
            slot.registered = Some(registered);
            return handle;
        }

        if self.slots.len() >= self.capacity_limit {
            return 0;
        }
        let index = self.slots.len();
        let generation = 1;
        let Some(handle) = Self::encode(index, generation) else {
            return 0;
        };
        self.slots.push(DatasetSlot {
            generation,
            registered: Some(registered),
        });
        handle
    }

    pub(super) fn insert(&mut self, dataset: Dataset) -> u32 {
        self.insert_registered(RegisteredDataset::new(dataset))
    }

    pub(super) fn insert_columnar(
        &mut self,
        name: String,
        columns: Vec<Column>,
        columnar: ColumnarDataset,
    ) -> u32 {
        self.insert_registered(RegisteredDataset::columnar_only(name, columns, columnar))
    }

    pub(super) fn get(&self, handle: u32) -> Option<&Dataset> {
        self.get_registered(handle)?.dataset.as_ref()
    }

    pub(super) fn get_registered(&self, handle: u32) -> Option<&RegisteredDataset> {
        let (index, generation) = Self::decode(handle)?;
        let slot = self.slots.get(index)?;
        if slot.generation != generation {
            return None;
        }
        slot.registered.as_ref()
    }

    pub(super) fn get_registered_mut(&mut self, handle: u32) -> Option<&mut RegisteredDataset> {
        let (index, generation) = Self::decode(handle)?;
        let slot = self.slots.get_mut(index)?;
        if slot.generation != generation {
            return None;
        }
        slot.registered.as_mut()
    }

    pub(super) fn get_columnar(&self, handle: u32) -> Option<&ColumnarDataset> {
        self.get_registered(handle)
            .map(|registered| registered.columnar.as_ref())
    }

    pub(super) fn remove(&mut self, handle: u32) -> bool {
        let Some((index, generation)) = Self::decode(handle) else {
            return false;
        };
        let Some(slot) = self.slots.get_mut(index) else {
            return false;
        };
        if slot.generation != generation || slot.registered.is_none() {
            return false;
        }

        slot.registered = None;
        if slot.generation < HANDLE_MAX_GENERATION {
            slot.generation += 1;
            self.free.push(index as u32);
        }
        true
    }

    /// Invalidate every issued handle while retaining slot generations. Reusing
    /// a slot after runtime recovery therefore produces a different capability
    /// instead of resurrecting an identifier from the previous generation.
    pub(super) fn reset(&mut self) {
        self.free.clear();
        for (index, slot) in self.slots.iter_mut().enumerate() {
            slot.registered = None;
            if slot.generation < HANDLE_MAX_GENERATION {
                slot.generation += 1;
                self.free.push(index as u32);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dataset(name: &str) -> Dataset {
        Dataset::new(name, Vec::new(), Vec::new())
    }

    #[test]
    fn destroyed_handle_never_reacquires_authority_after_slot_reuse() {
        let mut registry = DatasetRegistry::with_capacity_limit(1);
        let first = registry.insert(dataset("first"));
        assert_ne!(first, 0);
        assert!(registry.remove(first));
        assert!(registry.get(first).is_none());

        let second = registry.insert(dataset("second"));
        assert_ne!(second, 0);
        assert_ne!(second, first);
        assert_eq!(registry.get(second).map(|dataset| dataset.name.as_str()), Some("second"));
        assert!(registry.get(first).is_none());
        assert!(!registry.remove(first));
        assert!(registry.get(second).is_some());
    }

    #[test]
    fn bounded_registry_exhaustion_returns_zero_without_disturbing_live_handles() {
        let mut registry = DatasetRegistry::with_capacity_limit(2);
        let first = registry.insert(dataset("first"));
        let second = registry.insert(dataset("second"));
        assert_ne!(first, 0);
        assert_ne!(second, 0);
        assert_eq!(registry.insert(dataset("overflow")), 0);
        assert_eq!(registry.get(first).map(|dataset| dataset.name.as_str()), Some("first"));
        assert_eq!(registry.get(second).map(|dataset| dataset.name.as_str()), Some("second"));
        assert!(registry.get(u32::MAX).is_none());
    }

    #[test]
    fn registry_reset_invalidates_prior_runtime_generation() {
        let mut registry = DatasetRegistry::with_capacity_limit(1);
        let before = registry.insert(dataset("before"));
        registry.reset();
        assert!(registry.get(before).is_none());

        let after = registry.insert(dataset("after"));
        assert_ne!(after, 0);
        assert_ne!(after, before);
        assert_eq!(registry.get(after).map(|dataset| dataset.name.as_str()), Some("after"));
    }

    #[test]
    fn exhausted_generation_retires_slot_instead_of_wrapping_stale_capability() {
        let mut registry = DatasetRegistry::with_capacity_limit(1);
        let first = registry.insert(dataset("first"));
        assert!(registry.remove(first));

        registry.slots[0].generation = HANDLE_MAX_GENERATION;
        registry.free.clear();
        registry.free.push(0);
        let final_handle = registry.insert(dataset("final"));
        assert_ne!(final_handle, 0);
        assert!(registry.remove(final_handle));
        assert!(registry.free.is_empty());
        assert_eq!(registry.insert(dataset("retired")), 0);
        assert!(registry.get(final_handle).is_none());
    }

    #[test]
    fn reserved_high_bit_and_zero_are_never_valid_handles() {
        assert!(DatasetRegistry::decode(0).is_none());
        assert!(DatasetRegistry::decode(u32::MAX).is_none());
        assert!(DatasetRegistry::encode(MAX_DATASET_SLOTS - 1, HANDLE_MAX_GENERATION)
            .is_some_and(|handle| handle <= i32::MAX as u32));
    }
}
