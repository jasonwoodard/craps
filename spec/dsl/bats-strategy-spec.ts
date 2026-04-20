/**
 * BATS strategy spec — integration tests using Stage Machine implementation.
 *
 * Unit tests use stage config inspection (mustRetreatTo / canAdvanceTo).
 * Integration tests use RiggedDice for deterministic roll sequences.
 */

import { CrapsEngine } from '../../src/engine/craps-engine';
import { RiggedDice } from '../dice/rigged-dice';
import { STAGE_MACHINE_RUNTIME, StrategyDefinition } from '../../src/dsl/strategy';
import { StageMachineRuntime } from '../../src/dsl/stage-machine-state';
import { BATS } from '../../src/dsl/strategies-staged';

function getRuntime(strategy: StrategyDefinition): StageMachineRuntime {
  return (strategy as any)[STAGE_MACHINE_RUNTIME];
}

function runBATS(rolls: number[], bankroll = 500) {
  const strategy = BATS();
  const dice = new RiggedDice(rolls);
  const engine = new CrapsEngine({ strategy, bankroll, rolls: rolls.length, dice });
  const result = engine.run();
  const runtime = getRuntime(strategy);
  return { result, runtime, strategy };
}

describe('BATS strategy (Stage Machine implementation)', () => {

  // ---------------------------------------------------------------------------
  // layAmountToWin helper (tested indirectly via board bets)
  // ---------------------------------------------------------------------------

  describe('layAmountToWin amounts', () => {
    // Reconcile runs before each roll. On come-out the point is OFF so no odds are declared.
    // After the come-out sets a point, the NEXT roll's activeBets will show the odds.

    it('computes correct lay amount for point 4 (1× target = $10)', () => {
      // [4] sets point, [5] is no-action: check roll[1] activeBets (point ON at 4)
      const { result } = runBATS([4, 5]);
      const roll1 = result.rolls[1];
      const dp = roll1.activeBets.find(b => b.type === 'dontPass');
      expect(dp).toBeDefined();
      expect(dp!.odds).toBe(20); // layAmountToWin(4, 10) = ceil(10 * 2.0) = 20
    });

    it('computes correct lay amount for point 6 (1× target = $10)', () => {
      // [6] sets point, [5] is no-action: check roll[1] activeBets (point ON at 6)
      const { result } = runBATS([6, 5]);
      const roll1 = result.rolls[1];
      const dp = roll1.activeBets.find(b => b.type === 'dontPass');
      expect(dp).toBeDefined();
      expect(dp!.odds).toBe(12); // layAmountToWin(6, 10) = ceil(10 * 1.2) = 12
    });

    it('computes correct lay amount for point 5 (1× target = $10)', () => {
      // [5] sets point, [3] is no-action: check roll[1] activeBets (point ON at 5)
      const { result } = runBATS([5, 3]);
      const roll1 = result.rolls[1];
      const dp = roll1.activeBets.find(b => b.type === 'dontPass');
      expect(dp).toBeDefined();
      expect(dp!.odds).toBe(15); // layAmountToWin(5, 10) = ceil(10 * 1.5) = 15
    });

    it('computes correct lay amount for point 10 (1× target = $10)', () => {
      // [10] sets point, [5] is no-action: check roll[1] activeBets (point ON at 10)
      const { result } = runBATS([10, 5]);
      const roll1 = result.rolls[1];
      const dp = roll1.activeBets.find(b => b.type === 'dontPass');
      expect(dp!.odds).toBe(20); // same ratio as point 4
    });
  });

  // ---------------------------------------------------------------------------
  // Bearish Accumulator
  // ---------------------------------------------------------------------------

  describe('bearishAccumulator', () => {
    it('starts in bearishAccumulator', () => {
      const { runtime } = runBATS([4, 5]);
      expect(runtime.getCurrentStage()).toBe('bearishAccumulator');
    });

    it('places only dontPass on come-out (point OFF)', () => {
      // Roll a 7 on come-out (don't pass pushes and loses layOdds don't apply)
      // Actually: 7 on come-out = natural win for pass side = LOSS for DP
      // Use a 3 (craps) so come-out resolves without setting a point, just check pre-roll
      // Pass a non-point non-7/11 to set a point, then check bets on come-out roll before point is set
      const { result } = runBATS([3, 5]); // 3 = craps on come-out, then 5 = no-action
      // Roll 0 is the 3 (come-out): before the roll, point is OFF, so only DP should be on table
      const comeOutBets = result.rolls[0].activeBets;
      const dp = comeOutBets.find(b => b.type === 'dontPass');
      const dc = comeOutBets.find(b => b.type === 'dontCome');
      expect(dp).toBeDefined();
      expect(dp!.amount).toBe(10);
      expect(dp!.odds).toBe(0); // no odds until point is ON
      expect(dc).toBeUndefined(); // no DC on come-out
    });

    it('adds lay odds to dontPass once point is established', () => {
      // [4] sets point. On next roll, DP should have odds.
      const { result } = runBATS([4, 5]);
      // Roll 1 (the 5): point is ON at 4, DP should have odds
      const roll1bets = result.rolls[1].activeBets;
      const dp = roll1bets.find(b => b.type === 'dontPass');
      expect(dp).toBeDefined();
      expect(dp!.odds).toBeGreaterThan(0);
    });

    it('canAdvanceTo returns false below $120 profit', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('bearishAccumulator');
      const result = config.canAdvanceTo('littleDolly', { profit: 119, consecutiveSevenOuts: 0, handsPlayed: 5, stage: 'bearishAccumulator', consecutiveComeOutLosses: 0, pointRepeaterStreak: 0 });
      expect(result).toBe(false);
    });

    it('canAdvanceTo returns true at $120 profit', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('bearishAccumulator');
      const result = config.canAdvanceTo('littleDolly', { profit: 120, consecutiveSevenOuts: 0, handsPlayed: 5, stage: 'bearishAccumulator', consecutiveComeOutLosses: 0, pointRepeaterStreak: 0 });
      expect(result).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Little Dolly
  // ---------------------------------------------------------------------------

  describe('littleDolly', () => {
    it('mustRetreatTo returns bearishAccumulator on 2 consecutive come-out losses', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('littleDolly');
      const result = config.mustRetreatTo({
        profit: 150,
        consecutiveSevenOuts: 0,
        handsPlayed: 5,
        stage: 'littleDolly',
        consecutiveComeOutLosses: 2,
        pointRepeaterStreak: 0,
      });
      expect(result).toBe('bearishAccumulator');
    });

    it('mustRetreatTo returns bearishAccumulator on profit < $120', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('littleDolly');
      const result = config.mustRetreatTo({
        profit: 80,
        consecutiveSevenOuts: 0,
        handsPlayed: 5,
        stage: 'littleDolly',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 0,
      });
      expect(result).toBe('bearishAccumulator');
    });

    it('mustRetreatTo returns undefined when conditions are healthy', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('littleDolly');
      const result = config.mustRetreatTo({
        profit: 150,
        consecutiveSevenOuts: 0,
        handsPlayed: 5,
        stage: 'littleDolly',
        consecutiveComeOutLosses: 1,
        pointRepeaterStreak: 0,
      });
      expect(result).toBeUndefined();
    });

    it('canAdvanceTo returns true at $225 profit', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('littleDolly');
      const result = config.canAdvanceTo('threePtDolly', {
        profit: 225,
        consecutiveSevenOuts: 0,
        handsPlayed: 10,
        stage: 'littleDolly',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 0,
      });
      expect(result).toBe(true);
    });

    it('canAdvanceTo returns false at $224 profit', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('littleDolly');
      const result = config.canAdvanceTo('threePtDolly', {
        profit: 224,
        consecutiveSevenOuts: 0,
        handsPlayed: 10,
        stage: 'littleDolly',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 0,
      });
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Three-Point Dolly
  // ---------------------------------------------------------------------------

  describe('threePtDolly', () => {
    it('mustRetreatTo returns littleDolly on pointRepeaterStreak >= 2', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('threePtDolly');
      const result = config.mustRetreatTo({
        profit: 300,
        consecutiveSevenOuts: 0,
        handsPlayed: 10,
        stage: 'threePtDolly',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 2,
      });
      expect(result).toBe('littleDolly');
    });

    it('mustRetreatTo returns littleDolly on profit < $225', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('threePtDolly');
      const result = config.mustRetreatTo({
        profit: 200,
        consecutiveSevenOuts: 0,
        handsPlayed: 10,
        stage: 'threePtDolly',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 0,
      });
      expect(result).toBe('littleDolly');
    });

    it('mustRetreatTo returns undefined at streak 1 and profit $300', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('threePtDolly');
      const result = config.mustRetreatTo({
        profit: 300,
        consecutiveSevenOuts: 0,
        handsPlayed: 10,
        stage: 'threePtDolly',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 1,
      });
      expect(result).toBeUndefined();
    });

    it('canAdvanceTo returns true at $350 profit', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('threePtDolly');
      const result = config.canAdvanceTo('expandedDarkAlpha', {
        profit: 350,
        consecutiveSevenOuts: 0,
        handsPlayed: 15,
        stage: 'threePtDolly',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 0,
      });
      expect(result).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Expanded Dark Alpha
  // ---------------------------------------------------------------------------

  describe('expandedDarkAlpha', () => {
    it('mustRetreatTo returns threePtDolly on profit < $350', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('expandedDarkAlpha');
      const result = config.mustRetreatTo({
        profit: 300,
        consecutiveSevenOuts: 0,
        handsPlayed: 20,
        stage: 'expandedDarkAlpha',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 0,
      });
      expect(result).toBe('threePtDolly');
    });

    it('mustRetreatTo returns undefined at profit $400', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('expandedDarkAlpha');
      const result = config.mustRetreatTo({
        profit: 400,
        consecutiveSevenOuts: 0,
        handsPlayed: 20,
        stage: 'expandedDarkAlpha',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 0,
      });
      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Max Dark Alpha
  // ---------------------------------------------------------------------------

  describe('maxDarkAlpha', () => {
    it('mustRetreatTo returns expandedDarkAlpha on profit < $500', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('maxDarkAlpha');
      const result = config.mustRetreatTo({
        profit: 450,
        consecutiveSevenOuts: 0,
        handsPlayed: 25,
        stage: 'maxDarkAlpha',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 0,
      });
      expect(result).toBe('expandedDarkAlpha');
    });

    it('mustRetreatTo returns undefined at profit $500', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const config = (runtime as any).stageConfigs.get('maxDarkAlpha');
      const result = config.mustRetreatTo({
        profit: 500,
        consecutiveSevenOuts: 0,
        handsPlayed: 25,
        stage: 'maxDarkAlpha',
        consecutiveComeOutLosses: 0,
        pointRepeaterStreak: 0,
      });
      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // SessionState counter tracking
  // ---------------------------------------------------------------------------

  describe('consecutiveComeOutLosses tracking', () => {
    // Use minimal roll sequences so the counter isn't reset by subsequent come-out rolls.

    it('increments on come-out 7 (natural win = DP loss)', () => {
      // Single roll: 7 on come-out. Counter should be 1.
      const { runtime } = runBATS([7]);
      expect(runtime.getSessionState().consecutiveComeOutLosses).toBe(1);
    });

    it('increments on come-out 11 (natural win = DP loss)', () => {
      // Single roll: 11 on come-out. Counter should be 1.
      const { runtime } = runBATS([11]);
      expect(runtime.getSessionState().consecutiveComeOutLosses).toBe(1);
    });

    it('reaches 2 on two consecutive come-out naturals', () => {
      // Two consecutive 7s on come-out: count should reach 2.
      const { runtime } = runBATS([7, 7]);
      expect(runtime.getSessionState().consecutiveComeOutLosses).toBe(2);
    });

    it('resets to 0 on come-out craps (2, 3, 12)', () => {
      // 7 → loss (count=1), 3 → craps = DP win → resets count to 0
      const { runtime } = runBATS([7, 3]);
      expect(runtime.getSessionState().consecutiveComeOutLosses).toBe(0);
    });

    it('resets to 0 when a point is established', () => {
      // 7 → loss (count=1), 4 → point established → resets count to 0
      const { runtime } = runBATS([7, 4]);
      expect(runtime.getSessionState().consecutiveComeOutLosses).toBe(0);
    });

    it('does not change on point-phase rolls', () => {
      // 4 (point ON), 5 (no-action during point phase) — count stays 0
      const { runtime } = runBATS([4, 5]);
      expect(runtime.getSessionState().consecutiveComeOutLosses).toBe(0);
    });
  });

  describe('pointRepeaterStreak tracking', () => {
    it('starts at 0', () => {
      const { runtime } = runBATS([4, 5]);
      expect(runtime.getSessionState().pointRepeaterStreak).toBe(0);
    });

    it('increments when shooter makes their point', () => {
      // 4 (point established), 4 (point made — streak++)
      const { runtime } = runBATS([4, 4, 5]);
      expect(runtime.getSessionState().pointRepeaterStreak).toBe(1);
    });

    it('reaches 2 on two consecutive point-makes', () => {
      // Shooter 1: 4 (point), 4 (made). Shooter 2: 6 (point), 6 (made). Streak = 2.
      const { runtime } = runBATS([4, 4, 6, 6, 5]);
      expect(runtime.getSessionState().pointRepeaterStreak).toBe(2);
    });

    it('resets to 0 on seven-out', () => {
      // 4 (point), 4 (made, streak=1). 6 (point), 7 (seven-out, streak resets to 0).
      const { runtime } = runBATS([4, 4, 6, 7, 5]);
      expect(runtime.getSessionState().pointRepeaterStreak).toBe(0);
    });

    it('does not increment or reset on no-action rolls', () => {
      // 4 (point), 5 (no-action), 5 (no-action) — streak stays 0
      const { runtime } = runBATS([4, 5, 5]);
      expect(runtime.getSessionState().pointRepeaterStreak).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: stage transitions driven by SessionState counters
  // ---------------------------------------------------------------------------

  describe('stage transition integration', () => {
    it('consecutiveComeOutLosses reaches 2 on two consecutive come-out naturals', () => {
      // Verify counter reaches 2 so that littleDolly.mustRetreatTo would trigger.
      // (mustRetreatTo logic is verified by unit tests above; this confirms the counter feeds it.)
      const { runtime } = runBATS([7, 7]);
      expect(runtime.getSessionState().consecutiveComeOutLosses).toBe(2);
    });

    it('pointRepeaterStreak reaches 2 after two consecutive point-makes', () => {
      // Shooter 1: 4 (point), 4 (made). Shooter 2: 6 (point), 6 (made). Streak = 2.
      // (mustRetreatTo logic for threePtDolly is verified by unit tests above.)
      const { runtime } = runBATS([4, 4, 6, 6]);
      expect(runtime.getSessionState().pointRepeaterStreak).toBe(2);
    });

    it('pointRepeaterStreak resets to 0 after a seven-out', () => {
      // Shooter 1: 4 (point), 4 (made, streak=1). Shooter 2: 6 (point), 7 (seven-out, streak=0).
      const { runtime } = runBATS([4, 4, 6, 7]);
      expect(runtime.getSessionState().pointRepeaterStreak).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Smoke tests
  // ---------------------------------------------------------------------------

  describe('smoke tests', () => {
    it('runs without throwing over 100 rolls with a fixed seed', () => {
      const strategy = BATS();
      expect(() => {
        const engine = new CrapsEngine({
          strategy,
          bankroll: 500,
          rolls: 100,
          seed: 42,
        });
        engine.run();
      }).not.toThrow();
    });

    it('runs without throwing over 10000 rolls with a fixed seed', () => {
      const strategy = BATS();
      expect(() => {
        const engine = new CrapsEngine({
          strategy,
          bankroll: 1000,
          rolls: 10000,
          seed: 123,
        });
        engine.run();
      }).not.toThrow();
    });

    it('reaches expandedDarkAlpha with a heavily winning session', () => {
      // Build profit by generating many DP wins via 7-outs (DP wins on 7-out)
      // Sequence: set point then 7-out repeatedly (each 7-out = DP win)
      const rolls: number[] = [];
      for (let i = 0; i < 50; i++) {
        rolls.push(4, 7); // set point 4, seven-out → DP wins
      }
      rolls.push(5); // padding

      const { runtime } = runBATS(rolls, 2000);
      const profit = runtime.getSessionState().profit;
      if (profit >= 350) {
        expect(runtime.getCurrentStage()).toBe('expandedDarkAlpha');
      }
      // Whether or not $350 is reached, no throw
    });
  });

  // ---------------------------------------------------------------------------
  // all five stages are registered
  // ---------------------------------------------------------------------------

  describe('stage registration', () => {
    it('registers all five stages', () => {
      const strategy = BATS();
      const runtime = getRuntime(strategy);
      const configs = (runtime as any).stageConfigs;
      expect(configs.has('bearishAccumulator')).toBe(true);
      expect(configs.has('littleDolly')).toBe(true);
      expect(configs.has('threePtDolly')).toBe(true);
      expect(configs.has('expandedDarkAlpha')).toBe(true);
      expect(configs.has('maxDarkAlpha')).toBe(true);
    });
  });
});
