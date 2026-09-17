use crate::data::fingerprint::sha256_hex;
use serde::{Deserialize, Serialize};

pub const EFFECTIVE_FEATURE_AUTHORITY_SCHEMA_VERSION: &str = "1";
pub const EFFECTIVE_FEATURE_AUTHORITY_VERSION: &str = "numerical-rank-v1";
const ASSUMPTIONS: [&str; 3] = [
    "numeric features share lawful linear geometry",
    "numerical rank uses a scale-relative floating-point tolerance",
    "diagnostic only; not high-dimensional admission policy",
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EffectiveFeatureAuthorityStatus {
    Eligible,
    Abstain,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectiveFeatureAuthorityArtifactV1 {
    pub schema_version: String,
    pub authority_version: String,
    pub dataset_fingerprint: String,
    pub ordered_feature_ids: Vec<String>,
    pub target_claim: String,
    pub estimator_id: String,
    pub estimator_version: String,
    pub ambient_feature_count: usize,
    pub effective_feature_count: Option<usize>,
    pub status: EffectiveFeatureAuthorityStatus,
    pub refusal_reasons: Vec<String>,
    pub assumptions: Vec<String>,
    pub artifact_digest: String,
}

/// Floating-point numerical rank for a finite rectangular matrix.
/// The pivot threshold is relative to matrix scale. This is not exact symbolic
/// rank and must not be interpreted as intrinsic dimensionality.
fn rank(mut matrix: Vec<Vec<f64>>) -> usize {
    if matrix.is_empty() || matrix[0].is_empty() {
        return 0;
    }
    let rows = matrix.len();
    let cols = matrix[0].len();
    let scale = matrix
        .iter()
        .flatten()
        .map(|value| value.abs())
        .fold(0.0_f64, f64::max);
    if scale == 0.0 {
        return 0;
    }
    let tolerance = f64::EPSILON * (rows.max(cols) as f64) * scale;
    let mut pivot_row = 0;
    for col in 0..cols {
        let Some(best) = (pivot_row..rows)
            .max_by(|&a, &b| matrix[a][col].abs().total_cmp(&matrix[b][col].abs()))
        else {
            break;
        };
        if matrix[best][col].abs() <= tolerance {
            continue;
        }
        matrix.swap(pivot_row, best);
        let pivot = matrix[pivot_row][col];
        for row in 0..rows {
            if row == pivot_row {
                continue;
            }
            let factor = matrix[row][col] / pivot;
            for c in col..cols {
                matrix[row][c] -= factor * matrix[pivot_row][c];
            }
        }
        pivot_row += 1;
        if pivot_row == rows {
            break;
        }
    }
    pivot_row
}

fn digest_preimage(
    dataset_fingerprint: &str,
    ordered_feature_ids: &[String],
    target_claim: &str,
    effective: Option<usize>,
    refusal: &[String],
    assumptions: &[String],
) -> String {
    format!(
        "{}|{}|{}|{:?}|{}|{}|{}|{:?}|{:?}|{:?}",
        EFFECTIVE_FEATURE_AUTHORITY_SCHEMA_VERSION,
        EFFECTIVE_FEATURE_AUTHORITY_VERSION,
        dataset_fingerprint,
        ordered_feature_ids,
        target_claim,
        "NUMERICAL_MATRIX_RANK",
        "1",
        effective,
        refusal,
        assumptions
    )
}

pub fn numeric_linear_rank_artifact(
    dataset_fingerprint: &str,
    ordered_feature_ids: Vec<String>,
    rows: &[Vec<f64>],
    target_claim: &str,
) -> EffectiveFeatureAuthorityArtifactV1 {
    let ambient = ordered_feature_ids.len();
    let rectangular = rows.iter().all(|r| r.len() == ambient);
    let finite = rows.iter().flatten().all(|v| v.is_finite());
    let mut refusal = Vec::new();
    if target_claim != "NUMERIC_LINEAR_RANK_DIAGNOSTIC" {
        refusal.push("UNSUPPORTED_TARGET_CLAIM".into());
    }
    if !rectangular {
        refusal.push("NON_RECTANGULAR_INPUT".into());
    }
    if !finite {
        refusal.push("NON_FINITE_INPUT".into());
    }
    if rows.is_empty() || ambient == 0 {
        refusal.push("INSUFFICIENT_EVIDENCE".into());
    }
    let eligible = refusal.is_empty();
    let effective = eligible.then(|| rank(rows.to_vec()));
    let status = if eligible {
        EffectiveFeatureAuthorityStatus::Eligible
    } else {
        EffectiveFeatureAuthorityStatus::Abstain
    };
    let assumptions = ASSUMPTIONS
        .iter()
        .map(|value| (*value).into())
        .collect::<Vec<String>>();
    let artifact_digest = sha256_hex(&digest_preimage(
        dataset_fingerprint,
        &ordered_feature_ids,
        target_claim,
        effective,
        &refusal,
        &assumptions,
    ));
    EffectiveFeatureAuthorityArtifactV1 {
        schema_version: EFFECTIVE_FEATURE_AUTHORITY_SCHEMA_VERSION.into(),
        authority_version: EFFECTIVE_FEATURE_AUTHORITY_VERSION.into(),
        dataset_fingerprint: dataset_fingerprint.into(),
        ordered_feature_ids,
        target_claim: target_claim.into(),
        estimator_id: "NUMERICAL_MATRIX_RANK".into(),
        estimator_version: "1".into(),
        ambient_feature_count: ambient,
        effective_feature_count: effective,
        status,
        refusal_reasons: refusal,
        assumptions,
        artifact_digest,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_columns_have_rank_one() {
        let rows = (0..20).map(|i| vec![i as f64; 8]).collect::<Vec<_>>();
        let ids = (0..8).map(|i| format!("x{i}")).collect();
        let a = numeric_linear_rank_artifact("fp", ids, &rows, "NUMERIC_LINEAR_RANK_DIAGNOSTIC");
        assert_eq!(a.effective_feature_count, Some(1));
        assert_eq!(a.status, EffectiveFeatureAuthorityStatus::Eligible);
    }

    #[test]
    fn linear_dependence_has_rank_two() {
        let rows = (0..20)
            .map(|i| {
                let x = i as f64;
                let y = (i * i) as f64;
                vec![x, y, x + y]
            })
            .collect::<Vec<_>>();
        let a = numeric_linear_rank_artifact(
            "fp",
            vec!["x".into(), "y".into(), "sum".into()],
            &rows,
            "NUMERIC_LINEAR_RANK_DIAGNOSTIC",
        );
        assert_eq!(a.effective_feature_count, Some(2));
    }

    #[test]
    fn zero_matrix_has_rank_zero() {
        let a = numeric_linear_rank_artifact(
            "fp",
            vec!["a".into(), "b".into()],
            &[vec![0.0, 0.0], vec![0.0, 0.0]],
            "NUMERIC_LINEAR_RANK_DIAGNOSTIC",
        );
        assert_eq!(a.status, EffectiveFeatureAuthorityStatus::Eligible);
        assert_eq!(a.effective_feature_count, Some(0));
    }

    #[test]
    fn rank_is_invariant_to_uniform_rescaling() {
        let base = vec![vec![1.0, 0.0], vec![0.0, 1.0]];
        let tiny = base
            .iter()
            .map(|row| row.iter().map(|value| value * 1e-20).collect())
            .collect::<Vec<Vec<f64>>>();
        let huge = base
            .iter()
            .map(|row| row.iter().map(|value| value * 1e20).collect())
            .collect::<Vec<Vec<f64>>>();
        assert_eq!(rank(base), 2);
        assert_eq!(rank(tiny), 2);
        assert_eq!(rank(huge), 2);
    }

    #[test]
    fn unsupported_claim_abstains() {
        let a = numeric_linear_rank_artifact(
            "fp",
            vec!["a".into(), "b".into()],
            &[vec![0.2, 0.8], vec![0.4, 0.6]],
            "COMPOSITIONAL_EFFECTIVE_DIMENSION",
        );
        assert_eq!(a.status, EffectiveFeatureAuthorityStatus::Abstain);
        assert_eq!(a.effective_feature_count, None);
        assert!(a
            .refusal_reasons
            .contains(&"UNSUPPORTED_TARGET_CLAIM".into()));
    }

    #[test]
    fn malformed_numeric_evidence_abstains() {
        let non_rectangular = numeric_linear_rank_artifact(
            "fp",
            vec!["a".into(), "b".into()],
            &[vec![1.0, 2.0], vec![3.0]],
            "NUMERIC_LINEAR_RANK_DIAGNOSTIC",
        );
        assert_eq!(non_rectangular.status, EffectiveFeatureAuthorityStatus::Abstain);
        assert_eq!(non_rectangular.effective_feature_count, None);
        assert!(non_rectangular
            .refusal_reasons
            .contains(&"NON_RECTANGULAR_INPUT".into()));

        let non_finite = numeric_linear_rank_artifact(
            "fp",
            vec!["a".into()],
            &[vec![f64::NAN]],
            "NUMERIC_LINEAR_RANK_DIAGNOSTIC",
        );
        assert_eq!(non_finite.status, EffectiveFeatureAuthorityStatus::Abstain);
        assert_eq!(non_finite.effective_feature_count, None);
        assert!(non_finite
            .refusal_reasons
            .contains(&"NON_FINITE_INPUT".into()));
    }

    #[test]
    fn digest_binds_ordered_features() {
        let rows = [vec![1.0, 2.0], vec![2.0, 4.0]];
        let a = numeric_linear_rank_artifact(
            "fp",
            vec!["a".into(), "b".into()],
            &rows,
            "NUMERIC_LINEAR_RANK_DIAGNOSTIC",
        );
        let b = numeric_linear_rank_artifact(
            "fp",
            vec!["b".into(), "a".into()],
            &rows,
            "NUMERIC_LINEAR_RANK_DIAGNOSTIC",
        );
        assert_ne!(a.artifact_digest, b.artifact_digest);
    }

    #[test]
    fn digest_binds_claim_dataset_and_refusal_state() {
        let rows = [vec![1.0, 2.0], vec![2.0, 4.0]];
        let a = numeric_linear_rank_artifact(
            "fp-a",
            vec!["a".into(), "b".into()],
            &rows,
            "NUMERIC_LINEAR_RANK_DIAGNOSTIC",
        );
        let b = numeric_linear_rank_artifact("fp-a", vec!["a".into(), "b".into()], &rows, "OTHER");
        let c = numeric_linear_rank_artifact(
            "fp-b",
            vec!["a".into(), "b".into()],
            &rows,
            "NUMERIC_LINEAR_RANK_DIAGNOSTIC",
        );
        assert_ne!(a.artifact_digest, b.artifact_digest);
        assert_ne!(a.artifact_digest, c.artifact_digest);
        assert_ne!(a.refusal_reasons, b.refusal_reasons);
    }

    #[test]
    fn digest_binds_assumptions() {
        let feature_ids = vec!["a".into(), "b".into()];
        let refusal = Vec::<String>::new();
        let assumptions = ASSUMPTIONS
            .iter()
            .map(|value| (*value).into())
            .collect::<Vec<String>>();
        let mut changed_assumptions = assumptions.clone();
        changed_assumptions[1] = "different numerical tolerance contract".into();
        let a = sha256_hex(&digest_preimage(
            "fp",
            &feature_ids,
            "NUMERIC_LINEAR_RANK_DIAGNOSTIC",
            Some(1),
            &refusal,
            &assumptions,
        ));
        let b = sha256_hex(&digest_preimage(
            "fp",
            &feature_ids,
            "NUMERIC_LINEAR_RANK_DIAGNOSTIC",
            Some(1),
            &refusal,
            &changed_assumptions,
        ));
        assert_ne!(a, b);
    }
}
