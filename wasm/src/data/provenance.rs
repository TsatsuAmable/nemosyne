//! Provenance envelope for the Nemosyne analytical kernel.
//!
//! Every research-relevant analytical transformation must emit a provenance
//! envelope so results are reproducible and attributable to a specific kernel
//! build. The envelope is recorded in a side-channel (`LAST_PROVENANCE`) and
//! read back by the JS host via `kernel_provenance` — this keeps the
//! `(ptr, len)` + integer-handle ABI intact while satisfying the governance
//! rule that the kernel emits provenance on every result.
//!
//! `kernelVersion` is bumped whenever an analytical algorithm changes; saved
//! sessions break across a version bump (pre-alpha pivot, accepted).

use std::cell::RefCell;
use serde::Serialize;

/// Canonical kernel identifier carried on every provenance envelope.
pub const KERNEL_NAME: &str = "nemosyne-wasm";

/// Bumped on any analytical algorithm change. `0.3.0` adds governed analytical
/// resource envelopes and an opt-in bounded-neighbourhood approximation mode.
pub const KERNEL_VERSION: &str = "0.3.0";

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
    /// Outcome of the call. Absent on success. Set to `"refused"` on a
    /// kernel-inline resource refusal; refusal envelopes have no output
    /// fingerprint because no result was produced.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outcome: Option<String>,
}

thread_local! {
    static LAST_PROVENANCE: RefCell<Option<String>> = const { RefCell::new(None) };
    /// Resource/approximation evidence produced inside the pure operation
    /// dispatcher before `lib.rs` records the successful result. Keeping this
    /// separate from LAST_PROVENANCE lets the existing integer-handle ABI stay
    /// unchanged while still binding exact-vs-approximation evidence to the
    /// success envelope that `data_operation` records immediately afterwards.
    static PENDING_OPERATION_EVIDENCE: RefCell<Option<serde_json::Value>> = const { RefCell::new(None) };
}

/// Publish evidence that belongs to the next successful generic operation.
/// The next `record`/`record_with_ingest` call consumes it exactly once.
pub fn set_pending_operation_evidence(evidence: serde_json::Value) {
    PENDING_OPERATION_EVIDENCE.with(|slot| {
        *slot.borrow_mut() = Some(evidence);
    });
}

/// Clear any unconsumed operation evidence. Dispatchers call this before a new
/// operation so a failed/non-resource call cannot inherit stale evidence.
pub fn clear_pending_operation_evidence() {
    PENDING_OPERATION_EVIDENCE.with(|slot| {
        *slot.borrow_mut() = None;
    });
}

fn merge_pending_operation_evidence(mut parameters: serde_json::Value) -> serde_json::Value {
    let pending = PENDING_OPERATION_EVIDENCE.with(|slot| slot.borrow_mut().take());
    let Some(evidence) = pending else {
        return parameters;
    };
    match &mut parameters {
        serde_json::Value::Object(map) => {
            map.insert("resourceEvidence".to_string(), evidence);
            parameters
        }
        _ => serde_json::json!({
            "request": parameters,
            "resourceEvidence": evidence,
        }),
    }
}

/// Record the provenance envelope for the most recent kernel call. The JS host
/// reads it via `kernel_provenance` immediately after a result-bearing call.
pub fn record(
    operation: &str,
    parameters: serde_json::Value,
    input_fingerprint: &str,
    output_fingerprint: &str,
) {
    record_with_ingest(operation, parameters, input_fingerprint, output_fingerprint, None);
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
) {
    let envelope = Provenance {
        kernel: KERNEL_NAME,
        kernel_version: KERNEL_VERSION,
        operation: operation.to_string(),
        parameters: merge_pending_operation_evidence(parameters),
        input_fingerprint: input_fingerprint.to_string(),
        output_fingerprint: output_fingerprint.to_string(),
        timestamp: now_ms(),
        ingest_mode: ingest_mode.map(|s| s.to_string()),
        outcome: None,
    };
    let json = serde_json::to_string(&envelope).unwrap_or_else(|_| "{}".to_string());
    LAST_PROVENANCE.with(|slot| {
        *slot.borrow_mut() = Some(json);
    });
}

/// Record a refusal provenance envelope: `outcome = "refused"`,
/// `output_fingerprint = ""`, `ingest_mode = None`. Used by kernel-inline
/// resource guards so a refusal carries the same authority as a successful
/// result. Refusal parameters include the structured resource preflight.
pub fn record_refusal(
    operation: &str,
    parameters: serde_json::Value,
    input_fingerprint: &str,
) -> Provenance {
    clear_pending_operation_evidence();
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
    LAST_PROVENANCE.with(|slot| {
        *slot.borrow_mut() = Some(json);
    });
    envelope
}

/// Return the last recorded provenance envelope as a JSON string (or `""` if
/// no kernel call has been made yet).
pub fn last_json() -> String {
    LAST_PROVENANCE.with(|slot| slot.borrow().clone().unwrap_or_default())
}

/// Clear the side-channel. Used by tests for deterministic isolation.
pub fn clear() {
    LAST_PROVENANCE.with(|slot| {
        *slot.borrow_mut() = None;
    });
    clear_pending_operation_evidence();
}

// ---------------------------------------------------------------------------
// Timestamp source
// ---------------------------------------------------------------------------

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
extern "C" {
    /// JS-provided wall clock in milliseconds. Installed by RuntimeBridge.
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
        record(
            "sort",
            serde_json::json!({"column": "age", "ascending": true}),
            "deadbeef",
            "cafebabe",
        );
        let json = last_json();
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
    fn pending_resource_evidence_is_consumed_once() {
        clear();
        set_pending_operation_evidence(serde_json::json!({"mode": "bounded", "edgeRecall": 0.95}));
        record("dbscan", serde_json::json!({"eps": 1.0}), "in", "out");
        let first: serde_json::Value = serde_json::from_str(&last_json()).unwrap();
        assert_eq!(first["parameters"]["resourceEvidence"]["mode"], "bounded");
        assert_eq!(first["parameters"]["resourceEvidence"]["edgeRecall"], 0.95);

        record("sort", serde_json::json!({"column": "x"}), "in2", "out2");
        let second: serde_json::Value = serde_json::from_str(&last_json()).unwrap();
        assert!(second["parameters"].get("resourceEvidence").is_none());
        clear();
    }

    #[test]
    fn clear_empties_side_channel() {
        record("ping", serde_json::Value::Null, "a", "b");
        clear();
        assert_eq!(last_json(), "");
    }

    #[test]
    fn success_envelope_has_no_outcome_key() {
        clear();
        record_with_ingest(
            "compute_mapper_graph",
            serde_json::json!({"bins": 4}),
            "fp-in",
            "fp-out",
            Some("columnar_only"),
        );
        let json = last_json();
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(v.get("outcome").is_none(), "success envelope must not carry outcome");
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