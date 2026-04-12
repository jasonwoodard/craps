/**
 * Integration tests: Scenarios 042–049 — Don't Come
 * Source of truth: docs/testing/integration-scenarios.md
 *
 * Known failing scenarios — DontComeBet implementation bug:
 *   DontComeBet inherits DontPassBet.evaluateDiceRoll which uses table.currentPoint
 *   rather than tracking the bet's own "traveled-to" number. This causes:
 *
 *   042 — DC in transit: 7 should LOSE but impl WINs (point is ON → wins on 7)
 *   043 — DC in transit: 11 should LOSE but impl has NO ACTION (11 ≠ 7 ≠ currentPoint)
 *   044 — DC in transit: 2 should WIN but impl has NO ACTION (table point is ON)
 *   045 — DC in transit: 12 should PUSH but impl has NO ACTION
 *   047 — DC traveled to 9: 9 again should LOSE but impl has NO ACTION (9 ≠ currentPoint=6)
 *   048 — Lay-odds payout wrong: uses table.currentPoint (6) not DC's own point (9)
 *   049 — Same as 047: DC doesn't lose when its own point is made
 */

import { PassLineBet } from '../../src/bets/pass-line-bet';
import { DontComeBet } from '../../src/bets/dont-come-bet';
import { ScenarioTable } from './helpers/scenario-helper';

describe('Integration — Don\'t Come (Scenarios 042–049)', () => {

  it('Scenario 042 — Don\'t Come, Natural (7) During Travel (Loss)', () => {
    // DC in transit. Roll 7 → DC should LOSE, and it is also a seven-out.
    // BUG: DontComeBet wins on 7 when table point is ON.
    // Expected: rail = $80 (both bets lost). Actual (bug): DC wins → rail > $80.
    const s = new ScenarioTable(100, [8, 7]);
    const pl = new PassLineBet(10, 'player');
    const dc = new DontComeBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 8 → point on
    s.bet(dc).expectRail(80);          // Step 3
    s.roll();                           // Step 4: roll 7 → DC loses; seven-out
    // Expected per scenario: DC taken + pass taken → rail $80
    s.expectRail(80);                  // Steps 5–6
  });

  it('Scenario 043 — Don\'t Come, 11 During Travel (Loss)', () => {
    // DC in transit. Roll 11 → DC should LOSE. Pass line unaffected.
    // BUG: 11 with table.isPointOn=TRUE → no action; DC bet stays on table.
    // Expected: rail $80 (DC taken). Actual (bug): DC no action → DC stays, rail still $80.
    // This scenario coincidentally shows the same rail value ($80) — the bug causes DC
    // to NOT be removed (it stays as an active bet) rather than being lost. Downstream
    // rolls would behave differently. We test just the post-roll rail state.
    const s = new ScenarioTable(100, [8, 11]);
    const pl = new PassLineBet(10, 'player');
    const dc = new DontComeBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 8 → point on
    s.bet(dc).expectRail(80);          // Step 3
    s.roll();                           // Step 4: roll 11 → DC loses (expected)
    // BUG: DC has no action; it stays on table. Rail stays $80.
    s.expectRail(80);                  // Step 5: DC taken (rail unchanged either way)
    // Verify bet is removed (would fail if bug causes DC to stay on table):
    expect(s.table.bets.filter(b => b instanceof DontComeBet).length).toBe(0);
  });

  it('Scenario 044 — Don\'t Come, 2 During Travel (Win)', () => {
    // DC in transit. Roll 2 → DC should WIN immediately.
    // BUG: table.isPointOn=TRUE when DC is in transit → come-out phase code not reached.
    // DontPassBet logic: point ON, 2≠7, 2≠currentPoint → no action. DC bet stays.
    // Expected: rail $100 (win +$20). Actual (bug): DC no action → rail $80.
    const s = new ScenarioTable(100, [8, 2]);
    const pl = new PassLineBet(10, 'player');
    const dc = new DontComeBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 8 → point on
    s.bet(dc).expectRail(80);          // Step 3
    s.roll();                           // Step 4: roll 2 → DC wins (expected)
    // Expected: rail $100. BUG will produce $80.
    s.expectRail(100);                 // Steps 5–6
  });

  it('Scenario 045 — Don\'t Come, 12 During Travel (Push)', () => {
    // DC in transit. Roll 12 → DC should PUSH (bar 12).
    // BUG: table.isPointOn=TRUE → DontPassBet logic: 12≠7, 12≠currentPoint → no action.
    // The push behaviour (return $10) does not fire; DC stays on table unreturned.
    // Expected: rail $90 (push returns $10). Actual (bug): no action, DC stays.
    const s = new ScenarioTable(100, [8, 12]);
    const pl = new PassLineBet(10, 'player');
    const dc = new DontComeBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 8 → point on
    s.bet(dc).expectRail(80);          // Step 3
    s.roll();                           // Step 4: roll 12 → DC pushed (expected)
    // BUG: no action; DC stays on table. We manually push it to match scenario expectation.
    // (In a correct implementation, push would be handled automatically.)
    // Expected: rail $90. BUG will produce $80.
    s.expectRail(90);                  // Step 5: push returns $10
  });

  it('Scenario 046 — Don\'t Come, Point Established Then Seven-Out (Win)', () => {
    // Pass line point: 6. DC travels to 9. Seven-out → DC wins. Net flat (DC +$10, pass −$10).
    // NOTE: this scenario PASSES with the buggy implementation because the seven-out
    // triggers DontPassBet's point-ON win condition (7 → win) regardless of DC's own point.
    const s = new ScenarioTable(100, [6, 9, 4, 7]);
    const pl = new PassLineBet(10, 'player');
    const dc = new DontComeBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 6 → point on
    s.bet(dc).expectRail(80);          // Step 3
    s.roll().expectRail(80);           // Step 4: roll 9 → DC "travels" (no action in impl)
    s.roll().expectRail(80);           // Step 5: roll 4 → no action
    s.roll();                           // Step 6: roll 7 → DC wins; seven-out
    // DC win: rail += $10 + $0 + $10 = +$20 → $100; pass lost (no rail change, deducted at placement).
    // Document shows $90 ("takes $10 pass line") — double-deduction error in doc.
    // Correct final = $100 (DC +$10 net, PL −$10 net = flat from $100 start).
    s.expectRail(100);                 // Steps 7–9: DC +$10 net, PL −$10 net = flat
  });

  it('Scenario 047 — Don\'t Come, Point Established Then Number Made (Loss)', () => {
    // Pass line point: 6. DC travels to 9. 9 rolls → DC should LOSE.
    // BUG: DontComeBet checks table.currentPoint (6), not own point (9).
    // 9 ≠ 6 → no action. DC stays on table unreturned. Expected rail $80, bug $80 (same number
    // but wrong reason — DC bet is still "live" on table).
    const s = new ScenarioTable(100, [6, 9, 9]);
    const pl = new PassLineBet(10, 'player');
    const dc = new DontComeBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 6 → point on
    s.bet(dc).expectRail(80);          // Step 3
    s.roll().expectRail(80);           // Step 4: roll 9 → DC "travels" to 9
    s.roll();                           // Step 5: roll 9 → DC point made, DC loses (expected)
    // BUG: no action (9 ≠ table.currentPoint=6). DC stays alive. Rail still $80.
    s.expectRail(80);                  // Step 6: DC taken (already deducted, no change)
    // Verify DC is gone:
    expect(s.table.bets.filter(b => b instanceof DontComeBet).length).toBe(0);
  });

  it('Scenario 048 — Don\'t Come + Lay Odds, Seven-Out (Win)', () => {
    // Pass line point: 6. DC travels to 9. Lay $30 odds on DC-9.
    // Seven-out → DC wins. Lay odds on 9 pay 2:3 → $20 win.
    // BUG: DontComeBet uses table.currentPoint (6) for lay odds calculation.
    //      On point 6: pays floor(30 * 5/6) = $25 (WRONG).
    //      Correct (point 9): floor(30 * 2/3) = $20.
    // Expected: payOut=$10+$20=$30; rail += $10+$30+$30 = +$70 → $120; pass −$10 → $110.
    // Bug produces: payOut=$10+$25=$35; rail += $10+$30+$35 = +$75 → $125; pass −$10 → $115.
    const s = new ScenarioTable(100, [6, 9, 7]);
    const pl = new PassLineBet(10, 'player');
    const dc = new DontComeBet(10, 'player');

    s.bet(pl).expectRail(90);              // Step 1
    s.roll().expectRail(90);               // Step 2: roll 6 → point on
    s.bet(dc).expectRail(80);              // Step 3
    s.roll().expectRail(80);               // Step 4: roll 9 → DC travels to 9
    s.setLayOdds(dc, 30).expectRail(50);   // Step 5: lay $30 odds
    s.roll();                               // Step 6: roll 7 → DC wins
    // Correct expected per scenario: rail $110 (DC +$30 profit + return $10+$30 = +$70; pass −$10)
    s.expectRail(110);                     // Steps 7–10
  });

  it('Scenario 049 — Don\'t Come + Lay Odds, Number Made (Loss)', () => {
    // Pass line point: 6. DC travels to 9. Lay $30 odds. 9 rolls → DC loses.
    // BUG: same as 047 — DontComeBet checks table.currentPoint (6), not 9.
    // DC and lay odds should both lose. DC stays on table (bug).
    const s = new ScenarioTable(100, [6, 9, 9]);
    const pl = new PassLineBet(10, 'player');
    const dc = new DontComeBet(10, 'player');

    s.bet(pl).expectRail(90);              // Step 1
    s.roll().expectRail(90);               // Step 2: roll 6 → point on
    s.bet(dc).expectRail(80);              // Step 3
    s.roll().expectRail(80);               // Step 4: roll 9 → DC travels
    s.setLayOdds(dc, 30).expectRail(50);   // Step 5: lay $30
    s.roll();                               // Step 6: roll 9 → DC point made, both lose
    // BUG: no action; DC + odds stay on table. Rail = $50 (all deducted at placement).
    s.expectRail(50);                      // Steps 7–8: DC flat + lay odds taken
    expect(s.table.bets.filter(b => b instanceof DontComeBet).length).toBe(0);
  });
});
