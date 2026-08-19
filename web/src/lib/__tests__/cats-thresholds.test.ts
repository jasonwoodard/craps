import { describe, it, expect } from 'vitest';
import { catsUnits } from '@engine/dsl/units';
import { catsStageThresholds, computeThresholdProximity, isCATSStrategy } from '../cats-thresholds';
import type { RollRecord } from '@shared/simulation';

describe('CATS stage thresholds', () => {
  it('derives every gate from the engine unit system, at any table minimum', () => {
    for (const tableMin of [10, 15, 25]) {
      const U = catsUnits(tableMin);
      const t = catsStageThresholds(tableMin);

      expect(t.accumulatorRegressed.stepUp).toBe(U.gates.littleMolly);
      expect(t.littleMolly).toEqual({ stepUp: U.gates.threePtMolly, stepDown: U.gates.littleMolly });
      expect(t.threePtMollyTight).toEqual({ stepUp: U.modeShiftCushion, stepDown: U.gates.threePtMolly });
      expect(t.threePtMollyLoose).toEqual({ stepUp: U.gates.expandedAlpha, stepDown: U.gates.threePtMolly });
      expect(t.expandedAlpha).toEqual({ stepUp: U.gates.maxAlpha, stepDown: U.gates.expandedAlpha });
      expect(t.maxAlpha).toEqual({ stepDown: U.gates.maxAlpha });
    }
  });

  it('reproduces the strategy doc ladder at $10 and $15', () => {
    const ten = catsStageThresholds(10);
    expect([ten.accumulatorRegressed.stepUp, ten.littleMolly.stepUp, ten.threePtMollyLoose.stepUp, ten.maxAlpha.stepDown])
      .toEqual([70, 150, 250, 400]);

    const fifteen = catsStageThresholds(15);
    expect([fifteen.accumulatorRegressed.stepUp, fifteen.littleMolly.stepUp, fifteen.threePtMollyLoose.stepUp, fifteen.maxAlpha.stepDown])
      .toEqual([105, 225, 375, 600]);
  });

  it('recognises CATS through a canonical spec string', () => {
    expect(isCATSStrategy('CATS')).toBe(true);
    expect(isCATSStrategy('CATS@entry=threePtMollyLoose,tableMin=15')).toBe(true);
    expect(isCATSStrategy('CATSAccumulatorOnly')).toBe(false);
    expect(isCATSStrategy('PassLineOnly')).toBe(false);
  });
});

function roll(over: Partial<RollRecord>): RollRecord {
  return {
    rollNumber: 1, die1: 3, die2: 4, rollValue: 7,
    pointBefore: undefined, pointAfter: undefined, outcomes: [],
    bankrollBefore: 300, bankrollAfter: 300,
    activeBets: [], tableLoadBefore: 0, tableLoadAfter: 0,
    ...over,
  };
}

describe('computeThresholdProximity', () => {
  it('counts working bets at face value (cats-strategy.md §3.7)', () => {
    const rolls = [roll({ stageName: 'littleMolly', bankrollAfter: 240, tableLoadAfter: 60 })];
    // Rack $240 + $60 on the felt = $300 equity = +$0 profit against a $300 buy-in.
    const [point] = computeThresholdProximity(rolls, 300);
    expect(point.stepUpDistance).toBe(150);   // 150 - 0
    expect(point.stepDownCushion).toBe(-70);  // 0 - 70
  });

  it('measures profit from the funded-entry origin, not the buy-in', () => {
    // CATS@entry=threePtMollyLoose at B=$300: origin = 300 - 250 = 50.
    const rolls = [roll({ stageName: 'threePtMollyLoose', bankrollAfter: 300, tableLoadAfter: 0 })];
    const [point] = computeThresholdProximity(rolls, 300, { origin: 50 });
    expect(point.stepUpDistance).toBe(0);     // profit +250, gate 250
    expect(point.stepDownCushion).toBe(100);  // 250 - 150
  });

  it('scales with the table minimum', () => {
    const rolls = [roll({ stageName: 'littleMolly', bankrollAfter: 450, tableLoadAfter: 0 })];
    const [point] = computeThresholdProximity(rolls, 450, { tableMin: 15 });
    expect(point.stepUpDistance).toBe(225);
    expect(point.stepDownCushion).toBe(-105);
  });

  it('reports nothing for rolls outside the CATS ladder', () => {
    const [point] = computeThresholdProximity([roll({ stageName: undefined })], 300);
    expect(point.stepUpDistance).toBeNull();
    expect(point.stepDownCushion).toBeNull();
  });
});
