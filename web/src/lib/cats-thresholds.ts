import type { RollRecord } from '@shared/simulation';

// Profit thresholds for each CATS stage.
// stepUp: minimum session profit to advance to the next stage.
// stepDown: session profit below which the strategy retreats to the prior stage.
const CATS_STAGE_THRESHOLDS: Record<string, { stepUp?: number; stepDown?: number }> = {
  accumulatorFull: {},           // advances on first 6/8 hit — not profit-based
  accumulatorRegressed: { stepUp: 70 },
  littleMolly: { stepUp: 150, stepDown: 70 },
  threePtMollyTight: { stepUp: 200, stepDown: 150 },
  threePtMollyLoose: { stepDown: 150 },
};

const CATS_STAGE_NAMES = new Set(Object.keys(CATS_STAGE_THRESHOLDS));

export function isCATSStrategy(strategyName: string): boolean {
  return strategyName === 'CATS';
}

export interface ThresholdProximityPoint {
  rollNumber: number;
  // Distance below the step-up threshold (positive = still below, 0 = at threshold, negative = exceeded)
  stepUpDistance: number | null;
  // Cushion above the step-down threshold (positive = safe, negative = below threshold)
  stepDownCushion: number | null;
}

// For each roll, compute how far session profit is from the CATS advance/retreat thresholds.
// Returns null for thresholds that don't apply to the current stage.
export function computeThresholdProximity(
  rolls: RollRecord[],
  initialBankroll: number,
): ThresholdProximityPoint[] {
  return rolls.map(r => {
    const stageName = r.stageName;
    if (stageName == null || !CATS_STAGE_NAMES.has(stageName)) {
      return { rollNumber: r.rollNumber, stepUpDistance: null, stepDownCushion: null };
    }
    const thresholds = CATS_STAGE_THRESHOLDS[stageName];
    const profit = r.bankrollAfter - initialBankroll;
    return {
      rollNumber: r.rollNumber,
      stepUpDistance: thresholds.stepUp != null ? thresholds.stepUp - profit : null,
      stepDownCushion: thresholds.stepDown != null ? profit - thresholds.stepDown : null,
    };
  });
}
