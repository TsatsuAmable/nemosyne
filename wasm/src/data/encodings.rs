//! Encoding inference — the *logical* channel→field mapping.
//!
//! Mirrors `src/data/TopologyInference.ts::inferEncodingsForTopology` and
//! `src/data/Encodings.ts::inferEncodings` so the kernel is the single
//! authority for which column drives which visual channel. The *visual*
//! mapping (categoricalColor / numericColor / normalize, which depend on
//! three.js) stays in TS — only the field-name selection lives here.
//!
//! `EncodingMapping` carries only field-name strings (`color`/`size`/`pulse`/
//! `time`/`label`); spatial x/y/z channel assignment is a renderer concern.

use serde::Serialize;

use crate::data::dataset::Dataset;
use crate::data::topology::Topology;

/// Logical encoding mapping: which column name drives each visual channel.
/// Absent channels are omitted from the serialised JSON.
#[derive(Debug, Clone, Default, Serialize)]
pub struct EncodingMapping {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pulse: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

impl EncodingMapping {
    fn set_color(&mut self, cat: Option<&str>, num: Option<&str>) {
        self.color = cat.or(num).map(|s| s.to_string());
    }
}

/// `inferEncodings(dataset)` — topology-unaware default, matching
/// `src/data/Encodings.ts::inferEncodings`.
pub fn infer_encodings(dataset: &Dataset) -> EncodingMapping {
    let cat = first_categorical(dataset);
    let num = first_numeric(dataset);
    let time = first_temporal(dataset);
    let mut enc = EncodingMapping::default();
    enc.set_color(cat, num);
    enc.size = num.map(|s| s.to_string());
    enc.pulse = time.map(|s| s.to_string());
    enc.time = time.map(|s| s.to_string());
    enc
}

/// `inferEncodingsForTopology(dataset, topology)` — topology-aware mapping,
/// matching `src/data/TopologyInference.ts::inferEncodingsForTopology`.
pub fn infer_encodings_for_topology(dataset: &Dataset, topology: Topology) -> EncodingMapping {
    let cat = first_categorical(dataset);
    let num = first_numeric(dataset);
    let num2 = nth_numeric(dataset, 1);
    let time = first_temporal(dataset);
    let mut enc = EncodingMapping::default();
    match topology {
        Topology::Hierarchy => {
            enc.set_color(cat, num);
            enc.size = num.map(|s| s.to_string());
            enc.pulse = num2.map(|s| s.to_string());
        }
        Topology::Graph => {
            enc.set_color(cat, num);
            enc.size = num.map(|s| s.to_string());
        }
        Topology::TimeSeries => {
            enc.set_color(cat, num);
            enc.size = num.map(|s| s.to_string());
            enc.time = time.map(|s| s.to_string());
            enc.pulse = num2.map(|s| s.to_string());
        }
        Topology::VectorField => {
            // Literal channel targets (mirror JS exactly): the magnitude
            // column is expected to exist for vector fields.
            enc.color = Some("magnitude".to_string());
            enc.size = Some("magnitude".to_string());
        }
        Topology::Geo => {
            enc.set_color(cat, num);
            enc.size = num.map(|s| s.to_string());
            enc.label = cat.map(|s| s.to_string());
        }
        Topology::Tabular | Topology::Flow => {
            enc.set_color(cat, num);
            enc.size = num.map(|s| s.to_string());
        }
    }
    enc
}

fn first_categorical(ds: &Dataset) -> Option<&str> {
    ds.categorical_columns().first().map(|c| c.name.as_str())
}
fn first_numeric(ds: &Dataset) -> Option<&str> {
    ds.numeric_columns().first().map(|c| c.name.as_str())
}
fn nth_numeric(ds: &Dataset, n: usize) -> Option<&str> {
    ds.numeric_columns().get(n).map(|c| c.name.as_str())
}
fn first_temporal(ds: &Dataset) -> Option<&str> {
    ds.temporal_columns().first().map(|c| c.name.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::column::{Column, ColumnType};
    use crate::data::value::Value;
    use std::collections::HashMap;

    fn dataset_with(cols: &[(&str, ColumnType)]) -> Dataset {
        let columns = cols.iter().map(|(n, t)| Column::new(*n, *t)).collect();
        Dataset::new("enc", columns, Vec::<HashMap<String, Value>>::new())
    }

    #[test]
    fn infer_encodings_picks_first_categorical_and_numeric() {
        let ds = dataset_with(&[
            ("region", ColumnType::Categorical),
            ("revenue", ColumnType::Numeric),
            ("time", ColumnType::Temporal),
        ]);
        let enc = infer_encodings(&ds);
        assert_eq!(enc.color.as_deref(), Some("region"));
        assert_eq!(enc.size.as_deref(), Some("revenue"));
        assert_eq!(enc.time.as_deref(), Some("time"));
        assert_eq!(enc.pulse.as_deref(), Some("time"));
    }

    #[test]
    fn infer_encodings_color_falls_back_to_numeric() {
        let ds = dataset_with(&[("revenue", ColumnType::Numeric)]);
        let enc = infer_encodings(&ds);
        assert_eq!(enc.color.as_deref(), Some("revenue"));
        assert!(enc.label.is_none());
    }

    #[test]
    fn vector_field_targets_magnitude() {
        let ds = dataset_with(&[
            ("u", ColumnType::Numeric),
            ("v", ColumnType::Numeric),
        ]);
        let enc = infer_encodings_for_topology(&ds, Topology::VectorField);
        assert_eq!(enc.color.as_deref(), Some("magnitude"));
        assert_eq!(enc.size.as_deref(), Some("magnitude"));
    }

    #[test]
    fn geo_adds_label() {
        let ds = dataset_with(&[
            ("name", ColumnType::Categorical),
            ("lat", ColumnType::Numeric),
        ]);
        let enc = infer_encodings_for_topology(&ds, Topology::Geo);
        assert_eq!(enc.color.as_deref(), Some("name"));
        assert_eq!(enc.label.as_deref(), Some("name"));
    }

    #[test]
    fn serialised_mapping_omits_absent_channels() {
        let ds = dataset_with(&[("revenue", ColumnType::Numeric)]);
        let enc = infer_encodings(&ds);
        let json = serde_json::to_string(&enc).unwrap();
        assert!(json.contains("\"color\":\"revenue\""));
        assert!(json.contains("\"size\":\"revenue\""));
        assert!(!json.contains("label"));
        assert!(!json.contains("pulse"));
    }
}