use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum VRLayout {
    #[serde(rename = "GRID_3D")]
    Grid3D,
    #[serde(rename = "FORCE_DIRECTED_3D")]
    ForceDirected3D,
    #[serde(rename = "RADIAL_ORBITAL")]
    RadialOrbital,
    #[serde(rename = "VECTOR_STREAMLINE")]
    VectorStreamline,
    #[serde(rename = "TIME_RIBBON")]
    TimeRibbon,
    #[serde(rename = "GEO_SURFACE")]
    GeoSurface,
    #[serde(rename = "SPECTRAL_VOLUME")]
    SpectralVolume,
}

impl VRLayout {
    pub const ALL: [VRLayout; 7] = [
        VRLayout::Grid3D,
        VRLayout::ForceDirected3D,
        VRLayout::RadialOrbital,
        VRLayout::VectorStreamline,
        VRLayout::TimeRibbon,
        VRLayout::GeoSurface,
        VRLayout::SpectralVolume,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum VRGeometry {
    #[serde(rename = "CUBE_MATRIX")]
    CubeMatrix,
    #[serde(rename = "ICOSA_NODE")]
    IcosaNode,
    #[serde(rename = "CONICAL_TREE")]
    ConicalTree,
    #[serde(rename = "FLOW_RAY")]
    FlowRay,
    #[serde(rename = "GEO_COLUMN")]
    GeoColumn,
    #[serde(rename = "CLUSTER_VOLUME")]
    ClusterVolume,
    #[serde(rename = "INSTANCED_POINT_CLOUD")]
    InstancedPointCloud,
    #[serde(rename = "AGGREGATE_BARS")]
    AggregateBars,
    #[serde(rename = "ORB")]
    Orb,
    #[serde(rename = "COLUMN")]
    Column,
    #[serde(rename = "BEAM")]
    Beam,
    #[serde(rename = "SPECTRAL_BAR")]
    SpectralBar,
    #[serde(rename = "SPECTRAL_SURFACE")]
    SpectralSurface,
}

impl VRGeometry {
    pub const ALL: [VRGeometry; 13] = [
        VRGeometry::CubeMatrix,
        VRGeometry::IcosaNode,
        VRGeometry::ConicalTree,
        VRGeometry::FlowRay,
        VRGeometry::GeoColumn,
        VRGeometry::ClusterVolume,
        VRGeometry::InstancedPointCloud,
        VRGeometry::AggregateBars,
        VRGeometry::Orb,
        VRGeometry::Column,
        VRGeometry::Beam,
        VRGeometry::SpectralBar,
        VRGeometry::SpectralSurface,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum VRBehavior {
    #[serde(rename = "PULSE_QUANTITATIVE")]
    PulseQuantitative,
    #[serde(rename = "ORBITAL_SPIN")]
    OrbitalSpin,
    #[serde(rename = "WAVE_OSCILLATION")]
    WaveOscillation,
    #[serde(rename = "STATIC")]
    Static,
}

impl VRBehavior {
    pub const ALL: [VRBehavior; 4] = [
        VRBehavior::PulseQuantitative,
        VRBehavior::OrbitalSpin,
        VRBehavior::WaveOscillation,
        VRBehavior::Static,
    ];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum VRInteraction {
    #[serde(rename = "INSPECT_CELL")]
    InspectCell,
    #[serde(rename = "TRAVERSE_EDGE")]
    TraverseEdge,
    #[serde(rename = "DRILL_DOWN")]
    DrillDown,
    #[serde(rename = "HARVEST_STREAM")]
    HarvestStream,
    #[serde(rename = "CLUSTER_PROBE")]
    ClusterProbe,
    #[serde(rename = "FILTER_BRUSH")]
    FilterBrush,
    #[serde(rename = "RESONANCE_PULSE")]
    ResonancePulse,
    #[serde(rename = "FORK_PLANE")]
    ForkPlane,
    #[serde(rename = "CHRONO_DIAL")]
    ChronoDial,
    #[serde(rename = "CONSTELLATION")]
    Constellation,
    #[serde(rename = "BEACON")]
    Beacon,
    #[serde(rename = "ALEPH")]
    Aleph,
    #[serde(rename = "FREQUENCY_PROBE")]
    FrequencyProbe,
}

impl VRInteraction {
    pub const ALL: [VRInteraction; 13] = [
        VRInteraction::InspectCell,
        VRInteraction::TraverseEdge,
        VRInteraction::DrillDown,
        VRInteraction::HarvestStream,
        VRInteraction::ClusterProbe,
        VRInteraction::FilterBrush,
        VRInteraction::ResonancePulse,
        VRInteraction::ForkPlane,
        VRInteraction::ChronoDial,
        VRInteraction::Constellation,
        VRInteraction::Beacon,
        VRInteraction::Aleph,
        VRInteraction::FrequencyProbe,
    ];
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct MonetaSpec {
    pub layout: VRLayout,
    pub geometry: VRGeometry,
    pub behavior: VRBehavior,
    pub interaction: VRInteraction,
}

pub type DracoSpec = MonetaSpec;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonetaFacts {
    pub topology: String,
    #[serde(default)]
    pub row_count: usize,
    #[serde(default)]
    pub node_count: usize,
    #[serde(default)]
    pub edge_count: usize,
    #[serde(default)]
    pub depth: usize,
    #[serde(default)]
    pub numeric_columns: usize,
    #[serde(default)]
    pub categorical_columns: usize,
    #[serde(default)]
    pub temporal_columns: usize,
    #[serde(default)]
    pub has_time_series: bool,
    #[serde(default)]
    pub has_continuous_values: bool,
    #[serde(default)]
    pub density: f64,
    #[serde(default)]
    pub cardinality_of_color: usize,
    #[serde(default)]
    pub has_outliers: bool,
    #[serde(default)]
    pub has_high_variance: bool,
    #[serde(default)]
    pub correlation_matrix: HashMap<String, HashMap<String, f64>>,
    #[serde(default)]
    pub trend_direction: Option<String>,
    #[serde(default)]
    pub seasonality_hint: bool,
    #[serde(default)]
    pub is_large_dataset: bool,
}

pub type DracoFacts = MonetaFacts;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverResult {
    pub facts: MonetaFacts,
    pub spec: MonetaSpec,
    pub cost: f64,
}
