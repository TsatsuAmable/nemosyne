use crate::draco::types::{DracoFacts, DracoSpec, VRBehavior, VRGeometry, VRInteraction, VRLayout};

pub fn check_hard_constraints(facts: &DracoFacts, spec: &DracoSpec) -> bool {
    let top = facts.topology.as_str();

    // Incompatible layout combinations
    if top == "GRAPH" && spec.layout == VRLayout::Grid3D {
        return false;
    }
    if top == "HIERARCHY" && spec.layout == VRLayout::VectorStreamline {
        return false;
    }
    if top == "VECTOR_FIELD" && spec.layout != VRLayout::VectorStreamline {
        return false;
    }
    if top == "TIME_SERIES" && spec.layout != VRLayout::TimeRibbon {
        return false;
    }
    if top == "GEO" && spec.layout != VRLayout::GeoSurface {
        return false;
    }

    // Large dataset scalability pruning
    if facts.is_large_dataset {
        let is_scalable = matches!(
            spec.geometry,
            VRGeometry::ClusterVolume | VRGeometry::InstancedPointCloud | VRGeometry::AggregateBars
        );
        if !is_scalable {
            return false;
        }
    }

    true
}

pub struct SoftConstraint {
    pub name: &'static str,
    pub default_weight: f64,
    pub evaluate: fn(facts: &DracoFacts, spec: &DracoSpec) -> f64,
}

pub fn get_default_soft_constraints() -> Vec<SoftConstraint> {
    vec![
        SoftConstraint {
            name: "prefer_pulse_for_timeseries",
            default_weight: 10.0,
            evaluate: |facts, spec| {
                if facts.has_time_series && spec.behavior != VRBehavior::PulseQuantitative {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_radial_for_deep_hierarchy",
            default_weight: 15.0,
            evaluate: |facts, spec| {
                if facts.topology == "HIERARCHY" && facts.depth > 2 && spec.layout != VRLayout::RadialOrbital {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_grid_for_tabular",
            default_weight: 8.0,
            evaluate: |facts, spec| {
                if facts.topology == "TABULAR" && spec.layout != VRLayout::Grid3D {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "match_interaction_to_topology",
            default_weight: 12.0,
            evaluate: |facts, spec| {
                let top = facts.topology.as_str();
                if top == "HIERARCHY" && spec.interaction != VRInteraction::DrillDown {
                    return 1.0;
                }
                if top == "GRAPH" && spec.interaction != VRInteraction::TraverseEdge {
                    return 1.0;
                }
                if (top == "TABULAR" || top == "GEO") && spec.interaction != VRInteraction::InspectCell {
                    return 1.0;
                }
                if (top == "VECTOR_FIELD" || top == "TIME_SERIES") && spec.interaction != VRInteraction::HarvestStream {
                    return 1.0;
                }
                0.0
            },
        },
        SoftConstraint {
            name: "prefer_force_directed_for_graphs",
            default_weight: 14.0,
            evaluate: |facts, spec| {
                if facts.topology == "GRAPH" && spec.layout != VRLayout::ForceDirected3D {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_streamline_for_vectors",
            default_weight: 14.0,
            evaluate: |facts, spec| {
                if facts.topology == "VECTOR_FIELD" && spec.layout != VRLayout::VectorStreamline {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_geo_surface_for_geo",
            default_weight: 14.0,
            evaluate: |facts, spec| {
                if facts.topology == "GEO" && spec.layout != VRLayout::GeoSurface {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_icosa_node_for_graphs",
            default_weight: 12.0,
            evaluate: |facts, spec| {
                if facts.topology == "GRAPH" && spec.geometry != VRGeometry::IcosaNode {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_conical_tree_for_hierarchy",
            default_weight: 12.0,
            evaluate: |facts, spec| {
                if facts.topology == "HIERARCHY" && spec.geometry != VRGeometry::ConicalTree {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_flow_ray_for_vectors",
            default_weight: 12.0,
            evaluate: |facts, spec| {
                if facts.topology == "VECTOR_FIELD" && spec.geometry != VRGeometry::FlowRay {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_geo_column_for_geo",
            default_weight: 12.0,
            evaluate: |facts, spec| {
                if facts.topology == "GEO" && spec.geometry != VRGeometry::GeoColumn {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_orbital_spin_for_dense_graph",
            default_weight: 6.0,
            evaluate: |facts, spec| {
                if facts.topology == "GRAPH" && facts.density > 0.3 && spec.behavior != VRBehavior::OrbitalSpin {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_wave_for_continuous_tabular",
            default_weight: 6.0,
            evaluate: |facts, spec| {
                if facts.topology == "TABULAR" && facts.has_continuous_values && spec.behavior != VRBehavior::WaveOscillation {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_instanced_cloud_for_large_data",
            default_weight: 18.0,
            evaluate: |facts, spec| {
                if facts.is_large_dataset && spec.geometry != VRGeometry::InstancedPointCloud {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_orb_for_outliers",
            default_weight: 12.0,
            evaluate: |facts, spec| {
                if facts.has_outliers && spec.geometry != VRGeometry::Orb {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_column_for_high_variance",
            default_weight: 10.0,
            evaluate: |facts, spec| {
                if facts.has_high_variance && facts.topology == "TABULAR" && spec.geometry != VRGeometry::Column {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_beam_for_correlations",
            default_weight: 9.0,
            evaluate: |facts, spec| {
                let mut has_strong = false;
                for row in facts.correlation_matrix.values() {
                    for &corr in row.values() {
                        if corr.abs() > 0.7 && corr.abs() < 0.9999 {
                            has_strong = true;
                            break;
                        }
                    }
                    if has_strong {
                        break;
                    }
                }
                if has_strong && spec.geometry != VRGeometry::Beam {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "prefer_chrono_dial_for_trends",
            default_weight: 11.0,
            evaluate: |facts, spec| {
                if let Some(trend) = &facts.trend_direction {
                    if trend != "flat" && facts.topology == "TIME_SERIES" && spec.interaction != VRInteraction::ChronoDial {
                        return 1.0;
                    }
                }
                0.0
            },
        },
        SoftConstraint {
            name: "prefer_wave_for_seasonality",
            default_weight: 8.0,
            evaluate: |facts, spec| {
                if facts.seasonality_hint && spec.behavior != VRBehavior::WaveOscillation {
                    1.0
                } else {
                    0.0
                }
            },
        },
        SoftConstraint {
            name: "attach_chart_plane_for_rich_numeric_or_time",
            default_weight: 3.0,
            evaluate: |facts, spec| {
                let rich_data = facts.numeric_columns > 1 || facts.has_time_series;
                if !rich_data {
                    0.0
                } else if spec.interaction == VRInteraction::InspectCell {
                    0.0
                } else {
                    1.0
                }
            },
        },
    ]
}
