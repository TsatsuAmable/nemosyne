/// Compute 3D vector-field streamlines.
///
/// Returns a list of paths, each path containing `steps + 1` 3D points [x, y, z].
pub fn compute_streamlines_3d(
    count: usize,
    steps: usize,
    step_size: f32,
    bounds_min: [f32; 3],
    bounds_max: [f32; 3],
    seed: u64,
) -> Vec<Vec<[f32; 3]>> {
    if count == 0 {
        return Vec::new();
    }

    let mut prng_state = if seed == 0 { 1u64 } else { seed };
    let mut rand_range = |min: f32, max: f32| -> f32 {
        // Simple linear congruential PRNG
        prng_state = prng_state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let normalized = (prng_state >> 32) as f32 / 4294967295.0;
        min + (max - min) * normalized
    };

    let mut streamlines = Vec::with_capacity(count);

    for i in 0..count {
        let start_x = rand_range(bounds_min[0], bounds_max[0]);
        let start_y = rand_range(bounds_min[1], bounds_max[1]);
        let start_z = rand_range(bounds_min[2], bounds_max[2]);

        let mut points = Vec::with_capacity(steps + 1);
        points.push([start_x, start_y, start_z]);

        for _s in 0..steps {
            let prev = *points.last().unwrap();
            // Synthetic vector field advection
            let vx = (prev[2] * 0.7 + i as f32).sin() * 0.8;
            let vy = 0.2 + (prev[0] * 0.5 + i as f32).cos() * 0.2;
            let vz = -0.6 + (prev[1] * 0.9 + i as f32).sin() * 0.3;

            let mag = (vx * vx + vy * vy + vz * vz).sqrt();
            let (dx, dy, dz) = if mag > 1e-6 {
                (vx / mag, vy / mag, vz / mag)
            } else {
                (0.0, 1.0, 0.0)
            };

            let next_pt = [
                prev[0] + dx * step_size,
                prev[1] + dy * step_size,
                prev[2] + dz * step_size,
            ];
            points.push(next_pt);
        }

        streamlines.push(points);
    }

    streamlines
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn streamlines_generates_points() {
        let lines = compute_streamlines_3d(5, 3, 2.0, [-5.0, 0.5, -8.0], [5.0, 4.0, -2.0], 42);
        assert_eq!(lines.len(), 5);
        assert_eq!(lines[0].len(), 4); // start + 3 steps
    }
}
