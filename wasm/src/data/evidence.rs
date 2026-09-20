use serde::{Deserialize, Serialize};

use crate::data::measurement::{AnalyticalAdmission, AnalyticalGeometry};
use crate::data::measurement_inference::{MeasurementModelRecord, SemanticAdmissionPolicy};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AssumptionStatus {
    Satisfied,
    Violated,
    Unchecked,
    NotTestableFromData,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssumptionCheck {
    pub assumption: String,
    pub status: AssumptionStatus,
    pub detail: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SupportPolicy {
    FullDataset,
    CompleteCase,
    PairwiseComplete,
    FilteredSubset,
    Imputed,
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExclusionReasonCount {
    pub reason: String,
    pub row_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleSupport {
    pub total_rows: usize,
    pub rows_used: usize,
    pub rows_excluded: usize,
    pub columns: Vec<String>,
    pub policy: SupportPolicy,
    pub exclusion_reasons: Vec<ExclusionReasonCount>,
}

impl SampleSupport {
    pub fn new(
        total_rows: usize,
        rows_used: usize,
        columns: Vec<String>,
        policy: SupportPolicy,
        exclusion_reasons: Vec<ExclusionReasonCount>,
    ) -> Result<Self, String> {
        if rows_used > total_rows {
            return Err("rows_used cannot exceed total_rows".to_string());
        }
        let rows_excluded = total_rows - rows_used;
        let explained: usize = exclusion_reasons
            .iter()
            .map(|reason| reason.row_count)
            .sum();
        if explained > rows_excluded {
            return Err("exclusion reason counts cannot exceed rows_excluded".to_string());
        }
        Ok(Self {
            total_rows,
            rows_used,
            rows_excluded,
            columns,
            policy,
            exclusion_reasons,
        })
    }

    pub fn full_dataset(total_rows: usize, columns: Vec<String>) -> Self {
        Self {
            total_rows,
            rows_used: total_rows,
            rows_excluded: 0,
            columns,
            policy: SupportPolicy::FullDataset,
            exclusion_reasons: Vec::new(),
        }
    }

    pub fn support_fraction(&self) -> f64 {
        if self.total_rows == 0 {
            0.0
        } else {
            self.rows_used as f64 / self.total_rows as f64
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Uncertainty {
    pub method: String,
    pub lower: Option<f64>,
    pub upper: Option<f64>,
    pub standard_error: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stability {
    pub method: String,
    pub score: f64,
    pub repetitions: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SensitivityResult {
    pub factor: String,
    pub tested_values: Vec<String>,
    pub materially_changed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MethodProvenance {
    pub method: String,
    pub method_version: String,
    pub kernel_version: String,
    pub dataset_fingerprint: String,
    pub parameters: Vec<(String, String)>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceClaim<T> {
    pub claim_id: String,
    pub estimand: String,
    pub result: T,
    pub method_provenance: MethodProvenance,
    pub geometry: Option<AnalyticalGeometry>,
    pub assumptions: Vec<AssumptionCheck>,
    pub sample_support: SampleSupport,
    pub uncertainty: Option<Uncertainty>,
    pub stability: Option<Stability>,
    pub sensitivity: Vec<SensitivityResult>,
    pub limitations: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EvidenceMeasurementContextV1 {
    NotEstablished,
    Established {
        records: Vec<MeasurementModelRecord>,
        #[serde(rename = "semanticAdmissionPolicy")]
        semantic_admission_policy: Option<SemanticAdmissionPolicy>,
        #[serde(rename = "analyticalAdmission")]
        analytical_admission: Option<AnalyticalAdmission>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceReceiptV1 {
    pub receipt_id: String,
    pub claim_id: String,
    pub estimand: String,
    pub measurement_context: EvidenceMeasurementContextV1,
    pub geometry: Option<AnalyticalGeometry>,
    pub assumptions: Vec<AssumptionCheck>,
    pub sample_support: SampleSupport,
    pub uncertainty: Option<Uncertainty>,
    pub stability: Option<Stability>,
    pub sensitivity: Vec<SensitivityResult>,
    pub limitations: Vec<String>,
    pub method_provenance: MethodProvenance,
}

impl EvidenceReceiptV1 {
    pub fn from_claim<T>(
        claim: &EvidenceClaim<T>,
        measurement_context: EvidenceMeasurementContextV1,
    ) -> Self {
        Self {
            receipt_id: claim.claim_id.clone(),
            claim_id: claim.claim_id.clone(),
            estimand: claim.estimand.clone(),
            measurement_context,
            geometry: claim.geometry.clone(),
            assumptions: claim.assumptions.clone(),
            sample_support: claim.sample_support.clone(),
            uncertainty: claim.uncertainty.clone(),
            stability: claim.stability.clone(),
            sensitivity: claim.sensitivity.clone(),
            limitations: claim.limitations.clone(),
            method_provenance: claim.method_provenance.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceReceiptBundleV1 {
    pub schema_version: String,
    pub dataset_fingerprint: String,
    pub kernel_version: String,
    pub receipts: Vec<EvidenceReceiptV1>,
}

impl EvidenceReceiptBundleV1 {
    pub fn new(
        dataset_fingerprint: impl Into<String>,
        kernel_version: impl Into<String>,
        receipts: Vec<EvidenceReceiptV1>,
    ) -> Result<Self, String> {
        let dataset_fingerprint = dataset_fingerprint.into();
        let kernel_version = kernel_version.into();
        if dataset_fingerprint.is_empty() || kernel_version.is_empty() {
            return Err("receipt bundle identity fields must be non-empty".to_string());
        }

        let mut ids = std::collections::HashSet::new();
        for receipt in &receipts {
            if receipt.receipt_id.is_empty() || receipt.claim_id.is_empty() {
                return Err("receipt identities must be non-empty".to_string());
            }
            if receipt.method_provenance.dataset_fingerprint != dataset_fingerprint {
                return Err("receipt dataset fingerprint does not match bundle".to_string());
            }
            if receipt.method_provenance.kernel_version != kernel_version {
                return Err("receipt kernel version does not match bundle".to_string());
            }
            if !ids.insert(receipt.receipt_id.clone()) {
                return Err("duplicate receipt id".to_string());
            }
        }

        Ok(Self {
            schema_version: "1".to_string(),
            dataset_fingerprint,
            kernel_version,
            receipts,
        })
    }
}

impl<T> EvidenceClaim<T> {
    pub fn has_violated_assumptions(&self) -> bool {
        self.assumptions
            .iter()
            .any(|check| check.status == AssumptionStatus::Violated)
    }

    pub fn has_unresolved_assumptions(&self) -> bool {
        self.assumptions.iter().any(|check| {
            matches!(
                check.status,
                AssumptionStatus::Unchecked | AssumptionStatus::NotTestableFromData
            )
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn claim(assumptions: Vec<AssumptionCheck>) -> EvidenceClaim<f64> {
        EvidenceClaim {
            claim_id: "claim-1".to_string(),
            estimand: "example estimand".to_string(),
            result: 0.5,
            method_provenance: MethodProvenance {
                method: "example".to_string(),
                method_version: "1".to_string(),
                kernel_version: "test".to_string(),
                dataset_fingerprint: "fingerprint".to_string(),
                parameters: Vec::new(),
            },
            geometry: None,
            assumptions,
            sample_support: SampleSupport::full_dataset(10, vec!["x".to_string()]),
            uncertainty: None,
            stability: None,
            sensitivity: Vec::new(),
            limitations: Vec::new(),
        }
    }

    #[test]
    fn violated_assumptions_are_explicit() {
        let evidence = claim(vec![AssumptionCheck {
            assumption: "independence".to_string(),
            status: AssumptionStatus::Violated,
            detail: "repeated measures detected".to_string(),
        }]);
        assert!(evidence.has_violated_assumptions());
    }

    #[test]
    fn unresolved_assumptions_remain_visible() {
        let evidence = claim(vec![AssumptionCheck {
            assumption: "sampling mechanism".to_string(),
            status: AssumptionStatus::NotTestableFromData,
            detail: "requires study-design metadata".to_string(),
        }]);
        assert!(evidence.has_unresolved_assumptions());
    }

    #[test]
    fn sample_support_rejects_impossible_counts() {
        let result = SampleSupport::new(
            10,
            11,
            vec!["x".to_string()],
            SupportPolicy::CompleteCase,
            Vec::new(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn sample_support_preserves_policy_scope_and_exclusions() {
        let support = SampleSupport::new(
            10,
            7,
            vec!["x".to_string(), "y".to_string()],
            SupportPolicy::CompleteCase,
            vec![ExclusionReasonCount {
                reason: "missing requested column".to_string(),
                row_count: 3,
            }],
        )
        .expect("valid support");

        assert_eq!(support.rows_excluded, 3);
        assert_eq!(support.support_fraction(), 0.7);
        assert_eq!(support.columns.len(), 2);
    }

    #[test]
    fn receipt_preserves_absent_axes_as_absent() {
        let evidence = claim(Vec::new());
        let receipt =
            EvidenceReceiptV1::from_claim(&evidence, EvidenceMeasurementContextV1::NotEstablished);
        assert_eq!(receipt.receipt_id, evidence.claim_id);
        assert!(receipt.geometry.is_none());
        assert!(receipt.uncertainty.is_none());
        assert!(receipt.stability.is_none());
        assert!(receipt.sensitivity.is_empty());
        assert!(matches!(
            receipt.measurement_context,
            EvidenceMeasurementContextV1::NotEstablished
        ));
    }

    #[test]
    fn receipt_bundle_rejects_duplicate_or_mismatched_identity() {
        let evidence = claim(Vec::new());
        let receipt =
            EvidenceReceiptV1::from_claim(&evidence, EvidenceMeasurementContextV1::NotEstablished);
        assert!(EvidenceReceiptBundleV1::new(
            "fingerprint",
            "test",
            vec![receipt.clone(), receipt.clone()]
        )
        .is_err());

        let mut mismatched = receipt;
        mismatched.method_provenance.dataset_fingerprint = "other".to_string();
        assert!(EvidenceReceiptBundleV1::new("fingerprint", "test", vec![mismatched]).is_err());
    }

    #[test]
    fn established_measurement_context_uses_the_v1_camel_case_wire_shape() {
        let context = EvidenceMeasurementContextV1::Established {
            records: vec![MeasurementModelRecord::from_storage(
                &crate::data::column::Column::new("t", crate::data::column::ColumnType::Temporal),
            )],
            semantic_admission_policy: Some(SemanticAdmissionPolicy::AllowInferred),
            analytical_admission: Some(AnalyticalAdmission {
                status: crate::data::measurement::AdmissionStatus::Admitted,
                issues: Vec::new(),
            }),
        };
        let value = serde_json::to_value(context).expect("serialize measurement context");
        assert_eq!(value["status"], "ESTABLISHED");
        assert!(value.get("semanticAdmissionPolicy").is_some());
        assert!(value.get("analyticalAdmission").is_some());
        assert!(value.get("semantic_admission_policy").is_none());
        assert!(value.get("analytical_admission").is_none());
    }
}
