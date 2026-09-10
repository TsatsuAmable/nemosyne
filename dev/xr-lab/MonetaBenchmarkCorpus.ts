export type OracleStrength = 'exact-generative' | 'labeled-ground-truth' | 'task-solution' | 'human-preference' | 'diagnostic-only';
export type BenchmarkDomain = 'statistical-shape' | 'manifold' | 'graph' | 'time-series' | 'visual-analytics' | 'visualization-preference';

export interface MonetaBenchmarkFamily {
  id: string;
  label: string;
  domain: BenchmarkDomain;
  source: 'generated' | 'external';
  oracleStrength: OracleStrength;
  machineOracle: boolean;
  requiresHumanValidation: boolean;
  properties: string[];
  monetaQuestion: string;
  reference?: string;
}

/**
 * Benchmark families are deliberately heterogeneous. No single family defines
 * "the correct visualization". Exact/labeled oracles test whether a candidate
 * preserves known structure; preference corpora test ranking priors; human
 * studies are still required for discovery value and perceptual usefulness.
 */
export const MONETA_BENCHMARK_FAMILIES: Record<string, MonetaBenchmarkFamily> = {
  'synthetic-structure-lab': {
    id: 'synthetic-structure-lab', label: 'Seeded synthetic structure lab', domain: 'statistical-shape', source: 'generated',
    oracleStrength: 'exact-generative', machineOracle: true, requiresHumanValidation: false,
    properties: ['cluster membership', 'outlier identity', 'correlation form', 'heteroscedasticity', 'nonlinearity', 'class overlap'],
    monetaQuestion: 'Does the representation expose or preserve deliberately planted statistical structure without inventing structure?'
  },
  'anscombe-datasaurus': {
    id: 'anscombe-datasaurus', label: 'Anscombe / Datasaurus diagnostics', domain: 'statistical-shape', source: 'external',
    oracleStrength: 'diagnostic-only', machineOracle: true, requiresHumanValidation: true,
    properties: ['nearly/equally matched summary statistics', 'visually distinct distributions', 'outliers', 'nonlinear structure'],
    monetaQuestion: 'Does Moneta distinguish datasets that naive summary-statistic equivalence would collapse?',
    reference: 'Anscombe (1973); Matejka & Fitzmaurice (CHI 2017)'
  },
  'synthetic-manifolds': {
    id: 'synthetic-manifolds', label: 'Seeded manifold/topology suite', domain: 'manifold', source: 'generated',
    oracleStrength: 'exact-generative', machineOracle: true, requiresHumanValidation: false,
    properties: ['neighborhood graph', 'latent coordinate', 'connected components', 'loops', 'Swiss-roll/geodesic order'],
    monetaQuestion: 'Does dimensional/spatial projection preserve neighborhoods and known topology across representation families?'
  },
  'lfr-communities': {
    id: 'lfr-communities', label: 'LFR graph communities', domain: 'graph', source: 'generated',
    oracleStrength: 'exact-generative', machineOracle: true, requiresHumanValidation: false,
    properties: ['community membership', 'degree distribution', 'community-size distribution', 'mixing parameter'],
    monetaQuestion: 'Can graph representations recover planted communities as community mixing and scale vary?',
    reference: 'Lancichinetti, Fortunato & Radicchi (2008) LFR benchmark'
  },
  'nab-anomalies': {
    id: 'nab-anomalies', label: 'Numenta Anomaly Benchmark', domain: 'time-series', source: 'external',
    oracleStrength: 'labeled-ground-truth', machineOracle: true, requiresHumanValidation: true,
    properties: ['labeled anomaly windows', 'real and artificial time series', 'known-cause subsets'],
    monetaQuestion: 'Do time-oriented representations make known anomalous intervals recoverable while preserving temporal context?',
    reference: 'Numenta NAB v1.1'
  },
  'vast-ground-truth': {
    id: 'vast-ground-truth', label: 'VAST visual analytics benchmarks', domain: 'visual-analytics', source: 'external',
    oracleStrength: 'task-solution', machineOracle: false, requiresHumanValidation: true,
    properties: ['multi-source analytic tasks', 'scenario ground truth', 'published solutions', 'investigative synthesis'],
    monetaQuestion: 'Does Moneta help an investigator recover known analytic findings from realistic multi-source tasks?',
    reference: 'Visual Analytics Benchmark Repository / IEEE VAST Challenge'
  },
  'draco-perception': {
    id: 'draco-perception', label: 'Draco graphical-perception preferences', domain: 'visualization-preference', source: 'external',
    oracleStrength: 'human-preference', machineOracle: true, requiresHumanValidation: true,
    properties: ['hard encoding constraints', 'soft effectiveness preferences', 'weights learned from graphical-perception studies'],
    monetaQuestion: 'Do Moneta candidates respect established encoding legality and perceptual-effectiveness priors where applicable?',
    reference: 'Moritz et al., Formalizing Visualization Design Knowledge as Constraints (TVCG 2019); Draco 2'
  },
  'vizml-corpus': {
    id: 'vizml-corpus', label: 'VizML visualization corpus', domain: 'visualization-preference', source: 'external',
    oracleStrength: 'human-preference', machineOracle: true, requiresHumanValidation: true,
    properties: ['dataset features', 'analyst visualization choices', 'large-scale recommendation training signal'],
    monetaQuestion: 'How do Moneta ranking choices compare with large-scale human-authored visualization priors without treating popularity as truth?',
    reference: 'Hu et al., VizML (CHI 2019)'
  }
};

export function benchmarkFamiliesForAutomation(): MonetaBenchmarkFamily[] {
  return Object.values(MONETA_BENCHMARK_FAMILIES).filter((family) => family.machineOracle);
}

export function benchmarkFamiliesRequiringHumans(): MonetaBenchmarkFamily[] {
  return Object.values(MONETA_BENCHMARK_FAMILIES).filter((family) => family.requiresHumanValidation);
}
