import { BuyBet } from "../../src/bets/buy-bet";
import { TableMaker } from "../table-maker/table-maker";
import { LiveDice } from "../../src/dice/dice";

describe("BuyBet", () => {

  describe("isOkayToPlace", () => {
    it("should allow placement on all valid buy numbers", () => {
      const table = TableMaker.getTable().value();
      [4, 5, 6, 8, 9, 10].forEach(point => {
        const bet = new BuyBet(20, point, "player1");
        expect(bet.isOkayToPlace(table)).toBe(true, `point ${point} should be valid`);
      });
    });

    it("should throw on invalid buy numbers at construction", () => {
      [2, 3, 7, 11, 12].forEach(point => {
        expect(() => new BuyBet(20, point, "player1")).toThrow();
      });
    });
  });

  describe("evaluateDiceRoll — come-out (point OFF)", () => {
    it("should have no action when point is off, even if bet number rolled", () => {
      const table = TableMaker.getTable().value(); // point is OFF
      const bet = new BuyBet(20, 4, "player1");
      bet.evaluateDiceRoll({ die1: 2, die2: 2, sum: 4 }, table);
      expect(bet.amount).toBe(20);
      expect(bet.payOut).toBeUndefined();
    });

    it("should have no action on 7 when point is off", () => {
      const table = TableMaker.getTable().value(); // point is OFF
      const bet = new BuyBet(20, 4, "player1");
      bet.evaluateDiceRoll({ die1: 1, die2: 6, sum: 7 }, table);
      expect(bet.amount).toBe(20);
    });
  });

  describe("payout math — vig is 5% of the BET, charged on win only", () => {
    // payOut includes the original stake; profit = payOut - amount.

    it("$20 Buy 4/10 nets $39: win $40 at 2:1 minus $1 vig (5% of $20)", () => {
      const table = TableMaker.getTable().withPoint(6).value();
      [4, 10].forEach(point => {
        const bet = new BuyBet(20, point, "player1");
        bet.evaluateDiceRoll({ die1: point / 2, die2: point / 2, sum: point }, table);
        expect(bet.payOut).toBe(20 + 39, `point ${point}`);
      });
    });

    it("$20 Buy 5/9 nets $29: win $30 at 3:2 minus $1 vig (5% of $20)", () => {
      const table = TableMaker.getTable().withPoint(6).value();
      [5, 9].forEach(point => {
        const bet = new BuyBet(20, point, "player1");
        bet.evaluateDiceRoll({ die1: 2, die2: point - 2, sum: point }, table);
        expect(bet.payOut).toBe(20 + 29, `point ${point}`);
      });
    });

    it("$25 Buy 4/10 nets $49: win $50 at 2:1 minus $1 vig (floor of 5% of $25)", () => {
      const table = TableMaker.getTable().withPoint(6).value();
      [4, 10].forEach(point => {
        const bet = new BuyBet(25, point, "player1");
        bet.evaluateDiceRoll({ die1: point / 2, die2: point / 2, sum: point }, table);
        expect(bet.payOut).toBe(25 + 49, `point ${point}`);
      });
    });

    it("$25 Buy 5/9 nets $36: win $37 at 3:2 (floored) minus $1 vig", () => {
      const table = TableMaker.getTable().withPoint(6).value();
      [5, 9].forEach(point => {
        const bet = new BuyBet(25, point, "player1");
        bet.evaluateDiceRoll({ die1: 2, die2: point - 2, sum: point }, table);
        // true-odds win = floor(25 * 3/2) = 37; vig = floor(25 * 0.05) = 1
        expect(bet.payOut).toBe(25 + 36, `point ${point}`);
      });
    });

    it("charges a $1 minimum vig on small bets", () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new BuyBet(10, 4, "player1");
      bet.win(table);
      // win = $20, vig = max(1, floor(10 * 0.05)) = $1 → payOut = 10 + 20 - 1
      expect(bet.payOut).toBe(29);
    });
  });

  describe("lose", () => {
    it("should zero out the bet with no vig charged on a loss", () => {
      const table = TableMaker.getTable().withPoint(6).value();
      const bet = new BuyBet(20, 4, "player1");
      bet.evaluateDiceRoll({ die1: 1, die2: 6, sum: 7 }, table);
      expect(bet.amount).toBe(0);
      expect(bet.payOut).toBeUndefined();
    });
  });

  describe("long-run empirical edge (seeded, deterministic)", () => {
    // Resolve fresh $20 buy bets against seeded dice with the point ON until
    // N resolutions are reached, then compare the empirical edge per resolved
    // bet against the theoretical win-only-vig values:
    //   Buy 4/10: 1.67% of the bet per resolution
    //   Buy 5/9:  2.00% of the bet per resolution
    // Deterministic seed, 200k resolutions → sampling error well inside ±0.3pp.
    function empiricalEdge(point: number, resolutions: number, seed: number): number {
      const table = TableMaker.getTable().withPoint(6).value();
      const dice = new LiveDice(seed);
      let net = 0;
      let resolved = 0;
      let bet = new BuyBet(20, point, "player1");
      while (resolved < resolutions) {
        const roll = dice.roll();
        dice.rollHistory.length = 0; // keep memory flat over millions of rolls
        if (roll.sum !== point && roll.sum !== 7) continue;
        bet.evaluateDiceRoll(roll, table);
        if ((bet.payOut ?? 0) > 0) {
          net += (bet.payOut! - 20);
        } else {
          net -= 20;
        }
        resolved++;
        bet = new BuyBet(20, point, "player1");
      }
      // Edge = expected loss per dollar wagered per resolution (positive = house).
      return -net / (resolutions * 20);
    }

    it("Buy 4 shows ~1.67% house edge over 200k resolutions", () => {
      const edge = empiricalEdge(4, 200000, 12345);
      expect(Math.abs(edge - 0.0167)).toBeLessThan(0.003);
    });

    it("Buy 10 shows ~1.67% house edge over 200k resolutions", () => {
      const edge = empiricalEdge(10, 200000, 54321);
      expect(Math.abs(edge - 0.0167)).toBeLessThan(0.003);
    });

    it("Buy 5 shows ~2.00% house edge over 200k resolutions", () => {
      const edge = empiricalEdge(5, 200000, 777);
      expect(Math.abs(edge - 0.02)).toBeLessThan(0.003);
    });

    it("Buy 9 shows ~2.00% house edge over 200k resolutions", () => {
      const edge = empiricalEdge(9, 200000, 999);
      expect(Math.abs(edge - 0.02)).toBeLessThan(0.003);
    });
  });
});
