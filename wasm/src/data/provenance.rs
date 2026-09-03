//! Provenance envelope for the Nemosyne analytical kernel.
//!
//! Every research-relevant analytical transformation must emit a provenance
//! envelope so results are reproducible and attributable to a specific kernel
//! build. Envelopes are retained in a small sequence-addressable side-channel
//! and read back by the JS host by sequence id. Keeping recent records instead
//! of a single mutable "last" slot makes the two-call ABI robust to interleaved
//! host reads without embedding timestamp-bearing provenance in size probes.
//!
//! `kernelVersion` is bumped whenever an analytical algorithm changes; saved
//! sessions break across a version bump (pre-alpha pivot, accepted).

use serde::Serialize;
use std::cell::RefCell;
use std::collections::VecDeque;

/// Canonical kernel identifier carried on every provenance envelope.
pub const KERNEL_NAME: &str = "nemosyne-wasm";

/// Bumped on any analytical algorithm change. `0.2.0` is the Wave 1 canonical
/// versioned ABI: provenance envelope, canonical FNV-1a fingerprint, full
/// predicate/aggregator parity, exported topology/TDA/arrow/encodings.
pub const KERNEL_VERSION: &str = "0.2.0";

/// Recent envelopes retained for sequence-addressable host reads. The host reads
/// immediately after a result-bearing call, so this is intentionally small and
/// bounded while still tolerating realistic interleaving.
const PROVENANCE_HISTORY_LIMIT: usize = 64;

/// Provenance envelope attached to every kernel result.
///
/// Field names are camelCased to match the governance contract in
/// `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` and the JS `RuntimeBridge`
/// consumers, so the JSON crosses the ABI without renaming.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Provenance {
    pub kernel: &'static str,
    pub kernel_version: &'static str,
    pub operation: String,
    pub parameters: serde_json::Value,
    pub input_fingerprint: String,
    pub output_fingerprint: String,
    pub timestamp: f64,
    /// Substrate that produced the result: `"row_major"` or `"columnar_only"`.
    /// Absent on operations that do not distinguish ingest substrates, so the
    /// provenance JSON for every non-TDA envelope is unchanged. TDA ops
    /// (`compute_mapper_graph`, `compute_persistence_intervals`,
    /// `compute_betti0_curve`) always set this so replay can tell which
    /// substrate produced a result.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ingest_mode: Option<String>,
    /// Outcome of the call. Absent on success (kept out of the JSON so success
    /// envelopes are byte-identical). Set to `"refused"` on a kernel-inline
    /// resource refusal so the durable ledger can distinguish a refusal
    /// provenance from a successful one. A refusal provenance also sets
    /// `output_fingerprint` to the empty string (no output produced). The
    /// refusal reason itself travels in the accompanying
    /// `TdaResourcePreflight.refusal`, not here.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outcome: Option<String>,
}

#[derive(Default)]
struct ProvenanceStore {
    next_sequence: u32,
    records: VecDeque<(u32, String)>,
}

thread_local! {
    static PROVENANCE_STORE: RefCell<ProvenanceStore> = RefCell::new(ProvenanceStore::default());
}

fn retain_json(json: String) -> u32 {
    PROVENANCE_STORE.with(|slot| {
        let mut store = slot.borrow_mut();
        let mut sequence = store.next_sequence.wrapping_add(1);
        if sequence == 0 {
            sequence = 1;
        }
        store.next_sequence = sequence;
        if store.records.len() >= PROVENANCE_HISTORY_LIMIT {
            store.records.pop_front();
        }
        store.records.push_back((sequence, json));
        sequence
    })
}

/// Record the provenance envelope for a kernel call and return its sequence id.
/// Existing callers may ignore the id; the host bridge reads the most recent
/// sequence then resolves the exact record by id so a later call cannot replace
/// the envelope it is about to consume.
pub fn record(
    operation: &str,
    parameters: serde_json::Value,
    input_fingerprint: &str,
    output_fingerprint: &str,
) -> u32 {
    record_with_ingest(operation, parameters, input_fingerprint, output_fingerprint, None)
}

/// Record a provenance envelope that also names the ingest substrate. TDA
/// exports use this so a row-major and a columnar-only handle that produce the
/// same analytical output still carry distinguishable, replayable provenance.
pub fn record_with_ingest(
    operation: &str,
    parameters: serde_json::Value,
    input_fingerprint: &str,
    output_fingerprint: &str,
    ingest_mode: Option<&str>,
) -> u32 {
    let envelope = Provenance {
        kernel: KERNEL_NAME,
        kernel_version: KERNEL_VERSION,
        operation: operation.to_string(),
        parameters,
        input_fingerprint: input_fingerprint.to_string(),
        output_fingerprint: output_fingerprint.to_string(),
        timestamp: now_ms(),
        ingest_mode: ingest_mode.map(|s| s.to_string()),
        outcome: None,
    };
    let json = serde_json::to_string(&envelope).unwrap_or_else(|_| "{}".to_string());
    retain_json(json)
}

/// Record a refusal provenance envelope: `outcome = "refused"`,
/// `output_fingerprint = ""`, `ingest_mode = None`. Used by the kernel-inline
/// TDA resource guard so a refusal carries the same authority as a successful
/// result. Stores the envelope in the sequence-addressable side-channel and
/// returns it so the caller can embed it in the in-band refusal envelope.
pub fn record_refusal(
    operation: &str,
    parameters: serde_json::Value,
    input_fingerprint: &str,
) -> Provenance {
    let envelope = Provenance {
        kernel: KERNEL_NAME,
        kernel_version: KERNEL_VERSION,
        operation: operation.to_string(),
        parameters,
        input_fingerprint: input_fingerprint.to_string(),
        output_fingerprint: String::new(),
        timestamp: now_ms(),
        ingest_mode: None,
        outcome: Some("refused".to_string()),
    };
    let json = serde_json::to_string(&envelope).unwrap_or_else(|_| "{}".to_string());
    retain_json(json);
    envelope
}

/// Return the sequence id of the most recently recorded envelope, or zero when
/// no provenance has been emitted in this runtime generation.
pub fn last_sequence() -> u32 {
    PROVENANCE_STORE.with(|slot| slot.borrow().records.back().map(|(seq, _)| *seq).unwrap_or(0))
}

/// Resolve one retained provenance envelope by sequence id.
pub fn json_for_sequence(sequence: u32) -> String {
    if sequence == 0 {
        return String::new();
    }
    PROVENANCE_STORE.with(|slot| {
        slot.borrow()
            .records
            .iter()
            .find_map(|(seq, json)| (*seq == sequence).then(|| json.clone()))
            .unwrap_or_default()
    })
}

/// Compatibility read for legacy hosts. New hosts use `last_sequence` followed
/// by `json_for_sequence` so an interleaved call cannot misattribute provenance.
pub fn last_json() -> String {
    json_for_sequence(last_sequence())
}

/// wasm-bindgen sequence read used by the TypeScript host.
#[wasm_bindgen::prelude::wasm_bindgen(js_name = kernel_provenance_sequence)]
pub fn kernel_provenance_sequence_export() -> u32 {
    last_sequence()
}

/// wasm-bindgen sequence-addressable provenance read used by the TypeScript host.
#[wasm_bindgen::prelude::wasm_bindgen(js_name = kernel_provenance_by_sequence)]
pub fn kernel_provenance_by_sequence_export(
    sequence: u32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    crate::write_str_out(&json_for_sequence(sequence), out_ptr, out_len)
}

/// Clear the side-channel. Used by tests for deterministic isolation.
pub fn clear() {
    PROVENANCE_STORE.with(|slot| {
        *slot.borrow_mut() = ProvenanceStore::default();
    });
}

// ---------------------------------------------------------------------------
// Timestamp source
// ---------------------------------------------------------------------------
//
// The WASM target has no clock. Per `.claude/plan.md` the imported-function
// surface is limited to logging, timestamps, and telemetry, so the kernel
// imports a single `nemosyneNowMs` global that the JS host
// (`RuntimeBridge.initRuntime`) installs as `globalThis.nemosyneNowMs =
// () => Date.now()` before any analytical call. On the host target `cargo test`
// falls back to `SystemTime` so the same logic is exercised without a WASM
// runner.

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
extern "C" {
    /// JS-provided monotonic-ish wall clock in milliseconds. Installed by
    /// `RuntimeBridge.initRuntime`.
    #[wasm_bindgen::prelude::wasm_bindgen(js_name = nemosyneNowMs)]
    fn now_ms_js() -> f64;
}

#[cfg(target_arch = "wasm32")]
pub fn now_ms() -> f64 {
    now_ms_js()
}

#[cfg(not(target_arch = "wasm32"))]
pub fn now_ms() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_stable_string() {
        assert!(!KERNEL_VERSION.is_empty());
        assert_eq!(KERNEL_NAME, "nemosyne-wasm");
    }

    #[test]
    fn record_then_read_round_trips_fields() {
        clear();
        let sequence = record(
            "sort",
            serde_json::json!({"column": "age", "ascending": true}),
            "deadbeef",
            "cafebabe",
        );
        let json = json_for_sequence(sequence);
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(v["kernel"], "nemosyne-wasm");
        assert_eq!(v["kernelVersion"], KERNEL_VERSION);
        assert_eq!(v["operation"], "sort");
        assert_eq!(v["inputFingerprint"], "deadbeef");
        assert_eq!(v["outputFingerprint"], "cafebabe");
        assert_eq!(v["parameters"]["column"], "age");
        assert!(v["timestamp"].as_f64().unwrap() > 0.0);
        clear();
    }

    #[test]
    fn interleaved_sequences_retain_their_own_provenance() {
        clear();
        let first = record(
            "filter",
            serde_json::json!({"column": "x", "value": 1}),
            "fp-a",
            "fp-b",
        );
        let second = record(
            "sort",
            serde_json::json!({"column": "y"}),
            "fp-b",
            "fp-c",
        );

        assert_ne!(first, second);
        let first_value: serde_json::Value = serde_json::from_str(&json_for_sequence(first)).unwrap();
        let second_value: serde_json::Value = serde_json::from_str(&json_for_sequence(second)).unwrap();
        assert_eq!(first_value["operation"], "filter");
        assert_eq!(first_value["inputFingerprint"], "fp-a");
        assert_eq!(second_value["operation"], "sort");
        assert_eq!(second_value["inputFingerprint"], "fp-b");
        assert_eq!(last_sequence(), second);
        clear();
    }

    #[test]
    fn provenance_history_is_bounded() {
        clear();
        let first = record("op-0", serde_json::Value::Null, "a", "b");
        for i in 1..=PROVENANCE_HISTORY_LIMIT {
            record(&format!("op-{i}"), serde_json::Value::Null, "a", "b");
        }
        assert_eq!(json_for_sequence(first), "");
        assert_ne!(last_sequence(), 0);
        clear();
    }

    #[test]
    fn clear_empties_side_channel() {
        record("ping", serde_json::Value::Null, "a", "b");
        clear();
        assert_eq!(last_json(), "");
        assert_eq!(last_sequence(), 0);
    }

    #[test]
    fn success_envelope_has_no_outcome_key() {
        // Byte-identity guard: adding `outcome` must not change success JSON.
        clear();
        let sequence = record_with_ingest(
            "compute_mapper_graph",
            serde_json::json!({"bins": 4}),
            "fp-in",
            "fp-out",
            Some("columnar_only"),
        );
        let json = json_for_sequence(sequence);
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(v.get("outcome").is_none(), "success envelope must not carry outcome");
        assert!(v.get("outcome").is_none());
        // object-level check: the key is literally absent
        assert!(!json.contains("\"outcome\""));
        clear();
    }

    #[test]
    fn record_refusal_then_read_round_trips_outcome() {
        clear();
        let envelope = record_refusal(
            "compute_mapper_graph",
            serde_json::json!({"featureColumns": ["x", "y"], "bins": 10}),
            "fp-in",
        );
        assert_eq!(envelope.outcome.as_deref(), Some("refused"));
        assert_eq!(envelope.output_fingerprint, "");
        assert!(envelope.ingest_mode.is_none());

        let v: serde_json::Value = serde_json::from_str(&last_json()).unwrap();
        assert_eq!(v["outcome"], "refused");
        assert_eq!(v["outputFingerprint"], "");
        assert_eq!(v["operation"], "compute_mapper_graph");
        assert_eq!(v["inputFingerprint"], "fp-in");
        assert!(v.get("ingestMode").is_none());
        assert!(v["timestamp"].as_f64().unwrap() > 0.0);
        clear();
    }
}
