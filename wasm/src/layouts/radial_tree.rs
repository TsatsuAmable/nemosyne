use std::f32::consts::PI;

pub fn compute_radial_tree_3d(
    levels: &[usize],
    ring_spacing: f32,
    y_step: f32,
    y_offset: f32,
) -> Vec<[f32; 3]> {
    let count = levels.len();

    let mut level_groups: std::collections::BTreeMap<usize, Vec<usize>> = std::collections::BTreeMap::new();
    for (idx, &lvl) in levels.iter().enumerate() {
        level_groups.entry(lvl).or_default().push(idx);
    }

    let mut positions = vec![[0.0f32; 3]; count];

    for (&lvl, indices) in &level_groups {
        let radius = if lvl == 0 { 0.0 } else { lvl as f32 * ring_spacing };
        let num_nodes = indices.len();
        let y = lvl as f32 * y_step + y_offset;

        for (i, &node_idx) in indices.iter().enumerate() {
            let angle = (i as f32 / num_nodes as f32) * PI * 2.0;
            let x = angle.cos() * radius;
            let z = angle.sin() * radius;

            positions[node_idx] = [x, y, z];
        }
    }

    positions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn radial_tree_computes_positions() {
        let levels = [0, 1, 1, 2];
        let positions = compute_radial_tree_3d(&levels, 1.8, 0.8, 1.2);
        assert_eq!(positions.len(), 4);
        assert_eq!(positions[0], [0.0, 1.2, 0.0]); // Level 0 center node
    }
}
