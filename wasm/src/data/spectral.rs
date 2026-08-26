use num_complex::Complex;
use rustfft::FftPlanner;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

use crate::data::column::ColumnType;
use crate::data::columnar::PrimitiveColumn;
use crate::data::dataset::Dataset;

const MAX_EXACT_FFT_SAMPLES: usize = 65_536;
const REGULAR_SAMPLING_REL_TOLERANCE: f64 = 0.01;
const REGULAR_SAMPLING_ABS_TOLERANCE: f64 = 1e-9;

fn reduction_bin_end(bin: usize, transform_length: usize, observed_count: usize) -> usize {
    (((bin + 1) as u64 * observed_count as u64 + transform_length as u64 - 1)
        / transform_length as u64) as usize
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpectralFacts {
    /// Frequencies in cycles per time-coordinate unit when a temporal axis is
    /// supplied, otherwise cycles per implicit observation index.
    pub dominant_frequencies: Vec<f64>,
    pub spectral_entropy: f64,
    pub power_spectrum_peak: f64,
    pub directional_anisotropy: f64,
    /// Reciprocal dominant frequency, in the same time-coordinate unit.
    pub characteristic_scale: f64,
    pub has_periodicity: bool,
    /// Historical field name retained for ABI compatibility. This is an
    /// uncalibrated deterministic heuristic score, not statistical confidence.
    pub periodicity_confidence: f64,
    pub method: String,
    pub observed_count: usize,
    pub transform_length: usize,
    pub source_observations_per_bin: f64,
    /// Cycles per time-coordinate unit.
    pub frequency_resolution: f64,
    /// Nyquist frequency in cycles per time-coordinate unit.
    pub maximum_frequency: f64,
    pub window_function: String,
}

/// Compute spectral facts from a value column and, when available, its actual
/// temporal coordinate.
///
/// RF-028: FFT is valid only for regularly sampled observations. We therefore
/// intersect finite time/value observations, sort by time, verify a regular
/// positive sampling interval, and fail closed (`None`) for duplicate,
/// irregular, or gapped sampling. Callers that need irregular-series spectral
/// evidence must use an explicit governed resampling or Lomb-Scargle path rather
/// than silently treating row order as unit-spaced time.
pub fn compute_spectral_facts(
    dataset: &Dataset,
    time_column: &str,
    value_column: &str,
) -> Option<SpectralFacts> {
    let value_name = if !value_column.is_empty() {
        dataset
            .columns
            .iter()
            .find(|column| column.name == value_column && column.ty == ColumnType::Numeric)
            .map(|column| column.name.as_str())
    } else {
        dataset
            .columns
            .iter()
            .find(|column| column.ty == ColumnType::Numeric)
            .map(|column| column.name.as_str())
    }?;

    let time_name = if !time_column.is_empty() {
        let column = dataset
            .columns
            .iter()
            .find(|column| column.name == time_column && column.ty == ColumnType::Temporal)?;
        Some(column.name.as_str())
    } else {
        dataset
            .columns
            .iter()
            .find(|column| column.ty == ColumnType::Temporal)
            .map(|column| column.name.as_str())
    };

    let mut observations = Vec::new();
    for (row_index, row) in dataset.rows.iter().enumerate() {
        let Some(value) = row.get(value_name).and_then(|value| value.as_number()) else {
            continue;
        };
        if !value.is_finite() {
            continue;
        }
        let time = match time_name {
            Some(name) => match row.get(name).and_then(|value| value.as_number()) {
                Some(time) if time.is_finite() => time,
                _ => continue,
            },
            None => row_index as f64,
        };
        observations.push((time, value));
    }

    compute_spectral_facts_from_observations(
        observations,
        if time_name.is_some() {
            "regular-time"
        } else {
            "implicit-index"
        },
    )
}

/// Columnar spectral path over paired primitive time/value buffers. Passing
/// `None` for time is an explicit implicit-index sequence, not temporal data.
pub fn compute_spectral_facts_columnar(
    time: Option<&PrimitiveColumn>,
    values: &PrimitiveColumn,
) -> Option<SpectralFacts> {
    let len = values.values.len().min(values.validity.len());
    let mut observations = Vec::new();

    match time {
        Some(time) => {
            let len = len.min(time.values.len()).min(time.validity.len());
            for index in 0..len {
                if values.validity[index] == 0 || time.validity[index] == 0 {
                    continue;
                }
                let value = values.values[index];
                let time_value = time.values[index];
                if value.is_finite() && time_value.is_finite() {
                    observations.push((time_value, value));
                }
            }
            compute_spectral_facts_from_observations(observations, "regular-time")
        }
        None => {
            for index in 0..len {
                if values.validity[index] == 0 {
                    continue;
                }
                let value = values.values[index];
                if value.is_finite() {
                    observations.push((index as f64, value));
                }
            }
            compute_spectral_facts_from_observations(observations, "implicit-index")
        }
    }
}

fn compute_spectral_facts_from_observations(
    mut observations: Vec<(f64, f64)>,
    method_prefix: &str,
) -> Option<SpectralFacts> {
    if observations.len() < 4 {
        return None;
    }

    observations.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    let mut deltas = Vec::with_capacity(observations.len() - 1);
    for pair in observations.windows(2) {
        let delta = pair[1].0 - pair[0].0;
        if !delta.is_finite() || delta <= 0.0 {
            return None;
        }
        deltas.push(delta);
    }

    let mut sorted_deltas = deltas.clone();
    sorted_deltas.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median_interval = median(&sorted_deltas);
    if !median_interval.is_finite() || median_interval <= 0.0 {
        return None;
    }
    let tolerance = (median_interval.abs() * REGULAR_SAMPLING_REL_TOLERANCE)
        .max(REGULAR_SAMPLING_ABS_TOLERANCE);
    if deltas
        .iter()
        .any(|delta| (*delta - median_interval).abs() > tolerance)
    {
        return None;
    }

    let values: Vec<f64> = observations.into_iter().map(|(_, value)| value).collect();
    compute_regular_fft(&values, median_interval, method_prefix)
}

fn compute_regular_fft(
    values: &[f64],
    sample_interval: f64,
    method_prefix: &str,
) -> Option<SpectralFacts> {
    let observed_count = values.len();
    if observed_count < 4 || !sample_interval.is_finite() || sample_interval <= 0.0 {
        return None;
    }

    let transform_length = observed_count.min(MAX_EXACT_FFT_SAMPLES);
    let source_observations_per_bin = observed_count as f64 / transform_length as f64;
    let mut reduced_values = vec![0.0; transform_length];
    if transform_length == observed_count {
        reduced_values.copy_from_slice(values);
    } else {
        let mut counts = vec![0usize; transform_length];
        let mut bin = 0usize;
        let mut bin_end = reduction_bin_end(bin, transform_length, observed_count);
        for (index, value) in values.iter().copied().enumerate() {
            while index >= bin_end && bin + 1 < transform_length {
                bin += 1;
                bin_end = reduction_bin_end(bin, transform_length, observed_count);
            }
            reduced_values[bin] += value;
            counts[bin] += 1;
        }
        for (value, count) in reduced_values.iter_mut().zip(counts) {
            if count > 0 {
                *value /= count as f64;
            }
        }
    }

    let effective_interval = sample_interval * source_observations_per_bin;
    if !effective_interval.is_finite() || effective_interval <= 0.0 {
        return None;
    }
    let frequency_resolution = 1.0 / (transform_length as f64 * effective_interval);
    let maximum_frequency = 0.5 / effective_interval;

    let mut planner = FftPlanner::<f64>::new();
    let fft = planner.plan_fft_forward(transform_length);
    let mean = reduced_values.iter().sum::<f64>() / transform_length as f64;
    let mut buffer: Vec<Complex<f64>> = reduced_values
        .iter()
        .enumerate()
        .map(|(index, value)| {
            let window =
                0.5 * (1.0 - (2.0 * PI * index as f64 / (transform_length - 1) as f64).cos());
            Complex {
                re: (value - mean) * window,
                im: 0.0,
            }
        })
        .collect();
    fft.process(&mut buffer);
    let num_bins = transform_length / 2 + 1;
    let powers: Vec<f64> = buffer[..num_bins]
        .iter()
        .map(|coefficient| coefficient.norm_sqr())
        .collect();

    if powers.len() <= 1 {
        return None;
    }

    let method = if transform_length == observed_count {
        format!("{method_prefix}-fft")
    } else {
        format!("{method_prefix}-mean-pooled-fft")
    };
    let ac_powers = &powers[1..];
    let total_ac: f64 = ac_powers.iter().sum();

    if total_ac <= 1e-12 {
        return Some(SpectralFacts {
            dominant_frequencies: vec![],
            spectral_entropy: 0.0,
            power_spectrum_peak: 0.0,
            directional_anisotropy: 0.0,
            characteristic_scale: 0.0,
            has_periodicity: false,
            periodicity_confidence: 0.0,
            method,
            observed_count,
            transform_length,
            source_observations_per_bin,
            frequency_resolution,
            maximum_frequency,
            window_function: "hann".to_string(),
        });
    }

    let mut peak_indices: Vec<(usize, f64)> = (1..powers.len()).map(|k| (k, powers[k])).collect();
    peak_indices.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let top_peaks: Vec<(usize, f64)> = peak_indices.into_iter().take(3).collect();
    let dominant_frequencies: Vec<f64> = top_peaks
        .iter()
        .map(|&(k, _)| k as f64 * frequency_resolution)
        .collect();

    let max_peak_power = top_peaks.first().map(|peak| peak.1).unwrap_or(0.0);
    let power_spectrum_peak = (max_peak_power / total_ac).min(1.0);

    let k_count = ac_powers.len() as f64;
    let entropy: f64 = ac_powers
        .iter()
        .filter(|&&power| power > 0.0)
        .map(|&power| {
            let normalized = power / total_ac;
            if normalized > 0.0 {
                -normalized * normalized.ln()
            } else {
                0.0
            }
        })
        .sum();
    let normalized_entropy = if k_count > 1.0 {
        (entropy / k_count.ln()).clamp(0.0, 1.0)
    } else {
        0.0
    };

    let has_periodicity = power_spectrum_peak > 0.35 && normalized_entropy < 0.75;
    let periodicity_confidence = if has_periodicity {
        (power_spectrum_peak * 0.6 + (1.0 - normalized_entropy) * 0.4).clamp(0.0, 1.0)
    } else {
        0.0
    };
    let dominant_frequency = dominant_frequencies.first().copied().unwrap_or(0.0);
    let characteristic_scale = if dominant_frequency > 1e-12 {
        1.0 / dominant_frequency
    } else {
        0.0
    };

    Some(SpectralFacts {
        dominant_frequencies,
        spectral_entropy: (normalized_entropy * 1000.0).round() / 1000.0,
        power_spectrum_peak: (power_spectrum_peak * 1000.0).round() / 1000.0,
        directional_anisotropy: 0.0,
        characteristic_scale: (characteristic_scale * 1000.0).round() / 1000.0,
        has_periodicity,
        periodicity_confidence: (periodicity_confidence * 1000.0).round() / 1000.0,
        method,
        observed_count,
        transform_length,
        source_observations_per_bin,
        frequency_resolution,
        maximum_frequency,
        window_function: "hann".to_string(),
    })
}

fn median(sorted: &[f64]) -> f64 {
    let len = sorted.len();
    if len == 0 {
        0.0
    } else if len % 2 == 1 {
        sorted[len / 2]
    } else {
        (sorted[len / 2 - 1] + sorted[len / 2]) / 2.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data::column::Column;
    use crate::data::columnar::ColumnarDataset;
    use crate::data::value::Value;
    use std::collections::HashMap;

    fn regular_sine_dataset(time_scale: f64) -> Dataset {
        let n = 64;
        let period_samples = 16.0;
        let rows = (0..n)
            .map(|index| {
                let time = index as f64 * 0.5 * time_scale;
                let value = (2.0 * PI * index as f64 / period_samples).sin();
                HashMap::from([
                    ("time".to_string(), Value::Number(time)),
                    ("value".to_string(), Value::Number(value)),
                ])
            })
            .collect();
        Dataset::new(
            "regular-sine",
            vec![
                Column::new("time", ColumnType::Temporal),
                Column::new("value", ColumnType::Numeric),
            ],
            rows,
        )
    }

    #[test]
    fn regular_time_fft_reports_physical_frequency() {
        let dataset = regular_sine_dataset(1.0);
        let facts = compute_spectral_facts(&dataset, "time", "value").expect("regular series");
        assert!(facts.has_periodicity);
        assert_eq!(facts.method, "regular-time-fft");
        assert_eq!(facts.transform_length, 64);
        assert_eq!(facts.source_observations_per_bin, 1.0);
        // 16 samples * 0.5 time units/sample = period 8 => frequency 0.125.
        assert!((facts.dominant_frequencies[0] - 0.125).abs() < 0.01);
        assert!((facts.characteristic_scale - 8.0).abs() < 0.1);
        assert!((facts.maximum_frequency - 1.0).abs() < 1e-12);
    }

    #[test]
    fn spectral_facts_serialize_camel_case_for_wasm_abi() {
        let dataset = regular_sine_dataset(1.0);
        let facts = compute_spectral_facts(&dataset, "time", "value").expect("regular series");
        let json = serde_json::to_value(facts).expect("serialize spectral facts");

        for field in [
            "dominantFrequencies",
            "spectralEntropy",
            "powerSpectrumPeak",
            "directionalAnisotropy",
            "characteristicScale",
            "hasPeriodicity",
            "periodicityConfidence",
            "observedCount",
            "transformLength",
            "sourceObservationsPerBin",
            "frequencyResolution",
            "maximumFrequency",
            "windowFunction",
        ] {
            assert!(json.get(field).is_some(), "missing camelCase ABI field {field}");
        }
        assert!(json.get("dominant_frequencies").is_none());
        assert!(json.get("source_observations_per_bin").is_none());
        assert!(json.get("frequency_resolution").is_none());
    }

    #[test]
    fn explicit_invalid_time_column_fails_closed() {
        let dataset = regular_sine_dataset(1.0);
        assert!(compute_spectral_facts(&dataset, "missing_time", "value").is_none());
        assert!(compute_spectral_facts(&dataset, "value", "value").is_none());
    }

    #[test]
    fn row_shuffle_is_invariant_when_time_axis_is_explicit() {
        let original = regular_sine_dataset(1.0);
        let mut shuffled_rows = original.rows.clone();
        shuffled_rows.reverse();
        let shuffled = Dataset::new("shuffled", original.columns.clone(), shuffled_rows);

        let a = compute_spectral_facts(&original, "time", "value").expect("original");
        let b = compute_spectral_facts(&shuffled, "time", "value").expect("shuffled");
        assert_eq!(a, b);
    }

    #[test]
    fn time_unit_rescale_changes_units_not_periodicity_decision() {
        let seconds = compute_spectral_facts(&regular_sine_dataset(1.0), "time", "value")
            .expect("seconds");
        let milliseconds = compute_spectral_facts(&regular_sine_dataset(1000.0), "time", "value")
            .expect("milliseconds");

        assert_eq!(seconds.has_periodicity, milliseconds.has_periodicity);
        assert!((milliseconds.dominant_frequencies[0] * 1000.0
            - seconds.dominant_frequencies[0])
            .abs()
            < 1e-9);
        assert!((milliseconds.characteristic_scale
            - seconds.characteristic_scale * 1000.0)
            .abs()
            < 1e-6);
    }

    #[test]
    fn irregular_or_gapped_sampling_fails_closed() {
        let mut dataset = regular_sine_dataset(1.0);
        if let Some(time) = dataset.rows[20].get_mut("time") {
            *time = Value::Number(10.75);
        }
        assert!(compute_spectral_facts(&dataset, "time", "value").is_none());

        let mut missing = regular_sine_dataset(1.0);
        missing.rows[20].insert("value".to_string(), Value::Null);
        assert!(compute_spectral_facts(&missing, "time", "value").is_none());
    }

    #[test]
    fn duplicate_timestamp_fails_closed() {
        let mut dataset = regular_sine_dataset(1.0);
        let duplicate = dataset.rows[19].get("time").cloned().unwrap();
        dataset.rows[20].insert("time".to_string(), duplicate);
        assert!(compute_spectral_facts(&dataset, "time", "value").is_none());
    }

    #[test]
    fn columnar_and_row_paths_match_for_regular_time_series() {
        let dataset = regular_sine_dataset(1.0);
        let columnar = ColumnarDataset::from_dataset(&dataset);
        let row = compute_spectral_facts(&dataset, "time", "value").expect("row");
        let columnar_facts = compute_spectral_facts_columnar(
            Some(columnar.primitive_column(0).expect("time")),
            columnar.primitive_column(1).expect("value"),
        )
        .expect("columnar");
        assert_eq!(row, columnar_facts);
    }

    #[test]
    fn implicit_index_sequence_retains_non_temporal_sequence_support() {
        let n = 64;
        let rows = (0..n)
            .map(|index| {
                HashMap::from([(
                    "value".to_string(),
                    Value::Number((2.0 * PI * index as f64 / 16.0).sin()),
                )])
            })
            .collect();
        let dataset = Dataset::new(
            "implicit",
            vec![Column::new("value", ColumnType::Numeric)],
            rows,
        );
        let facts = compute_spectral_facts(&dataset, "", "value").expect("implicit index");
        assert_eq!(facts.method, "implicit-index-fft");
        assert!((facts.dominant_frequencies[0] - 1.0 / 16.0).abs() < 0.01);
    }

    #[test]
    fn large_series_uses_bounded_deterministic_full_sequence_reduction() {
        let n = MAX_EXACT_FFT_SAMPLES * 2 + 17;
        let values: Vec<f64> = (0..n)
            .map(|index| (2.0 * PI * index as f64 / 128.0).sin())
            .collect();
        let observations: Vec<(f64, f64)> = values
            .iter()
            .copied()
            .enumerate()
            .map(|(index, value)| (index as f64, value))
            .collect();

        let first = compute_spectral_facts_from_observations(observations.clone(), "implicit-index")
            .expect("bounded spectral facts");
        let second = compute_spectral_facts_from_observations(observations, "implicit-index")
            .expect("deterministic spectral facts");

        assert_eq!(first, second);
        assert_eq!(first.method, "implicit-index-mean-pooled-fft");
        assert_eq!(first.observed_count, n);
        assert_eq!(first.transform_length, MAX_EXACT_FFT_SAMPLES);
        assert!(first.source_observations_per_bin > 2.0);
        assert_eq!(first.window_function, "hann");
        assert!(first.has_periodicity);
        assert!((first.dominant_frequencies[0] - 1.0 / 128.0).abs() < 1e-5);
    }

    #[test]
    fn reduction_boundaries_cover_wasm32_scale_without_overflow() {
        assert_eq!(reduction_bin_end(0, MAX_EXACT_FFT_SAMPLES, 10_000_000), 153);
        assert_eq!(
            reduction_bin_end(MAX_EXACT_FFT_SAMPLES - 1, MAX_EXACT_FFT_SAMPLES, 10_000_000),
            10_000_000,
        );
    }

    #[test]
    fn insufficient_data_returns_none() {
        let dataset = Dataset::new(
            "short",
            vec![Column::new("value", ColumnType::Numeric)],
            vec![
                HashMap::from([("value".to_string(), Value::Number(1.0))]),
                HashMap::from([("value".to_string(), Value::Number(2.0))]),
            ],
        );
        assert!(compute_spectral_facts(&dataset, "", "value").is_none());
    }
}
