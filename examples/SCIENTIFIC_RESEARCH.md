# Scientific Research Example

A vector-field memory palace built from the `wind-field` sample dataset.

## What it shows

`src/data/SyntheticData.js` generates 40 sample vectors with position (`x`, `y`, `z`), direction (`u`, `v`, `w`), and derived `magnitude`.

| id | x | y | z | u | v | w | magnitude |
|---|---|---|---|---|---|---|---|
| V0 | 2.3 | 1.2 | -4.1 | 0.6 | -0.1 | 0.7 | 0.92 |
| ... | ... | ... | ... | ... | ... | ... | ... |

The Draco engine detects `u`/`v`/`w` vector components, infers **VECTOR_FIELD**, and renders flow-ray streamlines coloured by magnitude.

## Artefacts generated

- **Flow-ray streamlines** — cone/cylinder arrows showing vector direction and strength.
- **Magnitude colour scale** — Viridis-like mapping from low to high magnitude.
- **TDA summary panels** — persistence barcode, mapper graph, Betti curve (toggle via statistical lens).

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **Wind Vector Field**.
3. Operations you can perform:
   - **Inspect** — point at a streamline to see its vector components.
   - **Toggle statistical lens** — `scoopUp` gesture to open the TDA summary and correlation matrix.
   - **Anomaly on `magnitude`** — highlights extreme vectors.
   - **Reset** — `pushForward` gesture.

## Roadmap extensions

Full scientific loaders (NetCDF, HDF5, PLY/VTK meshes) and server-side TDA compute are planned for later phases. Today the app gives a lightweight, JS-only shape-first preview.

## Export

Use **Panels → Export Screenshot** to capture the vector-field view.
