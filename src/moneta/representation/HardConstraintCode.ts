/**
 * Machine-readable hard-constraint codes (RF-027).
 *
 * P1-E remediation previously classified a disqualification by substring-matching
 * the human-readable `disqualificationReason`. That is fragile: a reason-text
 * rename (e.g. RF-024's `occlusion` → `frustum exclusion`) silently broke
 * remediation routing. These typed codes are emitted by `checkHardConstraints`
 * and consumed by `diagnoseInvestigatorOutcome`, so remediation routing no
 * longer depends on prose.
 */
export type HardConstraintCode =
  | 'hardware-element-budget'
  | 'frustum-exclusion'
  | 'information-loss-critical'
  | 'identity-loss'
  | 'exact-metric-loss'
  | 'cluster-separation-loss'
  | 'cluster-authority-required'
  | 'layout-topology-requirement'
  | 'candidate-structure-requirement'
  | 'scale-range';

/**
 * Coarse category used by remediation routing. Separates scientific
 * permissibility (information-loss constraints may NOT be auto-relaxed) from
 * preference/device constraints (hardware / frustum-exclusion MAY be relaxed,
 * subject to device feasibility verification).
 */
export type HardConstraintCategory =
  | 'hardware'
  | 'perceptual'
  | 'scientific-info-loss'
  | 'structural';

export function classifyHardConstraint(
  code: HardConstraintCode | undefined
): HardConstraintCategory {
  switch (code) {
    case 'hardware-element-budget':
      return 'hardware';
    case 'frustum-exclusion':
      return 'perceptual';
    case 'information-loss-critical':
    case 'identity-loss':
    case 'exact-metric-loss':
    case 'cluster-separation-loss':
      return 'scientific-info-loss';
    default:
      return 'structural';
  }
}
