/**
 * Integration tests: Scenarios 011–019 — Come Bets
 * Source of truth: docs/testing/integration-scenarios.md
 *
 * Note on seven-out odds (scenarios 015/017/018/019): come odds are off by
 * default ONLY on the come-out roll. On a point-phase seven-out the odds
 * behind an established come bet are working and lose with the flat — the
 * originally documented "odds pushed on seven-out" behavior was
 * mathematically impossible (odds would win at true odds and push on their
 * loss: a positive-EV bet). Both the scenarios doc and these specs now
 * reflect the standard rule.
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

  it('Scenario 015 — Come Bet + Odds, Seven-Out (point phase: odds working, lost)', () => {
    // Seven-out with the table point ON: pass flat, come flat AND come odds
    // all lose — come odds are only off on the come-out roll. Down $50.
    const s = new ScenarioTable(100, [8, 9, 4, 7]);
    const pl = new PassLineBet(10, 'player');
    const cm = new ComeBet(10, 'player');

    s.bet(pl).expectRail(90);           // Step 1
    s.roll().expectRail(90);            // Step 2: roll 8 → point established
    s.bet(cm).expectRail(80);           // Step 3
    s.roll().expectRail(80);            // Step 4: roll 9 → come point 9
    s.setOdds(cm, 30).expectRail(50);   // Step 5: place $30 odds
    s.roll().expectRail(50);            // Step 6: roll 4 → no action
    s.roll();                            // Step 7: roll 7 → seven-out, all lost
    s.expectRail(50);                   // Steps 8–10: down $50
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

  it('Scenario 017 — Come Bet + Odds, Seven-Out Then New Come-Out', () => {
    // Seven-out ends the shooter with the point ON: come flat AND odds lost
    // (working during the point phase). cm is removed from the table, so the
    // following come-out 9 only establishes pl2's point.
    const s = new ScenarioTable(100, [8, 9, 7, 9]);
    const pl1 = new PassLineBet(10, 'player');
    const cm = new ComeBet(10, 'player');

    s.bet(pl1).expectRail(90);            // Step 1
    s.roll().expectRail(90);              // Step 2: roll 8 → point established
    s.bet(cm).expectRail(80);             // Step 3
    s.roll().expectRail(80);              // Step 4: roll 9 → come point 9
    s.setOdds(cm, 30).expectRail(50);     // Step 5: place $30 odds

    s.roll();                              // Step 6: roll 7 → seven-out, flat + odds lost
    s.expectRail(50);                      // after seven-out: rail $50

    // New come-out: place new pass line
    const pl2 = new PassLineBet(10, 'player');
    s.bet(pl2).expectRail(40);             // Step 10: bet $10 PL → rail $40

    s.roll();                              // Step 11: roll 9 → pl2 point 9 established; no cm on table
    s.expectRail(40);                      // no come win; rail unchanged
  });

  it('Scenario 018 — Two Come Bets, Seven-Out (both odds working, lost)', () => {
    // Two come bets with odds. Point-phase seven-out: all three flats and
    // both odds sets lose. Down $90 from the $200 start.
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
    s.roll();                              // Step 9: roll 7 → seven-out, all lost
    s.expectRail(110);                    // Steps 10–16: down $90
  });

  it('Scenario 019 — Two Come Bets, One Made Then Seven-Out', () => {
    // Come-5 made (pays $55 profit). Then seven-out: pass flat, come-8 flat
    // AND come-8 odds all lost (odds working during the point phase).
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

    s.roll();                              // Step 13: roll 7 → seven-out, remaining bets lost
    s.expectRail(205);                    // Steps 14–16: session profit $5
  });
});
