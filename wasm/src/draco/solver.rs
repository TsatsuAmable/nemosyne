use crate::draco::constraints::{check_hard_constraints, get_default_soft_constraints};
use crate::draco::types::{DracoFacts, DracoSpec, SolverResult, VRBehavior, VRGeometry, VRInteraction, VRLayout};

pub fn generate_all_candidates() -> Vec<DracoSpec> {
    let mut candidates = Vec::with_capacity(3168);
    for &layout in &VRLayout::ALL {
        for &geometry in &VRGeometry::ALL {
            for &behavior in &VRBehavior::ALL {
                for &interaction in &VRInteraction::ALL {
                    candidates.push(DracoSpec {
                        layout,
                        geometry,
                        behavior,
                        interaction,
                    });
                }
            }
        }
    }
    candidates
}

pub fn solve_draco(facts: DracoFacts) -> Option<SolverResult> {
    let candidates = generate_all_candidates();
    let soft_constraints = get_default_soft_constraints();

    let mut best_spec = None;
    let mut min_cost = f64::INFINITY;

    for spec in candidates {
        if !check_hard_constraints(&facts, &spec) {
            continue;
        }

        let mut cost = 0.0;
        for sc in &soft_constraints {
            let penalty = (sc.evaluate)(&facts, &spec);
            if penalty > 0.0 {
                cost += penalty * sc.default_weight;
            }
        }

        if cost < min_cost {
            min_cost = cost;
            best_spec = Some(spec);
        }
    }

    best_spec.map(|spec| SolverResult {
        facts,
        spec,
        cost: min_cost,
    })
}

pub fn evaluate_candidate(facts: &DracoFacts, spec: &DracoSpec) -> (bool, f64, Vec<String>) {
    let is_valid = check_hard_constraints(facts, spec);
    let mut cost = 0.0;
    let mut violations = Vec::new();
    let soft_constraints = get_default_soft_constraints();

    for sc in &soft_constraints {
        let penalty = (sc.evaluate)(facts, spec);
        if penalty > 0.0 {
            cost += penalty * sc.default_weight;
            violations.push(sc.name.to_string());
        }
    }

    (is_valid, cost, violations)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn solver_produces_valid_spec_for_tabular() {
        let facts = DracoFacts {
            topology: "TABULAR".to_string(),
            row_count: 50,
            node_count: 50,
            edge_count: 0,
            depth: 0,
            numeric_columns: 3,
            categorical_columns: 1,
            temporal_columns: 0,
            has_time_series: false,
            has_continuous_values: true,
            density: 0.0,
            cardinality_of_color: 4,
            has_outliers: false,
            has_high_variance: false,
            correlation_matrix: HashMap::new(),
            trend_direction: None,
            seasonality_hint: false,
            is_large_dataset: false,
        };

        let result = solve_draco(facts).expect("solve_draco should succeed");
        assert_eq!(result.spec.layout, VRLayout::Grid3D);
        assert_eq!(result.spec.interaction, VRInteraction::InspectCell);
    }
}
