use std::f32::consts::PI;

pub fn compute_force_directed_3d(
    count: usize,
    edges: &[(usize, usize, f32)],
    iterations: usize,
    repulsion: f32,
    attraction: f32,
    damping: f32,
    radius: f32,
    y_offset: f32,
    seed: f32,
) -> Vec<[f32; 3]> {
    let n = if count == 0 { 1 } else { count };

    // Initial Fibonacci sphere layout
    let mut positions: Vec<[f32; 3]> = Vec::with_capacity(count);
    for i in 0..count {
        let phi = ((-1.0 + (2.0 * i as f32) / (n as f32 - 1.0).max(1.0))).acos();
        let theta = (n as f32 * PI).sqrt() * phi + seed * 0.1;

        let x = radius * theta.cos() * phi.sin();
        let y = radius * theta.sin() * phi.sin() + y_offset;
        let z = radius * phi.cos();

        positions.push([x, y, z]);
    }

    let mut velocities = vec![[0.0f32; 3]; count];

    for _it in 0..iterations {
        let mut forces = vec![[0.0f32; 3]; count];

        // Repulsive forces between all pairs
        for i in 0..count {
            for j in (i + 1)..count {
                let dx = positions[i][0] - positions[j][0];
                let dy = positions[i][1] - positions[j][1];
                let dz = positions[i][2] - positions[j][2];

                let dist_sq = dx * dx + dy * dy + dz * dz;
                let (nx, ny, nz, _len) = if dist_sq < 1e-6 {
                    (1.0, 0.0, 0.0, 1.0)
                } else {
                    let len = dist_sq.sqrt();
                    (dx / len, dy / len, dz / len, len)
                };

                let f = repulsion / (dist_sq + 0.1);
                forces[i][0] += nx * f;
                forces[i][1] += ny * f;
                forces[i][2] += nz * f;

                forces[j][0] -= nx * f;
                forces[j][1] -= ny * f;
                forces[j][2] -= nz * f;
            }
        }

        // Attractive forces along edges
        for &(src, dst, weight) in edges {
            if src < count && dst < count {
                let dx = positions[dst][0] - positions[src][0];
                let dy = positions[dst][1] - positions[src][1];
                let dz = positions[dst][2] - positions[src][2];

                let edge_dist = (dx * dx + dy * dy + dz * dz).sqrt();
                let f = attraction * (edge_dist - 2.5) * weight;

                let (nx, ny, nz) = if edge_dist > 1e-6 {
                    (dx / edge_dist, dy / edge_dist, dz / edge_dist)
                } else {
                    (0.0, 0.0, 0.0)
                };

                forces[src][0] += nx * f;
                forces[src][1] += ny * f;
                forces[src][2] += nz * f;

                forces[dst][0] -= nx * f;
                forces[dst][1] -= ny * f;
                forces[dst][2] -= nz * f;
            }
        }

        // Centering gravity
        for i in 0..count {
            let dy = positions[i][1] - y_offset;
            forces[i][0] -= positions[i][0] * 0.005;
            forces[i][1] -= dy * 0.005;
            forces[i][2] -= positions[i][2] * 0.005;
        }

        // Apply velocity and position updates
        for i in 0..count {
            velocities[i][0] = (velocities[i][0] + forces[i][0] * damping) * 0.92;
            velocities[i][1] = (velocities[i][1] + forces[i][1] * damping) * 0.92;
            velocities[i][2] = (velocities[i][2] + forces[i][2] * damping) * 0.92;

            positions[i][0] += velocities[i][0];
            positions[i][1] += velocities[i][1];
            positions[i][2] += velocities[i][2];
        }
    }

    positions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn force_directed_computes_positions() {
        let edges = [(0, 1, 1.0)];
        let positions = compute_force_directed_3d(5, &edges, 10, 120.0, 0.02, 0.08, 4.0, 1.2, 1.0);
        assert_eq!(positions.len(), 5);
    }
}
