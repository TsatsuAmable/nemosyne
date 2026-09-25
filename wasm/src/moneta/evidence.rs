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

    // Sample-count weighting: a saturating size multiplier approaching 1.0 at N=10.
    // This is a sample-count weight, not statistical confidence.
    let sample_count_weight = (ev.sample_count as f64 / 10.0).min(1.0);

    // Delta relative to baseline neutral utility (0.5)
    // Positive utility (>0.5) decreases penalty cost (better).
    // Negative utility (<0.5) increases penalty cost (worse).
    let utility_delta = (ev.composite_utility - 0.5) * 30.0 * sample_count_weight;
    let adjusted_cost = (base_cost - utility_delta).max(0.0).round();

    (adjusted_cost, (-utility_delta).round())
}

#[cfg(test)]
mod tests {
    use super::*;

    // TEC2 authority pinning tests: `moneta::evidence` is the single compiled
    // implementation of the sample-count cost adjustment (`draco` is a `pub
    // use` alias of `moneta` in `lib.rs`, so the wasm export
    // `draco_adjust_evidence` reaches this code). These tests pin the exact
    // current numerics — including the zero/absent-evidence semantics — so any
    // drift in scale, saturation, or the zero-sample fail-closed path fails
    // here before it can reach the ABI. Sample count is a bounded support
    // multiplier, not statistical confidence; no rename may say otherwise.

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

    #[test]
    fn absent_evidence_leaves_cost_unchanged() {
        let (adjusted, delta) = adjust_candidate_cost_with_evidence(50.0, None);
        assert_eq!(adjusted, 50.0);
        assert_eq!(delta, 0.0);
    }

    #[test]
    fn zero_sample_count_leaves_cost_unchanged() {
        // Zero observations carry no empirical support: the adjustment must
        // fail closed to the base cost, never to a neutral-utility shift.
        let ev = EmpiricalUtilityEvidence {
            sample_count: 0,
            composite_utility: 0.9,
        };
        let (adjusted, delta) = adjust_candidate_cost_with_evidence(50.0, Some(&ev));
        assert_eq!(adjusted, 50.0);
        assert_eq!(delta, 0.0);
    }

    #[test]
    fn sample_count_scales_linearly_below_saturation() {
        // N=5 is exactly half the N=10 saturation point, so the utility delta
        // is half of the saturated value: (0.8 - 0.5) * 30.0 * 0.5 = 4.5.
        // The reported delta is (-4.5).round(): f64::round rounds half away
        // from zero, so it is -5.0, not -4.5.
        let ev = EmpiricalUtilityEvidence {
            sample_count: 5,
            composite_utility: 0.8,
        };
        let (adjusted, delta) = adjust_candidate_cost_with_evidence(50.0, Some(&ev));
        assert_eq!(adjusted, 46.0);
        assert_eq!(delta, -5.0);
    }

    #[test]
    fn sample_count_saturates_at_ten() {
        let ev = EmpiricalUtilityEvidence {
            sample_count: 100,
            composite_utility: 0.8,
        };
        let (adjusted, delta) = adjust_candidate_cost_with_evidence(50.0, Some(&ev));
        // Identical to the N=10 case: the weight is capped at 1.0.
        assert_eq!(adjusted, 41.0);
        assert_eq!(delta, -9.0);
    }

    #[test]
    fn below_neutral_utility_increases_cost() {
        let ev = EmpiricalUtilityEvidence {
            sample_count: 10,
            composite_utility: 0.2,
        };
        let (adjusted, delta) = adjust_candidate_cost_with_evidence(50.0, Some(&ev));
        assert_eq!(adjusted, 59.0);
        assert_eq!(delta, 9.0);
    }

    #[test]
    fn adjusted_cost_never_drops_below_zero() {
        let ev = EmpiricalUtilityEvidence {
            sample_count: 10,
            composite_utility: 1.0,
        };
        let (adjusted, delta) = adjust_candidate_cost_with_evidence(5.0, Some(&ev));
        assert_eq!(adjusted, 0.0);
        assert_eq!(delta, -15.0);
    }
}
