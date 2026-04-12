import { DontComeBet } from '../../src/bets/dont-come-bet';
import { TableMaker } from '../table-maker/table-maker';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { StrategyDefinition } from '../../src/dsl/strategy';
import { RiggedDice } from '../dice/rigged-dice';

describe('DontComeBet', () => {

  describe('isOkayToPlace', () => {
    it('returns true when point is ON', () => {
      const table = TableMaker.getTable().withPoint(8).value();
      const bet = new DontComeBet(10, 'player1');
      expect(bet.isOkayToPlace(table)).toBe(true);
    });

    it('returns false when point is OFF', () => {
      const table = TableMaker.getTable().value();
      const bet = new DontComeBet(10, 'player1');
      expect(bet.isOkayToPlace(table)).toBe(false);
    });
  });

  describe('established phase — win on 7 (bet already traveled to own point)', () => {
    it('rolls 7 when established at point 6 → payOut = amount (flat profit)', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontComeBet(10, 'player1');
      bet.point = 6; // bet has already traveled to point 6
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      expect(bet.payOut).toBe(10);
    });

    it('rolls 7 with lay odds, established at point 6 → payOut includes lay profit', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontComeBet(10, 'player1');
      bet.point = 6; // bet has already traveled to point 6
      bet.layOddsAmount = 12; // lay $12 on 6 → win $10
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      // flat profit $10 + lay odds profit floor(12*5/6)=$10 = $20
      expect(bet.payOut).toBe(20);
    });
  });

  describe('established phase — loss when own point is re-rolled', () => {
    it('rolls own point (6) → amount = 0', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontComeBet(10, 'player1');
      bet.point = 6; // bet has already traveled to point 6
      bet.layOddsAmount = 12;
      bet.evaluateDiceRoll({ die1: 0, die2: 6, sum: 6 }, table);
      expect(bet.amount).toBe(0);
      expect(bet.layOddsAmount).toBe(0);
    });
  });

  describe('point phase resolution — no action on other rolls', () => {
    it('rolls a non-7 non-point number → bet stays up', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontComeBet(10, 'player1');
      bet.evaluateDiceRoll({ die1: 0, die2: 5, sum: 5 }, table);
      expect(bet.payOut).toBeUndefined();
      expect(bet.amount).toBe(10);
    });
  });

  describe('bankroll accounting (CrapsEngine + RiggedDice)', () => {
    it('DontCome loses in transit on 7 (seven-out before DC establishes)', () => {
      // DC is placed with point ON, then 7 is rolled immediately.
      // DC is still in transit — 7 is a LOSER for a DC in transit (same as come-out rules).
      const strategy: StrategyDefinition = ({ bets }) => {
        bets.dontPass(10);
        bets.dontCome(10);
      };
      const dice = new RiggedDice([6, 7]);
      const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 (dontPass) = 290. Roll 6 → point 6.
      // Roll 2: 290 - 10 (dontCome) = 280. Roll 7:
      //   dontPass wins (seven-out) → +10+10=20 → 300
      //   dontCome in transit → 7 loses → amount=0 (no return)
      // Final: 280 + 20 = 300
      expect(result.finalBankroll).toBe(300);
    });

    it('DontCome loses when table point is made', () => {
      const strategy: StrategyDefinition = ({ bets }) => {
        bets.dontPass(10);
        bets.dontCome(10);
      };
      // Roll 1: come-out 6 → DontPass placed (point OFF). Point established.
      // Roll 2: reconcile. Point ON → DontCome placed. Roll 6 → point made → both lose.
      const dice = new RiggedDice([6, 6]);
      const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 = 290
      // Roll 2: 290 - 10 (dontCome) = 280. Roll 6 → DontPass loses, DontCome loses.
      // Final: 280
      expect(result.finalBankroll).toBe(280);
    });

    it('DontCome with lay odds loses in transit on 7 (seven-out before DC establishes)', () => {
      // DC + lay odds placed with point ON. 7 rolled immediately (DC still in transit).
      // DC in transit loses on 7; lay odds are also lost (bet never established).
      const strategy: StrategyDefinition = ({ bets }) => {
        bets.dontPass(10);
        bets.dontCome(10).withOdds(12);
      };
      const dice = new RiggedDice([6, 7]);
      const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 (dontPass) = 290. Roll 6 → point 6.
      // Roll 2: 290 - 10 (dontCome flat) - 12 (lay odds) = 268. Roll 7:
      //   dontPass wins → +10+10=20 → 288
      //   dontCome in transit → 7 loses flat+odds → no return
      // Final: 268 + 20 = 288
      expect(result.finalBankroll).toBe(288);
    });

    it('DontComeBet runs 500 rolls without error (seed 42, $500 bankroll)', () => {
      const strategy: StrategyDefinition = ({ bets }) => {
        bets.dontPass(10);
        bets.dontCome(10);
      };
      const engine = new CrapsEngine({ strategy, bankroll: 500, rolls: 500, seed: 42 });
      expect(() => engine.run()).not.toThrow();
    });
  });
});
