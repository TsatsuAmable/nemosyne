# Smart Cities Example

A geospatial memory palace built from the `geo-cities` sample dataset.

## What it shows

`src/data/SyntheticData.js` generates 20 global cities with lat/lon, population, and GDP:

| name | lat | lon | population | gdp |
|---|---|---|---|---|
| New York | 40.7 | -74.0 | 8 | 312 |
| London | 51.5 | -0.1 | 9 | 478 |
| ... | ... | ... | ... | ... |

The Draco engine detects `lat`/`lon`, infers **GEO**, and maps the points to a room-scale geo-surface with columns and zone boundaries.

## Artefacts generated

- **Geo-surface columns** — one per city, height = population.
- **Zone boundaries** — regional grouping halos.
- **Colour encoding** — GDP maps to the colour scale.

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **Global Cities Geospatial**.
3. Operations you can perform:
   - **Filter by population** — `pinchTogether` gesture.
   - **Aggregate by region** — `pinchApart` gesture.
   - **Sort by GDP** — `sliceUp` gesture.
   - **Toggle flight mode** — wheel menu **Views → Toggle Flight**, then fly over the model.

## Note on city-scale data

The current geospatial layout is room-scale and works best with tens to hundreds of points. Large-scale terrain, GeoJSON, and OSM building extrusion are roadmap items.

## Export

Use **Panels → Export Story** to save the current filter and camera view.
