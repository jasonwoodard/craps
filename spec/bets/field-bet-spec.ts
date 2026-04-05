import { FieldBet } from '../../src/bets/field-bet';
import { TableMaker } from '../table-maker/table-maker';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { StrategyDefinition } from '../../src/dsl/strategy';
import { RiggedDice } from '../dice/rigged-dice';
import { JustField } from '../../src/dsl/strategies';

describe('FieldBet', () => {

  describe('isOkayToPlace', () => {
    it('returns true when point is OFF', () => {
      const table = TableMaker.getTable().value();
      const bet = new FieldBet(10, 'player1');
      expect(bet.isOkayToPlace(table)).toBe(true);
    });

    it('returns true when point is ON', () => {
      const table = TableMaker.getTable().withPoint(8).value();
      const bet = new FieldBet(10, 'player1');
      expect(bet.isOkayToPlace(table)).toBe(true);
    });
  });

  describe('wins — 1:1', () => {
    const table = TableMaker.getTable().value();

    [
      { roll: 3,  die2: 3  },
      { roll: 4,  die2: 4  },
      { roll: 9,  die2: 9  },
      { roll: 10, die2: 10 },
      { roll: 11, die2: 11 },
    ].forEach(({ roll, die2 }) => {
      it(`rolls ${roll} → payOut = amount * 2`, () => {
        const bet = new FieldBet(10, 'player1');
        bet.evaluateDiceRoll({ die1: 0, die2: die2, sum: roll }, table);
        expect(bet.payOut).toBe(20);
      });
    });
  });

  describe('wins — 2:1 double pay', () => {
    const table = TableMaker.getTable().value();

    it('rolls 2 → payOut = amount * 3', () => {
      const bet = new FieldBet(10, 'player1');
      bet.evaluateDiceRoll({ die1: 0, die2: 2, sum: 2 }, table);
      expect(bet.payOut).toBe(30);
    });

    it('rolls 12 → payOut = amount * 3', () => {
      const bet = new FieldBet(10, 'player1');
      bet.evaluateDiceRoll({ die1: 0, die2: 12, sum: 12 }, table);
      expect(bet.payOut).toBe(30);
    });
  });

  describe('losses', () => {
    const table = TableMaker.getTable().value();

    [5, 6, 7, 8].forEach(roll => {
      it(`rolls ${roll} → amount = 0`, () => {
        const bet = new FieldBet(10, 'player1');
        bet.evaluateDiceRoll({ die1: 0, die2: roll, sum: roll }, table);
        expect(bet.amount).toBe(0);
      });
    });
  });

  describe('bankroll accounting (CrapsEngine + RiggedDice)', () => {
    const fieldOnly: StrategyDefinition = ({ bets }) => { bets.field(10); };

    it('$10 bet on 9 → bankroll +$10 (1:1)', () => {
      const dice = new RiggedDice([9]);
      const engine = new CrapsEngine({ strategy: fieldOnly, bankroll: 300, rolls: 1, dice });
      const result = engine.run();
      // 300 - 10 (bet) + 20 (payOut = amount * 2) = 310
      expect(result.finalBankroll).toBe(310);
    });

    it('$10 bet on 2 → bankroll +$20 (2:1)', () => {
      const dice = new RiggedDice([2]);
      const engine = new CrapsEngine({ strategy: fieldOnly, bankroll: 300, rolls: 1, dice });
      const result = engine.run();
      // 300 - 10 (bet) + 30 (payOut = amount * 3) = 320
      expect(result.finalBankroll).toBe(320);
    });

    it('$10 bet on 7 → bankroll -$10 (loss)', () => {
      const dice = new RiggedDice([7]);
      const engine = new CrapsEngine({ strategy: fieldOnly, bankroll: 300, rolls: 1, dice });
      const result = engine.run();
      // 300 - 10 (bet, lost) = 290
      expect(result.finalBankroll).toBe(290);
    });

    it('field active on come-out roll (point OFF)', () => {
      // Roll a come-out 4 (establishes point, no field win/loss for 4 = field winner)
      const dice = new RiggedDice([4]);
      const engine = new CrapsEngine({ strategy: fieldOnly, bankroll: 300, rolls: 1, dice });
      const result = engine.run();
      // 4 is a field winner (1:1) — 300 - 10 + 20 = 310
      expect(result.finalBankroll).toBe(310);
    });

    it('field active on point phase (point ON)', () => {
      // Roll 1: come-out 4 → establishes point, field wins 1:1
      // Roll 2: point ON (4), roll 9 → field still active, wins 1:1
      const dice = new RiggedDice([4, 9]);
      const engine = new CrapsEngine({ strategy: fieldOnly, bankroll: 300, rolls: 2, dice });
      const result = engine.run();
      // Roll 1: 300 - 10 + 20 = 310
      // Roll 2: 310 - 10 + 20 = 320
      expect(result.finalBankroll).toBe(320);
    });

    it('JustField runs 500 rolls without error (seed 42, $300 bankroll)', () => {
      const engine = new CrapsEngine({ strategy: JustField, bankroll: 300, rolls: 500, seed: 42 });
      expect(() => engine.run()).not.toThrow();
    });
  });
});
