/**
 * Integration tests: Scenarios 011–019 — Come Bets
 * Source of truth: docs/testing/integration-scenarios.md
 *
 * Known failing scenarios (bugs in implementation):
 *   015, 018, 019 — ComeBet.lose() zeros oddsAmount on seven-out, so come odds
 *                   are never pushed (returned) — they are lost instead.
 *   017            — Same seven-out bug affects the first half; the come-out
 *                   phase that follows may also be impacted.
 */

import { PassLineBet } from '../../src/bets/pass-line-bet';
import { ComeBet } from '../../src/bets/come-bet';
import { ScenarioTable } from './helpers/scenario-helper';

describe('Integration — Come Bets (Scenarios 011–019)', () => {

  it('Scenario 011 — Come Bet, Natural During Travel (7)', () => {
    // Come natural on 7 wins; 7 is also a seven-out, pass line loses. Net: flat.
    const s = new ScenarioTable(100, [6, 7]);
    const pl = new PassLineBet(10, 'player');
    const cm = new ComeBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 6 → point established
    s.bet(cm).expectRail(80);          // Step 3
    s.roll();                           // Step 4: roll 7 → come wins (+$20), pass loses
    // come win: rail += $10 + $0 + $10 = +$20 → $100; pass loss: no further change
    // Document shows $90 at step 7 ("takes $10 pass line") but that is a double-deduction;
    // the pass line was already deducted at placement. Correct final = $100.
    s.expectRail(100);                 // Steps 5–7: come +$10 net, pass -$10 net = flat on $100
  });

  it('Scenario 012 — Come Bet, Craps During Travel (2)', () => {
    // Come loses on 2 during transit. Pass line unaffected. Down $20 total.
    const s = new ScenarioTable(100, [8, 2]);
    const pl = new PassLineBet(10, 'player');
    const cm = new ComeBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 8 → point established
    s.bet(cm).expectRail(80);          // Step 3
    s.roll().expectRail(80);           // Step 4–5: roll 2 → come taken (no rail change)
  });

  it('Scenario 013 — Come Bet, Point Established Then Made (flat only)', () => {
    // Come point 5. No odds. Come wins $10. Pass line still active.
    const s = new ScenarioTable(100, [8, 5, 9, 5]);
    const pl = new PassLineBet(10, 'player');
    const cm = new ComeBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 8 → point established
    s.bet(cm).expectRail(80);          // Step 3
    s.roll().expectRail(80);           // Step 4: roll 5 → come point 5 established
    s.roll().expectRail(80);           // Step 5: roll 9 → no action
    s.roll();                           // Step 6: roll 5 → come point made
    // come win: rail += $10 + $0 + $10 = +$20 → $100
    s.expectRail(100);                 // Steps 7–8: net +$10 on come
  });

  it('Scenario 014 — Come Bet + Odds, Point Made (9)', () => {
    // Come point 9. $30 odds at 3:2 → $45. Total come profit $55.
    const s = new ScenarioTable(100, [6, 9, 4, 9]);
    const pl = new PassLineBet(10, 'player');
    const cm = new ComeBet(10, 'player');

    s.bet(pl).expectRail(90);           // Step 1
    s.roll().expectRail(90);            // Step 2: roll 6 → point established
    s.bet(cm).expectRail(80);           // Step 3
    s.roll().expectRail(80);            // Step 4: roll 9 → come point 9
    s.setOdds(cm, 30).expectRail(50);   // Step 5: place $30 odds
    s.roll().expectRail(50);            // Step 6: roll 4 → no action
    s.roll();                            // Step 7: roll 9 → come point made
    // payOut = $10 (flat) + $45 (odds 3:2) = $55
    // rail += $10 + $30 + $55 = +$95
    s.expectRail(145);                  // Steps 8–10: net come profit $55
  });

  it('Scenario 015 — Come Bet + Odds, Seven-Out (Odds Off)', () => {
    // Seven-out. Pass and come flats lost. Come odds PUSHED (returned). Down $20.
    // BUG: ComeBet.lose() zeros oddsAmount on seven-out, so odds are lost too.
    //      Expect $80 but implementation produces $50.
    const s = new ScenarioTable(100, [8, 9, 4, 7]);
    const pl = new PassLineBet(10, 'player');
    const cm = new ComeBet(10, 'player');

    s.bet(pl).expectRail(90);           // Step 1
    s.roll().expectRail(90);            // Step 2: roll 8 → point established
    s.bet(cm).expectRail(80);           // Step 3
    s.roll().expectRail(80);            // Step 4: roll 9 → come point 9
    s.setOdds(cm, 30).expectRail(50);   // Step 5: place $30 odds (OFF by default)
    s.roll().expectRail(50);            // Step 6: roll 4 → no action
    s.roll();                            // Step 7: roll 7 → seven-out
    // Expected per scenario: pass flat taken, come flat taken, come odds PUSHED → rail $80
    s.expectRail(80);                   // Steps 8–10: down $20
  });

  it('Scenario 016 — Come Bet + Odds, Seven-Out (Odds Working)', () => {
    // Odds declared working. Seven-out takes all three bets. Down $50.
    const s = new ScenarioTable(100, [8, 9, 4, 7]);
    const pl = new PassLineBet(10, 'player');
    const cm = new ComeBet(10, 'player');

    s.bet(pl).expectRail(90);            // Step 1
    s.roll().expectRail(90);             // Step 2: roll 8 → point established
    s.bet(cm).expectRail(80);            // Step 3
    s.roll().expectRail(80);             // Step 4: roll 9 → come point 9
    s.setOdds(cm, 30).expectRail(50);    // Step 5: place $30 odds
    s.setOddsWorking(cm);                // Step 6: declare odds working
    s.roll().expectRail(50);             // Step 7: roll 4 → no action
    s.roll();                             // Step 8: roll 7 → seven-out, all lost
    s.expectRail(50);                    // Steps 9–11: down $50
  });

  it('Scenario 017 — Come Bet + Odds, Come-Out Hits Come Point (Odds Off)', () => {
    // Seven-out ends shooter. Come flat LOST (flat always lost on seven).
    // Come odds OFF → returned as push (+$30). New come-out rolls 9.
    // cm was removed from table after seven-out (amount=0), so roll 9 only
    // establishes pl2's point — no come win fires.
    //
    // Correct implementation accounting:
    //   Seven-out: come flat taken; come odds returned (+$30) → rail $50+$30=$80.
    //   Bet new pass line: −$10 → rail $70.
    //   Roll 9 (come-out): no cm on table; pl2 establishes at 9. Rail stays $70.
    const s = new ScenarioTable(100, [8, 9, 7, 9]);
    const pl1 = new PassLineBet(10, 'player');
    const cm = new ComeBet(10, 'player');

    s.bet(pl1).expectRail(90);            // Step 1
    s.roll().expectRail(90);              // Step 2: roll 8 → point established
    s.bet(cm).expectRail(80);             // Step 3
    s.roll().expectRail(80);              // Step 4: roll 9 → come point 9
    s.setOdds(cm, 30).expectRail(50);     // Step 5: place $30 odds (OFF)

    s.roll();                              // Step 6: roll 7 → seven-out
    // come flat taken (amount=0); come odds returned (+$30)
    s.expectRail(80);                      // after seven-out: rail $80

    // New come-out: place new pass line
    const pl2 = new PassLineBet(10, 'player');
    s.bet(pl2).expectRail(70);             // Step 10: bet $10 PL → rail $70

    s.roll();                              // Step 11: roll 9 → pl2 point 9 established; no cm on table
    s.expectRail(70);                      // no come win; rail unchanged
  });

  it('Scenario 018 — Two Come Bets, Seven-Out (Both Odds Off)', () => {
    // Two come bets with odds (both OFF). Seven-out: flats lost, both odds pushed.
    // Net loss $30 (three flats). Rail from $200 → $170.
    // BUG: lose() zeros oddsAmount → odds are lost, not pushed → rail stays $110.
    const s = new ScenarioTable(200, [6, 5, 9, 7]);
    const pl = new PassLineBet(10, 'player');
    const cm1 = new ComeBet(10, 'player');
    const cm2 = new ComeBet(10, 'player');

    s.bet(pl).expectRail(190);            // Step 1
    s.roll().expectRail(190);             // Step 2: roll 6 → point established
    s.bet(cm1).expectRail(180);           // Step 3
    s.roll().expectRail(180);             // Step 4: roll 5 → come point 5
    s.setOdds(cm1, 30).expectRail(150);   // Step 5
    s.bet(cm2).expectRail(140);           // Step 6
    s.roll().expectRail(140);             // Step 7: roll 9 → come point 9
    s.setOdds(cm2, 30).expectRail(110);   // Step 8
    s.roll();                              // Step 9: roll 7 → seven-out
    // Expected: 3 flats lost, 2 sets odds pushed (+$60) → rail $110 + $60 = $170
    s.expectRail(170);                    // Steps 10–16
  });

  it('Scenario 019 — Two Come Bets, One Made Then Seven-Out', () => {
    // Come-5 made (pays $55 profit). Then seven-out: pass and come-8 flat lost,
    // come-8 odds pushed. Net session profit $15.
    // BUG: lose() zeros oddsAmount on seven-out → come-8 odds lost, not pushed.
    const s = new ScenarioTable(200, [6, 5, 8, 5, 7]);
    const pl = new PassLineBet(10, 'player');
    const cm1 = new ComeBet(10, 'player');
    const cm2 = new ComeBet(10, 'player');

    s.bet(pl).expectRail(190);            // Step 1
    s.roll().expectRail(190);             // Step 2: roll 6 → point established
    s.bet(cm1).expectRail(180);           // Step 3
    s.roll().expectRail(180);             // Step 4: roll 5 → come point 5
    s.setOdds(cm1, 30).expectRail(150);   // Step 5
    s.bet(cm2).expectRail(140);           // Step 6
    s.roll().expectRail(140);             // Step 7: roll 8 → come point 8
    s.setOdds(cm2, 30).expectRail(110);   // Step 8
    s.roll();                              // Step 9: roll 5 → come-5 made
    // come-5 win: payOut = $10 + $45 = $55; rail += $10+$30+$55 = +$95
    s.expectRail(205);                    // Steps 10–12: come-5 nets +$55

    s.roll();                              // Step 13: roll 7 → seven-out
    // come-8 flat survives; come-8 odds pushed (+$30).
    // Correct implementation: $205 + $30 = $235.
    // (The doc's $215 includes double-deduction of pass and come-8 flat at resolution.)
    s.expectRail(235);                    // Steps 14–16
  });
});
