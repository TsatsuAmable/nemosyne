import type { MonetaTopologyNode } from './MonetaTopologyNode.ts';

const EMBODIMENT_HINT_WEIGHT = 100;

const HINT_RULES: Record<string, string[]> = {
  'highlight-cluster': [
    'prefer_cluster_volume_for_high_cardinality',
    'prefer_cluster_probe_for_large_datasets',
  ],
  'annotate-boundary': [
    'prefer_orb_for_outliers',
  ],
  'focus-region': [
    'prefer_conical_tree_for_hierarchy',
  ],
  'split-view': [
    'prefer_fork_plane_for_tabular',
  ],
  'outlier-orb': [
    'prefer_orb_for_outliers',
  ],
};

export function applyEmbodimentHint(
  monetaNode: MonetaTopologyNode,
  hint: string,
): void {
  const ruleNames = HINT_RULES[hint];
  if (!ruleNames) return;
  for (const ruleName of ruleNames) {
    monetaNode.engine.setWeight(ruleName, EMBODIMENT_HINT_WEIGHT);
  }
  monetaNode.reSolveAndSynthesize();
}

export function clearEmbodimentHints(monetaNode: MonetaTopologyNode): void {
  for (const rules of Object.values(HINT_RULES)) {
    for (const ruleName of rules) {
      const sc = monetaNode.engine.softConstraints.find((s) => s.name === ruleName);
      if (sc) monetaNode.engine.setWeight(ruleName, sc.weight > 0 ? 1 : 0);
    }
  }
  monetaNode.reSolveAndSynthesize();
}
