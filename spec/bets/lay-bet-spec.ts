import { LayBet } from "../../src/bets/lay-bet";
import { TableMaker } from "../table-maker/table-maker";

describe("LayBet", () => {
  // Note: lay-bet vig follows the standard lay convention — 5% of the WIN
  // amount (not the lay amount), charged on win only. This differs from
  // BuyBet, whose vig is 5% of the bet.

  describe("isOkayToPlace", () => {
    it("should allow placement on all valid lay numbers", () => {
      const table = TableMaker.getTable().value();
      [4, 5, 6, 8, 9, 10].forEach(point => {
        const bet = new LayBet(40, point, "player1");
        expect(bet.isOkayToPlace(table)).toBe(true, `point ${point} should be valid`);
      });
    });

    it("should throw on invalid lay numbers at construction", () => {
      [2, 3, 7, 11, 12].forEach(point => {
        expect(() => new LayBet(40, point, "player1")).toThrow();
      });
    });
  });

  describe("payout math — lay more to win less, vig on win only", () => {
    it("$40 Lay 4/10 wins $20 minus $1 vig → payOut $59", () => {
      const table = TableMaker.getTable().withPoint(6).value();
      [4, 10].forEach(point => {
        const bet = new LayBet(40, point, "player1");
        bet.evaluateDiceRoll({ die1: 3, die2: 4, sum: 7 }, table);
        expect(bet.payOut).toBe(40 + 20 - 1, `point ${point}`);
      });
    });

    it("$30 Lay 5/9 wins $20 minus $1 vig → payOut $49", () => {
      const table = TableMaker.getTable().withPoint(6).value();
      [5, 9].forEach(point => {
        const bet = new LayBet(30, point, "player1");
        bet.evaluateDiceRoll({ die1: 3, die2: 4, sum: 7 }, table);
        expect(bet.payOut).toBe(30 + 20 - 1, `point ${point}`);
      });
    });

    it("$24 Lay 6/8 wins $20 minus $1 vig → payOut $43", () => {
      const table = TableMaker.getTable().withPoint(4).value();
      [6, 8].forEach(point => {
        const bet = new LayBet(24, point, "player1");
        bet.evaluateDiceRoll({ die1: 3, die2: 4, sum: 7 }, table);
        expect(bet.payOut).toBe(24 + 20 - 1, `point ${point}`);
      });
    });
  });

  describe("evaluateDiceRoll", () => {
    it("loses (amount = 0) when the lay number rolls, no vig charged", () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new LayBet(40, 4, "player1");
      bet.evaluateDiceRoll({ die1: 2, die2: 2, sum: 4 }, table);
      expect(bet.amount).toBe(0);
      expect(bet.payOut).toBeUndefined();
    });

    it("is always working — wins on 7 even during come-out (point OFF)", () => {
      const table = TableMaker.getTable().value(); // point OFF
      const bet = new LayBet(40, 4, "player1");
      bet.evaluateDiceRoll({ die1: 3, die2: 4, sum: 7 }, table);
      expect(bet.payOut).toBe(59);
    });

    it("has no action on unrelated numbers", () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new LayBet(40, 4, "player1");
      [2, 3, 5, 6, 8, 9, 10, 11, 12].forEach(sum => {
        bet.evaluateDiceRoll({ die1: 1, die2: sum - 1, sum }, table);
        expect(bet.amount).toBe(40, `should be unchanged on roll ${sum}`);
        expect(bet.payOut).toBeUndefined(`should have no payout on roll ${sum}`);
      });
    });
  });
});
