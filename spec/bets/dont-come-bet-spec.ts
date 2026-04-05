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

  describe('point phase resolution (table point ON) — win on 7', () => {
    it('rolls 7 when point is ON → payOut = amount (flat profit)', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontComeBet(10, 'player1');
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      expect(bet.payOut).toBe(10);
    });

    it('rolls 7 with lay odds on point 6 → payOut includes lay profit', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontComeBet(10, 'player1');
      bet.layOddsAmount = 12; // lay $12 on 6 → win $10
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      // flat profit $10 + lay odds profit $10 = $20
      expect(bet.payOut).toBe(20);
    });
  });

  describe('point phase resolution — loss on table current point', () => {
    it('rolls the table point → amount = 0', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontComeBet(10, 'player1');
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
    it('DontCome wins on 7-out', () => {
      // Strategy: dontPass $10 (needs come-out) + dontCome $10 (placed once point is ON)
      const strategy: StrategyDefinition = ({ bets }) => {
        bets.dontPass(10);
        bets.dontCome(10);
      };
      // Roll 1: come-out 6 → point established, DontPass placed, DontCome placed (point now on)
      // Roll 2: 7-out → both DontPass and DontCome win
      const dice = new RiggedDice([6, 7]);
      const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 (dontPass) = 290
      //   After roll 1 (point=6): dontCome can now be placed...
      //   Actually reconcile happens BEFORE roll. So on roll 1, point is OFF → only dontPass placed
      //   Roll 1 result: 290 (dontPass placed, 6 → point established, no win/loss)
      // Roll 2: reconcile again. Point is ON → dontPass already there, dontCome placed now
      //   290 - 10 (dontCome) = 280
      //   7-out: dontPass wins → +10+10=20; dontCome wins → +10+10=20
      //   280 + 20 + 20 = 320
      expect(result.finalBankroll).toBe(320);
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

    it('DontCome with lay odds wins on 7-out', () => {
      const strategy: StrategyDefinition = ({ bets }) => {
        bets.dontPass(10);
        bets.dontCome(10).withOdds(12); // lay $12 on point 6
      };
      const dice = new RiggedDice([6, 7]);
      const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 (dontPass) = 290
      // Roll 2: 290 - 10 (dontCome flat) - 12 (lay odds) = 268
      //   7-out: dontPass wins → +10+10=20; dontCome wins → +10+10+12+10=42
      //   268 + 20 + 42 = 330
      expect(result.finalBankroll).toBe(330);
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
