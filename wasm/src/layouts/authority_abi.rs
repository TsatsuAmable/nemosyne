use serde::Deserialize;

use super::compute_force_directed_3d;

fn write_positions(positions: &[[f32; 3]], out_ptr: u32, out_len: u32) -> u32 {
    let needed = positions.len().saturating_mul(3).saturating_mul(std::mem::size_of::<f32>());
    let needed = u32::try_from(needed).unwrap_or(0);
    if needed == 0 {
        return 0;
    }
    if out_ptr == 0 || out_len < needed {
        return needed;
    }

    let out = unsafe { crate::allocator::view_mut(out_ptr, needed) };
    for (index, position) in positions.iter().enumerate() {
        let base = index * 12;
        out[base..base + 4].copy_from_slice(&position[0].to_le_bytes());
        out[base + 4..base + 8].copy_from_slice(&position[1].to_le_bytes());
        out[base + 8..base + 12].copy_from_slice(&position[2].to_le_bytes());
    }
    needed
}

#[derive(Deserialize)]
struct WeightedEdge {
    source: usize,
    target: usize,
    #[serde(default = "default_weight")]
    weight: f32,
}

fn default_weight() -> f32 {
    1.0
}

/// Edge-aware force-directed layout ABI used by the Moneta layout authority.
/// Edges are JSON encoded as [{source,target,weight}], where source/target are
/// already-resolved row indices. Returning the required byte count on a zero
/// output pointer follows the two-call ABI used by the rest of the kernel.
#[no_mangle]
pub extern "C" fn layout_force_directed_edges_3d(
    count: u32,
    edges_ptr: u32,
    edges_len: u32,
    iterations: u32,
    repulsion: f32,
    attraction: f32,
    damping: f32,
    radius: f32,
    y_offset: f32,
    seed: f32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    if count == 0 {
        return 0;
    }

    let edges_bytes = unsafe { crate::allocator::view(edges_ptr, edges_len) };
    let parsed: Vec<WeightedEdge> = match serde_json::from_slice(edges_bytes) {
        Ok(edges) => edges,
        Err(_) => return 0,
    };
    let edges: Vec<(usize, usize, f32)> = parsed
        .into_iter()
        .map(|edge| (edge.source, edge.target, edge.weight))
        .collect();

    let positions = compute_force_directed_3d(
        count as usize,
        &edges,
        iterations as usize,
        repulsion,
        attraction,
        damping,
        radius,
        y_offset,
        seed,
    );
    write_positions(&positions, out_ptr, out_len)
}

#[derive(Deserialize)]
struct SpectralVolumeInput {
    frequencies: Vec<f32>,
    powers: Vec<f32>,
    phases: Vec<f32>,
}

/// Authoritative spectral-volume coordinate generation. The spectral facts are
/// already kernel-derived; this function owns the deterministic mapping from
/// those facts to data-derived 3D coordinates as well.
#[no_mangle]
pub extern "C" fn layout_spectral_volume_3d(
    input_ptr: u32,
    input_len: u32,
    radial_scale: f32,
    height_scale: f32,
    y_offset: f32,
    out_ptr: u32,
    out_len: u32,
) -> u32 {
    let input_bytes = unsafe { crate::allocator::view(input_ptr, input_len) };
    let input: SpectralVolumeInput = match serde_json::from_slice(input_bytes) {
        Ok(input) => input,
        Err(_) => return 0,
    };

    let count = input
        .frequencies
        .len()
        .min(input.powers.len())
        .min(input.phases.len());
    if count == 0 {
        return 0;
    }

    let mut positions = Vec::with_capacity(count);
    for index in 0..count {
        let radius = input.frequencies[index] * radial_scale;
        let phase = input.phases[index];
        positions.push([
            radius * phase.cos(),
            input.powers[index] * height_scale + y_offset,
            radius * phase.sin(),
        ]);
    }

    write_positions(&positions, out_ptr, out_len)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spectral_mapping_is_deterministic() {
        let input = SpectralVolumeInput {
            frequencies: vec![1.0, 2.0],
            powers: vec![0.5, 1.0],
            phases: vec![0.0, std::f32::consts::FRAC_PI_2],
        };
        let positions: Vec<[f32; 3]> = (0..2)
            .map(|index| {
                let radius = input.frequencies[index] * 3.0;
                let phase = input.phases[index];
                [
                    radius * phase.cos(),
                    input.powers[index] * 2.0 + 1.0,
                    radius * phase.sin(),
                ]
            })
            .collect();
        assert!((positions[0][0] - 3.0).abs() < 1e-6);
        assert!((positions[0][1] - 2.0).abs() < 1e-6);
        assert!((positions[1][2] - 6.0).abs() < 1e-5);
    }
}
