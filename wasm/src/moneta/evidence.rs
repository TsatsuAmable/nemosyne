use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmpiricalUtilityEvidence {
    pub sample_count: usize,
    pub composite_utility: f64,
}

pub fn adjust_candidate_cost_with_evidence(
    base_cost: f64,
    evidence: Option<&EmpiricalUtilityEvidence>,
) -> (f64, f64) {
    let ev = match evidence {
        Some(e) if e.sample_count > 0 => e,
        _ => return (base_cost, 0.0),
    };

    // Confidence weighting based on sample count (approaches 1.0 at N=10)
    let confidence_weight = (ev.sample_count as f64 / 10.0).min(1.0);

    // Delta relative to baseline neutral utility (0.5)
    // Positive utility (>0.5) decreases penalty cost (better).
    // Negative utility (<0.5) increases penalty cost (worse).
    let utility_delta = (ev.composite_utility - 0.5) * 30.0 * confidence_weight;
    let adjusted_cost = (base_cost - utility_delta).max(0.0).round();

    (adjusted_cost, (-utility_delta).round())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adjust_cost_reduces_penalty_for_positive_utility() {
        let ev = EmpiricalUtilityEvidence {
            sample_count: 10,
            composite_utility: 0.8,
        };
        let (adjusted, delta) = adjust_candidate_cost_with_evidence(50.0, Some(&ev));
        assert!(adjusted < 50.0);
        assert_eq!(delta, -9.0);
    }
}
