# Organization Chart Example

A hierarchical memory palace built from the `org-chart` sample dataset.

## What it shows

`src/data/SyntheticData.js` generates a four-level organization tree with `id`, `name`, `level`, `parent`, `employees`, and `budget`.

| id  | name | level | parent | employees | budget |
| --- | ---- | ----- | ------ | --------- | ------ |
| 1   | CEO  | 0     | null   | 67        | 2.8M   |
| 2   | VP-A | 1     | 1      | 42        | 1.5M   |
| ... | ...  | ...   | ...    | ...       | ...    |

Moneta consumes Rust-owned hierarchy evidence and can select an authoritative radial-tree layout on tiered rings.

## Artefacts generated

- **Radial tree nodes** — sized by `employees` and `budget`.
- **Tiered rings** — one ring per organizational level.
- **Beam edges** — reporting lines.

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **Organization Chart**.
3. Operations you can perform:
   - **Aggregate by level** — rolls up headcount and budget per level.
   - **Anomaly on `budget`** — highlights unusually high-cost units.
   - **Sort by employees** — `sliceUp` gesture.
   - **Toggle statistical lens** — `scoopUp` gesture to see the correlation between `employees` and `budget`.

## Export

Use **Panels → Operation Log** to review the operations applied during the audit, then **Export Story** to save the session.
