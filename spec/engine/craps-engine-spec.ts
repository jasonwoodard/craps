import { CrapsEngine } from '../../src/engine/craps-engine';
import { StrategyDefinition } from '../../src/dsl/strategy';
import { RiggedDice } from '../dice/rigged-dice';
import { BetTypes } from '../../src/bets/base-bet';

// --- Strategy fixtures ---

const PassLineOnly: StrategyDefinition = ({ bets }) => {
  bets.passLine(10);
};

const PassLineWithOdds: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(20);
};

const Place6And8: StrategyDefinition = ({ bets }) => {
  bets.place(6, 12);
  bets.place(8, 12);
};

const PassLineAndPlace68: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(20);
  bets.place(6, 12);
  bets.place(8, 12);
};

describe('CrapsEngine', () => {

  // --- Come-out phase tests ---

  describe('come-out phase', () => {
    it('should pay even money on a come-out 7 (natural)', () => {
      const dice = new RiggedDice([7]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 1,
        dice,
      });

      const result = engine.run();

      expect(result.rollsPlayed).toBe(1);
      expect(result.rolls[0].rollValue).toBe(7);
      expect(result.rolls[0].outcomes.length).toBe(1);
      expect(result.rolls[0].outcomes[0].result).toBe('win');
      expect(result.rolls[0].outcomes[0].betType).toBe(BetTypes.PASS_LINE);
      // Bankroll: 500 - 10 (bet) + 10 (original back) + 10 (profit) = 510
      expect(result.finalBankroll).toBe(510);
    });

    it('should pay even money on a come-out 11 (yo)', () => {
      const dice = new RiggedDice([11]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 1,
        dice,
      });

      const result = engine.run();
      expect(result.finalBankroll).toBe(510);
      expect(result.rolls[0].outcomes[0].result).toBe('win');
    });

    it('should lose pass line on come-out 2 (craps)', () => {
      const dice = new RiggedDice([2]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 1,
        dice,
      });

      const result = engine.run();
      expect(result.finalBankroll).toBe(490);
      expect(result.rolls[0].outcomes[0].result).toBe('loss');
    });

    it('should lose pass line on come-out 3 (craps)', () => {
      const dice = new RiggedDice([3]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 1,
        dice,
      });

      const result = engine.run();
      expect(result.finalBankroll).toBe(490);
    });

    it('should lose pass line on come-out 12 (craps)', () => {
      const dice = new RiggedDice([12]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 1,
        dice,
      });

      const result = engine.run();
      expect(result.finalBankroll).toBe(490);
    });

    it('should establish a point on come-out 6', () => {
      // Roll 6 (point set), then roll 5 (no resolution)
      const dice = new RiggedDice([6, 5]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // First roll: point established
      expect(result.rolls[0].pointBefore).toBeUndefined();
      expect(result.rolls[0].pointAfter).toBe(6);
      expect(result.rolls[0].outcomes.length).toBe(0);
      // Second roll: 5 doesn't resolve anything
      expect(result.rolls[1].outcomes.length).toBe(0);
      // Bankroll: 500 - 10 (bet placed once, stays on table) = 490
      expect(result.finalBankroll).toBe(490);
    });
  });

  // --- Point phase tests ---

  describe('point phase', () => {
    it('should pay pass line when point is made', () => {
      // Roll 4 (point), roll 4 (hit the point)
      const dice = new RiggedDice([4, 4]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      expect(result.rolls[0].pointAfter).toBe(4);
      expect(result.rolls[1].outcomes.length).toBe(1);
      expect(result.rolls[1].outcomes[0].result).toBe('win');
      // Bankroll: 500 - 10 + 10 + 10 = 510
      expect(result.finalBankroll).toBe(510);
    });

    it('should lose pass line on seven-out', () => {
      // Roll 8 (point), roll 7 (seven-out)
      const dice = new RiggedDice([8, 7]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      expect(result.rolls[0].pointAfter).toBe(8);
      expect(result.rolls[1].outcomes.length).toBe(1);
      expect(result.rolls[1].outcomes[0].result).toBe('loss');
      // Bankroll: 500 - 10 = 490
      expect(result.finalBankroll).toBe(490);
    });

    it('should pay correct odds on point 4 (2:1)', () => {
      // Roll 4 (point), roll 4 (hit)
      const dice = new RiggedDice([4, 4]);
      const engine = new CrapsEngine({
        strategy: PassLineWithOdds,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Bet: 10 flat + 20 odds = 30 deducted
      // Win: payOut = 10 (flat profit) + 20*2 = 50 (odds on 4/10 pay 2:1)
      // Settle: 10 (flat back) + 20 (odds back) + 50 (payOut) = 80
      // Final: 500 - 30 + 80 = 550
      expect(result.finalBankroll).toBe(550);
    });

    it('should pay correct odds on point 5 (3:2)', () => {
      // Roll 5 (point), roll 5 (hit)
      const dice = new RiggedDice([5, 5]);
      const engine = new CrapsEngine({
        strategy: PassLineWithOdds,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Bet: 10 flat + 20 odds = 30 deducted
      // Win: payOut = 10 (flat) + floor(20/2)*3 = 10 + 30 = 40
      // Settle: 10 + 20 + 40 = 70
      // Final: 500 - 30 + 70 = 540
      expect(result.finalBankroll).toBe(540);
    });

    it('should pay correct odds on point 6 (6:5)', () => {
      // Roll 6 (point), roll 6 (hit)
      const dice = new RiggedDice([6, 6]);
      const engine = new CrapsEngine({
        strategy: PassLineWithOdds,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Bet: 10 flat + 20 odds = 30 deducted
      // Win: payOut = 10 (flat) + floor(20/5)*6 = 10 + 24 = 34
      // Settle: 10 + 20 + 34 = 64
      // Final: 500 - 30 + 64 = 534
      expect(result.finalBankroll).toBe(534);
    });

    it('should pay correct odds on point 8 (6:5)', () => {
      const dice = new RiggedDice([8, 8]);
      const engine = new CrapsEngine({
        strategy: PassLineWithOdds,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Same as point 6: 6:5 odds
      expect(result.finalBankroll).toBe(534);
    });

    it('should pay correct odds on point 9 (3:2)', () => {
      const dice = new RiggedDice([9, 9]);
      const engine = new CrapsEngine({
        strategy: PassLineWithOdds,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Same as point 5: 3:2 odds
      expect(result.finalBankroll).toBe(540);
    });

    it('should pay correct odds on point 10 (2:1)', () => {
      const dice = new RiggedDice([10, 10]);
      const engine = new CrapsEngine({
        strategy: PassLineWithOdds,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Same as point 4: 2:1 odds
      expect(result.finalBankroll).toBe(550);
    });

    it('should lose odds bet on seven-out', () => {
      const dice = new RiggedDice([6, 7]);
      const engine = new CrapsEngine({
        strategy: PassLineWithOdds,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Bet: 10 flat + 20 odds = 30 deducted
      // Seven-out: lose everything
      // Final: 500 - 30 = 470
      expect(result.finalBankroll).toBe(470);
    });
  });

  // --- Place bet tests ---

  describe('place bets', () => {
    it('should pay 7:6 on place 6 win', () => {
      // Roll 4 (establish point so place bets are active), roll 6 (place 6 wins)
      const dice = new RiggedDice([4, 6]);
      const engine = new CrapsEngine({
        strategy: Place6And8,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Bet: 12 on 6 + 12 on 8 = 24 deducted
      // Roll 4: point set, place bets "off" on comeout, no action
      // Roll 6: place 6 wins. payOut = 12 + floor(12*7/6) = 12 + 14 = 26
      // Settle place win: bankroll += 26 (payOut includes original)
      // Place 8 still on table (12)
      // Final: 500 - 24 + 26 = 502
      expect(result.finalBankroll).toBe(502);
      expect(result.rolls[1].outcomes.length).toBe(1);
      expect(result.rolls[1].outcomes[0].result).toBe('win');
      expect(result.rolls[1].outcomes[0].betType).toBe(BetTypes.PLACE);
    });

    it('should pay 7:6 on place 8 win', () => {
      const dice = new RiggedDice([4, 8]);
      const engine = new CrapsEngine({
        strategy: Place6And8,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Same payout as 6: 7:6
      expect(result.finalBankroll).toBe(502);
    });

    it('should pay 7:5 on place 5 win', () => {
      const Place5: StrategyDefinition = ({ bets }) => { bets.place(5, 10); };
      const dice = new RiggedDice([4, 5]);
      const engine = new CrapsEngine({
        strategy: Place5,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // payOut = 10 + floor(10*7/5) = 10 + 14 = 24
      // Final: 500 - 10 + 24 = 514
      expect(result.finalBankroll).toBe(514);
    });

    it('should pay 9:5 on place 4 win', () => {
      // Need a different point so 4 doesn't set the point
      const Place4: StrategyDefinition = ({ bets }) => { bets.place(4, 10); };
      const dice = new RiggedDice([6, 4]);
      const engine = new CrapsEngine({
        strategy: Place4,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // payOut = 10 + floor(10*9/5) = 10 + 18 = 28
      // Final: 500 - 10 + 28 = 518
      expect(result.finalBankroll).toBe(518);
    });

    it('should lose place bets on seven-out', () => {
      const dice = new RiggedDice([4, 7]);
      const engine = new CrapsEngine({
        strategy: Place6And8,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Both place bets lose on seven-out
      // Final: 500 - 24 = 476
      expect(result.finalBankroll).toBe(476);
      expect(result.rolls[1].outcomes.length).toBe(2);
      expect(result.rolls[1].outcomes.every(o => o.result === 'loss')).toBe(true);
    });

    it('should not resolve place bets during come-out (off)', () => {
      // Roll 7 on comeout: place bets are off, pass line would win if present
      const dice = new RiggedDice([6]);
      const engine = new CrapsEngine({
        strategy: Place6And8,
        bankroll: 500,
        rolls: 1,
        dice,
      });

      const result = engine.run();
      // Come-out roll of 6 sets point. Place bets are "off" during comeout.
      // No place bet resolution.
      expect(result.rolls[0].outcomes.length).toBe(0);
    });
  });

  // --- Combined strategy tests ---

  describe('combined pass line + place bets', () => {
    it('should handle point-then-seven-out with both bet types', () => {
      // Roll 9 (point), roll 7 (seven-out: both pass line and place bets lose)
      const dice = new RiggedDice([9, 7]);
      const engine = new CrapsEngine({
        strategy: PassLineAndPlace68,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Deducted: 10 (pass) + 20 (odds) + 12 (place 6) + 12 (place 8) = 54
      // Seven-out: all bets lose
      // Final: 500 - 54 = 446
      expect(result.finalBankroll).toBe(446);
    });

    it('should pay place bet while point is still active', () => {
      // Roll 9 (point), roll 6 (place 6 wins, point still 9), roll 9 (point made)
      const dice = new RiggedDice([9, 6, 9]);
      const engine = new CrapsEngine({
        strategy: PassLineAndPlace68,
        bankroll: 500,
        rolls: 3,
        dice,
      });

      const result = engine.run();
      // Roll 1: Point 9 set. Bets placed: 10+20+12+12 = 54
      // Roll 2: 6 hits. Place 6 wins: payOut = 12 + 14 = 26. bankroll += 26
      //         After settle, place 6 is removed. Reconcile will re-place on next roll.
      // Roll 3: Reconcile re-places place 6 (12 deducted). Roll 9 hits the point.
      //         Pass line wins: payOut = 10 (flat) + floor(20/2)*3 = 10+30 = 40
      //         Settle pass line: bankroll += 10 + 20 + 40 = 70
      //         Place 8 and newly-placed place 6 remain (or may have outcomes)
      //
      // Let's compute step by step:
      // Start: 500
      // After roll 1 bets: 500 - 54 = 446
      // After roll 2 place 6 win: 446 + 26 = 472
      // Before roll 3 reconcile: re-place pass line (10+20) + place 6 (12) = 42 deducted
      //   Wait - pass line bet was already settled in roll 2? No, roll 2 was a 6, not 7 or point 9.
      //   So pass line bet: on roll 2, rollValue=6, point=9. 6 != 9 and 6 != 7 → no resolution.
      //   Pass line bet stays on table. No re-placement needed.
      //   Reconcile for roll 3: pass line already on table (no place command)
      //   Place 6 was settled/removed after win → reconcile re-places it: bankroll -= 12
      //   Place 8 still on table.
      //   bankroll before roll 3: 472 - 12 = 460
      // Roll 3: 9 hits point.
      //   Pass line wins: payOut = 10 + floor(20/2)*3 = 10 + 30 = 40
      //   Settle: bankroll += 10 + 20 + 40 = 70 → 460 + 70 = 530
      //   Place bets: point cleared → next roll is comeout. Place bets "off" during comeout,
      //     but roll 9 was the last roll and we're in point phase. Place bets during point:
      //     9 isn't 6 or 8 or 7 → no resolution for place bets.
      //
      // Final: 530 (with place 6 $12 and place 8 $12 still on table)
      expect(result.finalBankroll).toBe(530);
    });
  });

  // --- Multi-roll game tests ---

  describe('multi-roll games', () => {
    it('should handle consecutive come-out wins correctly', () => {
      // Three come-out 7s in a row
      const dice = new RiggedDice([7, 7, 7]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 3,
        dice,
      });

      const result = engine.run();
      // Each roll: bet 10, win 10. Net +10 each.
      // Final: 500 + 30 = 530
      expect(result.rollsPlayed).toBe(3);
      expect(result.finalBankroll).toBe(530);
    });

    it('should stop when bankroll is exhausted and no bets remain', () => {
      // Lose all money quickly
      const dice = new RiggedDice([2, 2, 2, 2, 2, 2]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 30,
        rolls: 10,
        dice,
      });

      const result = engine.run();
      // Lose 10 per roll on craps: 30 - 10 - 10 - 10 = 0
      expect(result.rollsPlayed).toBe(3);
      expect(result.finalBankroll).toBe(0);
    });

    it('should continue rolling with bets on table even if bankroll is 0', () => {
      // Bet all money on pass line, point is set, can't place more but must finish
      const dice = new RiggedDice([6, 6]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 10,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Roll 1: bet 10, bankroll = 0, point set to 6. Bet is on table.
      // shouldContinue: bankroll=0 but bets on table → continue
      // Roll 2: 6 hits point, pass line wins. bankroll = 0 + 10 + 10 = 20
      expect(result.rollsPlayed).toBe(2);
      expect(result.rolls[0].bankrollAfter).toBe(0);
      expect(result.finalBankroll).toBe(20);
    });

    it('should re-place pass line bet after a win', () => {
      // Win on comeout, then win again on next comeout
      const dice = new RiggedDice([7, 7]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Roll 1: bet 10, win 10 → 510. Bet settled and removed.
      // Roll 2: reconcile re-places pass line. bet 10, win 10 → 510
      expect(result.rollsPlayed).toBe(2);
      expect(result.finalBankroll).toBe(520);
    });
  });

  // --- Seed reproducibility ---

  describe('seed reproducibility', () => {
    it('should produce identical results with the same seed', () => {
      const strategy: StrategyDefinition = ({ bets }) => {
        bets.passLine(10);
        bets.place(6, 12);
        bets.place(8, 12);
      };

      const run1 = new CrapsEngine({
        strategy,
        bankroll: 500,
        rolls: 100,
        seed: 42,
      }).run();

      const run2 = new CrapsEngine({
        strategy,
        bankroll: 500,
        rolls: 100,
        seed: 42,
      }).run();

      expect(run1.finalBankroll).toBe(run2.finalBankroll);
      expect(run1.rollsPlayed).toBe(run2.rollsPlayed);
      for (let i = 0; i < run1.rollsPlayed; i++) {
        expect(run1.rolls[i].rollValue).toBe(run2.rolls[i].rollValue);
      }
    });

    it('should produce different results with different seeds', () => {
      const strategy: StrategyDefinition = ({ bets }) => {
        bets.passLine(10);
      };

      const run1 = new CrapsEngine({
        strategy,
        bankroll: 500,
        rolls: 1000,
        seed: 42,
      }).run();

      const run2 = new CrapsEngine({
        strategy,
        bankroll: 500,
        rolls: 1000,
        seed: 99,
      }).run();

      // With enough rolls and different seeds, results should differ
      const rolls1 = run1.rolls.map(r => r.rollValue);
      const rolls2 = run2.rolls.map(r => r.rollValue);
      expect(rolls1).not.toEqual(rolls2);
    });
  });

  // --- RollRecord structure ---

  describe('RollRecord structure', () => {
    it('should track bankroll before and after each roll', () => {
      const dice = new RiggedDice([7, 2]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 2,
        dice,
      });

      const result = engine.run();
      // Roll 1: comeout 7, win
      expect(result.rolls[0].bankrollBefore).toBe(500);
      expect(result.rolls[0].bankrollAfter).toBe(510);
      // Roll 2: comeout 2, loss
      expect(result.rolls[1].bankrollBefore).toBe(510);
      expect(result.rolls[1].bankrollAfter).toBe(500);
    });

    it('should record point transitions correctly', () => {
      const dice = new RiggedDice([6, 5, 7]);
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 3,
        dice,
      });

      const result = engine.run();
      // Roll 1: comeout 6, point set
      expect(result.rolls[0].pointBefore).toBeUndefined();
      expect(result.rolls[0].pointAfter).toBe(6);
      // Roll 2: 5, point unchanged
      expect(result.rolls[1].pointBefore).toBe(6);
      expect(result.rolls[1].pointAfter).toBe(6);
      // Roll 3: 7, seven-out, point cleared
      expect(result.rolls[2].pointBefore).toBe(6);
      expect(result.rolls[2].pointAfter).toBeUndefined();
    });
  });
});
