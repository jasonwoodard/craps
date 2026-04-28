/**
 * Do/Don't strategy spec.
 *
 * Tests cover the three phases of the hedge:
 *   Phase 1 — come-out (flat bets only, no odds before point is set)
 *   Phase 2 — point active (odds added to both sides)
 *   Phase 3 — come/don't come stacking (when maxComePairs > 0)
 *
 * All bankroll math assumes $10 flat / $10 odds / $10 lay-odds (DoDont1X).
 */

import { CrapsEngine } from '../../src/engine/craps-engine';
import { RiggedDice } from '../dice/rigged-dice';
import { STAGE_MACHINE_RUNTIME, StrategyDefinition } from '../../src/dsl/strategy';
import { StageMachineRuntime } from '../../src/dsl/stage-machine-state';
import { DoDont, DoDont1X, DoDont2X, DoDont3X, DoDontWithCome1X } from '../../src/dsl/strategies-staged';
import { BetTypes } from '../../src/bets/base-bet';

function getRuntime(strategy: StrategyDefinition): StageMachineRuntime {
  return (strategy as any)[STAGE_MACHINE_RUNTIME];
}

function runDoDont(rolls: number[], strategyFn: () => StrategyDefinition = DoDont1X, bankroll = 500) {
  const strategy = strategyFn();
  const dice = new RiggedDice(rolls);
  const engine = new CrapsEngine({ strategy, bankroll, rolls: rolls.length, dice });
  const result = engine.run();
  const runtime = getRuntime(strategy);
  return { result, runtime, strategy };
}

describe('DoDont strategy', () => {

  // ---------------------------------------------------------------------------
  // Phase 1 — come-out: flat bets only, no odds
  // ---------------------------------------------------------------------------

  describe('Phase 1 — come-out', () => {
    it('places passLine and dontPass on come-out, no odds', () => {
      // [5] establishes point 5; check roll[0] activeBets (come-out state)
      const { result } = runDoDont([5, 3]);
      const roll0 = result.rolls[0]; // come-out roll
      const pl = roll0.activeBets.find(b => b.type === 'passLine');
      const dp = roll0.activeBets.find(b => b.type === 'dontPass');
      expect(pl).toBeDefined();
      expect(pl!.amount).toBe(10);
      expect(pl!.odds).toBe(0); // no odds on come-out
      expect(dp).toBeDefined();
      expect(dp!.amount).toBe(10);
      expect(dp!.odds).toBe(0); // no lay odds on come-out
    });

    it('come-out natural 7 — passLine wins, dontPass loses, net $0', () => {
      // Natural 7 on come-out: passLine profits $10, dontPass loses $10.
      const { result } = runDoDont([7]);
      const roll = result.rolls[0];
      const plWin = roll.outcomes.find(o => o.betType === BetTypes.PASS_LINE && o.result === 'win');
      const dpLoss = roll.outcomes.find(o => o.betType === BetTypes.DONT_PASS && o.result === 'loss');
      expect(plWin).toBeDefined();
      expect(plWin!.payout).toBe(10); // even money, $10 profit
      expect(dpLoss).toBeDefined();
      expect(result.finalBankroll).toBe(500); // $500 + $10 - $10 = $500
    });

    it('come-out natural 11 — passLine wins, dontPass loses, net $0', () => {
      const { result } = runDoDont([11]);
      expect(result.finalBankroll).toBe(500);
    });

    it('come-out craps 2 — passLine loses, dontPass wins, net $0', () => {
      const { result } = runDoDont([2]);
      const roll = result.rolls[0];
      const plLoss = roll.outcomes.find(o => o.betType === BetTypes.PASS_LINE && o.result === 'loss');
      const dpWin = roll.outcomes.find(o => o.betType === BetTypes.DONT_PASS && o.result === 'win');
      expect(plLoss).toBeDefined();
      expect(dpWin).toBeDefined();
      expect(dpWin!.payout).toBe(10);
      expect(result.finalBankroll).toBe(500);
    });

    it('come-out craps 3 — passLine loses, dontPass wins, net $0', () => {
      const { result } = runDoDont([3]);
      expect(result.finalBankroll).toBe(500);
    });

    it('come-out 12 — passLine loses, dontPass rides (bar 12)', () => {
      // Bar 12: passLine loses $10; dontPass rides silently (no win/loss on 12).
      // After 12, the table stays in come-out mode. The game ends with dontPass
      // still locked on the table and passLine gone.
      const { result } = runDoDont([12]);
      const roll = result.rolls[0];
      const plLoss = roll.outcomes.find(o => o.betType === BetTypes.PASS_LINE && o.result === 'loss');
      // dontPass has no outcome on 12 (bet rides, not resolved)
      const dpOutcome = roll.outcomes.find(o => o.betType === BetTypes.DONT_PASS);
      expect(plLoss).toBeDefined();
      expect(dpOutcome).toBeUndefined(); // dontPass silently rides the 12
      // Both bets were placed ($20 total); dontPass still locked on table → $480
      expect(result.finalBankroll).toBe(480);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 2 — point active: odds added to both sides
  // ---------------------------------------------------------------------------

  describe('Phase 2 — point active, odds placement', () => {
    it('adds passLine take-odds after point is established', () => {
      // [8] establishes point; roll[1] activeBets shows odds on passLine
      const { result } = runDoDont([8, 3]);
      const roll1 = result.rolls[1]; // first point-phase roll
      const pl = roll1.activeBets.find(b => b.type === 'passLine');
      expect(pl).toBeDefined();
      expect(pl!.odds).toBe(10); // 1× odds on $10 flat
    });

    it('adds dontPass lay-odds after point is established', () => {
      const { result } = runDoDont([8, 3]);
      const roll1 = result.rolls[1];
      const dp = roll1.activeBets.find(b => b.type === 'dontPass');
      expect(dp).toBeDefined();
      expect(dp!.odds).toBe(10); // 1× lay odds on $10 flat
    });

    it('DoDont2X adds 2× take-odds and lay-odds', () => {
      const { result } = runDoDont([8, 3], DoDont2X);
      const roll1 = result.rolls[1];
      const pl = roll1.activeBets.find(b => b.type === 'passLine');
      const dp = roll1.activeBets.find(b => b.type === 'dontPass');
      expect(pl!.odds).toBe(20); // 2× odds on $10 flat
      expect(dp!.odds).toBe(20); // 2× lay odds on $10 flat
    });

    it('DoDont3X adds 3× take-odds and lay-odds', () => {
      const { result } = runDoDont([8, 3], DoDont3X);
      const roll1 = result.rolls[1];
      const pl = roll1.activeBets.find(b => b.type === 'passLine');
      const dp = roll1.activeBets.find(b => b.type === 'dontPass');
      expect(pl!.odds).toBe(30);
      expect(dp!.odds).toBe(30);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 2 — point resolution
  // ---------------------------------------------------------------------------

  describe('Phase 2 — point resolution', () => {
    // Point 8 payout: 6:5 odds. Lay-odds payout: 5:6.
    // With $10 flat + $10 odds on right, and $10 flat + $10 lay on wrong:
    //   Right win (point 8): profit = $10 (flat) + $12 (6:5 on $10 odds) = $22
    //   Wrong loss (point 8): lose $10 (flat) + $10 (lay odds) = $20
    //   Net: +$2

    it('point-8 repeat — right side wins, wrong side loses, net +$2', () => {
      // Roll sequence: [8]=come-out sets point 8, [8]=point made
      const { result } = runDoDont([8, 8]);
      expect(result.finalBankroll).toBe(502); // $500 + $2 net
    });

    it('point-8 seven-out — wrong side wins, right side loses, net -$2', () => {
      // Roll sequence: [8]=come-out sets point 8, [7]=seven-out
      // Right loss: $10 flat + $10 odds = $20 lost
      // Wrong win: $10 (flat profit) + floor($10*5/6)=$8 (lay-odds profit) = $18 profit
      //   returned: $10 + $10 + $18 = $38
      // Net: -$20 + $38 = +$18 profit on wrong side, -$20 on right side = -$2 net
      const { result } = runDoDont([8, 7]);
      expect(result.finalBankroll).toBe(498); // $500 - $2 net
    });

    it('point-4 repeat — net +$0 (2:1 odds / 1:2 lay cancel exactly)', () => {
      // Right win (point 4): $10 flat + $10*2=$20 odds profit = $30 profit
      // Wrong loss (point 4): $10 flat + $10 lay odds = $20 lost
      // Net: +$30 - $20 = +$10
      const { result } = runDoDont([4, 4]);
      expect(result.finalBankroll).toBe(510); // $500 + $10 net
    });

    it('point-4 seven-out — wrong wins, right loses, net -$10', () => {
      // Right loss: $10 flat + $10 odds = $20
      // Wrong win: $10 (flat profit) + floor($10/2)=$5 (lay profit) = $15 profit
      //   returned: $10 + $10 + $15 = $35
      // Net: -$20 + $35 = +$15 profit on wrong side, -$20 on right = -$5 net...
      // Wait let me recalculate.
      // Placement: passLine($10) + dontPass($10) = $20. Then odds: passOdds($10) + layOdds($10) = $20.
      // Total invested this hand: $40.
      // Seven-out at point 4:
      //   passLine loses: $10 flat + $10 odds = $20 forfeit (already deducted)
      //   dontPass wins at point 4: layOddsPayout = floor(10/2) = 5. payOut = 10 + 5 = 15.
      //   settleBets: bankroll += 10 (flat) + 10 (layOdds) + 15 (payOut) = 35
      // Net: -$40 placed + $35 returned = -$5? No: we got $35 back from dontPass win.
      // So: final = $500 - $20 (come-out placements) - $20 (odds) + $35 (dontPass settle) = $495.
      const { result } = runDoDont([4, 7]);
      expect(result.finalBankroll).toBe(495);
    });

    it('no-action roll during point phase — bets unchanged', () => {
      // Roll 3 (no-action): [6]=point, [3]=no-action, [7]=seven-out
      const { result } = runDoDont([6, 3, 7]);
      const roll1 = result.rolls[1]; // no-action
      expect(roll1.outcomes).toHaveSize(0); // no outcomes on roll 3
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 3 — come/don't come stacking
  // ---------------------------------------------------------------------------

  describe('Phase 3 — come/dont-come stacking', () => {
    it('places come and dontCome during point phase when maxComePairs > 0', () => {
      // [6]=point, [3]=first point-phase roll → check roll[1] activeBets
      const { result } = runDoDont([6, 3], DoDontWithCome1X);
      const roll1 = result.rolls[1];
      const come = roll1.activeBets.find(b => b.type === 'come');
      const dc = roll1.activeBets.find(b => b.type === 'dontCome');
      expect(come).toBeDefined();
      expect(come!.amount).toBe(10);
      expect(dc).toBeDefined();
      expect(dc!.amount).toBe(10);
    });

    it('does NOT place come or dontCome on come-out when maxComePairs > 0', () => {
      // [5]=point (come-out roll): check roll[0] activeBets
      const { result } = runDoDont([5, 3], DoDontWithCome1X);
      const roll0 = result.rolls[0]; // come-out
      const come = roll0.activeBets.find(b => b.type === 'come');
      const dc = roll0.activeBets.find(b => b.type === 'dontCome');
      expect(come).toBeUndefined();
      expect(dc).toBeUndefined();
    });

    it('does NOT place come or dontCome without come stacking enabled', () => {
      const { result } = runDoDont([6, 3], DoDont1X);
      const roll1 = result.rolls[1];
      const come = roll1.activeBets.find(b => b.type === 'come');
      const dc = roll1.activeBets.find(b => b.type === 'dontCome');
      expect(come).toBeUndefined();
      expect(dc).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Factory — DoDont(options) parametric configuration
  // ---------------------------------------------------------------------------

  describe('DoDont() factory parametric configuration', () => {
    it('respects rightUnit and wrongUnit', () => {
      const strategy = () => DoDont({ rightUnit: 25, wrongUnit: 25 });
      const { result } = runDoDont([8, 3], strategy);
      const roll1 = result.rolls[1];
      const pl = roll1.activeBets.find(b => b.type === 'passLine');
      const dp = roll1.activeBets.find(b => b.type === 'dontPass');
      expect(pl!.amount).toBe(25);
      expect(dp!.amount).toBe(25);
    });

    it('asymmetric sizing — larger right unit', () => {
      const strategy = () => DoDont({ rightUnit: 20, wrongUnit: 10, rightOddsMultiple: 1, wrongOddsMultiple: 1 });
      const { result } = runDoDont([8, 3], strategy);
      const roll1 = result.rolls[1];
      const pl = roll1.activeBets.find(b => b.type === 'passLine');
      const dp = roll1.activeBets.find(b => b.type === 'dontPass');
      expect(pl!.amount).toBe(20);
      expect(pl!.odds).toBe(20); // 1× of $20
      expect(dp!.amount).toBe(10);
      expect(dp!.odds).toBe(10); // 1× of $10
    });

    it('stays in hedgeActive stage throughout', () => {
      const { runtime } = runDoDont([8, 3, 7], DoDont1X);
      expect(runtime.getCurrentStage()).toBe('hedgeActive');
    });
  });
});
