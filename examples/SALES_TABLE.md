# Sales Performance Table Example

A tabular memory palace built from the `sales-table` sample dataset.

## What it shows

`src/data/SyntheticData.js` generates 60 sales rows with:

| id | region | product | units | price | revenue | discount |
|---|---|---|---|---|---|---|
| S1 | North | Widget | 123 | 10 | 1230 | 0 |
| ... | ... | ... | ... | ... | ... | ... |

The Draco engine infers **TABULAR** and places one crystal per row on category plinths. Because the dataset has several numeric columns, a **ChartPlane** is auto-attached with a default chart type.

## Artefacts generated

- **Crystals** — one per sales row.
- **Plinths** — grouped by region or product category.
- **Chart plane** — bar/line/correlation chart attached to the palace.

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **Sales Performance Table**.
3. Operations you can perform:
   - **Sort by revenue** — wheel menu or `sliceUp` gesture.
   - **Aggregate by region or product** — wheel menu or `pinchApart` gesture.
   - **Cluster by revenue** — wheel menu **Ops → Cluster**.
   - **Toggle statistical lens** — `scoopUp` gesture to see the correlation matrix and TDA summary.

## Export

Use **Panels → Export Story** to download the dataset plus applied operations as JSON.
