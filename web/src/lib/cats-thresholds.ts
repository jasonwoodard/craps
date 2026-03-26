import type { RollRecord } from '@shared/simulation';

// stepUp: session profit required to advance. stepDown: session profit below which we retreat.
const CATS_STAGE_THRESHOLDS: Record<string, { stepUp?: number; stepDown?: number }> = {
  accumulatorFull: {},           // advances on first 6/8 hit — not profit-based
  accumulatorRegressed: { stepUp: 70 },
  littleMolly: { stepUp: 150, stepDown: 70 },
  threePtMollyTight: { stepUp: 200, stepDown: 150 },
  threePtMollyLoose: { stepDown: 150 },
};

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

export function computeThresholdProximity(
  rolls: RollRecord[],
  initialBankroll: number,
): ThresholdProximityPoint[] {
  return rolls.map(r => {
    const stageName = r.stageName;
    if (stageName == null || !(stageName in CATS_STAGE_THRESHOLDS)) {
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
