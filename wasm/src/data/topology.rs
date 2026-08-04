/// Placeholder for topology inference facts.
///
/// Phase 1 ports the basic `TopologyInference` result used by Draco to pick
/// a default layout. The full constraint engine remains in JS for now.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Topology {
    Tabular,
    Hierarchy,
    Graph,
    TimeSeries,
    VectorField,
    Geo,
    Flow,
}

impl Topology {
    pub fn as_str(self) -> &'static str {
        match self {
            Topology::Tabular => "TABULAR",
            Topology::Hierarchy => "HIERARCHY",
            Topology::Graph => "GRAPH",
            Topology::TimeSeries => "TIME_SERIES",
            Topology::VectorField => "VECTOR_FIELD",
            Topology::Geo => "GEO",
            Topology::Flow => "FLOW",
        }
    }
}

/// Infer a simple topology from column types and row structure.
pub fn infer(dataset: &crate::data::dataset::Dataset) -> Topology {
    use crate::data::column::ColumnType;
    if dataset.has_temporal() {
        return Topology::TimeSeries;
    }
    if dataset
        .columns
        .iter()
        .any(|c| c.name.eq_ignore_ascii_case("parent") && c.ty == ColumnType::Categorical)
    {
        return Topology::Hierarchy;
    }
    if dataset
        .columns
        .iter()
        .any(|c| c.name.eq_ignore_ascii_case("source") && c.ty == ColumnType::Categorical)
    {
        return Topology::Graph;
    }
    Topology::Tabular
}
