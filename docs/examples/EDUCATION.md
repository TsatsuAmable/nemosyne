# Education Example

A hierarchical memory palace built from the `org-chart` sample dataset, used here as a teaching scenario for exploring structure and cost.

## What it shows

The same organization chart used in `ORG_CHART.md` is framed as an interactive lesson. Students can:

- See reporting relationships as a radial tree palace.
- Compare size and budget across levels.
- Use aggregation to answer “what does each level cost?”
- Use anomaly detection to find unusually funded units.

## Artefacts generated

- **Radial tree nodes** — one per org unit.
- **Tiered rings** — one per level.
- **Beam reporting lines** — parent-child edges.
- **Chart plane** — employees vs budget scatter/correlation.

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **Organization Chart**.
3. Learning activities:
   - **Drill down** — inspect any node to see its employees and budget.
   - **Aggregate by level** — discuss headcount roll-ups.
   - **Toggle statistical lens** — `scoopUp` to see the employees/budget correlation.
   - **Undo/redo** — `rotateCCW` / `rotateCW` to revisit decisions.

## Guided tour

Start **Panels → Tour** from the wheel menu for a step-by-step walkthrough of the palace, gestures, and dashboard.

## Export

Use **Panels → Export Story** to save the exploration as a JSON analysis story.
