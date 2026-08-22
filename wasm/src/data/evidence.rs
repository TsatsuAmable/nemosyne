use serde::{Deserialize, Serialize};

use crate::data::measurement::AnalyticalGeometry;

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleSupport {
    pub total_rows: usize,
    pub rows_used: usize,
    pub rows_excluded: usize,
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
            sample_support: SampleSupport {
                total_rows: 10,
                rows_used: 10,
                rows_excluded: 0,
            },
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
}
