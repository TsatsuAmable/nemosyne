/**
 * ResearchContext — manages session identity, investigator context, and time.
 */

export interface ResearchContextOptions {
  sessionId?: string;
  now?: () => number;
}

export class ResearchContext {
  private readonly _sessionId: string;
  private readonly _now: () => number;

  constructor(options: ResearchContextOptions = {}) {
    this._now = options.now ?? (() => {
      return (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : (typeof Date !== 'undefined' && Date.now)
          ? Date.now()
          : 0;
    });
    this._sessionId = options.sessionId ?? `session-${this._now()}`;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  now(): number {
    return this._now();
  }
}
