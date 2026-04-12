/**
 * Integration tests: Scenarios 050–054 — Lay Bets (Standalone)
 * Source of truth: docs/testing/integration-scenarios.md
 *
 * LayBet is implemented in src/bets/lay-bet.ts.
 * Always working (not off during come-out). Vig on win only.
 *
 * Note on document accounting: scenarios show "Dealer takes $10 Pass Line" as a
 * step that decreases the rail after the lay bet has already been settled. This is
 * the same double-deduction error seen elsewhere in the document. The correct
 * accounting is that the pass line loss does NOT produce a second deduction (it was
 * deducted when the bet was placed). These tests use the correct craps math.
 */

import { PassLineBet } from '../../src/bets/pass-line-bet';
import { LayBet } from '../../src/bets/lay-bet';
import { ScenarioTable } from './helpers/scenario-helper';

describe('Integration — Lay Bets (Scenarios 050–054)', () => {

  it('Scenario 050 — Lay 4, Seven-Out (Win, Vig on Win)', () => {
    // Point: 6. Lay 4 for $40. 7 rolls → win $20. Vig = $1. Net $19.
    // payOut = $40 + $19 = $59.
    // After seven-out: PL loses (no rail change). Lay wins → rail += $59.
    // Correct final: $50 + $59 = $109.
    // Document shows $99 (deducts pass line again after lay payout — doc error).
    const s = new ScenarioTable(100, [6, 9, 7]);
    const pl = new PassLineBet(10, 'player');
    const ly = new LayBet(40, 4, 'player');

    s.bet(pl);                          // rail $90
    s.roll();                            // roll 6 → point on
    s.bet(ly);                           // rail $50
    s.roll();                            // roll 9 → no action
    s.roll();                            // roll 7 → lay wins (+$59); pass lost
    s.expectRail(109);
  });

  it('Scenario 051 — Lay 4, Number Rolls (Loss)', () => {
    // Point: 6. Lay 4 for $40. 4 rolls → lay loses. No vig.
    const s = new ScenarioTable(100, [6, 4]);
    const pl = new PassLineBet(10, 'player');
    const ly = new LayBet(40, 4, 'player');

    s.bet(pl);                          // rail $90
    s.roll();                            // roll 6 → point on
    s.bet(ly);                           // rail $50
    s.roll();                            // roll 4 → lay loses
    s.expectRail(50);
  });

  it('Scenario 052 — Lay 10, Seven-Out (Win, Vig on Win)', () => {
    // Point: 6. Lay 10 for $40. 7 rolls → win $20. Vig = $1. Net $19.
    // payOut = $59. Correct final = $109.
    const s = new ScenarioTable(100, [6, 7]);
    const pl = new PassLineBet(10, 'player');
    const ly = new LayBet(40, 10, 'player');

    s.bet(pl);                          // rail $90
    s.roll();                            // roll 6 → point on
    s.bet(ly);                           // rail $50
    s.roll();                            // roll 7 → lay wins (+$59); pass lost
    s.expectRail(109);
  });

  it('Scenario 053 — Lay 6, Seven-Out (Win, Vig on Win)', () => {
    // Point: 9. Lay 6 for $24. 7 rolls → win = floor(24×5/6) = $20. Vig = $1. Net $19.
    // payOut = $24 + $19 = $43. Correct final = $66 + $43 = $109.
    const s = new ScenarioTable(100, [9, 4, 7]);
    const pl = new PassLineBet(10, 'player');
    const ly = new LayBet(24, 6, 'player');

    s.bet(pl);                          // rail $90
    s.roll();                            // roll 9 → point on
    s.bet(ly);                           // rail $66
    s.roll();                            // roll 4 → no action
    s.roll();                            // roll 7 → lay wins (+$43); pass lost
    s.expectRail(109);
  });

  it('Scenario 054 — Lay 6, Number Rolls (Loss)', () => {
    // Point: 9. Lay 6 for $24. 6 rolls → lay loses. No vig.
    const s = new ScenarioTable(100, [9, 6]);
    const pl = new PassLineBet(10, 'player');
    const ly = new LayBet(24, 6, 'player');

    s.bet(pl);                          // rail $90
    s.roll();                            // roll 9 → point on
    s.bet(ly);                           // rail $66
    s.roll();                            // roll 6 → lay loses
    s.expectRail(66);
  });
});
