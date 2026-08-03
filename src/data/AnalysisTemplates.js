/**
 * Ready-made analysis stories.
 *
 * Each template bundles a sample dataset, an atmospheric theme, and an optional
 * tour id so a new user can jump straight into a credible scenario rather than
 * loading a dataset and guessing which operations to try.
 */

export const ANALYSIS_TEMPLATES = [
  {
    id: 'factory-floor',
    label: 'Factory Floor Monitoring',
    icon: '🏭',
    datasetKey: 'sensor-stream',
    theme: 'coolDepth',
    tourId: 'first-dataset',
    description: 'Live temperature and vibration stream; time-slice to find anomaly spikes.',
  },
  {
    id: 'fraud-investigation',
    label: 'Fraud Investigation',
    icon: '🔍',
    datasetKey: 'fraud-graph',
    theme: 'warmAnomaly',
    tourId: 'first-dataset',
    description: 'Graph of transactions; filter and anomaly-highlight suspicious amounts.',
  },
  {
    id: 'sales-performance',
    label: 'Sales Performance Review',
    icon: '📈',
    datasetKey: 'sales-table',
    theme: 'daylightGlobe',
    tourId: 'first-dataset',
    description: 'Tabular sales data; sort by revenue and aggregate by region.',
  },
  {
    id: 'org-cost-audit',
    label: 'Organizational Cost Audit',
    icon: '🏛️',
    datasetKey: 'org-chart',
    theme: 'neonMidnight',
    tourId: 'first-dataset',
    description: 'Radial org hierarchy; aggregate by level and inspect budget outliers.',
  },
  {
    id: 'market-replay',
    label: 'Market Session Replay',
    icon: '📉',
    datasetKey: 'financial-series',
    theme: 'daylightGlobe',
    tourId: 'first-dataset',
    description: 'OHLCV time ribbon; scrub through slices to replay a trading session.',
  },
  {
    id: 'geo-benchmark',
    label: 'Geospatial Benchmark',
    icon: '🗺️',
    datasetKey: 'geo-cities',
    theme: 'coolDepth',
    tourId: 'first-dataset',
    description: 'Lat/lon columns as room-scale bars; filter to the largest metros.',
  },
];

/**
 * Resolve a template to a loader entry using the current sample-dataset registry.
 * @param {string} templateId
 * @param {Array<{ key: string, label: string, topology: string, dataset: Dataset, maxDepth?: number, encodings?: object }>} sampleDatasets
 * @returns {{ entry: object, theme: string, tourId: string } | null}
 */
export function resolveTemplate(templateId, sampleDatasets) {
  const template = ANALYSIS_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return null;
  const entry = sampleDatasets.find((e) => e.key === template.datasetKey);
  if (!entry) return null;
  return { entry, theme: template.theme, tourId: template.tourId };
}
