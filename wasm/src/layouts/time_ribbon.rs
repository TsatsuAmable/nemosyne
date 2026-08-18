use std::collections::BTreeMap;

/// Compute 3D positions for multi-series temporal ribbon curves.
///
/// Returns a flat vector of [x, y, z] points corresponding to each input row index.
pub fn compute_time_ribbon_3d(
    series_ids: &[usize],
    timestamps: &[f64],
    values: &[f64],
    x_scale: f32,
    y_scale: f32,
    z_spacing: f32,
    y_offset: f32,
) -> Vec<[f32; 3]> {
    let count = series_ids.len();
    if count == 0 {
        return Vec::new();
    }

    let mut series_groups: BTreeMap<usize, Vec<(usize, f64, f64)>> = BTreeMap::new();
    for i in 0..count {
        let sid = series_ids[i];
        let t = if i < timestamps.len() { timestamps[i] } else { i as f64 };
        let v = if i < values.len() { values[i] } else { 0.0 };
        series_groups.entry(sid).or_default().push((i, t, v));
    }

    let num_series = series_groups.len();
    let mut positions = vec![[0.0f32; 3]; count];

    for (s_idx, (_sid, mut items)) in series_groups.into_iter().enumerate() {
        items.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
        let num_items = items.len();
        let z = s_idx as f32 * z_spacing - ((num_series as f32 - 1.0) * z_spacing) / 2.0;

        for (idx, (orig_idx, _time, val)) in items.into_iter().enumerate() {
            let x = idx as f32 * x_scale - ((num_items as f32 - 1.0) * x_scale) / 2.0;
            let y = y_offset + (val as f32) * y_scale;
            positions[orig_idx] = [x, y, z];
        }
    }

    positions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn time_ribbon_computes_series_positions() {
        let series = [0, 0, 1, 1];
        let timestamps = [10.0, 20.0, 10.0, 20.0];
        let values = [1.0, 3.0, 2.0, 4.0];

        let positions = compute_time_ribbon_3d(&series, &timestamps, &values, 0.8, 0.2, 1.5, 1.2);
        assert_eq!(positions.len(), 4);
        // First series should have z = -0.75, second z = +0.75
        assert_eq!(positions[0][2], -0.75);
        assert_eq!(positions[2][2], 0.75);
    }
}
