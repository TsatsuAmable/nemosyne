use serde::Serialize;

use crate::data::dataset::Dataset;
use crate::data::evidence::{
    AssumptionCheck, AssumptionStatus, EvidenceClaim, MethodProvenance, SupportPolicy,
};
use crate::data::statistics::{
    compute_statistics, CategoricalStats, ColumnStats, CorrelationPair, TemporalStats,
};
use crate::data::support::{
    finite_numeric_support, legacy_temporal_support, observed_value_support,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatisticsEvidence {
    pub numeric: Vec<EvidenceClaim<ColumnStats>>,
    pub correlation: Vec<EvidenceClaim<CorrelationPair>>,
    pub categorical: Vec<EvidenceClaim<CategoricalStats>>,
    pub temporal: Vec<EvidenceClaim<TemporalStats>>,
}

fn provenance(method: &str, kernel_version: &str, dataset_fingerprint: &str) -> MethodProvenance {
    MethodProvenance {
        method: method.to_string(),
        method_version: "statistics-v1".to_string(),
        kernel_version: kernel_version.to_string(),
        dataset_fingerprint: dataset_fingerprint.to_string(),
        parameters: Vec::new(),
    }
}

/// Adapt the existing `Facts` calculations into explicit evidence claims
/// without changing the numerical algorithms or serialized `Facts` ABI.
pub fn compute_statistics_evidence(
    dataset: &Dataset,
    dataset_fingerprint: &str,
    kernel_version: &str,
) -> StatisticsEvidence {
    let facts = compute_statistics(dataset);

    let numeric = facts.numeric.iter().cloned().map(|result| {
        let columns = vec![result.name.clone()];
        EvidenceClaim {
            claim_id: format!("descriptive:{}", result.name),
            estimand: format!("descriptive finite-value summary for column {}", result.name),
            sample_support: finite_numeric_support(dataset, &columns),
            result,
            method_provenance: provenance("descriptive/finite-numeric", kernel_version, dataset_fingerprint),
            geometry: None,
            assumptions: Vec::new(),
            uncertainty: None,
            stability: None,
            sensitivity: Vec::new(),
            limitations: vec!["descriptive summary only; no population uncertainty has been estimated".to_string()],
        }
    }).collect();

    let correlation = facts.correlation.iter().cloned().map(|result| {
        let columns = vec![result.a.clone(), result.b.clone()];
        let mut sample_support = finite_numeric_support(dataset, &columns);
        sample_support.policy = SupportPolicy::PairwiseComplete;
        EvidenceClaim {
            claim_id: format!("pearson:{}:{}", result.a, result.b),
            estimand: format!("Pearson linear association between {} and {}", result.a, result.b),
            sample_support,
            result,
            method_provenance: provenance("dependency/pearson", kernel_version, dataset_fingerprint),
            geometry: None,
            assumptions: vec![
                AssumptionCheck {
                    assumption: "observation independence for inferential interpretation".to_string(),
                    status: AssumptionStatus::NotTestableFromData,
                    detail: "requires observation-structure or study-design metadata".to_string(),
                },
                AssumptionCheck {
                    assumption: "Pearson r describes linear association only".to_string(),
                    status: AssumptionStatus::Satisfied,
                    detail: "claim terminology is restricted to linear association".to_string(),
                },
            ],
            uncertainty: None,
            stability: None,
            sensitivity: Vec::new(),
            limitations: vec![
                "no hypothesis test, p-value, confidence interval, or multiplicity correction is performed".to_string(),
                "a weak Pearson coefficient does not establish absence of nonlinear dependence".to_string(),
            ],
        }
    }).collect();

    let categorical = facts.categorical.iter().cloned().map(|result| EvidenceClaim {
        claim_id: format!("categorical:{}", result.name),
        estimand: format!("empirical categorical cardinality, entropy, and top counts for {}", result.name),
        sample_support: observed_value_support(dataset, &result.name),
        result,
        method_provenance: provenance("descriptive/categorical-frequency", kernel_version, dataset_fingerprint),
        geometry: None,
        assumptions: Vec::new(),
        uncertainty: None,
        stability: None,
        sensitivity: Vec::new(),
        limitations: vec![
            "entropy is an empirical descriptive quantity over observed non-null values".to_string(),
            "no population uncertainty or missingness-mechanism adjustment is performed".to_string(),
        ],
    }).collect();

    let temporal = facts.temporal_stats.iter().cloned().map(|result| {
        let support = if result.value_column.is_empty() {
            crate::data::evidence::SampleSupport::full_dataset(dataset.row_count(), vec![result.column.clone()])
        } else {
            legacy_temporal_support(dataset, &result.column, &result.value_column)
        };
        EvidenceClaim {
            claim_id: format!("temporal:{}:{}", result.column, result.value_column),
            estimand: format!("legacy temporal trend and lag-quarter seasonality heuristic for {} using {}", result.column, result.value_column),
            sample_support: support,
            result,
            method_provenance: provenance("temporal/legacy-trend-seasonality-heuristic", kernel_version, dataset_fingerprint),
            geometry: None,
            assumptions: vec![AssumptionCheck {
                assumption: "temporal ordering and sampling semantics are scientifically meaningful".to_string(),
                status: AssumptionStatus::NotTestableFromData,
                detail: "the current legacy heuristic does not establish regular sampling, stationarity, or independence".to_string(),
            }],
            uncertainty: None,
            stability: None,
            sensitivity: Vec::new(),
            limitations: vec![
                "trend is an index-based least-squares heuristic normalized by observed value range".to_string(),
                "seasonality is a lag-n/4 autocorrelation hint and is not a calibrated periodicity test".to_string(),
                "legacy temporal ordering accepts a present null temporal value; this adapter mirrors rather than changes that behavior".to_string(),
            ],
        }
    }).collect();

    StatisticsEvidence { numeric, correlation, categorical, temporal }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use crate::data::column::{Column, ColumnType};
    use crate::data::value::Value;
    use super::*;

    fn row(values: &[(&str, Value)]) -> HashMap<String, Value> {
        values.iter().map(|(key, value)| ((*key).to_string(), value.clone())).collect()
    }

    #[test]
    fn evidence_wraps_existing_statistics_without_changing_values() {
        let dataset = Dataset::new(
            "stats-evidence",
            vec![
                Column::new("x", ColumnType::Numeric),
                Column::new("y", ColumnType::Numeric),
                Column::new("group", ColumnType::Categorical),
                Column::new("t", ColumnType::Temporal),
            ],
            vec![
                row(&[("x", Value::Number(1.0)), ("y", Value::Number(2.0)), ("group", Value::Text("a".into())), ("t", Value::Text("2026-01-01".into()))]),
                row(&[("x", Value::Number(2.0)), ("y", Value::Number(4.0)), ("group", Value::Text("a".into())), ("t", Value::Text("2026-01-02".into()))]),
                row(&[("x", Value::Null), ("y", Value::Number(6.0)), ("group", Value::Null), ("t", Value::Text("2026-01-03".into()))]),
            ],
        );

        let facts = compute_statistics(&dataset);
        let evidence = compute_statistics_evidence(&dataset, "fp", "kernel");

        assert_eq!(evidence.numeric[0].result.mean, facts.numeric[0].mean);
        assert_eq!(evidence.correlation[0].result.value, facts.correlation[0].value);
        assert_eq!(evidence.categorical[0].result.entropy, facts.categorical[0].entropy);
        assert_eq!(evidence.temporal[0].result.normalized_slope, facts.temporal_stats[0].normalized_slope);
        assert_eq!(evidence.numeric[0].sample_support.rows_used, 2);
        assert_eq!(evidence.correlation[0].sample_support.rows_used, 2);
        assert_eq!(evidence.categorical[0].sample_support.rows_used, 2);
        assert_eq!(evidence.temporal[0].sample_support.rows_used, 2);
        assert_eq!(evidence.correlation[0].sample_support.policy, SupportPolicy::PairwiseComplete);
        assert!(evidence.correlation[0].has_unresolved_assumptions());
        assert!(evidence.temporal[0].has_unresolved_assumptions());
        assert!(evidence.temporal[0].limitations.iter().any(|x| x.contains("not a calibrated periodicity test")));
        assert!(evidence.categorical[0].limitations.iter().any(|x| x.contains("missingness-mechanism")));
    }
}
