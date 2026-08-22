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
            (Compositional, _) => Applicability::requires_transformation(
                "compositional variables require an explicit log-ratio geometry",
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
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticalGeometry {
    pub columns: Vec<String>,
    pub metric: MetricType,
    pub transformations: Vec<Transformation>,
    pub missingness_policy: MissingnessPolicy,
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
            ApplicabilityStatus::RequiresTransformation
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
}
