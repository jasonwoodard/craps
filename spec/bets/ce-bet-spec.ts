import { CEBet } from '../../src/bets/ce-bet';
import { TableMaker } from '../table-maker/table-maker';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { IronCrossWithCE } from '../../src/dsl/strategies';

describe('CEBet', () => {

  describe('isOkayToPlace', () => {
    it('returns true when point is OFF', () => {
      const table = TableMaker.getTable().value();
      const bet = new CEBet(10, 'p1');
      expect(bet.isOkayToPlace(table)).toBe(true);
    });

    it('returns true when point is ON', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new CEBet(10, 'p1');
      expect(bet.isOkayToPlace(table)).toBe(true);
    });
  });

  describe('evaluateDiceRoll — craps wins (3:1)', () => {
    const table = TableMaker.getTable().value();

    [2, 3, 12].forEach(crapsNumber => {
      it(`rolls ${crapsNumber} → payOut = amount + 3×amount`, () => {
        const bet = new CEBet(10, 'p1');
        bet.evaluateDiceRoll({ die1: 0, die2: crapsNumber, sum: crapsNumber }, table);
        expect(bet.payOut).toBe(40); // 10 + 3*10
        expect(bet.amount).toBe(10);
      });
    });

    it('craps payout scales with bet size', () => {
      const bet = new CEBet(25, 'p1');
      bet.evaluateDiceRoll({ die1: 0, die2: 3, sum: 3 }, table);
      expect(bet.payOut).toBe(100); // 25 + 3*25
    });
  });

  describe('evaluateDiceRoll — eleven wins (7:1)', () => {
    const table = TableMaker.getTable().value();

    it('rolls 11 → payOut = amount + 7×amount', () => {
      const bet = new CEBet(10, 'p1');
      bet.evaluateDiceRoll({ die1: 5, die2: 6, sum: 11 }, table);
      expect(bet.payOut).toBe(80); // 10 + 7*10
      expect(bet.amount).toBe(10);
    });

    it('eleven payout scales with bet size', () => {
      const bet = new CEBet(20, 'p1');
      bet.evaluateDiceRoll({ die1: 5, die2: 6, sum: 11 }, table);
      expect(bet.payOut).toBe(160); // 20 + 7*20
    });
  });

  describe('evaluateDiceRoll — losses', () => {
    const table = TableMaker.getTable().value();

    [4, 5, 6, 7, 8, 9, 10].forEach(roll => {
      it(`rolls ${roll} → amount = 0`, () => {
        const bet = new CEBet(10, 'p1');
        bet.evaluateDiceRoll({ die1: 0, die2: roll, sum: roll }, table);
        expect(bet.amount).toBe(0);
        expect(bet.payOut).toBeUndefined();
      });
    });
  });

  describe('lose', () => {
    it('zeros out the bet amount', () => {
      const bet = new CEBet(50, 'p1');
      bet.lose();
      expect(bet.amount).toBe(0);
    });
  });

  describe('payout property', () => {
    it('starts undefined', () => {
      const bet = new CEBet(10, 'p1');
      expect(bet.payOut).toBeUndefined();
    });
  });

  describe('endurance', () => {
    it('IronCrossWithCE runs 500 rolls without error (seed 42, $500 bankroll)', () => {
      const engine = new CrapsEngine({ strategy: IronCrossWithCE, bankroll: 500, rolls: 500, seed: 42 });
      expect(() => engine.run()).not.toThrow();
    });
  });
});
