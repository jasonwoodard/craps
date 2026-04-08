import { ComeBet } from '../../src/bets/come-bet';
import { CrapsTable } from '../../src/craps-table';
import { TableMaker } from '../table-maker/table-maker';

describe('ComeBet', () => {
  const playerId = 'test-player';
  let comeBet: ComeBet;
  const betAmount: number = 10;

  beforeEach(() => {
    comeBet = new ComeBet(betAmount, playerId);
  });

  it('should indicate okToPlace only when the point is on', () => {
    let table = TableMaker.getTable().withPoint(10).value();
    expect(ComeBet.isOkayToPlace(table)).toBe(true);

    table = TableMaker.getTable().value();
    expect(ComeBet.isOkayToPlace(table)).toBe(false);
  });

  it('should not set the ComeBet point unless the table point is on', () => {
    let table: CrapsTable = TableMaker.getTable().value();
    expect(comeBet.point).toBeUndefined();
    comeBet.evaluateDiceRoll({ die1: 2, die2: 3, sum: 5 }, table);
    // Rolling a valid point should not cause the point to set if the table
    // point is not set.
    expect(comeBet.point).toBeUndefined();
  });

  describe('come bet transit phase (no own point yet)', () => {
    it('should win on 7 before traveling', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      expect(bet.payOut).toBe(10); // wins flat, no odds
      expect(bet.amount).toBeGreaterThan(0);
    });

    it('should win on 11 before traveling', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 11, sum: 11 }, table);
      expect(bet.payOut).toBe(10);
    });

    it('should lose on 2 before traveling', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 2, sum: 2 }, table);
      expect(bet.amount).toBe(0);
    });

    it('should lose on 3 before traveling', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 3, sum: 3 }, table);
      expect(bet.amount).toBe(0);
    });

    it('should lose on 12 before traveling', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 12, sum: 12 }, table);
      expect(bet.amount).toBe(0);
    });

    it('should travel to a point number and set its own point', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table);
      // Bet has traveled — own point is now 9, not the table point (6)
      expect(bet.point).toBe(9);
      expect(bet.payOut).toBeUndefined(); // not resolved yet, just traveled
    });
  });

  describe('come bet established phase (own point set)', () => {
    it('should win when OWN point is rolled, regardless of table point', () => {
      // Table point is 6, come bet has traveled to 9 — these are different
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table); // travels to 9
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table); // hits own point → should win
      expect(bet.payOut).toBeGreaterThan(0);
    });

    it('should NOT win when the TABLE point is rolled but not the come bet own point', () => {
      // Table point is 6, come bet has traveled to 9
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table); // travels to 9
      bet.evaluateDiceRoll({ die1: 0, die2: 6, sum: 6 }, table); // table point hit — irrelevant to come bet
      expect(bet.payOut).toBeUndefined(); // come bet still alive, not resolved
      expect(bet.amount).toBe(10);
    });

    it('should lose on 7 after traveling (seven-out)', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table); // travels to 9
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table); // seven-out
      expect(bet.amount).toBe(0);
      expect(bet.payOut).toBeUndefined();
    });

    it('should have no action on 11 after traveling (11 is not a natural once established)', () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new ComeBet(10, playerId);
      bet.evaluateDiceRoll({ die1: 0, die2: 9, sum: 9 }, table); // travels to 9
      bet.evaluateDiceRoll({ die1: 0, die2: 11, sum: 11 }, table); // 11 has no meaning once established
      expect(bet.payOut).toBeUndefined();
      expect(bet.amount).toBe(10); // still alive
    });

    it('should lose base bet on come-out 7, but return odds', () => {
      // Table point is OFF (come-out phase) — established come bets are contract
      // bets and survive, but odds are OFF during come-out and returned, not lost.
      const table = TableMaker.getTable().value(); // point OFF
      const bet = new ComeBet(10, playerId);
      bet.point = 9; // simulate already-traveled bet
      bet.oddsAmount = 20;
      bet.evaluateDiceRoll({ die1: 0, die2: 7, sum: 7 }, table);
      expect(bet.amount).toBe(0);      // base lost
      expect(bet.oddsAmount).toBe(20); // odds returned, not lost
    });
  });
});
