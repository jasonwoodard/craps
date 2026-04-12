/**
 * Integration tests: Scenarios 033–041 — Don't Pass
 * Source of truth: docs/testing/integration-scenarios.md
 */

import { DontPassBet } from '../../src/bets/dont-pass-bet';
import { ScenarioTable } from './helpers/scenario-helper';

describe('Integration — Don\'t Pass (Scenarios 033–041)', () => {

  it('Scenario 033 — Don\'t Pass, Come-Out 7 (Loss)', () => {
    // Come-out 7 is an immediate loser for don't pass. Down $10.
    const s = new ScenarioTable(100, [7]);
    const dp = new DontPassBet(10, 'player');

    s.bet(dp).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Steps 2–3: roll 7 → DP lost (no rail change)
  });

  it('Scenario 034 — Don\'t Pass, Come-Out 11 (Loss)', () => {
    // Come-out 11 loses for don't pass. Down $10.
    const s = new ScenarioTable(100, [11]);
    const dp = new DontPassBet(10, 'player');

    s.bet(dp).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Steps 2–3: roll 11 → DP lost
  });

  it('Scenario 035 — Don\'t Pass, Come-Out 2 (Win)', () => {
    // Come-out 2 wins for don't pass. +$10.
    const s = new ScenarioTable(100, [2]);
    const dp = new DontPassBet(10, 'player');

    s.bet(dp).expectRail(90);          // Step 1
    s.roll();                           // Step 2: roll 2 → DP wins
    // payOut = $10; rail += $10 (amount) + $0 (layOdds) + $10 (payOut) = +$20
    s.expectRail(110);                 // Steps 3–4
  });

  it('Scenario 036 — Don\'t Pass, Come-Out 3 (Win)', () => {
    // Come-out 3 wins for don't pass. +$10.
    const s = new ScenarioTable(100, [3]);
    const dp = new DontPassBet(10, 'player');

    s.bet(dp).expectRail(90);          // Step 1
    s.roll();                           // Step 2: roll 3 → DP wins
    s.expectRail(110);                 // Steps 3–4
  });

  it('Scenario 037 — Don\'t Pass, Come-Out 12 (Push / Bar)', () => {
    // Come-out 12 is barred — don't pass pushed. No gain, no loss.
    // Push: DontPassBet.evaluateDiceRoll does nothing on 12 (no-op).
    // No payOut set, amount unchanged → bet stays on table.
    // Player must manually take it down (engine would do this; test verifies rail unchanged).
    const s = new ScenarioTable(100, [12]);
    const dp = new DontPassBet(10, 'player');

    s.bet(dp).expectRail(90);          // Step 1: $10 on table
    s.roll();                           // Step 2: roll 12 → push (no action from bet)
    // Bet is still on table (not zeroed, no payOut). Return it manually.
    s.rail += dp.amount;               // +$10 returned (push)
    s.table.removeBet(dp);
    s.expectRail(100);                 // Step 3: push returns $10
  });

  it('Scenario 038 — Don\'t Pass, Point Established Then Seven-Out (Win)', () => {
    // Point: 8. Seven-out. DP wins. +$10.
    const s = new ScenarioTable(100, [8, 5, 7]);
    const dp = new DontPassBet(10, 'player');

    s.bet(dp).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 8 → point on, DP rides
    s.roll().expectRail(90);           // Step 3: roll 5 → no action
    s.roll();                           // Step 4: roll 7 → DP wins
    // payOut = $10; rail += $10 + $0 + $10 = +$20
    s.expectRail(110);                 // Steps 5–6
  });

  it('Scenario 039 — Don\'t Pass, Point Established Then Point Made (Loss)', () => {
    // Point: 8. Point made. DP loses. Down $10.
    const s = new ScenarioTable(100, [8, 4, 8]);
    const dp = new DontPassBet(10, 'player');

    s.bet(dp).expectRail(90);          // Step 1
    s.roll().expectRail(90);           // Step 2: roll 8 → point on
    s.roll().expectRail(90);           // Step 3: roll 4 → no action
    s.roll().expectRail(90);           // Steps 4–5: roll 8 → point made, DP lost
  });

  it('Scenario 040 — Don\'t Pass + Lay Odds, Seven-Out (Win)', () => {
    // Point: 6. Lay $36 odds on DP. True odds 5:6 → win $30. Flat wins $10. Total +$40.
    // payOut = $10 (flat) + $30 (lay odds) = $40
    // rail += $10 (amount) + $36 (layOddsAmount) + $40 (payOut) = +$86
    const s = new ScenarioTable(100, [6, 3, 7]);
    const dp = new DontPassBet(10, 'player');

    s.bet(dp).expectRail(90);                // Step 1
    s.roll().expectRail(90);                 // Step 2: roll 6 → point on
    s.setLayOdds(dp, 36).expectRail(54);     // Step 3: lay $36 odds
    s.roll().expectRail(54);                 // Step 4: roll 3 → no action
    s.roll();                                 // Step 5: roll 7 → DP wins
    s.expectRail(140);                       // Steps 6–8: flat $10 + odds $30 + return $10+$36
  });

  it('Scenario 041 — Don\'t Pass + Lay Odds, Point Made (Loss)', () => {
    // Point: 6. Lay $36 odds. Point made. Both lose. Down $46.
    const s = new ScenarioTable(100, [6, 6]);
    const dp = new DontPassBet(10, 'player');

    s.bet(dp).expectRail(90);                // Step 1
    s.roll().expectRail(90);                 // Step 2: roll 6 → point on
    s.setLayOdds(dp, 36).expectRail(54);     // Step 3: lay $36 odds
    s.roll();                                 // Step 4: roll 6 → point made, DP loses
    // lose(): amount=0, layOddsAmount=0 → removed; no payOut → no rail change
    s.expectRail(54);                        // Steps 5–6: down $46 total
  });
});
