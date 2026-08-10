pub fn compute_grid_3d(count: usize, spacing: f32, y_offset: f32) -> Vec<[f32; 3]> {
    let n = if count == 0 { 1 } else { count };
    let cols = (n as f32).cbrt().ceil() as usize;
    let cols = if cols == 0 { 1 } else { cols };
    let layers = ((n as f32) / ((cols * cols) as f32)).ceil() as usize;
    let mut out = Vec::with_capacity(count);

    for i in 0..count {
        let col = i % cols;
        let row = (i / cols) % cols;
        let layer = i / (cols * cols);

        let x = (col as f32 - (cols - 1) as f32 / 2.0) * spacing;
        let y = (row as f32 - (cols - 1) as f32 / 2.0) * spacing + y_offset;
        let z = (layer as f32 - (layers - 1) as f32 / 2.0) * spacing;

        out.push([x, y, z]);
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grid_layout_computes_positions() {
        let positions = compute_grid_3d(8, 1.1, 1.2);
        assert_eq!(positions.len(), 8);
        // f32 arithmetic in compute_grid_3d yields 0.65000004, so compare with
        // tolerance instead of exact equality.
        assert!((positions[0][1] - 0.65).abs() < 1e-5); // Check y offset centering
    }
}
