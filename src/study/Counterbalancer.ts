/**
 * Counterbalancer for Nemosyne controlled experiments.
 *
 * Implements balanced Latin Square generation and deterministic participant assignment
 * to prevent order effects and carry-over bias in within-subject / crossover designs.
 */

import type { StudyCondition, ParticipantAssignment } from './types.ts';

export class Counterbalancer {
  private _conditions: StudyCondition[];
  private _sequences: StudyCondition[][];

  constructor(conditions: StudyCondition[] = ['2d_control', 'vr_experimental']) {
    this._conditions = [...conditions];
    this._sequences = this._generateLatinSquare(this._conditions);
  }

  get sequences(): StudyCondition[][] {
    return this._sequences.map((seq) => [...seq]);
  }

  /**
   * Generates a balanced Latin Square sequence matrix for the given condition set.
   * For even N, produces an N x N Williams square.
   * For odd N, produces a 2N x N balanced square to balance first-order carryover.
   */
  private _generateLatinSquare(conditions: StudyCondition[]): StudyCondition[][] {
    const n = conditions.length;
    if (n === 0) return [];
    if (n === 1) return [[conditions[0]]];
    if (n === 2) {
      return [
        [conditions[0], conditions[1]],
        [conditions[1], conditions[0]],
      ];
    }

    const latinSquare: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        let val: number;
        if (j % 2 === 0) {
          val = (i + Math.floor(j / 2)) % n;
        } else {
          val = (i + n - Math.floor((j + 1) / 2)) % n;
        }
        row.push(val);
      }
      latinSquare.push(row);
    }

    // If N is odd, double the square by reversing rows to balance carryover
    if (n % 2 !== 0) {
      const reversedSquare = latinSquare.map((row) => [...row].reverse());
      latinSquare.push(...reversedSquare);
    }

    return latinSquare.map((indices) => indices.map((idx) => conditions[idx]));
  }

  /**
   * Deterministically assigns a participant to a counterbalanced condition sequence.
   * If participantId ends with digits, parses numeric index; otherwise hashes string.
   */
  assignParticipant(participantId: string): ParticipantAssignment {
    const numericMatch = participantId.match(/\d+$/);
    let index: number;

    if (numericMatch) {
      index = (parseInt(numericMatch[0], 10) - 1) % this._sequences.length;
      if (index < 0) index = 0;
    } else {
      let hash = 0;
      for (let i = 0; i < participantId.length; i++) {
        hash = (hash << 5) - hash + participantId.charCodeAt(i);
        hash |= 0;
      }
      index = Math.abs(hash) % this._sequences.length;
    }

    const order = [...this._sequences[index]];
    const cohort = `Cohort-${String.fromCharCode(65 + index)}`;

    return {
      participantId,
      order,
      cohort,
      assignedAt: Date.now(),
    };
  }
}
