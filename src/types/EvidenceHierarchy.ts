/**
 * 5-Level Evidence Hierarchy (Research Validation Roadmap).
 *
 * Enforces project-wide rigor distinguishing demonstrated technical implementation
 * from empirical research validation:
 *
 * 🟢 IMPLEMENTED: Code exists in repository.
 * 🔵 TESTED: Automated tests verify intended behavior under declared tolerances.
 * 🟡 USABLE: Usability trials confirm representative analysts complete tasks without blocking friction.
 * 🟠 USEFUL: Quantitative trials demonstrate measurable task speed / accuracy / workload improvements.
 * 🔴 SUPERIOR: Preregistered controlled crossover study demonstrates statistically significant
 *             and reproducible advantage over the 2D desktop baseline.
 */

export type EvidenceLevel =
  | 'IMPLEMENTED'
  | 'TESTED'
  | 'USABLE'
  | 'USEFUL'
  | 'SUPERIOR';

export interface FeatureEvidenceRecord {
  featureId: string;
  name: string;
  level: EvidenceLevel;
  validatedBy: string;
  evidenceArtifactUri?: string;
  lastAuditedTimestamp: number;
}

export const EVIDENCE_ORDER: Record<EvidenceLevel, number> = {
  IMPLEMENTED: 1,
  TESTED: 2,
  USABLE: 3,
  USEFUL: 4,
  SUPERIOR: 5,
};

export class EvidenceHierarchyRegistry {
  private _records = new Map<string, FeatureEvidenceRecord>();

  register(record: FeatureEvidenceRecord): void {
    this._records.set(record.featureId, record);
  }

  getRecord(featureId: string): FeatureEvidenceRecord | undefined {
    return this._records.get(featureId);
  }

  satisfiesLevel(featureId: string, requiredLevel: EvidenceLevel): boolean {
    const record = this._records.get(featureId);
    if (!record) return false;
    return EVIDENCE_ORDER[record.level] >= EVIDENCE_ORDER[requiredLevel];
  }

  getAllByLevel(level: EvidenceLevel): FeatureEvidenceRecord[] {
    return Array.from(this._records.values()).filter((r) => r.level === level);
  }
}
