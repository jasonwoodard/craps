/**
 * Unit-system spec — the no-change proof.
 *
 * Every dollar figure in cats-strategy.md v1.2 must be reproduced exactly at
 * $10 and $15 table minimums. If any figure at $10 differs from the doc,
 * that is a regression in the unit module — fix the module, never this spec.
 */
import { catsUnits, batsUnits, minPlaceBet, placeStep } from '../../src/dsl/units';
import { CATS } from '../../src/dsl/strategies-staged';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { RiggedDice } from '../dice/rigged-dice';

describe('unit system', () => {

  describe('minPlaceBet', () => {
    it('is the smallest proper multiple at or above the table minimum', () => {
      expect(minPlaceBet(6, 10)).toBe(12);
      expect(minPlaceBet(8, 10)).toBe(12);
      expect(minPlaceBet(6, 15)).toBe(18);
      expect(minPlaceBet(8, 15)).toBe(18);
      expect(minPlaceBet(5, 10)).toBe(10);
      expect(minPlaceBet(9, 10)).toBe(10);
      expect(minPlaceBet(4, 15)).toBe(15);
      expect(minPlaceBet(10, 15)).toBe(15);
      expect(minPlaceBet(5, 25)).toBe(25);
      expect(minPlaceBet(6, 25)).toBe(30);
    });

    it('placeStep is $6 on 6/8 and $5 elsewhere', () => {
      expect(placeStep(6)).toBe(6);
      expect(placeStep(8)).toBe(6);
      [4, 5, 9, 10].forEach(n => expect(placeStep(n)).toBe(5));
    });
  });

  describe('CATS units at a $10 table (v1.2 doc figures, exact)', () => {
    const u = catsUnits(10);

    it('gates: $70 / $150 / $250 / $400 (7u/15u/25u/40u)', () => {
      expect(u.gates.littleMolly).toBe(70);
      expect(u.gates.threePtMolly).toBe(150);
      expect(u.gates.expandedAlpha).toBe(250);
      expect(u.gates.maxAlpha).toBe(400);
    });

    it('flats and odds: $10 flat, $20 Little odds, $50 Loose odds', () => {
      expect(u.flat).toBe(10);
      expect(u.oddsLittle).toBe(20);
      expect(u.oddsLoose).toBe(50);
    });

    it('tight tier: 30/20/10 sweet, 20/10/10 middle, 10/10/10 rough', () => {
      expect(u.tier.sweet).toEqual({ passLine: 30, come1: 20, come2: 10 });
      expect(u.tier.middle).toEqual({ passLine: 20, come1: 10, come2: 10 });
      expect(u.tier.rough).toEqual({ passLine: 10, come1: 10, come2: 10 });
    });

    it('buys $20; accumulator $18 → $12; mode shift $200; risk $300; hard reset $20', () => {
      expect(u.buyAmount).toBe(20);
      expect(u.accumulatorStart).toBe(18);
      expect(u.accumulatorRegressed).toBe(12);
      expect(u.modeShiftCushion).toBe(200);
      expect(u.classicRisk).toBe(300);
      expect(u.hardReset).toBe(20);
    });

    it('reference funded configs (v4 §4): $200 @ Tight, $150 @ Little Molly', () => {
      expect(u.referenceFunded.tight).toBe(200);
      expect(u.referenceFunded.littleMolly).toBe(150);
    });

    it('stage loads: Little $60, Loose $180, Expanded $220, Max $260', () => {
      expect(2 * u.flat + 2 * u.oddsLittle).toBe(60);
      expect(3 * u.flat + 3 * u.oddsLoose).toBe(180);
      expect(3 * u.flat + 3 * u.oddsLoose + 2 * u.buyAmount).toBe(220);
      expect(3 * u.flat + 3 * u.oddsLoose + 4 * u.buyAmount).toBe(260);
      expect(2 * u.accumulatorStart).toBe(36);
      expect(2 * u.accumulatorRegressed).toBe(24);
    });
  });

  describe('CATS units at a $15 table (v1.2 §3.1/§3.2 $15 columns, exact)', () => {
    const u = catsUnits(15);

    it('gates: $105 / $225 / $375 / $600', () => {
      expect(u.gates.littleMolly).toBe(105);
      expect(u.gates.threePtMolly).toBe(225);
      expect(u.gates.expandedAlpha).toBe(375);
      expect(u.gates.maxAlpha).toBe(600);
    });

    it('flats and odds: $15 flat, $30 Little odds, $75 Loose odds', () => {
      expect(u.flat).toBe(15);
      expect(u.oddsLittle).toBe(30);
      expect(u.oddsLoose).toBe(75);
    });

    it('tight tier: 45/30/15 sweet', () => {
      expect(u.tier.sweet).toEqual({ passLine: 45, come1: 30, come2: 15 });
    });

    it('buys $30; accumulator $24 → $18; risk $450', () => {
      expect(u.buyAmount).toBe(30);
      expect(u.accumulatorStart).toBe(24);
      expect(u.accumulatorRegressed).toBe(18);
      expect(u.classicRisk).toBe(450);
    });

    it('reference funded configs (v4 §4): $300 @ Tight, $225 @ Little Molly', () => {
      expect(u.referenceFunded.tight).toBe(300);
      expect(u.referenceFunded.littleMolly).toBe(225);
    });

    it('stage loads: Little $90, Loose $270, Expanded $330, Max $390', () => {
      expect(2 * u.flat + 2 * u.oddsLittle).toBe(90);
      expect(3 * u.flat + 3 * u.oddsLoose).toBe(270);
      expect(3 * u.flat + 3 * u.oddsLoose + 2 * u.buyAmount).toBe(330);
      expect(3 * u.flat + 3 * u.oddsLoose + 4 * u.buyAmount).toBe(390);
      expect(2 * u.accumulatorStart).toBe(48);
      expect(2 * u.accumulatorRegressed).toBe(36);
    });
  });

  describe('BATS units', () => {
    it('reproduces the v1.x $10 gate ladder exactly', () => {
      const b = batsUnits(10);
      expect(b.gates.littleDolly).toBe(120);
      expect(b.gates.threePtDolly).toBe(225);
      expect(b.gates.expandedDarkAlpha).toBe(350);
      expect(b.gates.maxDarkAlpha).toBe(500);
      expect(b.flat).toBe(10);
      expect(b.layWinAccumulator).toBe(10);
      expect(b.layWinDolly).toBe(20);
      expect(b.layWinThreePt).toBe(50);
      expect(b.layWinStandalone).toBe(20);
    });

    it('scales to $15 (gates rounded to the dollar)', () => {
      const b = batsUnits(15);
      expect(b.gates.littleDolly).toBe(180);
      expect(b.gates.threePtDolly).toBe(338); // 22.5u rounded
      expect(b.gates.expandedDarkAlpha).toBe(525);
      expect(b.gates.maxDarkAlpha).toBe(750);
      expect(b.layWinThreePt).toBe(75);
    });
  });

  describe('CATS at $15 (engine smoke)', () => {
    it('opens the Accumulator at $24 each on 6/8', () => {
      const dice = new RiggedDice([4, 5]);
      const engine = new CrapsEngine({ strategy: CATS({ tableMin: 15 }), bankroll: 450, rolls: 2, dice });
      const result = engine.run();
      const bets = result.rolls[0].activeBets;
      expect(bets.find(b => b.type === 'place' && b.point === 6)!.amount).toBe(24);
      expect(bets.find(b => b.type === 'place' && b.point === 8)!.amount).toBe(24);
    });

    it('runs 2000 rolls without throwing', () => {
      const engine = new CrapsEngine({ strategy: CATS({ tableMin: 15 }), bankroll: 450, rolls: 2000, seed: 7 });
      expect(() => engine.run()).not.toThrow();
    });
  });
});
