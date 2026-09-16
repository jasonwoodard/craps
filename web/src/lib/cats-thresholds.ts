import type { RollRecord } from '@shared/simulation';
import { catsUnits } from '@engine/dsl/units';

/**
 * CATS step-up / step-down proximity, in the same accounting the engine uses.
 *
 * Every dollar figure here comes from `src/dsl/units.ts` — the web build
 * imports the engine's unit system directly rather than restating the ladder
 * (webui-plan.md cross-phase guardrail: units.ts is the only origin of dollar
 * amounts in web/). What remains local is the *shape* of the ladder: which
 * gate a stage advances on and which it retreats below.
 *
 * FLAGGED (design note, not implemented here): the stage machine keeps its
 * transition thresholds inside `canAdvanceTo` / `mustRetreatTo` closures, so
 * they are not part of the exported stage metadata. The Tight -> Loose shift
 * in particular fires at the 20u mode-shift cushion rather than at the next
 * stage's entry gate, so it cannot be inferred from gates alone. Exporting
 * per-stage transition thresholds as metadata would let this map disappear
 * entirely; that is an engine change and belongs in a design note.
 */
export interface StageThresholds {
  /** Session profit at or above which the stage advances. */
  stepUp?: number;
  /** Session profit below which the stage retreats. */
  stepDown?: number;
}

export function catsStageThresholds(tableMin: number): Record<string, StageThresholds> {
  const U = catsUnits(tableMin);
  return {
    // Advances on the first 6/8 hit — not profit-based.
    accumulatorFull: {},
    accumulatorRegressed: { stepUp: U.gates.littleMolly },
    littleMolly:          { stepUp: U.gates.threePtMolly,  stepDown: U.gates.littleMolly },
    // Tight -> Loose is a mode shift on the 20u cushion, not a stage advance.
    threePtMollyTight:    { stepUp: U.modeShiftCushion,    stepDown: U.gates.threePtMolly },
    threePtMollyLoose:    { stepUp: U.gates.expandedAlpha, stepDown: U.gates.threePtMolly },
    expandedAlpha:        { stepUp: U.gates.maxAlpha,      stepDown: U.gates.expandedAlpha },
    maxAlpha:             {                                stepDown: U.gates.maxAlpha },
  };
}

export function isCATSStrategy(strategyName: string): boolean {
  return strategyName.split('@')[0] === 'CATS';
}

export interface ThresholdProximityPoint {
  rollNumber: number;
  // Distance below the step-up threshold (positive = still below, 0 = at threshold, negative = exceeded)
  stepUpDistance: number | null;
  // Cushion above the step-down threshold (positive = safe, negative = below threshold)
  stepDownCushion: number | null;
}

export interface ProximityOptions {
  /** Table minimum the run used; gates scale with it. */
  tableMin?: number;
  /**
   * Profit's zero point (session-lifecycle.md v4 §2: origin = B − gate(entry)).
   * Defaults to the buy-in, which is classic entry.
   */
  origin?: number;
}

/**
 * Per-roll distance to the current stage's transition gates.
 *
 * Profit follows cats-strategy.md §3.7: (rack + working bets at face value)
 * − origin. Rack-only accounting differs from this by a full stage gate once
 * a Molly board is up, which would put every threshold reading a stage off.
 */
export function computeThresholdProximity(
  rolls: RollRecord[],
  initialBankroll: number,
  options: ProximityOptions = {},
): ThresholdProximityPoint[] {
  const thresholdsByStage = catsStageThresholds(options.tableMin ?? 10);
  const origin = options.origin ?? initialBankroll;

  return rolls.map(r => {
    const stageName = r.stageName;
    if (stageName == null || !(stageName in thresholdsByStage)) {
      return { rollNumber: r.rollNumber, stepUpDistance: null, stepDownCushion: null };
    }
    const thresholds = thresholdsByStage[stageName];
    const profit = r.bankrollAfter + r.tableLoadAfter - origin;
    return {
      rollNumber: r.rollNumber,
      stepUpDistance: thresholds.stepUp != null ? thresholds.stepUp - profit : null,
      stepDownCushion: thresholds.stepDown != null ? profit - thresholds.stepDown : null,
    };
  });
}
