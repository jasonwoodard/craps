import { PlaceBet } from "../src/bets/place-bet";
import { TableMaker } from "./table-maker/table-maker";

describe("PlaceBet", () => {

  describe("isOkayToPlace", () => {
    it("should allow placement on all valid point numbers", () => {
      const table = TableMaker.getTable().value();
      [4, 5, 6, 8, 9, 10].forEach(point => {
        const bet = new PlaceBet(10, point, "player1");
        expect(bet.isOkayToPlace(table)).toBe(true, `point ${point} should be valid`);
      });
    });

    it("should reject placement on non-point numbers", () => {
      const table = TableMaker.getTable().value();
      [2, 3, 7, 11, 12].forEach(point => {
        const bet = new PlaceBet(10, point, "player1");
        expect(bet.isOkayToPlace(table)).toBe(false, `point ${point} should be invalid`);
      });
    });
  });

  describe("evaluateDiceRoll — come-out (point OFF)", () => {
    it("should have no action when point is off, even if bet number rolled", () => {
      const table = TableMaker.getTable().value(); // point is OFF
      const bet = new PlaceBet(10, 6, "player1");
      bet.evaluateDiceRoll(6, table);
      expect(bet.amount).toBe(10);
      expect(bet.payOut).toBeUndefined();
    });

    it("should have no action on 7 when point is off", () => {
      const table = TableMaker.getTable().value(); // point is OFF
      const bet = new PlaceBet(10, 6, "player1");
      bet.evaluateDiceRoll(7, table);
      expect(bet.amount).toBe(10);
    });
  });

  describe("evaluateDiceRoll — point ON", () => {
    it("should win when bet number is rolled", () => {
      const table = TableMaker.getTable().withPoint(8).value(); // establishes any point
      const bet = new PlaceBet(12, 6, "player1");
      bet.evaluateDiceRoll(6, table);
      // 7:6 payout on 6: profit = floor(12 * 7/6) = 14, payOut = 12 + 14 = 26
      expect(bet.payOut).toBe(26);
      expect(bet.amount).toBe(12); // amount unchanged until table clears it
    });

    it("should lose (amount = 0) on 7-out", () => {
      const table = TableMaker.getTable().withPoint(8).value();
      const bet = new PlaceBet(10, 6, "player1");
      bet.evaluateDiceRoll(7, table);
      expect(bet.amount).toBe(0);
    });

    it("should have no action on unrelated numbers", () => {
      const table = TableMaker.getTable().withPoint(8).value();
      const bet = new PlaceBet(10, 6, "player1");
      [2, 3, 4, 5, 8, 9, 10, 11, 12].forEach(roll => {
        bet.evaluateDiceRoll(roll, table);
        expect(bet.amount).toBe(10, `should be unchanged on roll ${roll}`);
        expect(bet.payOut).toBeUndefined(`should have no payout on roll ${roll}`);
      });
    });
  });

  describe("computeWinAmount — payout math", () => {
    it("should pay 9:5 on 4 and 10", () => {
      // $10 bet: profit = floor(10 * 9/5) = 18
      expect(PlaceBet.computeWinAmount(10, 4)).toBe(18);
      expect(PlaceBet.computeWinAmount(10, 10)).toBe(18);

      // $25 bet: profit = floor(25 * 9/5) = 45
      expect(PlaceBet.computeWinAmount(25, 4)).toBe(45);
      expect(PlaceBet.computeWinAmount(25, 10)).toBe(45);
    });

    it("should pay 7:5 on 5 and 9", () => {
      // $10 bet: profit = floor(10 * 7/5) = 14
      expect(PlaceBet.computeWinAmount(10, 5)).toBe(14);
      expect(PlaceBet.computeWinAmount(10, 9)).toBe(14);

      // $25 bet: profit = floor(25 * 7/5) = 35
      expect(PlaceBet.computeWinAmount(25, 5)).toBe(35);
      expect(PlaceBet.computeWinAmount(25, 9)).toBe(35);
    });

    it("should pay 7:6 on 6 and 8", () => {
      // $12 bet: profit = floor(12 * 7/6) = 14
      expect(PlaceBet.computeWinAmount(12, 6)).toBe(14);
      expect(PlaceBet.computeWinAmount(12, 8)).toBe(14);

      // $6 bet: profit = floor(6 * 7/6) = 7
      expect(PlaceBet.computeWinAmount(6, 6)).toBe(7);
      expect(PlaceBet.computeWinAmount(6, 8)).toBe(7);
    });

    it("should floor partial chip payouts", () => {
      // $10 on 6: floor(10 * 7/6) = floor(11.67) = 11
      expect(PlaceBet.computeWinAmount(10, 6)).toBe(11);
      // $10 on 5: floor(10 * 7/5) = 14 (no fraction)
      expect(PlaceBet.computeWinAmount(10, 5)).toBe(14);
    });

    it("should throw on invalid point", () => {
      expect(() => PlaceBet.computeWinAmount(10, 7)).toThrow();
    });
  });

  describe("win", () => {
    it("should set payOut to amount plus profit", () => {
      const table = TableMaker.getTable().withPoint(8).value();
      const bet = new PlaceBet(10, 8, "player1");
      bet.win(table);
      // 7:6 on 8: profit = floor(10 * 7/6) = 11, payOut = 10 + 11 = 21
      expect(bet.payOut).toBe(21);
    });
  });

  describe("lose", () => {
    it("should zero out the bet amount", () => {
      const bet = new PlaceBet(30, 6, "player1");
      bet.lose();
      expect(bet.amount).toBe(0);
    });
  });
});
