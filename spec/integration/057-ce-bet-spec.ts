/**
 * Integration tests: C&E bets (M6)
 *
 * C&E is a one-roll prop bet requiring only diceRoll.sum, so standard
 * RiggedDice (die1=0, die2=sum) is sufficient for all scenarios.
 *
 * Bankroll accounting (payOut = original + profit):
 *   Craps (2, 3, 12): pays 3:1 net → payOut = amount + 3×amount
 *   Eleven (11):      pays 7:1 net → payOut = amount + 7×amount
 */

import { CrapsEngine } from '../../src/engine/craps-engine';
import { StrategyDefinition } from '../../src/dsl/strategy';
import { RiggedDice } from '../dice/rigged-dice';
import { CEBet } from '../../src/bets/ce-bet';
import { ScenarioTable } from './helpers/scenario-helper';

describe('Integration — C&E bets (M6)', () => {

  describe('bankroll accounting (CrapsEngine + RiggedDice)', () => {
    const ceOnly: StrategyDefinition = ({ bets }) => { bets.ce(10); };

    it('$10 C&E on 12 → bankroll +$30 (3:1 net)', () => {
      // $100 - $10 (bet) + $40 (payOut) = $130
      const engine = new CrapsEngine({ strategy: ceOnly, bankroll: 100, rolls: 1, dice: new RiggedDice([12]) });
      expect(engine.run().finalBankroll).toBe(130);
    });

    it('$10 C&E on 2 → bankroll +$30 (3:1 net)', () => {
      const engine = new CrapsEngine({ strategy: ceOnly, bankroll: 100, rolls: 1, dice: new RiggedDice([2]) });
      expect(engine.run().finalBankroll).toBe(130);
    });

    it('$10 C&E on 3 → bankroll +$30 (3:1 net)', () => {
      const engine = new CrapsEngine({ strategy: ceOnly, bankroll: 100, rolls: 1, dice: new RiggedDice([3]) });
      expect(engine.run().finalBankroll).toBe(130);
    });

    it('$10 C&E on 11 → bankroll +$70 (7:1 net)', () => {
      // $100 - $10 + $80 = $170
      const engine = new CrapsEngine({ strategy: ceOnly, bankroll: 100, rolls: 1, dice: new RiggedDice([11]) });
      expect(engine.run().finalBankroll).toBe(170);
    });

    it('$10 C&E on 7 → bankroll -$10 (loss)', () => {
      const engine = new CrapsEngine({ strategy: ceOnly, bankroll: 100, rolls: 1, dice: new RiggedDice([7]) });
      expect(engine.run().finalBankroll).toBe(90);
    });

    it('$10 C&E on 6 → bankroll -$10 (loss)', () => {
      const engine = new CrapsEngine({ strategy: ceOnly, bankroll: 100, rolls: 1, dice: new RiggedDice([6]) });
      expect(engine.run().finalBankroll).toBe(90);
    });

    it('two rolls — loss then craps win', () => {
      // Roll 1: 5 → C&E loses, bankroll $90. Strategy re-places C&E $10 → $80.
      // Roll 2: 12 → C&E wins, payOut $40 → bankroll $120.
      const engine = new CrapsEngine({ strategy: ceOnly, bankroll: 100, rolls: 2, dice: new RiggedDice([5, 12]) });
      expect(engine.run().finalBankroll).toBe(120);
    });

    it('two rolls — loss then yo win', () => {
      // Roll 1: 4 → C&E loses → $90. Re-place $10 → $80.
      // Roll 2: 11 → C&E wins, payOut $80 → $160.
      const engine = new CrapsEngine({ strategy: ceOnly, bankroll: 100, rolls: 2, dice: new RiggedDice([4, 11]) });
      expect(engine.run().finalBankroll).toBe(160);
    });

    it('active on come-out roll (point OFF)', () => {
      // Come-out roll of 11 → C&E wins. C&E is always active.
      const engine = new CrapsEngine({ strategy: ceOnly, bankroll: 100, rolls: 1, dice: new RiggedDice([11]) });
      expect(engine.run().finalBankroll).toBe(170);
    });

    it('active when point is ON', () => {
      // Roll 1: come-out 6 → C&E loses (6 is not a CE winner), point set.
      // Roll 2: point ON, roll 12 → C&E wins.
      const engine = new CrapsEngine({ strategy: ceOnly, bankroll: 100, rolls: 2, dice: new RiggedDice([6, 12]) });
      // Roll 1: $100 - $10 = $90. Roll 2: $90 - $10 + $40 = $120.
      expect(engine.run().finalBankroll).toBe(120);
    });
  });

  describe('ScenarioTable — bet lifecycle via rail', () => {

    it('C&E placed and wins on craps: one-roll bet removed after win', () => {
      // Rail $100, place $10 → $90. Roll 3 → CE wins ($40) → rail $130.
      // Bet is removed (one-roll prop).
      const s = new ScenarioTable(100, [3]);
      const ce = new CEBet(10, 'player');
      s.bet(ce).expectRail(90);
      s.roll().expectRail(130);
      expect(s.table.bets).not.toContain(ce); // one-roll: removed after win
    });

    it('C&E placed and wins on eleven: one-roll bet removed after win', () => {
      const s = new ScenarioTable(100, [11]);
      const ce = new CEBet(10, 'player');
      s.bet(ce).expectRail(90);
      s.roll().expectRail(170); // 10 + 7*10 = 80 → 90 + 80 = 170
      expect(s.table.bets).not.toContain(ce);
    });

    it('C&E loses on off-number: rail unchanged (loss already deducted)', () => {
      const s = new ScenarioTable(100, [8]);
      const ce = new CEBet(10, 'player');
      s.bet(ce).expectRail(90);
      s.roll().expectRail(90);
    });

    it('C&E active across come-out and point phases', () => {
      // Roll 1 (come-out): roll 2 → craps, C&E wins.
      // Roll 2 (come-out again after natural): roll 11 → yo, C&E wins.
      const s = new ScenarioTable(100, [2, 11]);
      const ce1 = new CEBet(10, 'player');
      s.bet(ce1).expectRail(90);
      s.roll().expectRail(130);  // craps 2 wins (3:1)

      const ce2 = new CEBet(10, 'player');
      s.bet(ce2).expectRail(120);
      s.roll().expectRail(200);  // yo 11 wins (7:1): rail $120 + $80 payOut = $200
    });
  });
});
