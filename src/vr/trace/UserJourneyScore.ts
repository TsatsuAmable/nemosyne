/**
 * UX-Cost Composite ("User Journey Score") Analyzer.
 *
 * Models holistic user burden across the complete analytic inquiry cycle:
 * UX Cost = LearningCost + NavigationCost + InteractionCost + InterpretationCost + EvidenceCost.
 *
 * Treats the score as an investigative diagnostic (identifying which phase introduces friction),
 * not a vanity number.
 */

export interface UserJourneyCostBreakdown {
  learningCostMs: number;
  navigationCostMs: number;
  interactionCostMs: number;
  interpretationCostMs: number;
  evidenceCostMs: number;
}

export interface UserJourneyScoreReport {
  totalCostMs: number;
  breakdown: UserJourneyCostBreakdown;
  dominantCostPhase: keyof UserJourneyCostBreakdown;
  percentageByPhase: Record<keyof UserJourneyCostBreakdown, number>;
  efficiencyIndex: number; // Ratio of core analysis/evidence time to total overhead
}

export class UserJourneyScoreCalculator {
  calculate(breakdown: UserJourneyCostBreakdown): UserJourneyScoreReport {
    const totalCostMs =
      breakdown.learningCostMs +
      breakdown.navigationCostMs +
      breakdown.interactionCostMs +
      breakdown.interpretationCostMs +
      breakdown.evidenceCostMs;

    const safeTotal = totalCostMs > 0 ? totalCostMs : 1;

    const percentageByPhase: Record<keyof UserJourneyCostBreakdown, number> = {
      learningCostMs: (breakdown.learningCostMs / safeTotal) * 100,
      navigationCostMs: (breakdown.navigationCostMs / safeTotal) * 100,
      interactionCostMs: (breakdown.interactionCostMs / safeTotal) * 100,
      interpretationCostMs: (breakdown.interpretationCostMs / safeTotal) * 100,
      evidenceCostMs: (breakdown.evidenceCostMs / safeTotal) * 100,
    };

    let dominantPhase: keyof UserJourneyCostBreakdown = 'learningCostMs';
    let maxCost = -1;

    for (const [phase, cost] of Object.entries(breakdown) as [keyof UserJourneyCostBreakdown, number][]) {
      if (cost > maxCost) {
        maxCost = cost;
        dominantPhase = phase;
      }
    }

    // Core productive time = interpretation + evidence
    // Overhead = learning + navigation + interaction (mechanical friction)
    const productiveTime = breakdown.interpretationCostMs + breakdown.evidenceCostMs;
    const overheadTime = breakdown.learningCostMs + breakdown.navigationCostMs + breakdown.interactionCostMs;
    const efficiencyIndex = overheadTime > 0 ? productiveTime / overheadTime : productiveTime > 0 ? 1.0 : 0.0;

    return {
      totalCostMs,
      breakdown,
      dominantCostPhase: dominantPhase,
      percentageByPhase,
      efficiencyIndex,
    };
  }
}
