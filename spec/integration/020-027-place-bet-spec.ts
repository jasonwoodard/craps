/**
 * Integration tests: Scenarios 020–027 — Place Bets
 * Source of truth: docs/testing/integration-scenarios.md
 *
 * Note on document accounting: several scenarios include a "Dealer takes $X"
 * step after a seven-out that shows the rail decreasing. This is a document
 * inconsistency — the bet amount was already deducted from the rail when the
 * bet was placed. Losses do not produce a second deduction. These tests use
 * the correct craps accounting (no double-deduction on loss).
 */

import { PassLineBet } from '../../src/bets/pass-line-bet';
import { PlaceBet } from '../../src/bets/place-bet';
import { ScenarioTable } from './helpers/scenario-helper';

describe('Integration — Place Bets (Scenarios 020–027)', () => {

  it('Scenario 020 — Place 6, Hit Then Seven-Out', () => {
    // Point: 9. Place 6 for $12. 7:6 payout → profit $14. payOut = $12+$14 = $26.
    // Hit once, then seven-out. Pass and place both lost (already deducted at placement).
    // Correct final: $100 − $10 (PL) − $12 (P6) + $26 (P6 hit) = $104.
    const s = new ScenarioTable(100, [9, 6, 7]);
    const pl = new PassLineBet(10, 'player');
    const p6 = new PlaceBet(12, 6, 'player');

    s.bet(pl).expectRail(90);
    s.roll().expectRail(90);           // roll 9 → point on
    s.bet(p6).expectRail(78);
    s.roll();                           // roll 6 → place hits; rail += $26
    s.expectRail(104);
    s.roll().expectRail(104);          // roll 7 → seven-out; losses already deducted
  });

  it('Scenario 021 — Place 8, Hit Then Seven-Out', () => {
    // Point: 5. Place 8 for $12. 7:6 → profit $14. payOut = $26.
    const s = new ScenarioTable(100, [5, 8, 7]);
    const pl = new PassLineBet(10, 'player');
    const p8 = new PlaceBet(12, 8, 'player');

    s.bet(pl);                         // rail $90
    s.roll();                           // roll 5 → point on
    s.bet(p8);                         // rail $78
    s.roll();                           // roll 8 → hits; rail += $26 → $104
    s.roll();                           // roll 7 → seven-out; losses deducted at placement
    s.expectRail(104);
  });

  it('Scenario 022 — Place 5, Hit Then Seven-Out', () => {
    // Point: 6. Place 5 for $10. 7:5 → profit $14. payOut = $24.
    const s = new ScenarioTable(100, [6, 5, 7]);
    const pl = new PassLineBet(10, 'player');
    const p5 = new PlaceBet(10, 5, 'player');

    s.bet(pl);                         // rail $90
    s.roll();                           // roll 6 → point on
    s.bet(p5);                         // rail $80
    s.roll();                           // roll 5 → hits; rail += $24 → $104
    s.roll();                           // roll 7 → seven-out
    s.expectRail(104);
  });

  it('Scenario 023 — Place 9, Hit Then Seven-Out', () => {
    // Point: 6. Place 9 for $10. 7:5 → profit $14. payOut = $24.
    const s = new ScenarioTable(100, [6, 9, 7]);
    const pl = new PassLineBet(10, 'player');
    const p9 = new PlaceBet(10, 9, 'player');

    s.bet(pl);                         // rail $90
    s.roll();                           // roll 6 → point on
    s.bet(p9);                         // rail $80
    s.roll();                           // roll 9 → hits; rail += $24 → $104
    s.roll();                           // roll 7 → seven-out
    s.expectRail(104);
  });

  it('Scenario 024 — Place 4, Hit Then Seven-Out', () => {
    // Point: 6. Place 4 for $10. 9:5 → profit $18. payOut = $28.
    const s = new ScenarioTable(100, [6, 4, 7]);
    const pl = new PassLineBet(10, 'player');
    const p4 = new PlaceBet(10, 4, 'player');

    s.bet(pl);                         // rail $90
    s.roll();                           // roll 6 → point on
    s.bet(p4);                         // rail $80
    s.roll();                           // roll 4 → hits; rail += $28 → $108
    s.roll();                           // roll 7 → seven-out
    s.expectRail(108);
  });

  it('Scenario 025 — Place 10, Hit Then Seven-Out', () => {
    // Point: 6. Place 10 for $10. 9:5 → profit $18. payOut = $28.
    const s = new ScenarioTable(100, [6, 10, 7]);
    const pl = new PassLineBet(10, 'player');
    const p10 = new PlaceBet(10, 10, 'player');

    s.bet(pl);                         // rail $90
    s.roll();                           // roll 6 → point on
    s.bet(p10);                        // rail $80
    s.roll();                           // roll 10 → hits; rail += $28 → $108
    s.roll();                           // roll 7 → seven-out
    s.expectRail(108);
  });

  it('Scenario 026 — Place 6, Off During Come-Out (No Loss on 7)', () => {
    // Seven-out takes pass + place. New come-out: fresh pass line, 7 natural.
    // Note: place bet is not active during come-out. The come-out 7 does not affect it.
    // (The place bet is gone after the first seven-out; no place is active on the come-out roll.)
    const s = new ScenarioTable(100, [9, 7, 7]);
    const pl1 = new PassLineBet(10, 'player');
    const p6  = new PlaceBet(12, 6, 'player');

    s.bet(pl1);                          // rail $90
    s.roll();                             // roll 9 → point on
    s.bet(p6);                            // rail $78
    s.roll();                             // roll 7 → seven-out: pass lost, place lost

    // New come-out
    const pl2 = new PassLineBet(10, 'player');
    s.bet(pl2);                           // rail $68
    s.roll();                             // roll 7 → come-out natural; pass wins (+$20)
    s.expectRail(88);
  });

  it('Scenario 027 — Place 6, Multiple Hits Before Seven-Out', () => {
    // Point: 9. Place 6 for $12. Hits twice (payOut=$26 each), then seven-out.
    // Final: $100 − $10 − $12 + $26 + $26 = $130.
    const s = new ScenarioTable(100, [9, 6, 6, 7]);
    const pl = new PassLineBet(10, 'player');
    const p6 = new PlaceBet(12, 6, 'player');

    s.bet(pl);                           // rail $90
    s.roll();                             // roll 9 → point on
    s.bet(p6);                            // rail $78
    s.roll();                             // roll 6 → hit #1; rail += $26 → $104
    s.roll();                             // roll 6 → hit #2; rail += $26 → $130
    s.roll();                             // roll 7 → seven-out; losses already deducted
    s.expectRail(130);
  });
});
