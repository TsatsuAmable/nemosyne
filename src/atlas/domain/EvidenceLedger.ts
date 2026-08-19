/**
 * EvidenceLedger — authoritative append-only provenance event stream, results, structures, and derived history.
 */

import { AnalysisHistory } from '../../data/AnalysisHistory.ts';
import { Dataset } from '../../data/Dataset.ts';
import type {
  AnalysisResult,
  AnalysisSpec,
  ResearchEvent,
  VRCommand,
} from '../types.ts';
import type { StructureSet } from '../structures.ts';

export class EvidenceLedger {
  private _ledger: ResearchEvent[] = [];
  private _results: AnalysisResult[] = [];
  private _structures: StructureSet[] = [];
  private _historyView: AnalysisHistory | null = null;
  private _resultCounter = 0;
  private _eventCounter = 0;

  get ledger(): readonly ResearchEvent[] {
    return this._ledger;
  }

  get results(): readonly AnalysisResult[] {
    return this._results;
  }

  get structures(): readonly StructureSet[] {
    return this._structures;
  }

  nextResultId(fp: string, datasetVersion: number, opName: string): string {
    this._resultCounter += 1;
    return `${fp}:${datasetVersion}:${opName}:${this._resultCounter}`;
  }

  addResult(result: AnalysisResult): void {
    this._results.push(result);
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

  recordObservation(
    observation: string,
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
        observation,
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
    this._resultCounter = 0;
    this._eventCounter = 0;
    this.invalidateHistoryView();
  }

  restore(
    results: AnalysisResult[],
    ledger: ResearchEvent[],
    structures?: StructureSet[],
  ): void {
    this._results = results.slice();
    this._ledger = ledger.slice();
    // The ledger is the authoritative record: rebuild structures from structure events
    const fromLedger = this._ledger
      .filter((event) => event.kind === 'structure' && event.structureSet)
      .map((event) => event.structureSet!);
    this._structures = fromLedger.length > 0 ? fromLedger : (structures?.slice() ?? []);
    this._resultCounter = this._results.length;
    this._eventCounter = this._ledger.length;
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
