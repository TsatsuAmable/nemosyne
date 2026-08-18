/// Compute geospatial surface layout positions.
///
/// Maps longitudes and latitudes to a room-scale plane with elevation scaled from `values`.
pub fn compute_geo_surface_3d(
    longitudes: &[f64],
    latitudes: &[f64],
    values: &[f64],
    room_width: f32,
    room_depth: f32,
    height_scale: f32,
    y_offset: f32,
) -> Vec<[f32; 3]> {
    let count = longitudes.len();
    if count == 0 {
        return Vec::new();
    }

    let mut min_lon = f64::INFINITY;
    let mut max_lon = f64::NEG_INFINITY;
    let mut min_lat = f64::INFINITY;
    let mut max_lat = f64::NEG_INFINITY;

    for i in 0..count {
        let lon = longitudes[i];
        let lat = if i < latitudes.len() { latitudes[i] } else { 0.0 };
        if lon.is_finite() {
            min_lon = min_lon.min(lon);
            max_lon = max_lon.max(lon);
        }
        if lat.is_finite() {
            min_lat = min_lat.min(lat);
            max_lat = max_lat.max(lat);
        }
    }

    let mut positions = Vec::with_capacity(count);

    for i in 0..count {
        let lon = longitudes[i];
        let lat = if i < latitudes.len() { latitudes[i] } else { 0.0 };
        let val = if i < values.len() { values[i] } else { 0.0 };

        let x = if lon.is_finite() && min_lon < max_lon {
            let nx = (lon - min_lon) / (max_lon - min_lon);
            ((nx - 0.5) * room_width as f64) as f32
        } else {
            0.0
        };

        let z = if lat.is_finite() && min_lat < max_lat {
            let nz = (lat - min_lat) / (max_lat - min_lat);
            ((nz - 0.5) * room_depth as f64) as f32
        } else {
            0.0
        };

        let y = y_offset + (val.max(0.0) as f32) * height_scale;
        positions.push([x, y, z]);
    }

    positions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn geo_surface_maps_bounds() {
        let lons = [-120.0, 0.0, 120.0];
        let lats = [-30.0, 0.0, 30.0];
        let vals = [10.0, 20.0, 30.0];

        let positions = compute_geo_surface_3d(&lons, &lats, &vals, 6.0, 3.0, 0.05, 0.5);
        assert_eq!(positions.len(), 3);
        assert_eq!(positions[0][0], -3.0); // Min lon
        assert_eq!(positions[2][0], 3.0);  // Max lon
        assert_eq!(positions[0][2], -1.5); // Min lat
        assert_eq!(positions[2][2], 1.5);  // Max lat
        assert_eq!(positions[0][1], 0.5 + 10.0 * 0.05);
    }
}
