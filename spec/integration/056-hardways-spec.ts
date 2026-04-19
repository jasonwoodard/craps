/**
 * Integration tests: Hardways bets (M5)
 *
 * Uses CrapsEngine + RiggedDicePairs so die1/die2 are precisely controlled,
 * which is required to distinguish hard rolls (die1 === die2) from easy ones.
 *
 * Bankroll accounting for all scenarios (payOut = original + profit):
 *   Hard 6/8 payout: 9:1 → payOut = amount + 9×amount
 *   Hard 4/10 payout: 7:1 → payOut = amount + 7×amount
 */

import { CrapsEngine } from '../../src/engine/craps-engine';
import { StrategyDefinition } from '../../src/dsl/strategy';
import { RiggedDicePairs } from '../dice/rigged-dice-pairs';
import { HardwaysBet } from '../../src/bets/hardways-bet';
import { ScenarioTable } from './helpers/scenario-helper';

describe('Integration — Hardways bets (M5)', () => {

  describe('bankroll accounting (CrapsEngine + RiggedDicePairs)', () => {

    it('hard 6: $10 bet on H6 wins on (3,3) → bankroll $190', () => {
      // Start $100 → place $10 → $90. Roll (3,3): hard 6 wins. payOut = $100.
      // Settle: bankroll += $100 → $190.
      const strategy: StrategyDefinition = ({ bets }) => { bets.hardways(6, 10); };
      const dice = new RiggedDicePairs([[3, 3]]);
      const engine = new CrapsEngine({ strategy, bankroll: 100, rolls: 1, dice });
      expect(engine.run().finalBankroll).toBe(190);
    });

    it('hard 8: $10 bet on H8 wins on (4,4) → bankroll $190', () => {
      const strategy: StrategyDefinition = ({ bets }) => { bets.hardways(8, 10); };
      const dice = new RiggedDicePairs([[4, 4]]);
      const engine = new CrapsEngine({ strategy, bankroll: 100, rolls: 1, dice });
      expect(engine.run().finalBankroll).toBe(190);
    });

    it('hard 4: $10 bet on H4 wins on (2,2) → bankroll $170 (7:1 payout)', () => {
      // payOut = 10 + 7*10 = $80 → bankroll $100 - $10 + $80 = $170.
      const strategy: StrategyDefinition = ({ bets }) => { bets.hardways(4, 10); };
      const dice = new RiggedDicePairs([[2, 2]]);
      const engine = new CrapsEngine({ strategy, bankroll: 100, rolls: 1, dice });
      expect(engine.run().finalBankroll).toBe(170);
    });

    it('hard 10: $10 bet on H10 wins on (5,5) → bankroll $170 (7:1 payout)', () => {
      const strategy: StrategyDefinition = ({ bets }) => { bets.hardways(10, 10); };
      const dice = new RiggedDicePairs([[5, 5]]);
      const engine = new CrapsEngine({ strategy, bankroll: 100, rolls: 1, dice });
      expect(engine.run().finalBankroll).toBe(170);
    });

    it('seven-out: $10 H6 loses on (4,3) → bankroll $90', () => {
      const strategy: StrategyDefinition = ({ bets }) => { bets.hardways(6, 10); };
      const dice = new RiggedDicePairs([[4, 3]]);
      const engine = new CrapsEngine({ strategy, bankroll: 100, rolls: 1, dice });
      expect(engine.run().finalBankroll).toBe(90);
    });

    it('easy way loss: $10 H6 loses on easy 6 (1+5) → bankroll $90', () => {
      const strategy: StrategyDefinition = ({ bets }) => { bets.hardways(6, 10); };
      const dice = new RiggedDicePairs([[1, 5]]);
      const engine = new CrapsEngine({ strategy, bankroll: 100, rolls: 1, dice });
      expect(engine.run().finalBankroll).toBe(90);
    });

    it('no-action roll then hard win: H6 survives unrelated rolls', () => {
      // Roll 1: (2,3)=5 — no action; H6 stays up.
      // Roll 2: (3,3)=6 hard — H6 wins.
      // After roll 1: bankroll $90 (bet not settled). After roll 2: bankroll $190.
      // (Strategy re-places on roll 2 only if needed; diff engine detects bet is still on table.)
      const strategy: StrategyDefinition = ({ bets }) => { bets.hardways(6, 10); };
      const dice = new RiggedDicePairs([[2, 3], [3, 3]]);
      const engine = new CrapsEngine({ strategy, bankroll: 100, rolls: 2, dice });
      expect(engine.run().finalBankroll).toBe(190);
    });

    it('easy loss then re-placed and hard win: bankroll reflects two cycles', () => {
      // Roll 1: (5,1)=6 easy — H6 loses → bankroll $90.
      // Roll 2: strategy re-places H6 $10 → $80, rolls (3,3) hard 6 → win $100 → $180.
      const strategy: StrategyDefinition = ({ bets }) => { bets.hardways(6, 10); };
      const dice = new RiggedDicePairs([[5, 1], [3, 3]]);
      const engine = new CrapsEngine({ strategy, bankroll: 100, rolls: 2, dice });
      expect(engine.run().finalBankroll).toBe(180);
    });
  });

  describe('ScenarioTable — bet lifecycle via rail', () => {

    function makeTable(pairs: Array<[number, number]>, bankroll = 100): ScenarioTable {
      const s = new ScenarioTable(bankroll, []);
      s.table.dice = new RiggedDicePairs(pairs);
      return s;
    }

    it('H6 placed and wins: rail increases by full payOut, bet stays on table', () => {
      // $100 rail. Place H6 $10 → rail $90.
      // Roll (3,3): hard 6 wins. payOut = $100 → rail $190. Bet stays up.
      const s = makeTable([[3, 3]]);
      const h6 = new HardwaysBet(10, 6, 'player');
      s.bet(h6).expectRail(90);
      s.roll().expectRail(190);
      expect(s.table.bets).toContain(h6); // bet stays up for re-hit
    });

    it('H6 placed, no-action roll, then seven-out: bet eventually lost', () => {
      // Roll 1: (2,3)=5 — no action.
      // Roll 2: (4,3)=7 — seven-out; H6 lost (deducted at placement).
      const s = makeTable([[2, 3], [4, 3]]);
      const h6 = new HardwaysBet(10, 6, 'player');
      s.bet(h6).expectRail(90);
      s.roll().expectRail(90);  // 5 — no action
      s.roll().expectRail(90);  // 7 — loss (already deducted)
    });

    it('H6 survives multiple no-action rolls before winning', () => {
      // 3 no-action rolls (5, 9, 4), then hard 6.
      const s = makeTable([[2, 3], [4, 5], [1, 3], [3, 3]]);
      const h6 = new HardwaysBet(10, 6, 'player');
      s.bet(h6).expectRail(90);
      s.roll().expectRail(90);   // 5 — no action
      s.roll().expectRail(90);   // 9 — no action
      s.roll().expectRail(90);   // 4 — no action
      s.roll().expectRail(190);  // hard 6 — win
    });

    it('H6 wins twice before a seven-out', () => {
      // Hard 6, hard 6, then 7. Each win returns $100; losses deducted at placement.
      const s = makeTable([[3, 3], [3, 3], [4, 3]]);
      const h6 = new HardwaysBet(10, 6, 'player');
      s.bet(h6).expectRail(90);
      s.roll().expectRail(190);  // hard 6 win #1
      s.roll().expectRail(290);  // hard 6 win #2
      s.roll().expectRail(290);  // 7 — loss (already deducted at placement)
    });
  });
});
