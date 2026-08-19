/**
 * ResearchContext — manages session identity, investigator context, and time.
 */

export interface ResearchContextOptions {
  sessionId?: string;
  now?: () => number;
  studyId?: string;
  researchQuestion?: string;
  hypothesis?: string;
}

export class ResearchContext {
  private readonly _sessionId: string;
  private readonly _now: () => number;
  private readonly _studyId?: string;
  private readonly _researchQuestion?: string;
  private readonly _hypothesis?: string;

  constructor(options: ResearchContextOptions = {}) {
    this._now = options.now ?? (() => {
      return (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : (typeof Date !== 'undefined' && Date.now)
          ? Date.now()
          : 0;
    });
    this._sessionId = options.sessionId ?? `session-${this._now()}`;
    this._studyId = options.studyId;
    this._researchQuestion = options.researchQuestion;
    this._hypothesis = options.hypothesis;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get studyId(): string | undefined {
    return this._studyId;
  }

  get researchQuestion(): string | undefined {
    return this._researchQuestion;
  }

  get hypothesis(): string | undefined {
    return this._hypothesis;
  }

  now(): number {
    return this._now();
  }
}
