use num_complex::Complex;
use rustfft::FftPlanner;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

use crate::data::column::ColumnType;
use crate::data::columnar::PrimitiveColumn;
use crate::data::dataset::Dataset;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SpectralFacts {
    pub dominant_frequencies: Vec<f64>,
    pub spectral_entropy: f64,
    pub power_spectrum_peak: f64,
    pub directional_anisotropy: f64,
    pub characteristic_scale: f64,
    pub has_periodicity: bool,
    pub periodicity_confidence: f64,
}

/// Compute spectral facts from a dataset column via FFT.
pub fn compute_spectral_facts(
    dataset: &Dataset,
    _time_column: &str,
    value_column: &str,
) -> Option<SpectralFacts> {
    // 1. Locate numeric column
    let col_name = if !value_column.is_empty() {
        dataset.columns.iter().find(|c| c.name == value_column).map(|c| c.name.as_str())
    } else {
        dataset
            .columns
            .iter()
            .find(|c| c.ty == ColumnType::Numeric)
            .map(|c| c.name.as_str())
    }?;

    let values: Vec<f64> = dataset
        .rows
        .iter()
        .filter_map(|r| r.get(col_name).and_then(|v| v.as_number()))
        .collect();

    compute_spectral_facts_from_values(values)
}

pub fn compute_spectral_facts_columnar(column: &PrimitiveColumn) -> Option<SpectralFacts> {
    compute_spectral_facts_from_values(column.finite_values().collect())
}

fn compute_spectral_facts_from_values(values: Vec<f64>) -> Option<SpectralFacts> {
    let n = values.len();
    if n < 4 {
        return None;
    }

    // 2. Center values (remove DC offset) and apply Hann window
    let mean: f64 = values.iter().sum::<f64>() / (n as f64);
    let mut planner = FftPlanner::<f64>::new();
    let fft = planner.plan_fft_forward(n);

    let mut buffer: Vec<Complex<f64>> = values
        .iter()
        .enumerate()
        .map(|(i, &v)| {
            let centered = v - mean;
            let window = 0.5 * (1.0 - (2.0 * PI * (i as f64) / ((n - 1) as f64)).cos());
            Complex {
                re: centered * window,
                im: 0.0,
            }
        })
        .collect();

    fft.process(&mut buffer);

    // 3. Compute power spectrum for positive frequencies (k = 0..=n/2)
    let num_bins = n / 2 + 1;
    let powers: Vec<f64> = buffer[..num_bins]
        .iter()
        .map(|c| c.norm_sqr())
        .collect();

    // 4. Analyze AC components (k >= 1)
    if powers.len() <= 1 {
        return None;
    }

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
        });
    }

    // 5. Peak finding
    let mut peak_indices: Vec<(usize, f64)> = (1..powers.len())
        .map(|k| (k, powers[k]))
        .collect();
    peak_indices.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let top_peaks: Vec<(usize, f64)> = peak_indices.into_iter().take(3).collect();
    let dominant_frequencies: Vec<f64> = top_peaks
        .iter()
        .map(|&(k, _)| (k as f64) / (n as f64))
        .collect();

    let max_peak_power = top_peaks.first().map(|p| p.1).unwrap_or(0.0);
    let power_spectrum_peak = (max_peak_power / total_ac).min(1.0);

    // 6. Spectral entropy
    let k_count = ac_powers.len() as f64;
    let entropy: f64 = ac_powers
        .iter()
        .filter(|&&p| p > 0.0)
        .map(|&p| {
            let p_norm = p / total_ac;
            if p_norm > 0.0 {
                -p_norm * p_norm.ln()
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

    // 7. Periodicity detection
    let has_periodicity = power_spectrum_peak > 0.35 && normalized_entropy < 0.75;
    let periodicity_confidence = if has_periodicity {
        (power_spectrum_peak * 0.6 + (1.0 - normalized_entropy) * 0.4).clamp(0.0, 1.0)
    } else {
        0.0
    };

    let dominant_freq = dominant_frequencies.first().copied().unwrap_or(0.0);
    let characteristic_scale = if dominant_freq > 1e-6 {
        1.0 / dominant_freq
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
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use crate::data::column::Column;
    use crate::data::value::Value;

    #[test]
    fn test_sine_wave_periodicity() {
        let n = 64;
        let freq = 4.0; // 4 cycles in 64 samples -> period = 16 samples
        let mut rows = Vec::new();
        for i in 0..n {
            let t = (i as f64) / (n as f64);
            let val = (2.0 * PI * freq * t).sin();
            let mut row = HashMap::new();
            row.insert("val".to_string(), Value::Number(val));
            rows.push(row);
        }

        let dataset = Dataset::new(
            "sine_dataset".to_string(),
            vec![Column::new("val".to_string(), ColumnType::Numeric)],
            rows,
        );

        let facts = compute_spectral_facts(&dataset, "", "val").expect("should compute facts");
        assert!(facts.has_periodicity, "sine wave must exhibit periodicity");
        assert!(facts.periodicity_confidence > 0.5);
        assert!(!facts.dominant_frequencies.is_empty());
        assert!((facts.dominant_frequencies[0] - (freq / n as f64)).abs() < 0.02);
    }

    #[test]
    fn test_white_noise_no_periodicity() {
        let noise_vals = [
            0.12, 0.89, 0.34, 0.76, 0.55, 0.23, 0.91, 0.04,
            0.67, 0.43, 0.88, 0.19, 0.51, 0.38, 0.72, 0.61,
            0.29, 0.84, 0.47, 0.15, 0.93, 0.58, 0.31, 0.79,
            0.02, 0.66, 0.41, 0.85, 0.26, 0.53, 0.37, 0.70,
            0.11, 0.95, 0.48, 0.21, 0.83, 0.64, 0.32, 0.77,
            0.08, 0.59, 0.44, 0.87, 0.25, 0.52, 0.39, 0.71,
            0.18, 0.82, 0.49, 0.14, 0.92, 0.57, 0.33, 0.78,
            0.05, 0.68, 0.42, 0.86, 0.28, 0.54, 0.36, 0.69,
        ];
        let mut rows = Vec::new();
        for &val in noise_vals.iter() {
            let mut row = HashMap::new();
            row.insert("noise".to_string(), Value::Number(val));
            rows.push(row);
        }

        let dataset = Dataset::new(
            "noise_dataset".to_string(),
            vec![Column::new("noise".to_string(), ColumnType::Numeric)],
            rows,
        );

        let facts = compute_spectral_facts(&dataset, "", "noise").expect("should compute facts");
        assert!(!facts.has_periodicity, "white noise should not exhibit periodicity");
    }

    #[test]
    fn test_insufficient_data_returns_none() {
        let mut rows = Vec::new();
        for i in 0..2 {
            let mut row = HashMap::new();
            row.insert("val".to_string(), Value::Number(i as f64));
            rows.push(row);
        }
        let dataset = Dataset::new(
            "short_dataset".to_string(),
            vec![Column::new("val".to_string(), ColumnType::Numeric)],
            rows,
        );

        assert!(compute_spectral_facts(&dataset, "", "val").is_none());
    }
}
