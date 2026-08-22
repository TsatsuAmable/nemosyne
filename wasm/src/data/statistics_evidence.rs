use serde::Serialize;

use crate::data::dataset::Dataset;
use crate::data::evidence::{
    AssumptionCheck, AssumptionStatus, EvidenceClaim, MethodProvenance, SupportPolicy,
};
use crate::data::statistics::{compute_statistics, ColumnStats, CorrelationPair};
use crate::data::support::finite_numeric_support;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatisticsEvidence {
    pub numeric: Vec<EvidenceClaim<ColumnStats>>,
    pub correlation: Vec<EvidenceClaim<CorrelationPair>>,
}

fn provenance(
    method: &str,
    kernel_version: &str,
    dataset_fingerprint: &str,
) -> MethodProvenance {
    MethodProvenance {
        method: method.to_string(),
        method_version: "statistics-v1".to_string(),
        kernel_version: kernel_version.to_string(),
        dataset_fingerprint: dataset_fingerprint.to_string(),
        parameters: Vec::new(),
    }
}

/// Adapt the existing descriptive/Pearson `Facts` calculations into explicit
/// evidence claims without changing the numerical algorithms or serialized
/// `Facts` ABI.
pub fn compute_statistics_evidence(
    dataset: &Dataset,
    dataset_fingerprint: &str,
    kernel_version: &str,
) -> StatisticsEvidence {
    let facts = compute_statistics(dataset);

    let numeric = facts
        .numeric
        .iter()
        .cloned()
        .map(|result| {
            let columns = vec![result.name.clone()];
            EvidenceClaim {
                claim_id: format!("descriptive:{}", result.name),
                estimand: format!(
                    "descriptive finite-value summary for column {}",
                    result.name
                ),
                sample_support: finite_numeric_support(dataset, &columns),
                result,
                method_provenance: provenance(
                    "descriptive/finite-numeric",
                    kernel_version,
                    dataset_fingerprint,
                ),
                geometry: None,
                assumptions: Vec::new(),
                uncertainty: None,
                stability: None,
                sensitivity: Vec::new(),
                limitations: vec![
                    "descriptive summary only; no population uncertainty has been estimated"
                        .to_string(),
                ],
            }
        })
        .collect();

    let correlation = facts
        .correlation
        .iter()
        .cloned()
        .map(|result| {
            let columns = vec![result.a.clone(), result.b.clone()];
            let mut sample_support = finite_numeric_support(dataset, &columns);
            sample_support.policy = SupportPolicy::PairwiseComplete;

            EvidenceClaim {
                claim_id: format!("pearson:{}:{}", result.a, result.b),
                estimand: format!(
                    "Pearson linear association between {} and {}",
                    result.a, result.b
                ),
                sample_support,
                result,
                method_provenance: provenance(
                    "dependency/pearson",
                    kernel_version,
                    dataset_fingerprint,
                ),
                geometry: None,
                assumptions: vec![
                    AssumptionCheck {
                        assumption: "observation independence for inferential interpretation"
                            .to_string(),
                        status: AssumptionStatus::NotTestableFromData,
                        detail: "requires observation-structure or study-design metadata"
                            .to_string(),
                    },
                    AssumptionCheck {
                        assumption: "Pearson r describes linear association only".to_string(),
                        status: AssumptionStatus::Satisfied,
                        detail: "claim terminology is restricted to linear association"
                            .to_string(),
                    },
                ],
                uncertainty: None,
                stability: None,
                sensitivity: Vec::new(),
                limitations: vec![
                    "no hypothesis test, p-value, confidence interval, or multiplicity correction is performed"
                        .to_string(),
                    "a weak Pearson coefficient does not establish absence of nonlinear dependence"
                        .to_string(),
                ],
            }
        })
        .collect();

    StatisticsEvidence {
        numeric,
        correlation,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::data::column::{Column, ColumnType};
    use crate::data::value::Value;

    use super::*;

    fn row(values: &[(&str, Value)]) -> HashMap<String, Value> {
        values
            .iter()
            .map(|(key, value)| ((*key).to_string(), value.clone()))
            .collect()
    }

    #[test]
    fn evidence_wraps_existing_statistics_without_changing_values() {
        let dataset = Dataset::new(
            "stats-evidence",
            vec![
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
            ],
            vec![
                row(&[("x", Value::Number(1.0)), ("y", Value::Number(2.0))]),
                row(&[("x", Value::Number(2.0)), ("y", Value::Number(4.0))]),
                row(&[("x", Value::Null), ("y", Value::Number(6.0))]),
            ],
        );

        let facts = compute_statistics(&dataset);
        let evidence = compute_statistics_evidence(&dataset, "fp", "kernel");

        assert_eq!(evidence.numeric[0].result.mean, facts.numeric[0].mean);
        assert_eq!(evidence.correlation[0].result.value, facts.correlation[0].value);
        assert_eq!(evidence.numeric[0].sample_support.rows_used, 2);
        assert_eq!(evidence.correlation[0].sample_support.rows_used, 2);
        assert_eq!(
            evidence.correlation[0].sample_support.policy,
            SupportPolicy::PairwiseComplete
        );
        assert!(evidence.correlation[0].has_unresolved_assumptions());
    }
}
