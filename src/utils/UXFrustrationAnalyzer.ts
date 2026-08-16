/**
 * UX Frustration & Dissatisfaction Analyzer.
 *
 * Tracks user interaction cadence locally in real time to detect user friction,
 * frustration, and dissatisfaction patterns (e.g. frantic repeated clicking,
 * rapid window thrashing, air-clicking misses, repeated resets).
 *
 * Produces a ultra-compact, low-token summary digest so AI analysis models can
 * evaluate UX pain points without consuming context quota.
 */

export interface UXEvent {
  action: string;
  target?: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface FrictionPattern {
  type: 'REPEATED_ACTION' | 'RAPID_ABANDONMENT' | 'AIR_CLICK_MISS' | 'REPEATED_RESET' | 'ERROR_CORRELATION' | 'GESTURE_MISFIRE' | 'LONG_DWELL_HESITATION';
  description: string;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionKey: string;
  count: number;
  timespanMs: number;
}

export interface CompactUXDigest {
  durationSeconds: number;
  dissatisfactionScore: number; // 0.0 (happy) to 1.0 (frustrated)
  frictionLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectedPatterns: FrictionPattern[];
  compactTrail: string; // Token-compressed event sequence e.g. "M:toggle x3 -> AIR:miss x4 -> ERR:wasm"
  remedySuggestions: string[];
}

export class UXFrustrationAnalyzer {
  private events: UXEvent[] = [];
  private maxEvents: number = 60;
  private startTime: number = Date.now();

  recordUserAction(action: string, target?: string, meta?: Record<string, unknown>): void {
    const timestamp = Date.now();
    this.events.push({ action, target, timestamp, meta });
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  reset(): void {
    this.events = [];
    this.startTime = Date.now();
  }

  /**
   * Analyze the recorded interaction stream for friction patterns.
   */
  analyzeFriction(): FrictionPattern[] {
    const patterns: FrictionPattern[] = [];
    if (this.events.length < 2) return patterns;

    const now = Date.now();
    const recent = this.events.filter((e) => now - e.timestamp <= 15000); // Last 15 seconds

    // 1. Detect Repeated Action Rapid Clicking / Toggling (≥ 3 times in 4 seconds)
    const actionCounts: Map<string, UXEvent[]> = new Map();
    for (const ev of recent) {
      const key = `${ev.action}:${ev.target ?? 'global'}`;
      const list = actionCounts.get(key) ?? [];
      list.push(ev);
      actionCounts.set(key, list);
    }

    for (const [key, evList] of actionCounts.entries()) {
      if (evList.length >= 3) {
        const timespan = evList[evList.length - 1].timestamp - evList[0].timestamp;
        if (timespan <= 4000) {
          patterns.push({
            type: 'REPEATED_ACTION',
            description: `Repeated action '${key}' ${evList.length}x in ${(timespan / 1000).toFixed(1)}s (user expecting unfulfilled result)`,
            severity: evList.length >= 5 ? 'CRITICAL' : 'HIGH',
            actionKey: key,
            count: evList.length,
            timespanMs: timespan,
          });
        }
      }
    }

    // 2. Detect Rapid Window Abandonment / Thrashing (Open -> Close in < 1.2s)
    for (let i = 0; i < recent.length - 1; i++) {
      const curr = recent[i];
      const next = recent[i + 1];
      if (
        curr.action.includes('show') &&
        next.action.includes('hide') &&
        curr.target === next.target &&
        next.timestamp - curr.timestamp < 1200
      ) {
        patterns.push({
          type: 'RAPID_ABANDONMENT',
          description: `Rapid abandonment of panel '${curr.target}' after ${next.timestamp - curr.timestamp}ms`,
          severity: 'MEDIUM',
          actionKey: `panel:${curr.target}`,
          count: 1,
          timespanMs: next.timestamp - curr.timestamp,
        });
      }
    }

    // 3. Detect Air Clicking Misses (≥ 3 misses on empty space in 5 seconds)
    const misses = recent.filter((e) => e.action.includes('miss') || e.action.includes('air_click'));
    if (misses.length >= 3) {
      const timespan = misses[misses.length - 1].timestamp - misses[0].timestamp;
      patterns.push({
        type: 'AIR_CLICK_MISS',
        description: `Registered ${misses.length} clicks on empty space in ${(timespan / 1000).toFixed(1)}s (target selection difficulty)`,
        severity: misses.length >= 6 ? 'CRITICAL' : 'HIGH',
        actionKey: 'interaction:miss',
        count: misses.length,
        timespanMs: timespan,
      });
    }

    // 4. Detect Error Correlations
    const errors = recent.filter((e) => e.action.includes('error') || e.action.includes('panic'));
    if (errors.length > 0) {
      patterns.push({
        type: 'ERROR_CORRELATION',
        description: `${errors.length} system/runtime error(s) occurred during user interaction sequence`,
        severity: 'CRITICAL',
        actionKey: 'system:error',
        count: errors.length,
        timespanMs: 5000,
      });
    }

    // 5. Detect Gesture Misfires (gestures flagged as misfire or low confidence < 0.6)
    const gestureMisfires = recent.filter(
      (e) => e.action.includes('misfire') || (e.action.includes('gesture') && typeof e.meta?.confidence === 'number' && (e.meta.confidence as number) < 0.6)
    );
    if (gestureMisfires.length >= 2) {
      const timespan = gestureMisfires[gestureMisfires.length - 1].timestamp - gestureMisfires[0].timestamp;
      patterns.push({
        type: 'GESTURE_MISFIRE',
        description: `Registered ${gestureMisfires.length} gesture misfires/low-confidence detections in ${(timespan / 1000).toFixed(1)}s (gesture tuning needed)`,
        severity: gestureMisfires.length >= 4 ? 'HIGH' : 'MEDIUM',
        actionKey: 'gesture:misfire',
        count: gestureMisfires.length,
        timespanMs: timespan,
      });
    }

    // 6. Detect Long Dwell Hesitation (hovering > 3500ms without clicking)
    const longDwells = recent.filter(
      (e) => e.action.includes('dwell') && typeof e.meta?.durationMs === 'number' && (e.meta.durationMs as number) > 3500 && !e.meta?.wasClicked
    );
    if (longDwells.length >= 2) {
      patterns.push({
        type: 'LONG_DWELL_HESITATION',
        description: `Detected ${longDwells.length} long gaze/laser hesitations (>3.5s without selection, user evaluating UI labels)`,
        severity: 'MEDIUM',
        actionKey: 'interaction:dwell-hesitation',
        count: longDwells.length,
        timespanMs: 10000,
      });
    }

    return patterns;
  }

  /**
   * Compute a 0.0 - 1.0 dissatisfaction score based on detected friction patterns.
   */
  getDissatisfactionScore(): number {
    const patterns = this.analyzeFriction();
    let score = 0.0;
    for (const p of patterns) {
      if (p.severity === 'CRITICAL') score += 0.35;
      else if (p.severity === 'HIGH') score += 0.22;
      else if (p.severity === 'MEDIUM') score += 0.10;
    }
    return Math.min(1.0, score);
  }

  /**
   * Generate an ultra-compact low-token UX digest summary report.
   */
  getCompactDigest(): CompactUXDigest {
    const patterns = this.analyzeFriction();
    const score = this.getDissatisfactionScore();
    const durationSeconds = Math.round((Date.now() - this.startTime) / 1000);

    let frictionLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (score >= 0.7) frictionLevel = 'CRITICAL';
    else if (score >= 0.45) frictionLevel = 'HIGH';
    else if (score >= 0.25) frictionLevel = 'MEDIUM';

    // Compress event trail into token-efficient short strings
    const recent = this.events.slice(-12);
    const compactTrail = recent
      .map((e) => {
        const name = e.action
          .replace('menu:', 'M:')
          .replace('panel:', 'P:')
          .replace('gesture:', 'G:')
          .replace('operation:', 'OP:');
        return e.target ? `${name}(${e.target})` : name;
      })
      .join(' ➔ ');

    // Generate actionable remedies based on detected patterns
    const remedySuggestions: string[] = [];
    for (const p of patterns) {
      if (p.type === 'REPEATED_ACTION' && p.actionKey.includes('menu')) {
        remedySuggestions.push('Reposition menu closer to analyst torso & increase hit test radius');
      } else if (p.type === 'REPEATED_ACTION' && p.actionKey.includes('panel')) {
        remedySuggestions.push('Verify panel button click handlers and visual response state');
      } else if (p.type === 'AIR_CLICK_MISS') {
        remedySuggestions.push('Increase 3D object raycast collider bounding boxes for easier pointing');
      } else if (p.type === 'ERROR_CORRELATION') {
        remedySuggestions.push('Auto-trigger JS fallback for WASM runtime panics');
      }
    }

    if (remedySuggestions.length === 0) {
      remedySuggestions.push('System interactions performing smooth and responsive');
    }

    return {
      durationSeconds,
      dissatisfactionScore: Number(score.toFixed(2)),
      frictionLevel,
      detectedPatterns: patterns,
      compactTrail,
      remedySuggestions: Array.from(new Set(remedySuggestions)),
    };
  }

  /**
   * Format the compact digest into a concise 8-line token-efficient text block.
   */
  formatCompactReport(): string {
    const digest = this.getCompactDigest();
    const lines = [
      `=== COMPACT UX DISSATISFACTION REPORT ===`,
      `Duration: ${digest.durationSeconds}s | Score: ${digest.dissatisfactionScore} (${digest.frictionLevel})`,
      `Compact Trail: ${digest.compactTrail || 'No interactions recorded'}`,
    ];

    if (digest.detectedPatterns.length > 0) {
      lines.push(`Friction Points:`);
      for (const p of digest.detectedPatterns) {
        lines.push(`  - [${p.severity}] ${p.description}`);
      }
    } else {
      lines.push(`Friction Points: None (Smooth UX)`);
    }

    lines.push(`Suggested Remedies:`);
    for (const r of digest.remedySuggestions) {
      lines.push(`  * ${r}`);
    }
    lines.push(`=========================================`);

    return lines.join('\n');
  }
}
