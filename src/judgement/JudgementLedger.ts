import {
  REPRESENTATION_JUDGEMENT_SCHEMA_VERSION,
  assertRepresentationJudgement,
  type RepresentationJudgement,
} from './RepresentationJudgement.ts';

export const JUDGEMENT_LEDGER_SCHEMA_VERSION = '1.0.0' as const;

export interface JudgementLedgerSnapshot {
  schemaVersion: typeof JUDGEMENT_LEDGER_SCHEMA_VERSION;
  judgementSchemaVersion: typeof REPRESENTATION_JUDGEMENT_SCHEMA_VERSION;
  judgements: readonly RepresentationJudgement[];
}

function cloneJudgement(judgement: RepresentationJudgement): RepresentationJudgement {
  return structuredClone(judgement);
}

/**
 * Append-only evidence ledger for attributable human representation judgements.
 *
 * The ledger intentionally has no update/delete operation. Corrections are new
 * judgements with their own IDs/sequences so research history remains auditable.
 */
export class JudgementLedger {
  private readonly judgements: RepresentationJudgement[] = [];
  private readonly ids = new Set<string>();
  private readonly nextSequenceByInvestigation = new Map<string, number>();

  get size(): number {
    return this.judgements.length;
  }

  all(): readonly RepresentationJudgement[] {
    return this.judgements.map(cloneJudgement);
  }

  forInvestigation(investigationId: string): readonly RepresentationJudgement[] {
    return this.judgements
      .filter((item) => item.investigationId === investigationId)
      .map(cloneJudgement);
  }

  expectedSequence(investigationId: string): number {
    return this.nextSequenceByInvestigation.get(investigationId) ?? 0;
  }

  append(judgement: RepresentationJudgement): void {
    assertRepresentationJudgement(judgement);
    if (this.ids.has(judgement.judgementId)) {
      throw new Error(`RepresentationJudgement already exists: ${judgement.judgementId}`);
    }
    const expected = this.expectedSequence(judgement.investigationId);
    if (judgement.sequence !== expected) {
      throw new Error(
        `Out-of-order RepresentationJudgement for ${judgement.investigationId}: expected ${expected}, received ${judgement.sequence}`,
      );
    }
    this.judgements.push(cloneJudgement(judgement));
    this.ids.add(judgement.judgementId);
    this.nextSequenceByInvestigation.set(judgement.investigationId, expected + 1);
  }

  toJSON(): JudgementLedgerSnapshot {
    return {
      schemaVersion: JUDGEMENT_LEDGER_SCHEMA_VERSION,
      judgementSchemaVersion: REPRESENTATION_JUDGEMENT_SCHEMA_VERSION,
      judgements: this.all(),
    };
  }

  restore(snapshot: JudgementLedgerSnapshot): void {
    if (snapshot.schemaVersion !== JUDGEMENT_LEDGER_SCHEMA_VERSION) {
      throw new Error(`Unsupported JudgementLedger schema version: ${snapshot.schemaVersion}`);
    }
    if (snapshot.judgementSchemaVersion !== REPRESENTATION_JUDGEMENT_SCHEMA_VERSION) {
      throw new Error(`Unsupported RepresentationJudgement schema version: ${snapshot.judgementSchemaVersion}`);
    }

    const staged = new JudgementLedger();
    for (const judgement of snapshot.judgements) staged.append(judgement);

    this.judgements.splice(0, this.judgements.length, ...staged.all());
    this.ids.clear();
    this.nextSequenceByInvestigation.clear();
    for (const judgement of this.judgements) {
      this.ids.add(judgement.judgementId);
      this.nextSequenceByInvestigation.set(judgement.investigationId, judgement.sequence + 1);
    }
  }
}
