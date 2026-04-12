import { CrapsEngine } from '../../src/engine/craps-engine';
import { ComeBet } from '../../src/bets/come-bet';
import { CrapsTable } from '../../src/craps-table';
import { RiggedDice } from '../dice/rigged-dice';
import { StrategyDefinition } from '../../src/dsl/strategy';

// ---------------------------------------------------------------------------
// Engine integration tests — come bet bankroll settlement
//
// These tests verify that the engine's settleBets() method correctly credits
// the player's bankroll for every come bet resolution scenario, including the
// come-out push (odds OFF, returned intact) that the unit tests cannot cover.
//
// Test parameters (flat come-bet-odds.md §§1–7 standing values):
//   flat wager : $10  (come bet amount)
//   come point : 9    (3:2 true-odds multiplier)
//   odds wager : $50  (oddsAmount; varies per test)
// ---------------------------------------------------------------------------

// Must match CrapsEngine's private playerId field.
const PLAYER_ID = 'engine-player';

const FLAT = 10;
const ODDS = 50;
const STARTING_BANKROLL = 200;
// Bankroll remaining after $10 flat + $50 odds are placed:
const AFTER_PLACEMENT = STARTING_BANKROLL - FLAT - ODDS; // 140

// ---------------------------------------------------------------------------
// Test helper
//
// Creates a CrapsEngine pre-loaded with an established come bet at point 9.
// The engine's running bankroll is reduced to reflect what was spent to place
// the flat bet and odds during the earlier (simulated) point-phase roll.
//
// The strategy declares the established bet each pre-roll reconciliation so
// the reconciler does not generate a remove command for it.
// ---------------------------------------------------------------------------

function makeEngine(options: {
  dice: number[];
  oddsAmount?: number;
  oddsWorking?: boolean;
  tablePoint?: number; // undefined → come-out (point OFF); set → point ON
}): { engine: CrapsEngine; comeBet: ComeBet } {
  const oddsAmount = options.oddsAmount ?? ODDS;
  const oddsWorking = options.oddsWorking ?? false;

  // Create the bet first so the strategy closure can reference it.
  const comeBet = new ComeBet(FLAT, PLAYER_ID);
  comeBet.point = 9;
  comeBet.oddsAmount = oddsAmount;
  comeBet.oddsWorking = oddsWorking;

  // Declare the established come bet in the reconciler's desired list so the
  // reconciler treats it as intentional and does not remove it before the roll.
  const strategy: StrategyDefinition = (ctx) => {
    (ctx.bets as any).desired.push({
      type: 'come',
      amount: comeBet.amount,
      point: comeBet.point,
      odds: comeBet.oddsAmount,
    });
  };

  const engine = new CrapsEngine({
    strategy,
    bankroll: STARTING_BANKROLL,
    rolls: options.dice.length,
    dice: new RiggedDice(options.dice),
  });

  // Wire in the pre-established come bet and set the table point.
  const table: CrapsTable = (engine as any).table;
  table.currentPoint = options.tablePoint;
  table.placeBet(comeBet);

  // Reflect the original placement cost in the engine's running bankroll.
  (engine as any).bankroll -= (FLAT + oddsAmount);

  return { engine, comeBet };
}

// ---------------------------------------------------------------------------
// Come-out roll — odds OFF (default)
// Table point is undefined (OFF); come bet is established at 9 with $50 odds.
// ---------------------------------------------------------------------------

describe('CrapsEngine — come bet bankroll settlement', () => {

  describe('come-out roll, odds OFF (default)', () => {

    // §§3.1–3.3, §6.2: seven during come-out → flat loses, odds pushed.
    // The engine must return the $50 odds to bankroll even though payOut is
    // undefined (this is the push path, not the win path).
    it('should return odds to bankroll when come-out 7 pushes the odds', () => {
      const { engine } = makeEngine({ dice: [7] }); // come-out (tablePoint: undefined)

      // Come-out 7 with odds OFF:
      //   flat $10 lost (already deducted at placement)
      //   odds $50 returned as push
      // Bankroll: 140 + 50 = 190
      const result = engine.run();
      expect(result.finalBankroll).toBe(190);
    });

    // §§2.1–2.3: own-point during come-out → flat wins 1:1, odds returned.
    // payOut = $10 (flat only). Settlement path: bankroll += amount + oddsAmount + payOut.
    it('should credit flat win + return odds when come-out own-point hits', () => {
      const { engine } = makeEngine({ dice: [9] }); // come-out, own point

      // Come-out 9 (own point) with odds OFF:
      //   flat $10 wins 1:1 → payOut = 10
      //   odds $50 returned (not paid)
      // Settlement: amount(10) + oddsAmount(50) + payOut(10) = 70
      // Bankroll: 140 + 70 = 210
      const result = engine.run();
      expect(result.finalBankroll).toBe(210);
    });
  });

  // ---------------------------------------------------------------------------
  // Come-out roll — odds WORKING (§5)
  // Player has declared odds working; they are live during the come-out roll.
  // ---------------------------------------------------------------------------

  describe('come-out roll, odds WORKING', () => {

    // §5.2: own-point + odds working → flat wins 1:1, odds win at true odds.
    // Point 9 pays 3:2: $50 odds → $75 profit. payOut = $10 + $75 = $85.
    it('should pay flat 1:1 + true odds when come-out own-point hits with odds working', () => {
      const { engine } = makeEngine({ dice: [9], oddsWorking: true });

      // payOut = 10 (flat) + 75 (3:2 on $50) = 85
      // Settlement: amount(10) + oddsAmount(50) + payOut(85) = 145
      // Bankroll: 140 + 145 = 285
      const result = engine.run();
      expect(result.finalBankroll).toBe(285);
    });

    // §5.3: seven + odds working → flat loses AND odds lose.
    it('should lose both flat and odds when come-out 7 with odds working', () => {
      const { engine } = makeEngine({ dice: [7], oddsWorking: true });

      // lose() → amount=0, oddsAmount=0. Nothing returned.
      // Bankroll: 140 (no change)
      const result = engine.run();
      expect(result.finalBankroll).toBe(140);
    });
  });

  // ---------------------------------------------------------------------------
  // Point phase (table point ON)
  // Come bet is established at 9 while the table point is at 6.
  // ---------------------------------------------------------------------------

  describe('point phase (table point ON)', () => {

    // True-odds win: come bet's own point (9, 3:2) overrides table point (6, 6:5).
    it('should pay true odds based on come bet own point (9, 3:2) not table point (6, 6:5)', () => {
      const { engine } = makeEngine({ dice: [9], tablePoint: 6 });

      // win(table): payOut = 10 (flat) + floor(50/2)*3 = 10 + 75 = 85
      // Settlement: amount(10) + oddsAmount(50) + payOut(85) = 145
      // Bankroll: 140 + 145 = 285
      const result = engine.run();
      expect(result.finalBankroll).toBe(285);
    });

    // Seven-out: flat always lost; odds OFF → returned to bankroll.
    it('should lose flat and return odds to bankroll on seven-out (odds OFF)', () => {
      const { engine } = makeEngine({ dice: [7], tablePoint: 6 });

      // Flat $10 taken (amount=0); odds $50 returned as push (amount===0 path).
      // Bankroll: 140 + 50 (odds returned) = 190
      const result = engine.run();
      expect(result.finalBankroll).toBe(190);
    });
  });
});
