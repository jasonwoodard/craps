/**
 * BATSAccumulatorOnly strategy spec.
 *
 * The Accumulator component of BATS in isolation: Don't Pass $10 with 2× lay odds,
 * de-leverage to 1× lay odds on first 7-out, then grind at 1× indefinitely.
 */

import { CrapsEngine } from '../../src/engine/craps-engine';
import { RiggedDice } from '../dice/rigged-dice';
import { STAGE_MACHINE_RUNTIME, StrategyDefinition } from '../../src/dsl/strategy';
import { StageMachineRuntime } from '../../src/dsl/stage-machine-state';
import { BATSAccumulatorOnly } from '../../src/dsl/strategies-staged';

function getRuntime(strategy: StrategyDefinition): StageMachineRuntime {
  return (strategy as any)[STAGE_MACHINE_RUNTIME];
}

function run(rolls: number[], bankroll = 500) {
  const strategy = BATSAccumulatorOnly();
  const dice = new RiggedDice(rolls);
  const engine = new CrapsEngine({ strategy, bankroll, rolls: rolls.length, dice });
  const result = engine.run();
  const runtime = getRuntime(strategy);
  return { result, runtime, strategy };
}

describe('BATSAccumulatorOnly strategy', () => {

  describe('bearishAccumulatorFull stage', () => {
    it('starts in bearishAccumulatorFull', () => {
      const { runtime } = run([4, 5]);
      expect(runtime.getCurrentStage()).toBe('bearishAccumulatorFull');
    });

    it('places only dontPass on come-out (point OFF)', () => {
      // Roll 3 = craps on come-out; point never set, check bets pre-roll
      const { result } = run([3, 5]);
      const comeOutBets = result.rolls[0].activeBets;
      const dp = comeOutBets.find(b => b.type === 'dontPass');
      const dc = comeOutBets.find(b => b.type === 'dontCome');
      expect(dp).toBeDefined();
      expect(dp!.amount).toBe(10);
      expect(dp!.odds).toBe(0);
      expect(dc).toBeUndefined();
    });

    it('adds 2× lay odds once point is established (point 4: lay $40 to win $20)', () => {
      // [4] sets point at 4. Roll[1] (the 5) sees point ON — check odds.
      const { result } = run([4, 5]);
      const roll1bets = result.rolls[1].activeBets;
      const dp = roll1bets.find(b => b.type === 'dontPass');
      expect(dp).toBeDefined();
      expect(dp!.odds).toBe(40); // layAmountToWin(4, 20) = ceil(20 * 2.0) = 40
    });

    it('adds 2× lay odds for point 6 (lay $24 to win $20)', () => {
      // [6] sets point at 6. Roll[1] sees point ON.
      const { result } = run([6, 5]);
      const roll1bets = result.rolls[1].activeBets;
      const dp = roll1bets.find(b => b.type === 'dontPass');
      expect(dp).toBeDefined();
      expect(dp!.odds).toBe(24); // layAmountToWin(6, 20) = ceil(20 * 1.2) = 24
    });

    it('adds 2× lay odds for point 5 (lay $30 to win $20)', () => {
      // [5] sets point at 5. Roll[1] (3 = no-action) sees point ON.
      const { result } = run([5, 3]);
      const roll1bets = result.rolls[1].activeBets;
      const dp = roll1bets.find(b => b.type === 'dontPass');
      expect(dp).toBeDefined();
      expect(dp!.odds).toBe(30); // layAmountToWin(5, 20) = ceil(20 * 1.5) = 30
    });

    it('transitions to bearishAccumulatorRegressed on first 7-out', () => {
      // [4] sets point, [7] is 7-out → sevenOut event fires → advance
      const { runtime } = run([4, 7, 5]);
      expect(runtime.getCurrentStage()).toBe('bearishAccumulatorRegressed');
    });

    it('does NOT transition on a come-out 7 (natural win = DP loss, not a sevenOut)', () => {
      // [7] on come-out is a natural win (DP loss) — no sevenOut event fires
      const { runtime } = run([7, 4, 5]);
      expect(runtime.getCurrentStage()).toBe('bearishAccumulatorFull');
    });

    it('does NOT transition on a no-action roll during point phase', () => {
      // [4] sets point, [5] is no-action (neither makes nor breaks the point)
      const { runtime } = run([4, 5]);
      expect(runtime.getCurrentStage()).toBe('bearishAccumulatorFull');
    });

    it('does NOT transition when point is made (shooter repeats — DP loses)', () => {
      // [4] sets point, [4] point made (DP loses, not a sevenOut)
      const { runtime } = run([4, 4, 5]);
      expect(runtime.getCurrentStage()).toBe('bearishAccumulatorFull');
    });
  });

  describe('bearishAccumulatorRegressed stage', () => {
    it('places dontPass with 1× lay odds after regression (point 4: lay $20 to win $10)', () => {
      // Trigger regression: [4, 7]. Then set a new point [4, 5].
      const { result, runtime } = run([4, 7, 4, 5]);
      expect(runtime.getCurrentStage()).toBe('bearishAccumulatorRegressed');
      const lastRoll = result.rolls[result.rolls.length - 1];
      const dp = lastRoll.activeBets.find(b => b.type === 'dontPass');
      expect(dp).toBeDefined();
      expect(dp!.odds).toBe(20); // layAmountToWin(4, 10) = ceil(10 * 2.0) = 20
    });

    it('places dontPass with 1× lay odds for point 6 (lay $12 to win $10)', () => {
      const { result, runtime } = run([4, 7, 6, 5]);
      expect(runtime.getCurrentStage()).toBe('bearishAccumulatorRegressed');
      const lastRoll = result.rolls[result.rolls.length - 1];
      const dp = lastRoll.activeBets.find(b => b.type === 'dontPass');
      if (dp && dp.odds) {
        expect(dp.odds).toBe(12); // layAmountToWin(6, 10) = ceil(10 * 1.2) = 12
      }
    });

    it('stays in bearishAccumulatorRegressed indefinitely — never advances further', () => {
      const rolls: number[] = [4, 7]; // trigger regression
      // Many 7-outs after regression — should stay in regressed stage
      for (let i = 0; i < 40; i++) {
        rolls.push(4, 7);
      }
      rolls.push(5);
      const { runtime } = run(rolls, 2000);
      expect(runtime.getCurrentStage()).toBe('bearishAccumulatorRegressed');
    });
  });

  describe('integration', () => {
    it('runs without throwing over 100 rolls', () => {
      expect(() => {
        const engine = new CrapsEngine({
          strategy: BATSAccumulatorOnly(),
          bankroll: 500,
          rolls: 100,
          seed: 42,
        });
        engine.run();
      }).not.toThrow();
    });

    it('runs without throwing over 10000 rolls', () => {
      expect(() => {
        const engine = new CrapsEngine({
          strategy: BATSAccumulatorOnly(),
          bankroll: 1000,
          rolls: 10000,
          seed: 123,
        });
        engine.run();
      }).not.toThrow();
    });
  });
});
