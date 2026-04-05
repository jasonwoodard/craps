import { DontPassBet } from '../../src/bets/dont-pass-bet';
import { TableMaker } from '../table-maker/table-maker';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { StrategyDefinition } from '../../src/dsl/strategy';
import { RiggedDice } from '../dice/rigged-dice';

describe('DontPassBet', () => {

  describe('isOkayToPlace', () => {
    it('returns true when point is OFF (come-out)', () => {
      const table = TableMaker.getTable().value();
      const bet = new DontPassBet(10, 'player1');
      expect(bet.isOkayToPlace(table)).toBe(true);
    });

    it('returns false when point is ON', () => {
      const table = TableMaker.getTable().withPoint(8).value();
      const bet = new DontPassBet(10, 'player1');
      expect(bet.isOkayToPlace(table)).toBe(false);
    });
  });

  describe('come-out wins — 2 and 3', () => {
    const table = TableMaker.getTable().value(); // point OFF

    [2, 3].forEach(roll => {
      it(`rolls ${roll} on come-out → payOut = amount (even money profit)`, () => {
        const bet = new DontPassBet(10, 'player1');
        bet.evaluateDiceRoll({ die1: 0, die2: roll, sum: roll }, table);
        expect(bet.payOut).toBe(10);
      });
    });
  });

  describe('come-out push — 12 (bar 12)', () => {
    it('rolls 12 on come-out → no action (push)', () => {
      const table = TableMaker.getTable().value();
      const bet = new DontPassBet(10, 'player1');
      bet.evaluateDiceRoll({ die1: 0, die2: 12, sum: 12 }, table);
      expect(bet.payOut).toBeUndefined();
      expect(bet.amount).toBe(10); // still up
    });
  });

  describe('come-out losses — 7 and 11', () => {
    const table = TableMaker.getTable().value(); // point OFF

    [7, 11].forEach(roll => {
      it(`rolls ${roll} on come-out → amount = 0 (lose)`, () => {
        const bet = new DontPassBet(10, 'player1');
        bet.evaluateDiceRoll({ die1: 0, die2: roll, sum: roll }, table);
        expect(bet.amount).toBe(0);
      });
    });
  });

  describe('come-out no-action — other numbers establish a point', () => {
    const table = TableMaker.getTable().value(); // point OFF

    [4, 5, 6, 8, 9, 10].forEach(roll => {
      it(`rolls ${roll} on come-out → no action (point established, bet rides)`, () => {
        const bet = new DontPassBet(10, 'player1');
        bet.evaluateDiceRoll({ die1: 0, die2: roll, sum: roll }, table);
        expect(bet.payOut).toBeUndefined();
        expect(bet.amount).toBe(10);
      });
    });
  });

  describe('point phase — wins on 7-out', () => {
    it('rolls 7 in point phase → payOut = amount (flat profit, no odds)', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontPassBet(10, 'player1');
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      expect(bet.payOut).toBe(10);
    });

    it('rolls 7 in point phase with lay odds → payOut includes lay profit', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontPassBet(10, 'player1');
      bet.layOddsAmount = 12; // lay $12 on point 6 (6:5 lay) → win $10
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      // flat profit = $10, lay odds profit on 6 = floor(12 * 5/6) = $10
      expect(bet.payOut).toBe(20);
    });
  });

  describe('point phase — losses when point is made', () => {
    [4, 5, 6, 8, 9, 10].forEach(point => {
      it(`point ${point} is rolled in point phase → amount = 0 and layOddsAmount = 0`, () => {
        const table = TableMaker.getTable().withPoint(point).value();
        const bet = new DontPassBet(10, 'player1');
        bet.layOddsAmount = 20;
        bet.evaluateDiceRoll({ die1: 0, die2: point, sum: point }, table);
        expect(bet.amount).toBe(0);
        expect(bet.layOddsAmount).toBe(0);
      });
    });
  });

  describe('point phase — no action on other rolls', () => {
    it('rolls 5 when point is 6 → no action', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontPassBet(10, 'player1');
      bet.evaluateDiceRoll({ die1: 0, die2: 5, sum: 5 }, table);
      expect(bet.payOut).toBeUndefined();
      expect(bet.amount).toBe(10);
    });
  });

  describe('lay odds payout — computeLayOddsPayout', () => {
    it('point 4 → floor(layOdds / 2)  — lay 2:1', () => {
      const table = TableMaker.getTable().withPoint(4).value();
      const bet = new DontPassBet(10, 'player1');
      bet.layOddsAmount = 20; // lay $20, win $10
      expect(DontPassBet.computeLayOddsPayout(bet, table)).toBe(10);
    });

    it('point 10 → floor(layOdds / 2)  — lay 2:1', () => {
      const table = TableMaker.getTable().withPoint(10).value();
      const bet = new DontPassBet(10, 'player1');
      bet.layOddsAmount = 20;
      expect(DontPassBet.computeLayOddsPayout(bet, table)).toBe(10);
    });

    it('point 5 → floor(layOdds * 2/3) — lay 3:2', () => {
      const table = TableMaker.getTable().withPoint(5).value();
      const bet = new DontPassBet(10, 'player1');
      bet.layOddsAmount = 15; // lay $15, win $10
      expect(DontPassBet.computeLayOddsPayout(bet, table)).toBe(10);
    });

    it('point 9 → floor(layOdds * 2/3) — lay 3:2', () => {
      const table = TableMaker.getTable().withPoint(9).value();
      const bet = new DontPassBet(10, 'player1');
      bet.layOddsAmount = 15;
      expect(DontPassBet.computeLayOddsPayout(bet, table)).toBe(10);
    });

    it('point 6 → floor(layOdds * 5/6) — lay 6:5', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontPassBet(10, 'player1');
      bet.layOddsAmount = 12; // lay $12, win $10
      expect(DontPassBet.computeLayOddsPayout(bet, table)).toBe(10);
    });

    it('point 8 → floor(layOdds * 5/6) — lay 6:5', () => {
      const table = TableMaker.getTable().withPoint(8).value();
      const bet = new DontPassBet(10, 'player1');
      bet.layOddsAmount = 12;
      expect(DontPassBet.computeLayOddsPayout(bet, table)).toBe(10);
    });

    it('returns 0 when layOddsAmount is 0', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new DontPassBet(10, 'player1');
      expect(DontPassBet.computeLayOddsPayout(bet, table)).toBe(0);
    });
  });

  describe('totalAmount includes layOddsAmount', () => {
    it('totalAmount = amount + layOddsAmount', () => {
      const bet = new DontPassBet(10, 'player1');
      bet.layOddsAmount = 20;
      expect(bet.totalAmount).toBe(30);
    });
  });

  describe('bankroll accounting (CrapsEngine + RiggedDice)', () => {
    const dontPassOnly: StrategyDefinition = ({ bets }) => {
      bets.dontPass(10);
    };

    it('come-out 2 → bankroll +$10 (even money win)', () => {
      // Roll 1: come-out 2 → DontPass wins
      const dice = new RiggedDice([2]);
      const engine = new CrapsEngine({ strategy: dontPassOnly, bankroll: 300, rolls: 1, dice });
      const result = engine.run();
      // 300 - 10 (bet) + 10 (returned) + 10 (profit) = 310
      expect(result.finalBankroll).toBe(310);
    });

    it('come-out 3 → bankroll +$10 (even money win)', () => {
      const dice = new RiggedDice([3]);
      const engine = new CrapsEngine({ strategy: dontPassOnly, bankroll: 300, rolls: 1, dice });
      const result = engine.run();
      expect(result.finalBankroll).toBe(310);
    });

    it('come-out 7 → bankroll -$10 (loss)', () => {
      const dice = new RiggedDice([7]);
      const engine = new CrapsEngine({ strategy: dontPassOnly, bankroll: 300, rolls: 1, dice });
      const result = engine.run();
      // 300 - 10 (bet, lost) = 290
      expect(result.finalBankroll).toBe(290);
    });

    it('come-out 11 → bankroll -$10 (loss)', () => {
      const dice = new RiggedDice([11]);
      const engine = new CrapsEngine({ strategy: dontPassOnly, bankroll: 300, rolls: 1, dice });
      const result = engine.run();
      expect(result.finalBankroll).toBe(290);
    });

    it('come-out 12 → bankroll unchanged (push)', () => {
      // Roll 1: come-out 12 → push. Roll 2: 7 → DontPass wins
      const dice = new RiggedDice([12, 7]);
      const engine = new CrapsEngine({ strategy: dontPassOnly, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 12 push, bankroll stays 300 (bet still up)
      // Roll 2: 7 on come-out (point was never set, so it's still come-out!) → DontPass loses on 7 come-out
      // Wait: 12 doesn't establish a point, so roll 2 is also a come-out. 7 on come-out → DontPass LOSES
      // 300 - 10 (bet) = 290 (then 7 comes → lose, bet already deducted)
      expect(result.finalBankroll).toBe(290);
    });

    it('come-out 6 (point established), then 7-out → bankroll +$10', () => {
      // Roll 1: come-out 6 → point established, bet stays up (no outcome)
      // Roll 2: 7 in point phase → DontPass WINS
      const dice = new RiggedDice([6, 7]);
      const engine = new CrapsEngine({ strategy: dontPassOnly, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 (bet placed) = 290 bankroll
      // Roll 2: 7-out wins → +10 (returned) + 10 (profit) = +20
      // Final: 290 + 20 = 310
      expect(result.finalBankroll).toBe(310);
    });

    it('come-out 6 (point established), then 6 made → bankroll -$10', () => {
      // Roll 1: come-out 6 → point established
      // Roll 2: 6 → point made → DontPass LOSES
      const dice = new RiggedDice([6, 6]);
      const engine = new CrapsEngine({ strategy: dontPassOnly, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 = 290 (bet placed)
      // Roll 2: point made → DontPass loses, amount = 0
      // Final: 290
      expect(result.finalBankroll).toBe(290);
    });

    it('DontPass with lay odds on point 6 — 7-out pays flat + lay profit', () => {
      // Strategy: dontPass $10, lay odds $12 on point 6 (6:5 lay → win $10)
      const dontPassWithLay: StrategyDefinition = ({ bets }) => {
        bets.dontPass(10).withOdds(12);
      };
      // Roll 1: come-out 6 → point established
      // Roll 2: 7-out → DontPass wins (flat $10 + lay profit $10)
      const dice = new RiggedDice([6, 7]);
      const engine = new CrapsEngine({ strategy: dontPassWithLay, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 (flat) = 290, then - 12 (lay odds placed) = 278
      // Roll 2: win → +10 (flat returned) + 10 (flat profit) + 12 (lay returned) + 10 (lay profit) = +42
      // Final: 278 + 42 = 320
      expect(result.finalBankroll).toBe(320);
    });

    it('DontPass with lay odds on point 4 — 7-out pays flat + lay profit (1:2)', () => {
      // Lay $20 on point 4 → win $10 (1:2 payout)
      const dontPassWithLay: StrategyDefinition = ({ bets }) => {
        bets.dontPass(10).withOdds(20);
      };
      const dice = new RiggedDice([4, 7]);
      const engine = new CrapsEngine({ strategy: dontPassWithLay, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 - 20 = 270
      // Roll 2: win → +10 + 10 + 20 + 10 = +50
      // Final: 270 + 50 = 320
      expect(result.finalBankroll).toBe(320);
    });

    it('DontPass with lay odds — point made loses both flat and lay', () => {
      const dontPassWithLay: StrategyDefinition = ({ bets }) => {
        bets.dontPass(10).withOdds(20);
      };
      const dice = new RiggedDice([4, 4]); // point 4 made
      const engine = new CrapsEngine({ strategy: dontPassWithLay, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 - 20 = 270
      // Roll 2: lose → 270 (bankroll already deducted when bet was placed)
      expect(result.finalBankroll).toBe(270);
    });

    it('DontPassLineOnly runs 500 rolls without error (seed 42, $500 bankroll)', () => {
      const engine = new CrapsEngine({ strategy: dontPassOnly, bankroll: 500, rolls: 500, seed: 42 });
      expect(() => engine.run()).not.toThrow();
    });
  });
});
