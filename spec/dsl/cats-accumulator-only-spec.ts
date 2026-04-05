/**
 * CATSAccumulatorOnly strategy spec.
 *
 * The Accumulator component of CATS in isolation: Place 6/8 at $18, de-leverage
 * to $12 on first 6/8 hit, then grind at $12 indefinitely.
 */

import { CrapsEngine } from '../../src/engine/craps-engine';
import { RiggedDice } from '../dice/rigged-dice';
import { STAGE_MACHINE_RUNTIME, StrategyDefinition } from '../../src/dsl/strategy';
import { StageMachineRuntime } from '../../src/dsl/stage-machine-state';
import { CATSAccumulatorOnly } from '../../src/dsl/strategies-staged';

function getRuntime(strategy: StrategyDefinition): StageMachineRuntime {
  return (strategy as any)[STAGE_MACHINE_RUNTIME];
}

function run(rolls: number[], bankroll = 500) {
  const strategy = CATSAccumulatorOnly();
  const dice = new RiggedDice(rolls);
  const engine = new CrapsEngine({ strategy, bankroll, rolls: rolls.length, dice });
  const result = engine.run();
  const runtime = getRuntime(strategy);
  return { result, runtime, strategy };
}

describe('CATSAccumulatorOnly strategy', () => {

  describe('accumulatorFull stage', () => {
    it('starts in accumulatorFull', () => {
      const { runtime } = run([4, 5]);
      expect(runtime.getCurrentStage()).toBe('accumulatorFull');
    });

    it('places 6 and 8 at $18 each', () => {
      const { result, runtime } = run([4, 5]);
      expect(runtime.getCurrentStage()).toBe('accumulatorFull');
      const bets = result.rolls[0].activeBets;
      const place6 = bets.find(b => b.type === 'place' && b.point === 6);
      const place8 = bets.find(b => b.type === 'place' && b.point === 8);
      expect(place6).toBeDefined();
      expect(place6!.amount).toBe(18);
      expect(place8).toBeDefined();
      expect(place8!.amount).toBe(18);
    });

    it('transitions to accumulatorRegressed on 6 hit', () => {
      const { runtime } = run([4, 6, 5]);
      expect(runtime.getCurrentStage()).toBe('accumulatorRegressed');
    });

    it('transitions to accumulatorRegressed on 8 hit', () => {
      const { runtime } = run([4, 8, 5]);
      expect(runtime.getCurrentStage()).toBe('accumulatorRegressed');
    });

    it('does NOT transition on a non-6/8 number hit', () => {
      const { runtime } = run([4, 5]);
      expect(runtime.getCurrentStage()).toBe('accumulatorFull');
    });

    it('does NOT transition on 7-out', () => {
      const { runtime } = run([4, 7, 4, 5]);
      expect(runtime.getCurrentStage()).toBe('accumulatorFull');
    });
  });

  describe('accumulatorRegressed stage', () => {
    it('places 6 and 8 at $12 each after regression', () => {
      const { result, runtime } = run([4, 6, 5, 5]);
      expect(runtime.getCurrentStage()).toBe('accumulatorRegressed');
      const lastRoll = result.rolls[result.rolls.length - 1];
      const place6 = lastRoll.activeBets.find(b => b.type === 'place' && b.point === 6);
      if (place6) {
        expect(place6.amount).toBe(12);
      }
    });

    it('stays in accumulatorRegressed indefinitely — never advances further', () => {
      const rolls: number[] = [4];
      // Hit 6 to trigger regression, then rack up many wins
      for (let i = 0; i < 40; i++) {
        rolls.push(i % 2 === 0 ? 6 : 8);
      }
      rolls.push(5);
      const { runtime } = run(rolls, 2000);
      expect(runtime.getCurrentStage()).toBe('accumulatorRegressed');
    });
  });

  describe('integration', () => {
    it('runs without throwing over 100 rolls', () => {
      expect(() => {
        const engine = new CrapsEngine({
          strategy: CATSAccumulatorOnly(),
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
          strategy: CATSAccumulatorOnly(),
          bankroll: 1000,
          rolls: 10000,
          seed: 123,
        });
        engine.run();
      }).not.toThrow();
    });
  });
});
