# Social Influence Graph Example

A graph memory palace built from the `social-graph` sample dataset.

## What it shows

`src/data/SyntheticData.js` generates 24 nodes with `group` and `influence` plus random edges. The Draco engine detects `edges`, infers **GRAPH**, and runs a force-directed 3D layout.

| id | group | influence |
|---|---|---|
| N0 | A | 452 |
| N1 | B | 891 |
| ... | ... | ... |

## Artefacts generated

- **Icosa nodes** — coloured by group.
- **Thread/Beam edges** — weighted by influence.
- **Orb hubs** — high-influence nodes grow into orbs.
- **Constellation layout** — force-directed placement in 3D space.

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **Social Influence Graph**.
3. Operations you can perform:
   - **Filter by group** — keeps one community and fades the rest.
   - **Density cluster (DBSCAN)** — wheel menu **Ops → Density Cluster**.
   - **Anomaly on influence** — highlights outliers.
   - **Reset** — `pushForward` gesture or **Ops → Reset**.

## Export

Use **Panels → Export Story** to capture the filtered graph state.
