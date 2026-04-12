/**
 * Integration tests: Scenarios 028–032 — Buy Bets
 * Source of truth: docs/testing/integration-scenarios.md
 *
 * BuyBet is implemented in src/bets/buy-bet.ts.
 * Vig = Math.max(1, Math.floor(winAmount × 0.05)); charged on win only.
 */

import { PassLineBet } from '../../src/bets/pass-line-bet';
import { BuyBet } from '../../src/bets/buy-bet';
import { ScenarioTable } from './helpers/scenario-helper';

describe('Integration — Buy Bets (Scenarios 028–032)', () => {

  it('Scenario 028 — Buy 4, Hit (Vig on Win Only)', () => {
    // Point: 6. Buy 4 for $20. True odds 2:1 → win $40. Vig = floor($40×0.05) = $2. Net $38.
    // payOut = $20 + $38 = $58. Then 7-out takes pass line.
    const s = new ScenarioTable(100, [6, 4, 7]);
    const pl = new PassLineBet(10, 'player');
    const b4 = new BuyBet(20, 4, 'player');

    s.bet(pl);                          // −$10; rail $90
    s.roll();                            // roll 6 → point on
    s.bet(b4);                           // −$20; rail $70
    s.roll();                            // roll 4 → buy hits; rail += $58 → $128
    s.roll();                            // roll 7 → seven-out; pass lost (already deducted)
    s.expectRail(128);
  });

  it('Scenario 029 — Buy 10, Hit (Vig on Win Only)', () => {
    // Point: 6. Buy 10 for $20. True odds 2:1 → win $40. Vig $2. Net $38.
    // payOut = $58. Then 7-out.
    const s = new ScenarioTable(100, [6, 10, 7]);
    const pl = new PassLineBet(10, 'player');
    const b10 = new BuyBet(20, 10, 'player');

    s.bet(pl);                           // −$10; rail $90
    s.roll();                             // roll 6 → point on
    s.bet(b10);                           // −$20; rail $70
    s.roll();                             // roll 10 → buy hits; rail += $58 → $128
    s.roll();                             // roll 7 → seven-out
    s.expectRail(128);
  });

  it('Scenario 030 — Buy 4, Seven-Out (No Vig Charged)', () => {
    // Point: 6. Buy 4 for $20. Seven-out before 4. No vig on loss.
    // Both bets lost. Down $30.
    const s = new ScenarioTable(100, [6, 9, 7]);
    const pl = new PassLineBet(10, 'player');
    const b4 = new BuyBet(20, 4, 'player');

    s.bet(pl);                           // −$10; rail $90
    s.roll();                             // roll 6 → point on
    s.bet(b4);                            // −$20; rail $70
    s.roll();                             // roll 9 → no action
    s.roll();                             // roll 7 → seven-out; both lost (no rail change)
    s.expectRail(70);
  });

  it('Scenario 031 — Buy 5, Hit (Vig on Win Only)', () => {
    // Point: 6. Buy 5 for $20. True odds 3:2 → win $30. Vig = floor($30×0.05) = $1. Net $29.
    // payOut = $20 + $29 = $49. Then 7-out.
    const s = new ScenarioTable(100, [6, 5, 7]);
    const pl = new PassLineBet(10, 'player');
    const b5 = new BuyBet(20, 5, 'player');

    s.bet(pl);                           // −$10; rail $90
    s.roll();                             // roll 6 → point on
    s.bet(b5);                            // −$20; rail $70
    s.roll();                             // roll 5 → buy hits; rail += $49 → $119
    s.roll();                             // roll 7 → seven-out; pass lost
    s.expectRail(119);
  });

  it('Scenario 032 — Buy 9, Seven-Out (No Vig Charged)', () => {
    // Point: 6. Buy 9 for $20. Seven-out immediately. No vig.
    // Both lost. Down $30.
    const s = new ScenarioTable(100, [6, 7]);
    const pl = new PassLineBet(10, 'player');
    const b9 = new BuyBet(20, 9, 'player');

    s.bet(pl);                           // −$10; rail $90
    s.roll();                             // roll 6 → point on
    s.bet(b9);                            // −$20; rail $70
    s.roll();                             // roll 7 → seven-out; both lost
    s.expectRail(70);
  });
});
