//! RFC 0009 tranche 3 slice 2 — kernel-issued governed consumer identity.
//!
//! A persisted `uses` record (RFC 0009 V3) authorizes a consumer only against a
//! consumer identity the Rust kernel issued. This module is that issuer: it
//! attests, for one receipt bundle the kernel itself produced, which governed
//! consumers consume its receipts and which receipts each one consumes. The
//! attestation travels to the TypeScript composition layer through the
//! analytical-execution-port readout as raw bytes; the composition layer then
//! mints the persisted `uses` records from it (joined with the authority-owned
//! consumer profile policy). It NEVER mints a `consumerId` of its own: every
//! consumer identity in every governed archive this build exports originates
//! from this constant, evaluated over the bundle the kernel issued.
//!
//! Scope decision (owner, 2026-10-02): the first governed consumer is the
//! descriptive-statistics consumer. It consumes every receipt the statistics
//! evidence family issues for a dataset — descriptive summaries, Pearson
//! linear association, categorical frequency and the legacy temporal heuristic
//! — under the requirement profile `descriptive-summary/v1` (no epistemic axes
//! required; violated assumptions refused; unresolved-but-not-testable
//! assumptions tolerated). The profile identity itself lives in the
//! TypeScript closed profile registry and is owned there; this module states
//! only *who consumes what*, never *what quality they require*.

use serde::Serialize;

use crate::data::evidence::EvidenceReceiptBundleV1;

/// The kernel-minted identity of the governed descriptive-statistics consumer.
///
/// This is the single source of the consumer identity for the descriptive
/// statistics consumer. The TypeScript side holds a mirror of this constant in
/// its own consumer-policy registry, and the wasm integration suite pins the
/// two to be equal, so neither side can rename a governed consumer without the
/// other refusing the export or the replay.
pub const DESCRIPTIVE_STATISTICS_CONSUMER_ID: &str =
    "nemosyne:consumer/descriptive-statistics/v1";

/// The attestation wire contract version. Distinct from the receipt bundle's
/// `schemaVersion` on purpose: the two formats evolve independently.
pub const GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION: &str = "1";

/// One governed consumer's claim over receipts of one bundle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GovernedConsumerUseV1 {
    pub consumer_id: String,
    pub receipt_ids: Vec<String>,
}

/// Attestation that the kernel issued: which governed consumers consume this
/// dataset's receipts. Serialized to JSON at the ABI boundary (camelCase).
///
/// The attestation carries the bundle's identity so the consumer-side
/// composition can refuse when the receipt bytes it was handed and the
/// consumer claims it was handed were minted for different identities.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GovernedConsumerAttestationV1 {
    pub schema_version: String,
    pub dataset_fingerprint: String,
    pub kernel_version: String,
    pub consumers: Vec<GovernedConsumerUseV1>,
}

impl GovernedConsumerAttestationV1 {
    /// Mint the attestation for a Rust-issued receipt bundle. The mint takes
    /// no caller-supplied identity: the consumer set, the consumer id and the
    /// receipt ids all originate in kernel state (the bundle), and the
    /// identity fields are copied from the bundle itself.
    ///
    /// A bundle holding no receipts mints an attestation with an empty
    /// consumer list: a governed use must name a receipt, so an attestation
    /// that claims a consumer over no receipts would be unbindable. The
    /// TypeScript composition refuses such a capture (a policy that governs a
    /// consumer no attestation names would mint `uses` that fail
    /// `MISSING_USE`), so governed export of an empty receipt bundle fails
    /// closed end to end.
    pub fn for_receipt_bundle(bundle: &EvidenceReceiptBundleV1) -> Result<Self, String> {
        let consumers = if bundle.receipts.is_empty() {
            Vec::new()
        } else {
            vec![GovernedConsumerUseV1 {
                consumer_id: DESCRIPTIVE_STATISTICS_CONSUMER_ID.to_string(),
                receipt_ids: bundle
                    .receipts
                    .iter()
                    .map(|receipt| receipt.receipt_id.clone())
                    .collect(),
            }]
        };
        let attestation = Self {
            schema_version: GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION.to_string(),
            dataset_fingerprint: bundle.dataset_fingerprint.clone(),
            kernel_version: bundle.kernel_version.clone(),
            consumers,
        };
        attestation.validate_for_bundle(bundle)?;
        Ok(attestation)
    }

    /// Structural validation: the attestation must agree with the bundle it
    /// was minted over, in identity and in receipt coverage. Run on every
    /// mint, so a malformed attestation can only ever exist as a deliberate
    /// hand-constructed value, never as a returned one.
    pub fn validate_for_bundle(&self, bundle: &EvidenceReceiptBundleV1) -> Result<(), String> {
        if self.schema_version != GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION {
            return Err("attestation schema version must be 1".to_string());
        }
        if self.dataset_fingerprint.is_empty() || self.kernel_version.is_empty() {
            return Err("attestation identity fields must be non-empty".to_string());
        }
        if self.dataset_fingerprint != bundle.dataset_fingerprint {
            return Err("attestation dataset fingerprint does not match bundle".to_string());
        }
        if self.kernel_version != bundle.kernel_version {
            return Err("attestation kernel version does not match bundle".to_string());
        }

        let bundle_ids: Vec<&str> = bundle
            .receipts
            .iter()
            .map(|receipt| receipt.receipt_id.as_str())
            .collect();
        let mut seen_consumers = std::collections::HashSet::new();
        for consumer in &self.consumers {
            if consumer.consumer_id.is_empty() {
                return Err("attested consumer id must be non-empty".to_string());
            }
            if !seen_consumers.insert(consumer.consumer_id.clone()) {
                return Err("duplicate attested consumer id".to_string());
            }
            if consumer.receipt_ids.is_empty() {
                return Err("attested consumer must claim at least one receipt".to_string());
            }
            let mut seen_receipts = std::collections::HashSet::new();
            for receipt_id in &consumer.receipt_ids {
                if receipt_id.is_empty() {
                    return Err("attested receipt id must be non-empty".to_string());
                }
                if !seen_receipts.insert(receipt_id.clone()) {
                    return Err("duplicate attested receipt id".to_string());
                }
                if !bundle_ids.contains(&receipt_id.as_str()) {
                    return Err(format!(
                        "attested receipt id {} is not in the bundle",
                        receipt_id
                    ));
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::column::{Column, ColumnType};
    use crate::data::dataset::Dataset;
    use crate::data::evidence::{
        AssumptionCheck, AssumptionStatus, EvidenceClaim, EvidenceMeasurementContextV1,
        EvidenceReceiptV1, MethodProvenance, SampleSupport, SupportPolicy,
    };
    use crate::data::statistics_evidence::compute_statistics_evidence_receipt_bundle;
    use crate::data::value::Value;
    use std::collections::HashMap;

    fn row(values: &[(&str, Value)]) -> HashMap<String, Value> {
        values
            .iter()
            .map(|(key, value)| ((*key).to_string(), value.clone()))
            .collect()
    }

    fn bundle_with(
        receipts: Vec<EvidenceReceiptV1>,
        dataset_fingerprint: &str,
        kernel_version: &str,
    ) -> EvidenceReceiptBundleV1 {
        EvidenceReceiptBundleV1::new(dataset_fingerprint, kernel_version, receipts).unwrap()
    }

    /// A receipt shaped like a family-issued one, over a caller-chosen claim
    /// id — used to test refusal paths the statistics claim families cannot
    /// produce. `EvidenceReceiptBundleV1::new` validates receipt provenance
    /// against the bundle, so this carries the "fp"/"kernel" identity the test
    /// bundles commit to; a mismatched fixture would refuse at `bundle_with`,
    /// not at the behavior it exists to test.
    fn synthetic_receipt(
        claim_id: &str,
        assumptions: Vec<AssumptionCheck>,
    ) -> EvidenceReceiptV1 {
        EvidenceReceiptV1::from_claim(
            &EvidenceClaim {
                claim_id: claim_id.to_string(),
                estimand: "test estimand".to_string(),
                result: 0.5,
                method_provenance: MethodProvenance {
                    method: "test/method".to_string(),
                    method_version: "test-v1".to_string(),
                    kernel_version: "kernel".to_string(),
                    dataset_fingerprint: "fp".to_string(),
                    parameters: Vec::new(),
                },
                geometry: None,
                assumptions,
                sample_support: SampleSupport::full_dataset(1, vec!["x".to_string()]),
                uncertainty: None,
                stability: None,
                sensitivity: Vec::new(),
                limitations: Vec::new(),
            },
            EvidenceMeasurementContextV1::NotEstablished,
        )
    }

    #[test]
    fn consumer_identity_is_kernel_minted_and_stable() {
        // This test computes receipt bundles, which moves the process-global
        // computation counters; hold the shared test guard (see its doc in
        // `prepared_results`) so parallel test threads cannot compute into a
        // delta-window falsifier's measurement span.
        let _guard = crate::prepared_results::COUNTER_TESTS.lock().unwrap();

        // The minted consumer id is a build constant.
        assert_eq!(
            DESCRIPTIVE_STATISTICS_CONSUMER_ID,
            "nemosyne:consumer/descriptive-statistics/v1"
        );

        let dataset = Dataset::new(
            "consumer-attestation",
            vec![Column::new("x", ColumnType::Numeric)],
            vec![
                row(&[("x", Value::Number(1.0))]),
                row(&[("x", Value::Number(2.0))]),
            ],
        );
        let first =
            compute_statistics_evidence_receipt_bundle(&dataset, "fp", "kernel").unwrap();
        let second =
            compute_statistics_evidence_receipt_bundle(&dataset, "fp", "kernel").unwrap();

        let attestation = GovernedConsumerAttestationV1::for_receipt_bundle(&first).unwrap();
        assert_eq!(
            attestation,
            GovernedConsumerAttestationV1::for_receipt_bundle(&second).unwrap()
        );
        assert_eq!(attestation.consumers.len(), 1);
        assert_eq!(
            attestation.consumers[0].consumer_id,
            DESCRIPTIVE_STATISTICS_CONSUMER_ID
        );
        // Every receipt the kernel issued is claimed by the attested consumer,
        // under the bundle's own ids and order — never a re-derivation.
        let expected: Vec<String> = first
            .receipts
            .iter()
            .map(|receipt| receipt.receipt_id.clone())
            .collect();
        assert_eq!(attestation.consumers[0].receipt_ids, expected);
        assert!(!expected.is_empty());
        // Identity comes from the bundle, not from a caller parameter.
        assert_eq!(attestation.dataset_fingerprint, "fp");
        assert_eq!(attestation.kernel_version, "kernel");
        assert_eq!(attestation.schema_version, "1");
    }

    #[test]
    fn attestation_wire_shape_is_camel_case() {
        // Computes a receipt bundle, so it moves the process-global counters:
        // serialized on the shared test guard like every other counter-moving
        // falsifier (see its doc in `prepared_results`).
        let _guard = crate::prepared_results::COUNTER_TESTS.lock().unwrap();

        let dataset = Dataset::new(
            "consumer-wire",
            vec![Column::new("x", ColumnType::Numeric)],
            vec![row(&[("x", Value::Number(1.0))])],
        );
        let bundle = compute_statistics_evidence_receipt_bundle(&dataset, "fp", "kernel").unwrap();
        let attestation = GovernedConsumerAttestationV1::for_receipt_bundle(&bundle).unwrap();
        let value = serde_json::to_value(&attestation).unwrap();
        assert_eq!(value["schemaVersion"], "1");
        assert_eq!(value["datasetFingerprint"], "fp");
        assert_eq!(value["kernelVersion"], "kernel");
        assert!(value.get("consumers").is_some());
        assert!(value.get("consumer_id").is_none());
        let consumer = &value["consumers"][0];
        assert!(consumer.get("consumerId").is_some());
        assert!(consumer.get("receiptIds").is_some());
        assert!(consumer.get("consumer_id").is_none());
        assert!(consumer.get("receipt_ids").is_none());
    }

    #[test]
    fn a_bundle_without_receipts_attests_no_consumer() {
        let bundle = bundle_with(Vec::new(), "fp", "kernel");
        let attestation = GovernedConsumerAttestationV1::for_receipt_bundle(&bundle).unwrap();
        assert!(attestation.consumers.is_empty());
    }

    #[test]
    fn validation_refuses_identity_and_coverage_drift() {
        let receipt = synthetic_receipt("descriptive:x", Vec::new());
        let bundle = bundle_with(vec![receipt], "fp", "kernel");

        // The honest mint validates.
        let honest = GovernedConsumerAttestationV1::for_receipt_bundle(&bundle).unwrap();
        assert!(honest.validate_for_bundle(&bundle).is_ok());

        let mut wrong_schema = honest.clone();
        wrong_schema.schema_version = "2".to_string();
        assert!(wrong_schema.validate_for_bundle(&bundle).is_err());

        let mut wrong_dataset = honest.clone();
        wrong_dataset.dataset_fingerprint = "other".to_string();
        assert!(wrong_dataset.validate_for_bundle(&bundle).is_err());

        let mut wrong_kernel = honest.clone();
        wrong_kernel.kernel_version = "other".to_string();
        assert!(wrong_kernel.validate_for_bundle(&bundle).is_err());

        // Empty identity fields.
        let mut empty_fp = honest.clone();
        empty_fp.dataset_fingerprint = String::new();
        assert!(empty_fp.validate_for_bundle(&bundle).is_err());

        // An attested receipt id absent from the bundle: the dangling case.
        let dangling = GovernedConsumerAttestationV1 {
            schema_version: GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION.to_string(),
            dataset_fingerprint: "fp".to_string(),
            kernel_version: "kernel".to_string(),
            consumers: vec![GovernedConsumerUseV1 {
                consumer_id: DESCRIPTIVE_STATISTICS_CONSUMER_ID.to_string(),
                receipt_ids: vec!["descriptive:absent-column".to_string()],
            }],
        };
        assert!(dangling.validate_for_bundle(&bundle).is_err());

        // Duplicate coverage of the same receipt.
        let duplicate = GovernedConsumerAttestationV1 {
            schema_version: GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION.to_string(),
            dataset_fingerprint: "fp".to_string(),
            kernel_version: "kernel".to_string(),
            consumers: vec![GovernedConsumerUseV1 {
                consumer_id: DESCRIPTIVE_STATISTICS_CONSUMER_ID.to_string(),
                receipt_ids: vec!["descriptive:x".to_string(), "descriptive:x".to_string()],
            }],
        };
        assert!(duplicate.validate_for_bundle(&bundle).is_err());

        // A duplicated consumer entry.
        let duplicated_consumer = GovernedConsumerAttestationV1 {
            schema_version: GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION.to_string(),
            dataset_fingerprint: "fp".to_string(),
            kernel_version: "kernel".to_string(),
            consumers: vec![
                GovernedConsumerUseV1 {
                    consumer_id: DESCRIPTIVE_STATISTICS_CONSUMER_ID.to_string(),
                    receipt_ids: vec!["descriptive:x".to_string()],
                },
                GovernedConsumerUseV1 {
                    consumer_id: DESCRIPTIVE_STATISTICS_CONSUMER_ID.to_string(),
                    receipt_ids: vec!["descriptive:x".to_string()],
                },
            ],
        };
        assert!(duplicated_consumer.validate_for_bundle(&bundle).is_err());

        // An attestation claiming a consumer over nothing is unbindable.
        let greedy = GovernedConsumerAttestationV1 {
            schema_version: GOVERNED_CONSUMER_ATTESTATION_SCHEMA_VERSION.to_string(),
            dataset_fingerprint: "fp".to_string(),
            kernel_version: "kernel".to_string(),
            consumers: vec![GovernedConsumerUseV1 {
                consumer_id: DESCRIPTIVE_STATISTICS_CONSUMER_ID.to_string(),
                receipt_ids: Vec::new(),
            }],
        };
        assert!(greedy.validate_for_bundle(&bundle).is_err());
    }

    #[test]
    fn coverage_is_attested_independently_of_receipt_quality() {
        // The mint attests receipt *coverage*, not receipt quality: a receipt
        // whose assumption is violated is still claimed, and the consumer-side
        // requirement profile refuses it. Keeping quality out of this module
        // is what keeps the closed profile registry the only quality authority.
        let violated = synthetic_receipt(
            "descriptive:x",
            vec![AssumptionCheck {
                assumption: "finite values".to_string(),
                status: AssumptionStatus::Violated,
                detail: "violated in fixture".to_string(),
            }],
        );
        let bundle = bundle_with(vec![violated], "fp", "kernel");
        let attestation = GovernedConsumerAttestationV1::for_receipt_bundle(&bundle).unwrap();
        assert_eq!(attestation.consumers.len(), 1);
        assert_eq!(
            attestation.consumers[0].receipt_ids,
            vec!["descriptive:x".to_string()]
        );
        assert_eq!(
            attestation.consumers[0].consumer_id,
            DESCRIPTIVE_STATISTICS_CONSUMER_ID
        );
    }

    #[test]
    fn support_policy_surface_stays_referenced() {
        // Guard that the support-policy vocabulary this module sits beside has
        // not been renamed out from under the receipt families it describes.
        assert_ne!(SupportPolicy::FullDataset, SupportPolicy::CompleteCase);
    }
}
