/**
 * EvidenceLedger — authoritative append-only provenance event stream, results, structures, and derived history.
 */

import { AnalysisHistory } from '../../data/AnalysisHistory.ts';
import { Dataset } from '../../data/Dataset.ts';
import type {
  AnalysisResult,
  AnalysisSpec,
  Annotation,
  Finding,
  Observation,
  ResearchEvent,
  VRCommand,
} from '../types.ts';
import type { StructureSet } from '../structures.ts';

export class EvidenceLedger {
  private _ledger: ResearchEvent[] = [];
  private _results: AnalysisResult[] = [];
  private _structures: StructureSet[] = [];
  private _observations: Observation[] = [];
  private _findings: Finding[] = [];
  private _annotations: Annotation[] = [];
  private _historyView: AnalysisHistory | null = null;
  private _resultCounter = 0;
  private _eventCounter = 0;
  private _observationCounter = 0;
  private _findingCounter = 0;
  private _annotationCounter = 0;

  get ledger(): readonly ResearchEvent[] {
    return this._ledger;
  }

  get results(): readonly AnalysisResult[] {
    return this._results;
  }

  get structures(): readonly StructureSet[] {
    return this._structures;
  }

  get observations(): readonly Observation[] {
    return this._observations;
  }

  get findings(): readonly Finding[] {
    return this._findings;
  }

  get annotations(): readonly Annotation[] {
    return this._annotations;
  }

  nextResultId(fp: string, datasetVersion: number, opName: string): string {
    this._resultCounter += 1;
    return `${fp}:${datasetVersion}:${opName}:${this._resultCounter}`;
  }

  addResult(result: AnalysisResult): void {
    this._results.push(result);
  }

  recordObservation(
    obs: Omit<Observation, 'id' | 'timestamp'>,
    sessionId: string,
    stateHash: string = obs.datasetFingerprint,
    now: number = Date.now(),
  ): Observation {
    this._observationCounter += 1;
    const observation: Observation = {
      ...obs,
      id: `obs:${sessionId}:${this._observationCounter}`,
      timestamp: now,
    };
    this._observations.push(observation);
    this.appendEvent(
      {
        timestamp: now,
        kind: 'observation',
        command: { op: 'observation' },
        observationEntity: observation,
        datasetVersion: obs.datasetVersion,
        datasetFingerprint: obs.datasetFingerprint,
        stateHash,
        observation: obs.notes,
      },
      sessionId,
    );
    return observation;
  }

  recordFinding(
    findingInput: Omit<Finding, 'id' | 'timestamp'>,
    sessionId: string,
    stateHash: string = findingInput.datasetFingerprint,
    now: number = Date.now(),
  ): Finding {
    this._findingCounter += 1;
    const finding: Finding = {
      ...findingInput,
      id: `finding:${sessionId}:${this._findingCounter}`,
      timestamp: now,
    };
    this._findings.push(finding);
    this.appendEvent(
      {
        timestamp: now,
        kind: 'finding',
        command: { op: 'finding' },
        findingEntity: finding,
        datasetVersion: findingInput.datasetVersion,
        datasetFingerprint: findingInput.datasetFingerprint,
        stateHash,
        observation: findingInput.title,
      },
      sessionId,
    );
    return finding;
  }

  recordAnnotation(
    annotationInput: Omit<Annotation, 'id' | 'timestamp'>,
    sessionId: string,
    datasetVersion: number = 0,
    datasetFingerprint: string = '',
    stateHash: string = datasetFingerprint,
    now: number = Date.now(),
  ): Annotation {
    this._annotationCounter += 1;
    const annotation: Annotation = {
      ...annotationInput,
      id: `annot:${sessionId}:${this._annotationCounter}`,
      timestamp: now,
    };
    this._annotations.push(annotation);
    this.appendEvent(
      {
        timestamp: now,
        kind: 'annotation',
        command: { op: 'annotation' },
        annotationEntity: annotation,
        datasetVersion,
        datasetFingerprint,
        stateHash,
        observation: annotationInput.text,
      },
      sessionId,
    );
    return annotation;
  }

  findObservationsForFinding(findingId: string): Observation[] {
    const finding = this._findings.find((f) => f.id === findingId);
    if (!finding) return [];
    return this._observations.filter((o) => finding.observationIds.includes(o.id));
  }

  appendEvent(
    event: Omit<ResearchEvent, 'eventId'>,
    sessionId: string,
  ): ResearchEvent {
    this._eventCounter += 1;
    const fullEvent: ResearchEvent = {
      ...event,
      eventId: `${sessionId}:${this._eventCounter}`,
      sessionId,
    };
    this._ledger.push(fullEvent);
    this.invalidateHistoryView();
    return fullEvent;
  }

  recordStructure(
    structureSet: StructureSet,
    sessionId: string,
    now: number,
  ): void {
    this._structures.push(structureSet);
    this.appendEvent(
      {
        timestamp: now,
        kind: 'structure',
        command: { op: 'structure' },
        structureSet,
        datasetVersion: structureSet.datasetVersion,
        datasetFingerprint: structureSet.datasetFingerprint,
        stateHash: structureSet.datasetFingerprint,
      },
      sessionId,
    );
  }

  recordEmbodimentCommand(
    command: VRCommand,
    sessionId: string,
    datasetVersion: number,
    datasetFingerprint: string,
    stateHash: string,
    now: number,
  ): void {
    this.appendEvent(
      {
        timestamp: now,
        kind: 'embodiment',
        command: { op: 'embodiment' },
        embodimentCommand: command,
        datasetVersion,
        datasetFingerprint,
        stateHash,
      },
      sessionId,
    );
  }


  recordIntervention(
    intervention: string,
    sessionId: string,
    datasetVersion: number,
    datasetFingerprint: string,
    stateHash: string,
    now: number,
  ): void {
    this.appendEvent(
      {
        timestamp: now,
        kind: 'analysis',
        command: { op: 'analysis' },
        datasetVersion,
        datasetFingerprint,
        intervention,
        stateHash,
      },
      sessionId,
    );
  }

  getAnalysisHistory(original: Dataset | null): AnalysisHistory {
    if (!this._historyView) {
      this._historyView = this._buildHistoryFromLedger(original);
    }
    return this._historyView;
  }

  invalidateHistoryView(): void {
    this._historyView = null;
  }

  reset(): void {
    this._ledger = [];
    this._results = [];
    this._structures = [];
    this._observations = [];
    this._findings = [];
    this._annotations = [];
    this._resultCounter = 0;
    this._eventCounter = 0;
    this._observationCounter = 0;
    this._findingCounter = 0;
    this._annotationCounter = 0;
    this.invalidateHistoryView();
  }

  restore(
    results: AnalysisResult[],
    ledger: ResearchEvent[],
    structures?: StructureSet[],
    observations?: Observation[],
    findings?: Finding[],
    annotations?: Annotation[],
  ): void {
    this._results = results.slice();
    this._ledger = ledger.slice();

    // Rebuild structures from authoritative ledger
    const fromLedgerStructures = this._ledger
      .filter((event) => event.kind === 'structure' && event.structureSet)
      .map((event) => event.structureSet!);
    this._structures = fromLedgerStructures.length > 0 ? fromLedgerStructures : (structures?.slice() ?? []);

    // Rebuild observations from authoritative ledger or passed snapshot
    const fromLedgerObs = this._ledger
      .filter((event) => event.kind === 'observation' && event.observationEntity)
      .map((event) => event.observationEntity!);
    this._observations = fromLedgerObs.length > 0 ? fromLedgerObs : (observations?.slice() ?? []);

    // Rebuild findings from authoritative ledger or passed snapshot
    const fromLedgerFindings = this._ledger
      .filter((event) => event.kind === 'finding' && event.findingEntity)
      .map((event) => event.findingEntity!);
    this._findings = fromLedgerFindings.length > 0 ? fromLedgerFindings : (findings?.slice() ?? []);

    // Rebuild annotations from authoritative ledger or passed snapshot
    const fromLedgerAnnots = this._ledger
      .filter((event) => event.kind === 'annotation' && event.annotationEntity)
      .map((event) => event.annotationEntity!);
    this._annotations = fromLedgerAnnots.length > 0 ? fromLedgerAnnots : (annotations?.slice() ?? []);

    this._resultCounter = this._results.length;
    this._eventCounter = this._ledger.length;
    this._observationCounter = this._observations.length;
    this._findingCounter = this._findings.length;
    this._annotationCounter = this._annotations.length;
    this.invalidateHistoryView();
  }

  private _buildHistoryFromLedger(original: Dataset | null): AnalysisHistory {
    const history = new AnalysisHistory();
    let current = original?.clone?.() ?? null;
    for (const event of this._ledger) {
      switch (event.kind) {
        case 'load':
          current = original?.clone?.() ?? null;
          break;
        case 'analysis': {
          if (!event.result?.dataset) break;
          const before = current?.clone?.() ?? null;
          const after = Dataset.fromJSON(event.result.dataset);
          current = after;
          const spec = event.command as AnalysisSpec;
          const label = spec.label ?? spec.operation.op;
          history.push(label, before, after, spec.operation as Record<string, unknown>);
          break;
        }
        case 'reset': {
          const before = current?.clone?.() ?? null;
          current = original?.clone?.() ?? null;
          if (before) history.push('reset', before, current, {});
          break;
        }
        case 'undo': {
          const entry = history.undo();
          if (entry) current = entry.dataset;
          break;
        }
        case 'redo': {
          const entry = history.redo();
          if (entry) current = entry.dataset;
          break;
        }
        case 'seek': {
          const index = (event.command as { index?: number }).index;
          if (index != null) {
            const entry = history.seek(index);
            if (entry) current = entry.dataset;
          }
          break;
        }
        default:
          break;
      }
    }
    return history;
  }
}
