use serde::{Deserialize, Serialize};

use crate::data::column::{Column, ColumnType};
use crate::data::measurement::{
    AdmissionIssue, AdmissionStatus, AnalysisRequest, AnalyticalAdmission, MeasurementModel,
    MeasurementScale, ObservationStructure,
};

/// How strongly Nemosyne can defend the semantic interpretation attached to a
/// measurement model. This is deliberately separate from statistical
/// confidence: it records provenance of the meaning assigned to a column.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MeasurementModelStatus {
    Inferred,
    Declared,
    Confirmed,
    Ambiguous,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasurementModelBasis {
    pub source: String,
    pub rationale: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasurementModelRecord {
    pub model: MeasurementModel,
    pub status: MeasurementModelStatus,
    pub basis: Vec<MeasurementModelBasis>,
}

impl MeasurementModelRecord {
    /// Construct only what the physical column storage can actually support.
    /// Numeric and categorical storage remain ambiguous because storage type
    /// cannot establish their mathematical measurement semantics.
    pub fn from_storage(column: &Column) -> Self {
        let (scale, status, rationale) = match column.ty {
            ColumnType::Numeric => (
                MeasurementScale::Unknown,
                MeasurementModelStatus::Ambiguous,
                "numeric storage does not distinguish interval, ratio, count, proportion, circular, identifier, or compositional semantics",
            ),
            ColumnType::Categorical => (
                MeasurementScale::Unknown,
                MeasurementModelStatus::Ambiguous,
                "categorical storage does not distinguish nominal, ordinal, identifier, or grouping semantics",
            ),
            ColumnType::Temporal => (
                MeasurementScale::Temporal,
                MeasurementModelStatus::Inferred,
                "temporal storage supports a temporal measurement scale but does not establish observation dependence",
            ),
            ColumnType::Text => (
                MeasurementScale::Unknown,
                MeasurementModelStatus::Unknown,
                "text storage has no generic quantitative measurement geometry",
            ),
            ColumnType::Unknown => (
                MeasurementScale::Unknown,
                MeasurementModelStatus::Unknown,
                "column storage type is unknown",
            ),
        };

        Self {
            model: MeasurementModel {
                column: column.name.clone(),
                scale,
                observation_structure: ObservationStructure::Unknown,
                compositional_group: None,
            },
            status,
            basis: vec![MeasurementModelBasis {
                source: "storage-schema".to_string(),
                rationale: rationale.to_string(),
            }],
        }
    }

    pub fn declared(
        model: MeasurementModel,
        source: impl Into<String>,
        rationale: impl Into<String>,
    ) -> Self {
        Self {
            model,
            status: MeasurementModelStatus::Declared,
            basis: vec![MeasurementModelBasis {
                source: source.into(),
                rationale: rationale.into(),
            }],
        }
    }

    pub fn confirm(mut self, source: impl Into<String>, rationale: impl Into<String>) -> Self {
        self.status = MeasurementModelStatus::Confirmed;
        self.basis.push(MeasurementModelBasis {
            source: source.into(),
            rationale: rationale.into(),
        });
        self
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SemanticAdmissionPolicy {
    AllowInferred,
    RequireDeclared,
    RequireConfirmed,
}

fn semantic_status_allowed(
    status: MeasurementModelStatus,
    policy: SemanticAdmissionPolicy,
) -> bool {
    match policy {
        SemanticAdmissionPolicy::AllowInferred => matches!(
            status,
            MeasurementModelStatus::Inferred
                | MeasurementModelStatus::Declared
                | MeasurementModelStatus::Confirmed
        ),
        SemanticAdmissionPolicy::RequireDeclared => matches!(
            status,
            MeasurementModelStatus::Declared | MeasurementModelStatus::Confirmed
        ),
        SemanticAdmissionPolicy::RequireConfirmed => {
            status == MeasurementModelStatus::Confirmed
        }
    }
}

/// Admit through both semantic-provenance and mathematical applicability gates.
pub fn admit_with_semantics(
    request: &AnalysisRequest,
    records: &[MeasurementModelRecord],
    policy: SemanticAdmissionPolicy,
) -> AnalyticalAdmission {
    let mut issues = Vec::new();
    let mut admitted_models = Vec::new();

    for column in &request.geometry.columns {
        let Some(record) = records.iter().find(|record| record.model.column == *column) else {
            issues.push(AdmissionIssue {
                column: Some(column.clone()),
                reason: "no MeasurementModelRecord exists for requested analytical column"
                    .to_string(),
            });
            continue;
        };

        if !semantic_status_allowed(record.status, policy) {
            issues.push(AdmissionIssue {
                column: Some(column.clone()),
                reason: format!(
                    "measurement semantics are {:?}; admission policy {:?} requires stronger semantic provenance",
                    record.status, policy
                ),
            });
            continue;
        }

        admitted_models.push(record.model.clone());
    }

    if !issues.is_empty() {
        return AnalyticalAdmission {
            status: AdmissionStatus::Rejected,
            issues,
        };
    }

    request.admit(&admitted_models)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::measurement::{
        AnalyticalGeometry, MetricType, MissingnessPolicy, Transformation,
    };

    fn request(column: &str, metric: MetricType) -> AnalysisRequest {
        AnalysisRequest {
            geometry: AnalyticalGeometry {
                columns: vec![column.to_string()],
                metric,
                transformations: Vec::<Transformation>::new(),
                missingness_policy: MissingnessPolicy::Preserve,
            },
            requires_iid: false,
        }
    }

    #[test]
    fn numeric_storage_does_not_invent_ratio_scale() {
        let record = MeasurementModelRecord::from_storage(&Column::new("mass", ColumnType::Numeric));
        assert_eq!(record.status, MeasurementModelStatus::Ambiguous);
        assert_eq!(record.model.scale, MeasurementScale::Unknown);
    }

    #[test]
    fn categorical_storage_does_not_choose_nominal_over_ordinal() {
        let record = MeasurementModelRecord::from_storage(&Column::new("grade", ColumnType::Categorical));
        assert_eq!(record.status, MeasurementModelStatus::Ambiguous);
        assert_eq!(record.model.scale, MeasurementScale::Unknown);
    }

    #[test]
    fn temporal_storage_infers_scale_but_not_observation_dependence() {
        let record = MeasurementModelRecord::from_storage(&Column::new("when", ColumnType::Temporal));
        assert_eq!(record.status, MeasurementModelStatus::Inferred);
        assert_eq!(record.model.scale, MeasurementScale::Temporal);
        assert_eq!(record.model.observation_structure, ObservationStructure::Unknown);
    }

    #[test]
    fn strict_policy_rejects_schema_inference() {
        let record = MeasurementModelRecord::from_storage(&Column::new("when", ColumnType::Temporal));
        let result = admit_with_semantics(
            &request("when", MetricType::DynamicTimeWarping),
            &[record],
            SemanticAdmissionPolicy::RequireDeclared,
        );
        assert_eq!(result.status, AdmissionStatus::Rejected);
    }

    #[test]
    fn allow_inferred_policy_can_use_unambiguous_temporal_scale() {
        let record = MeasurementModelRecord::from_storage(&Column::new("when", ColumnType::Temporal));
        let result = admit_with_semantics(
            &request("when", MetricType::DynamicTimeWarping),
            &[record],
            SemanticAdmissionPolicy::AllowInferred,
        );
        assert_eq!(result.status, AdmissionStatus::Admitted);
    }

    #[test]
    fn ambiguous_numeric_storage_fails_even_when_inference_is_allowed() {
        let record = MeasurementModelRecord::from_storage(&Column::new("x", ColumnType::Numeric));
        let result = admit_with_semantics(
            &request("x", MetricType::Euclidean),
            &[record],
            SemanticAdmissionPolicy::AllowInferred,
        );
        assert_eq!(result.status, AdmissionStatus::Rejected);
    }

    #[test]
    fn declared_model_can_be_promoted_to_confirmed() {
        let declared = MeasurementModelRecord::declared(
            MeasurementModel {
                column: "mass".to_string(),
                scale: MeasurementScale::Ratio,
                observation_structure: ObservationStructure::Iid,
                compositional_group: None,
            },
            "dataset-manifest",
            "instrument reports mass in kilograms",
        );
        assert_eq!(declared.status, MeasurementModelStatus::Declared);

        let confirmed = declared.confirm("researcher", "confirmed against study protocol");
        assert_eq!(confirmed.status, MeasurementModelStatus::Confirmed);
        assert_eq!(confirmed.basis.len(), 2);
    }

    #[test]
    fn confirmed_policy_admits_only_confirmed_semantics() {
        let declared = MeasurementModelRecord::declared(
            MeasurementModel {
                column: "mass".to_string(),
                scale: MeasurementScale::Ratio,
                observation_structure: ObservationStructure::Iid,
                compositional_group: None,
            },
            "dataset-manifest",
            "mass in kilograms",
        );
        let req = request("mass", MetricType::Euclidean);
        assert_eq!(
            admit_with_semantics(
                &req,
                &[declared.clone()],
                SemanticAdmissionPolicy::RequireConfirmed,
            )
            .status,
            AdmissionStatus::Rejected
        );
        assert_eq!(
            admit_with_semantics(
                &req,
                &[declared.confirm("researcher", "confirmed")],
                SemanticAdmissionPolicy::RequireConfirmed,
            )
            .status,
            AdmissionStatus::Admitted
        );
    }
}
