# Plan — Expand `docs/index.html` applications and use cases

## Goal

The `nemosyne.world` landing page (`docs/index.html`) is the first place visitors learn what Nemosyne does. Right now the "Applications" and "Use Cases" sections describe aspirational domains (DICOM, FIX trading, molecular PDB, etc.) that are not backed by built-in sample datasets. This plan updates the page so every showcased example is directly reproducible in the live app today.

## Scope

### 1. `docs/index.html`

- **Hero copy** — replace the generic "Manipulate Reality" framing with the actual project identity: a three.js/WebXR spatial data analysis suite that turns tabular/hierarchical/graph/time-series/vector/geospatial data into interactive 3D memory palaces.
- **Quick Start code block** — replace the current snippet (which uses a non-existent `Dataset.fromJSON` API) with a working snippet based on the current `World` and `allSampleDatasets` exports.
- **Built-in datasets section** — add a concise reference table mapping each `allSampleDatasets` entry to its topology, primary artefact, and one supported operation.
- **Examples gallery** — refactor the 12 domain cards into topology-backed cards that map 1:1 to `src/data/SampleDatasets.js`. Each card lists the sample key, topology tag, generated artefacts, and a concrete interaction.
- **Use cases section** — expand from six generic blurbs into credible scenarios, each tied to a shipped sample dataset and a real feature (gesture operation, live stream, anomaly detection, chart plane, TDA summary, etc.).
- **Internal links** — link each gallery card to the matching `docs/examples/*.md` page and to `GETTING_STARTED.md` for the VR launch steps.

### 2. `docs/examples/*.md`

- Rewrite the existing example docs so they describe the matching built-in dataset, its columns, the topology the Draco engine infers, the artefacts `VRTopologyTranslator` produces, and a short walkthrough of supported operations.
- Remove or re-label "Extensions Required" lists. Only features that ship today (CSV/JSON import, live WebSocket adapter, gesture operations, clustering, anomaly detection, chart planes, TDA summary panels, session export) should be listed as current.
- Add any missing topology-specific docs so every gallery card has a resolving link.

### 3. Out of scope

- New sample datasets or parsers (CSV/Excel/Parquet/SQL connectors are roadmap work).
- URL query-parameter deep links to auto-load a dataset.
- Major CSS/theme redesign beyond what is needed to present the new content.

## Proposed built-in dataset mapping

Use this table to keep the gallery and example docs aligned with `src/data/SampleDatasets.js`.

| Sample key | Topology | Artefacts generated | Concrete operation to demo | Example doc |
|---|---|---|---|---|
| `supply-chain` | HIERARCHY | Conical tree nodes on plinth rings, beam parent-child edges | Filter by region, aggregate by region, anomaly on `riskScore` | `docs/examples/SUPPLY_CHAIN.md` |
| `fraud-graph` | GRAPH | Icosa nodes + beam edges, orb for high-influence hubs | Filter fraud nodes, anomaly on `amount`, k-means cluster | `docs/examples/FRAUD_GRAPH.md` |
| `sensor-stream` | TIME_SERIES | Time ribbon/trail with token markers | Time slice, live stream via `/__demo-stream`, anomaly on `vibration` | `docs/examples/INDUSTRIAL_IOT.md` |
| `sales-table` | TABULAR | Crystals on category plinths, auto-attached chart plane | Sort by `revenue`, aggregate by `region`, cluster | `docs/examples/SALES_TABLE.md` |
| `org-chart` | HIERARCHY | Radial tree on tiered rings | Aggregate by `level`, anomaly on `budget` | `docs/examples/EDUCATION.md` (or `ORG_CHART.md`) |
| `wind-field` | VECTOR_FIELD | Flow-ray streamlines + magnitude colour | Inspect magnitude, statistical lens (TDA summary) | `docs/examples/SCIENTIFIC_RESEARCH.md` |
| `social-graph` | GRAPH | Force-directed constellation | Filter by `group`, density cluster | `docs/examples/SOCIAL_GRAPH.md` |
| `financial-series` | TIME_SERIES | Time ribbon with OHLCV candle tokens | Time slice, anomaly on `close` | `docs/examples/FINANCIAL_MARKETS.md` |
| `geo-cities` | GEO | Geo-surface columns + zone boundaries | Filter by population, aggregate by region | `docs/examples/SMART_CITIES.md` |
| `flow-process` | GRAPH / FLOW | Process nodes + weighted beams/trails | Filter low-throughput stages | `docs/examples/FLOW_PROCESS.md` |

## Concrete use-case blurbs (all supported today)

1. **Factory floor monitoring** — Load `sensor-stream`, connect to the dev-server `wss://host/__demo-stream`, and watch temperature/vibration tokens update in the time ribbon. Use the wheel menu or `sliceDown` gesture to time-slice the stream and `Highlight outliers` to pulse magenta halos on anomalous readings.
2. **Fraud investigation** — Load `fraud-graph`. Fraudulent transactions lift as orbs with anomaly detection on `amount`. Filter non-fraud nodes with `pinchTogether` or the wheel menu to focus on the suspicious chain.
3. **Sales performance review** — Load `sales-table`. The Draco engine attaches a chart plane automatically. Sort by `revenue` (`sliceUp`), aggregate by `region`, and export the analysis story from the wheel menu.
4. **Organizational cost audit** — Load `org-chart`. Walk the radial tree, aggregate by `level`, and turn on the statistical lens (`scoopUp`) to see a correlation panel for `employees` vs `budget`.
5. **Market session replay** — Load `financial-series`. Scrub through the OHLCV ribbon with the time-slice operation to replay a trading session and spot volatility clusters.
6. **Geospatial benchmark** — Load `geo-cities`. Fly over room-scale lat/lon bars sized by `population` and coloured by `gdp`, then filter to the largest metros.

## Tasks

- [ ] Audit `src/data/SampleDatasets.js` and `src/data/SyntheticData.js` to confirm columns and operations for each entry.
- [ ] Rewrite hero subtitle and tagline in `docs/index.html`.
- [ ] Fix the Quick Start code block to use the real `World` + `allSampleDatasets` API.
- [ ] Add a "Built-in datasets" reference section to `docs/index.html`.
- [ ] Refactor the Examples Gallery into topology-backed cards using the mapping table above.
- [ ] Rewrite the Use Cases section with the six credible scenarios above.
- [ ] Create/rename example docs so every gallery card has a resolving page:
  - `docs/examples/SUPPLY_CHAIN.md`
  - `docs/examples/FRAUD_GRAPH.md`
  - `docs/examples/INDUSTRIAL_IOT.md` (rewrite)
  - `docs/examples/SALES_TABLE.md`
  - `docs/examples/ORG_CHART.md`
  - `docs/examples/SOCIAL_GRAPH.md`
  - `docs/examples/FINANCIAL_MARKETS.md` (rewrite)
  - `docs/examples/SCIENTIFIC_RESEARCH.md` (rewrite)
  - `docs/examples/SMART_CITIES.md` (rewrite)
  - `docs/examples/FLOW_PROCESS.md`
- [ ] Remove references to unsupported extensions (DICOM, FIX, PDB, OSM extrusion, etc.) from the rewritten example docs.
- [ ] Add/verify navigation anchors and internal links.
- [ ] Run `npm run build` in `nemosyne/` to ensure no static-file regressions.
- [ ] Optional: generate CSS list/table styles for the new reference section if the existing card grid is not suitable.

## Success criteria

- Every example and use case on `docs/index.html` maps to a sample dataset in `src/data/SampleDatasets.js`.
- No landing-page claim references unsupported formats or extensions.
- The Quick Start code block can be pasted into a local `nemosyne` build and produce a visible palace (modulo HTTPS certs).
- All gallery card links resolve to `docs/examples/*.md` files that describe shipped behaviour.
- The site still builds and renders without broken internal anchors.
