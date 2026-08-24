# Fraud Transaction Graph Example

A graph memory palace built from the `fraud-graph` sample dataset.

## What it shows

`src/data/SampleDatasets.ts` defines eight transactions with `amount`, `isFraud`, and `hour` fields, plus weighted edges between related transactions.

| id  | amount | isFraud | hour |
| --- | ------ | ------- | ---- |
| A   | 120    | false   | 9    |
| B   | 8500   | true    | 2    |
| C   | 300    | false   | 14   |
| D   | 9200   | true    | 3    |
| ... | ...    | ...     | ...  |
| H   | 11000  | true    | 1    |

Moneta consumes Rust-owned graph/categorical evidence and can select a constellation of connected crystal nodes. High-amount transactions become larger **Orb** nodes.

## Artefacts generated

- **Icosa nodes** — one per transaction, coloured by fraud status.
- **Beam edges** — weighted by relationship strength.
- **Orb hubs** — large nodes for high transaction amounts.
- **Anomaly halos** — magenta glow for amount outliers.

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **Fraud Transaction Graph**.
3. Operations you can perform:
   - **Filter to fraud nodes** — wheel menu or `pinchTogether` gesture.
   - **Anomaly on `amount`** — wheel menu **Ops → Highlight Outliers**.
   - **Cluster by amount** — wheel menu **Ops → Cluster**.
   - **Reset** — `pushForward` gesture or **Ops → Reset**.

## Export

Use **Panels → Export Screenshot** to capture the current constellation view.
