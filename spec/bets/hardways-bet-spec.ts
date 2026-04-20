import { HardwaysBet } from '../../src/bets/hardways-bet';
import { TableMaker } from '../table-maker/table-maker';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { PassAndHards } from '../../src/dsl/strategies';

describe('HardwaysBet', () => {

  describe('isOkayToPlace', () => {
    const table = TableMaker.getTable().value();

    [4, 6, 8, 10].forEach(point => {
      it(`returns true for hard ${point}`, () => {
        const bet = new HardwaysBet(10, point, 'p1');
        expect(bet.isOkayToPlace(table)).toBe(true);
      });
    });

    [2, 3, 5, 7, 9, 11, 12].forEach(point => {
      it(`returns false for invalid point ${point}`, () => {
        const bet = new HardwaysBet(10, point, 'p1');
        expect(bet.isOkayToPlace(table)).toBe(false);
      });
    });
  });

  describe('evaluateDiceRoll — hard wins', () => {
    const table = TableMaker.getTable().value();

    it('hard 4 (2+2) wins', () => {
      const bet = new HardwaysBet(10, 4, 'p1');
      bet.evaluateDiceRoll({ die1: 2, die2: 2, sum: 4 }, table);
      expect(bet.payOut).toBe(80); // 10 + 7*10
      expect(bet.amount).toBe(10);
    });

    it('hard 6 (3+3) wins', () => {
      const bet = new HardwaysBet(10, 6, 'p1');
      bet.evaluateDiceRoll({ die1: 3, die2: 3, sum: 6 }, table);
      expect(bet.payOut).toBe(100); // 10 + 9*10
    });

    it('hard 8 (4+4) wins', () => {
      const bet = new HardwaysBet(10, 8, 'p1');
      bet.evaluateDiceRoll({ die1: 4, die2: 4, sum: 8 }, table);
      expect(bet.payOut).toBe(100); // 10 + 9*10
    });

    it('hard 10 (5+5) wins', () => {
      const bet = new HardwaysBet(10, 10, 'p1');
      bet.evaluateDiceRoll({ die1: 5, die2: 5, sum: 10 }, table);
      expect(bet.payOut).toBe(80); // 10 + 7*10
    });
  });

  describe('evaluateDiceRoll — easy-way losses', () => {
    const table = TableMaker.getTable().value();

    it('easy 6 (1+5) loses', () => {
      const bet = new HardwaysBet(10, 6, 'p1');
      bet.evaluateDiceRoll({ die1: 1, die2: 5, sum: 6 }, table);
      expect(bet.amount).toBe(0);
      expect(bet.payOut).toBeUndefined();
    });

    it('easy 6 (5+1) loses', () => {
      const bet = new HardwaysBet(10, 6, 'p1');
      bet.evaluateDiceRoll({ die1: 5, die2: 1, sum: 6 }, table);
      expect(bet.amount).toBe(0);
    });

    it('easy 8 (3+5) loses', () => {
      const bet = new HardwaysBet(10, 8, 'p1');
      bet.evaluateDiceRoll({ die1: 3, die2: 5, sum: 8 }, table);
      expect(bet.amount).toBe(0);
    });

    it('easy 4 (1+3) loses', () => {
      const bet = new HardwaysBet(10, 4, 'p1');
      bet.evaluateDiceRoll({ die1: 1, die2: 3, sum: 4 }, table);
      expect(bet.amount).toBe(0);
    });

    it('easy 10 (4+6) loses', () => {
      const bet = new HardwaysBet(10, 10, 'p1');
      bet.evaluateDiceRoll({ die1: 4, die2: 6, sum: 10 }, table);
      expect(bet.amount).toBe(0);
    });
  });

  describe('evaluateDiceRoll — seven-out losses', () => {
    const table = TableMaker.getTable().value();

    it('any 7 loses the bet', () => {
      const bet = new HardwaysBet(10, 6, 'p1');
      bet.evaluateDiceRoll({ die1: 4, die2: 3, sum: 7 }, table);
      expect(bet.amount).toBe(0);
    });

    it('7 when hardways on 4 loses', () => {
      const bet = new HardwaysBet(10, 4, 'p1');
      bet.evaluateDiceRoll({ die1: 1, die2: 6, sum: 7 }, table);
      expect(bet.amount).toBe(0);
    });
  });

  describe('evaluateDiceRoll — no action (bet stays up)', () => {
    const table = TableMaker.getTable().value();

    // Any roll that is neither 7 nor the hardways number is a no-op.
    [
      { die1: 1, die2: 2, sum: 3 },
      { die1: 2, die2: 3, sum: 5 },
      { die1: 3, die2: 6, sum: 9 },
      { die1: 5, die2: 6, sum: 11 },
      { die1: 1, die2: 1, sum: 2 },
      // Hard roll of a different number (H4 bet, hard 6 rolled)
      { die1: 3, die2: 3, sum: 6 },
    ].forEach(roll => {
      it(`roll ${roll.sum} (${roll.die1}+${roll.die2}) on H10 — no action`, () => {
        const bet = new HardwaysBet(10, 10, 'p1');
        bet.evaluateDiceRoll(roll, table);
        expect(bet.amount).toBe(10);
        expect(bet.payOut).toBeUndefined();
      });
    });
  });

  describe('win', () => {
    const table = TableMaker.getTable().value();

    it('sets payOut to amount + 7×amount for H4', () => {
      const bet = new HardwaysBet(10, 4, 'p1');
      bet.win(table);
      expect(bet.payOut).toBe(80);
    });

    it('sets payOut to amount + 9×amount for H6', () => {
      const bet = new HardwaysBet(15, 6, 'p1');
      bet.win(table);
      expect(bet.payOut).toBe(150); // 15 + 9*15
    });

    it('sets payOut to amount + 9×amount for H8', () => {
      const bet = new HardwaysBet(20, 8, 'p1');
      bet.win(table);
      expect(bet.payOut).toBe(200); // 20 + 9*20
    });

    it('sets payOut to amount + 7×amount for H10', () => {
      const bet = new HardwaysBet(10, 10, 'p1');
      bet.win(table);
      expect(bet.payOut).toBe(80);
    });
  });

  describe('lose', () => {
    it('zeros out the bet amount', () => {
      const bet = new HardwaysBet(25, 6, 'p1');
      bet.lose();
      expect(bet.amount).toBe(0);
    });
  });

  describe('payout property', () => {
    it('starts undefined', () => {
      const bet = new HardwaysBet(10, 6, 'p1');
      expect(bet.payOut).toBeUndefined();
    });
  });

  describe('endurance', () => {
    it('PassAndHards runs 500 rolls without error (seed 42, $500 bankroll)', () => {
      const engine = new CrapsEngine({ strategy: PassAndHards, bankroll: 500, rolls: 500, seed: 42 });
      expect(() => engine.run()).not.toThrow();
    });
  });
});
