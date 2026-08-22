use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MeasurementScale {
    Unknown,
    Identifier,
    Nominal,
    Ordinal,
    Interval,
    Ratio,
    Count,
    Proportion,
    Compositional,
    Circular,
    Temporal,
    SpatialCoordinate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ObservationStructure {
    Unknown,
    Iid,
    Grouped,
    RepeatedMeasures,
    TemporalSequence,
    Spatial,
    Spatiotemporal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MetricType {
    Euclidean,
    StandardizedEuclidean,
    Mahalanobis,
    Gower,
    Aitchison,
    Hamming,
    Jaccard,
    Geodesic,
    DynamicTimeWarping,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Transformation {
    Standardize,
    RobustScale,
    RankEncode,
    IndicatorEncode,
    Ilr,
    CircularEmbedding,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MissingnessPolicy {
    Preserve,
    CompleteCase,
    PairwiseComplete,
    Impute,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ApplicabilityStatus {
    Applicable,
    RequiresTransformation,
    NotApplicable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Applicability {
    pub status: ApplicabilityStatus,
    pub reason: String,
}

impl Applicability {
    fn applicable() -> Self {
        Self {
            status: ApplicabilityStatus::Applicable,
            reason: String::new(),
        }
    }

    fn requires_transformation(reason: impl Into<String>) -> Self {
        Self {
            status: ApplicabilityStatus::RequiresTransformation,
            reason: reason.into(),
        }
    }

    fn not_applicable(reason: impl Into<String>) -> Self {
        Self {
            status: ApplicabilityStatus::NotApplicable,
            reason: reason.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasurementModel {
    pub column: String,
    pub scale: MeasurementScale,
    pub observation_structure: ObservationStructure,
    pub compositional_group: Option<String>,
}

impl MeasurementModel {
    pub fn validate_metric(&self, metric: MetricType) -> Applicability {
        use MeasurementScale::*;
        use MetricType::*;

        match (self.scale, metric) {
            (Unknown, _) => Applicability::not_applicable(
                "measurement scale is unknown; metric use requires an explicit model",
            ),
            (Identifier, _) => Applicability::not_applicable(
                "identifier variables are not analytical coordinates",
            ),
            (Nominal, Euclidean | StandardizedEuclidean | Mahalanobis) => {
                Applicability::not_applicable(
                    "nominal variables cannot enter continuous Euclidean covariance geometry",
                )
            }
            (Ordinal, Euclidean | StandardizedEuclidean | Mahalanobis) => {
                Applicability::requires_transformation(
                    "ordinal variables require an explicit rank or latent-scale encoding",
                )
            }
            (Compositional, Aitchison) if self.compositional_group.is_some() => {
                Applicability::applicable()
            }
            (Compositional, Aitchison) => Applicability::not_applicable(
                "Aitchison geometry requires a declared compositional variable group",
            ),
            (Compositional, _) => Applicability::requires_transformation(
                "compositional variables require an explicit log-ratio transformation",
            ),
            (Circular, Euclidean | StandardizedEuclidean | Mahalanobis) => {
                Applicability::requires_transformation(
                    "circular variables require an explicit directional embedding",
                )
            }
            (Temporal, DynamicTimeWarping) => Applicability::applicable(),
            (SpatialCoordinate, Geodesic) => Applicability::applicable(),
            (_, Aitchison) => Applicability::not_applicable(
                "Aitchison geometry requires a declared compositional variable group",
            ),
            (_, DynamicTimeWarping) => Applicability::not_applicable(
                "dynamic time warping requires temporal or trajectory-valued observations",
            ),
            (_, Geodesic) => Applicability::not_applicable(
                "geodesic distance requires spatial coordinates or an explicit manifold geometry",
            ),
            _ => Applicability::applicable(),
        }
    }

    fn required_transformation(&self, metric: MetricType) -> Option<Transformation> {
        match (self.scale, metric) {
            (
                MeasurementScale::Ordinal,
                MetricType::Euclidean
                | MetricType::StandardizedEuclidean
                | MetricType::Mahalanobis,
            ) => Some(Transformation::RankEncode),
            (MeasurementScale::Compositional, metric) if metric != MetricType::Aitchison => {
                Some(Transformation::Ilr)
            }
            (
                MeasurementScale::Circular,
                MetricType::Euclidean
                | MetricType::StandardizedEuclidean
                | MetricType::Mahalanobis,
            ) => Some(Transformation::CircularEmbedding),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticalGeometry {
    pub columns: Vec<String>,
    pub metric: MetricType,
    pub transformations: Vec<Transformation>,
    pub missingness_policy: MissingnessPolicy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AdmissionStatus {
    Admitted,
    Rejected,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdmissionIssue {
    pub column: Option<String>,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticalAdmission {
    pub status: AdmissionStatus,
    pub issues: Vec<AdmissionIssue>,
}

impl AnalyticalAdmission {
    pub fn is_admitted(&self) -> bool {
        self.status == AdmissionStatus::Admitted
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisRequest {
    pub geometry: AnalyticalGeometry,
    /// True only for methods whose inferential validity requires independent
    /// observations. Descriptive/geometric transforms should leave this false.
    pub requires_iid: bool,
}

impl AnalysisRequest {
    /// Gate an analytical request against declared measurement semantics before
    /// computation begins. Unknown or incompatible semantics fail closed.
    ///
    /// This is deliberately an admission contract, not an automatic inference
    /// engine: callers must supply the `MeasurementModel`s they are willing to
    /// defend. Storage type alone is insufficient.
    pub fn admit(&self, models: &[MeasurementModel]) -> AnalyticalAdmission {
        let mut issues = Vec::new();

        for column in &self.geometry.columns {
            let Some(model) = models.iter().find(|model| model.column == *column) else {
                issues.push(AdmissionIssue {
                    column: Some(column.clone()),
                    reason: "no MeasurementModel exists for requested analytical column".to_string(),
                });
                continue;
            };

            let applicability = model.validate_metric(self.geometry.metric);
            match applicability.status {
                ApplicabilityStatus::Applicable => {}
                ApplicabilityStatus::NotApplicable => issues.push(AdmissionIssue {
                    column: Some(column.clone()),
                    reason: applicability.reason,
                }),
                ApplicabilityStatus::RequiresTransformation => {
                    let required = model.required_transformation(self.geometry.metric);
                    if required
                        .is_some_and(|required| self.geometry.transformations.contains(&required))
                    {
                        // The requested geometry explicitly records the semantic
                        // transformation needed to make this coordinate admissible.
                    } else {
                        issues.push(AdmissionIssue {
                            column: Some(column.clone()),
                            reason: applicability.reason,
                        });
                    }
                }
            }

            if self.requires_iid
                && model.observation_structure != ObservationStructure::Iid
            {
                issues.push(AdmissionIssue {
                    column: Some(column.clone()),
                    reason: format!(
                        "analysis requires IID observations but column is declared {:?}",
                        model.observation_structure
                    ),
                });
            }
        }

        AnalyticalAdmission {
            status: if issues.is_empty() {
                AdmissionStatus::Admitted
            } else {
                AdmissionStatus::Rejected
            },
            issues,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn model(scale: MeasurementScale) -> MeasurementModel {
        MeasurementModel {
            column: "x".to_string(),
            scale,
            observation_structure: ObservationStructure::Iid,
            compositional_group: None,
        }
    }

    fn request(metric: MetricType, transformations: Vec<Transformation>) -> AnalysisRequest {
        AnalysisRequest {
            geometry: AnalyticalGeometry {
                columns: vec!["x".to_string()],
                metric,
                transformations,
                missingness_policy: MissingnessPolicy::Preserve,
            },
            requires_iid: false,
        }
    }

    #[test]
    fn identifiers_cannot_enter_metric_geometry() {
        let result = model(MeasurementScale::Identifier).validate_metric(MetricType::Euclidean);
        assert_eq!(result.status, ApplicabilityStatus::NotApplicable);
    }

    #[test]
    fn ordinal_euclidean_requires_explicit_transformation() {
        let result = model(MeasurementScale::Ordinal).validate_metric(MetricType::Euclidean);
        assert_eq!(result.status, ApplicabilityStatus::RequiresTransformation);
    }

    #[test]
    fn compositional_aitchison_requires_declared_group() {
        let without_group = model(MeasurementScale::Compositional);
        assert_eq!(
            without_group.validate_metric(MetricType::Aitchison).status,
            ApplicabilityStatus::NotApplicable
        );

        let with_group = MeasurementModel {
            compositional_group: Some("composition-a".to_string()),
            ..without_group
        };
        assert_eq!(
            with_group.validate_metric(MetricType::Aitchison).status,
            ApplicabilityStatus::Applicable
        );
    }

    #[test]
    fn circular_euclidean_requires_directional_embedding() {
        let result = model(MeasurementScale::Circular).validate_metric(MetricType::Euclidean);
        assert_eq!(result.status, ApplicabilityStatus::RequiresTransformation);
    }

    #[test]
    fn temporal_dtw_is_allowed_but_numeric_dtw_is_not() {
        assert_eq!(
            model(MeasurementScale::Temporal)
                .validate_metric(MetricType::DynamicTimeWarping)
                .status,
            ApplicabilityStatus::Applicable
        );
        assert_eq!(
            model(MeasurementScale::Ratio)
                .validate_metric(MetricType::DynamicTimeWarping)
                .status,
            ApplicabilityStatus::NotApplicable
        );
    }

    #[test]
    fn admission_rejects_missing_measurement_models() {
        let result = request(MetricType::Euclidean, vec![]).admit(&[]);
        assert_eq!(result.status, AdmissionStatus::Rejected);
        assert_eq!(result.issues.len(), 1);
    }

    #[test]
    fn admission_rejects_identifier_coordinates() {
        let result = request(MetricType::Euclidean, vec![])
            .admit(&[model(MeasurementScale::Identifier)]);
        assert_eq!(result.status, AdmissionStatus::Rejected);
    }

    #[test]
    fn admission_requires_recorded_semantic_transformation() {
        let ordinal = model(MeasurementScale::Ordinal);
        assert_eq!(
            request(MetricType::Euclidean, vec![]).admit(&[ordinal.clone()]).status,
            AdmissionStatus::Rejected
        );
        assert_eq!(
            request(MetricType::Euclidean, vec![Transformation::RankEncode])
                .admit(&[ordinal])
                .status,
            AdmissionStatus::Admitted
        );
    }

    #[test]
    fn iid_only_analysis_rejects_repeated_measures() {
        let repeated = MeasurementModel {
            observation_structure: ObservationStructure::RepeatedMeasures,
            ..model(MeasurementScale::Ratio)
        };
        let mut req = request(MetricType::Euclidean, vec![]);
        req.requires_iid = true;
        assert_eq!(req.admit(&[repeated]).status, AdmissionStatus::Rejected);
    }

    #[test]
    fn descriptive_geometry_can_admit_non_iid_observations() {
        let grouped = MeasurementModel {
            observation_structure: ObservationStructure::Grouped,
            ..model(MeasurementScale::Ratio)
        };
        let req = request(MetricType::Euclidean, vec![]);
        assert!(req.admit(&[grouped]).is_admitted());
    }
}
