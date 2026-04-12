/**
 * Integration tests: Scenarios 001–010 — Pass Line
 * Source of truth: docs/testing/integration-scenarios.md
 */

import { PassLineBet } from '../../src/bets/pass-line-bet';
import { ScenarioTable } from './helpers/scenario-helper';

describe('Integration — Pass Line (Scenarios 001–010)', () => {

  it('Scenario 001 — Pass Line Flat, Point Made (6)', () => {
    // Point: 6. No odds. Expect +$10 profit.
    // Note: scenario doc step 2 says "rolls 4 (point established: 6)" — this is a
    // document typo; rolling 4 establishes point 4, not 6. The correct read is roll 6.
    const s = new ScenarioTable(100, [6, 9, 6]);
    const pl = new PassLineBet(10, 'player');

    s.bet(pl).expectRail(90);         // Step 1
    s.roll().expectRail(90);          // Step 2: roll 6 → point established: 6
    s.roll().expectRail(90);          // Step 3: roll 9 → no action
    s.roll();                          // Step 4: roll 6 → point made, win fires
    // payOut = $10 flat profit; rail += $10 (amount) + $0 (odds) + $10 (payOut) = +$20
    s.expectRail(110);                // Steps 5–6: pays $10 + returns $10 flat
  });

  it('Scenario 002 — Pass Line + Odds, Point Made (6)', () => {
    // Point: 6. $30 odds at 6:5 → odds win $36. Total profit $46.
    const s = new ScenarioTable(100, [6, 8, 6]);
    const pl = new PassLineBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 6 → point established
    s.setOdds(pl, 30).expectRail(60);  // Step 3: place $30 odds
    s.roll().expectRail(60);           // Step 4: roll 8 → no action
    s.roll();                           // Step 5: roll 6 → point made
    // payOut = $10 (flat) + $36 (odds 6:5) = $46
    // rail += $10 (amount) + $30 (oddsAmount) + $46 (payOut) = +$86
    s.expectRail(146);                 // Steps 6–8
  });

  it('Scenario 003 — Pass Line Flat, Seven-Out', () => {
    // Point: 8. No odds. Seven-out. Down $10.
    const s = new ScenarioTable(100, [8, 5, 7]);
    const pl = new PassLineBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 8 → point established
    s.roll().expectRail(90);           // Step 3: roll 5 → no action
    s.roll().expectRail(90);           // Step 4: roll 7 → seven-out, flat taken (no rail change)
  });

  it('Scenario 004 — Pass Line + Odds, Seven-Out (9)', () => {
    // Point: 9. $30 odds. Seven-out. Down $40.
    const s = new ScenarioTable(100, [9, 4, 7]);
    const pl = new PassLineBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 9 → point established
    s.setOdds(pl, 30).expectRail(60);  // Step 3: place $30 odds
    s.roll().expectRail(60);           // Step 4: roll 4 → no action
    s.roll().expectRail(60);           // Steps 5–7: seven-out, both lost (no rail change)
  });

  it('Scenario 005 — Pass Line, Come-Out Natural (7)', () => {
    // Come-out 7. Immediate winner. +$10.
    const s = new ScenarioTable(100, [7]);
    const pl = new PassLineBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll();                           // Step 2: roll 7 → natural win
    // payOut = $10; rail += $10 + $0 + $10 = +$20
    s.expectRail(110);                 // Steps 3–4
  });

  it('Scenario 006 — Pass Line, Come-Out Craps (2)', () => {
    // Come-out 2. Immediate loser. Down $10.
    const s = new ScenarioTable(100, [2]);
    const pl = new PassLineBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2–3: roll 2 → flat taken (no rail change)
  });

  it('Scenario 007 — Pass Line, Come-Out Craps (12)', () => {
    // Come-out 12. Immediate loser. Down $10.
    const s = new ScenarioTable(100, [12]);
    const pl = new PassLineBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2–3: roll 12 → flat taken (no rail change)
  });

  it('Scenario 008 — Pass Line, Come-Out Yo (11)', () => {
    // Come-out 11. Immediate winner. +$10.
    const s = new ScenarioTable(100, [11]);
    const pl = new PassLineBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll();                           // Step 2: roll 11 → natural win
    // payOut = $10; rail += $10 + $0 + $10 = +$20
    s.expectRail(110);                 // Steps 3–4
  });

  it('Scenario 009 — Pass Line, Multi-Roll Point Then Made (5)', () => {
    // Point: 5. $30 odds at 3:2 → odds win $45. Total profit $55.
    const s = new ScenarioTable(100, [5, 3, 10, 5]);
    const pl = new PassLineBet(10, 'player');

    s.bet(pl).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 5 → point established
    s.setOdds(pl, 30).expectRail(60);  // Step 3: place $30 odds
    s.roll().expectRail(60);           // Step 4: roll 3 → no action
    s.roll().expectRail(60);           // Step 5: roll 10 → no action
    s.roll();                           // Step 6: roll 5 → point made
    // payOut = $10 (flat) + $45 (odds 3:2) = $55
    // rail += $10 + $30 + $55 = +$95
    s.expectRail(155);                 // Steps 7–9
  });

  it('Scenario 010 — Pass Line, Multi-Roll Then Seven-Out', () => {
    // Point: 10. $30 odds. Seven-out. Down $40.
    const s = new ScenarioTable(100, [10, 6, 8, 7]);
    const pl = new PassLineBet(10, 'player');

    s.bet(pl).expectRail(90);           // Step 1
    s.roll().expectRail(90);            // Step 2: roll 10 → point established
    s.setOdds(pl, 30).expectRail(60);   // Step 3: place $30 odds
    s.roll().expectRail(60);            // Step 4: roll 6 → no action
    s.roll().expectRail(60);            // Step 5: roll 8 → no action
    s.roll().expectRail(60);            // Steps 6–8: roll 7 → seven-out, both lost
  });
});
