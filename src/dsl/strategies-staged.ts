/**
 * CATS — Calculated Advantage Timing Strategy
 * BATS — Bearish Alpha-Transition Strategy
 *
 * Both are five-stage strategies implemented using the Stage Machine API.
 * Each call to CATS() / BATS() returns a fresh StrategyDefinition with its own runtime.
 *
 * CATS stages:
 *   accumulatorFull    → Place 6/8 at $18 each. Transitions on first 6/8 hit.
 *   accumulatorRegressed → Place 6/8 at $12 each. Advances at profit ≥ +$70.
 *   littleMolly        → Pass $10 + 1 Come $10 + 2× odds. Advances at +$150.
 *   threePtMollyTight  → Pass + 2 Come + tiered odds. Shifts to Loose at +$200 w/ 6/8.
 *   threePtMollyLoose  → Pass + 2 Come + 5× odds. Terminal stage (no further advance).
 *
 * BATS stages:
 *   bearishAccumulator → Don't Pass $10 + 1× lay odds. Advances at profit ≥ +$120.
 *   littleDolly        → DP + 1 DC + 2× lay odds. Advances at +$225.
 *   threePtDolly       → DP + 2 DC + 5× lay odds. Advances at +$350.
 *   expandedDarkAlpha  → Dolly + Lay 4/10 (if not DC-covered). Advances at +$500.
 *   maxDarkAlpha       → Dolly + Lay 4/5/9/10. Terminal stage.
 */

import { stageMachine } from './stage-machine';
import { StageContext, TableReadView } from './stage-machine-types';

/**
 * Creates a fresh CATS strategy. Each call produces an independent runtime.
 * Register in StrategyRegistry as: `'CATS': CATS()`
 */
export function CATS() {
  return stageMachine('CATS')
    .startingAt('accumulatorFull')

    // --- Stage 1: Accumulator Full ---
    // Place 6/8 at $18 each. On first hit of 6 or 8, transition to regressed.
    .stage('accumulatorFull', {
      board: ({ bets }: StageContext) => {
        bets.place(6, 18);
        bets.place(8, 18);
      },
      canAdvanceTo: () => true,
      on: {
        numberHit: ({ number }, { advanceTo }) => {
          if (number === 6 || number === 8) {
            advanceTo('accumulatorRegressed');
          }
        },
      },
    })

    // --- Stage 2: Accumulator Regressed ---
    // Place 6/8 at $12 each. Advance to LittleMolly when profit >= +$70.
    .stage('accumulatorRegressed', {
      board: ({ bets, session, advanceTo }: StageContext) => {
        bets.place(6, 12);
        bets.place(8, 12);
        if (session.profit >= 70) {
          advanceTo('littleMolly');
        }
      },
      canAdvanceTo: (_target, session) => session.profit >= 70,
    })

    // --- Stage 3: Little Molly ---
    // Pass line $10 + 1 come $10, both with 2× odds.
    // Advances to ThreePtMollyTight at +$150.
    // Retreats to AccumulatorRegressed on profit < +$70 or 2 consecutive 7-outs.
    .stage('littleMolly', {
      board: ({ bets, session, advanceTo }: StageContext) => {
        bets.passLine(10).withOdds(20);
        bets.come(10).withOdds(20);
        if (session.profit >= 150) {
          advanceTo('threePtMollyTight');
        }
      },
      canAdvanceTo: (_target, session) => session.profit >= 150,
      mustRetreatTo: (session) =>
        session.profit < 70 || session.consecutiveSevenOuts >= 2
          ? 'accumulatorRegressed'
          : undefined,
    })

    // --- Stage 4: Three-Point Molly — Tight ---
    // Pass line $10 + 2 come $10, with tiered odds based on coverage.
    // Shifts to Loose at +$200 when 6 or 8 is covered.
    // Retreats to LittleMolly on profit < +$150 or 2 consecutive 7-outs.
    .stage('threePtMollyTight', {
      board: ({ bets, table, session, advanceTo }: StageContext) => {
        const odds = tieredOdds(table);
        bets.passLine(10).withOdds(odds.passLine);
        bets.come(10).withOdds(odds.come1);
        bets.come(10).withOdds(odds.come2);
        if (session.profit >= 200 && table.hasSixOrEight) {
          advanceTo('threePtMollyLoose');
        }
      },
      canAdvanceTo: (_target, session) => session.profit >= 200,
      mustRetreatTo: (session) =>
        session.profit < 150 || session.consecutiveSevenOuts >= 2
          ? 'littleMolly'
          : undefined,
    })

    // --- Stage 5: Three-Point Molly — Loose ---
    // Pass line $10 + 2 come $10, all with 5× odds ($50 each).
    // Retreats to ThreePtMollyTight on profit < +$150 or 2 consecutive 7-outs.
    // No further advance — ExpandedAlpha/MaxAlpha deferred (require Buy bets).
    .stage('threePtMollyLoose', {
      board: ({ bets }: StageContext) => {
        bets.passLine(10).withOdds(50);
        bets.come(10).withOdds(50);
        bets.come(10).withOdds(50);
      },
      mustRetreatTo: (session) =>
        session.profit < 150 || session.consecutiveSevenOuts >= 2
          ? 'threePtMollyTight'
          : undefined,
    })

    .build();
}

/**
 * Creates a fresh CATSAccumulatorOnly strategy.
 *
 * This is the Accumulator component of CATS in isolation — Place 6/8 at $18,
 * then de-leverage to $12 on the first 6 or 8 hit. No further advancement.
 *
 * Register in StrategyRegistry as: `'CATSAccumulatorOnly': CATSAccumulatorOnly()`
 */
export function CATSAccumulatorOnly() {
  return stageMachine('CATSAccumulatorOnly')
    .startingAt('accumulatorFull')

    // --- Stage 1: Full ---
    // Place 6/8 at $18 each. On first hit of 6 or 8, de-leverage to regressed.
    .stage('accumulatorFull', {
      board: ({ bets }: StageContext) => {
        bets.place(6, 18);
        bets.place(8, 18);
      },
      canAdvanceTo: () => true,
      on: {
        numberHit: ({ number }, { advanceTo }) => {
          if (number === 6 || number === 8) {
            advanceTo('accumulatorRegressed');
          }
        },
      },
    })

    // --- Stage 2: Regressed (terminal) ---
    // Place 6/8 at $12 each. No further advancement — grind indefinitely.
    .stage('accumulatorRegressed', {
      board: ({ bets }: StageContext) => {
        bets.place(6, 12);
        bets.place(8, 12);
      },
    })

    .build();
}

/**
 * Tiered odds for ThreePtMollyTight based on coverage.
 *
 * Sweet spot (6/8 + 5/9 covered): 3×/2×/1× = $30/$20/$10
 * Middle (6/8 covered, no 5/9): 2×/1×/1× = $20/$10/$10
 * Rough (no 6/8): 1×/1×/1× = $10/$10/$10
 */
function tieredOdds(table: TableReadView) {
  if (table.hasSixOrEight && hasPointInSet(table.coverage, [5, 9])) {
    return { passLine: 30, come1: 20, come2: 10 };
  } else if (table.hasSixOrEight) {
    return { passLine: 20, come1: 10, come2: 10 };
  }
  return { passLine: 10, come1: 10, come2: 10 };
}

// ---------------------------------------------------------------------------
// BATS — Bearish Alpha-Transition Strategy
// ---------------------------------------------------------------------------

/**
 * Compute the lay amount required to win targetWin on a given point number.
 * Lay odds are inverse of pass odds: you lay more to win less.
 *   4 / 10: lay 2:1  (risk $2 to win $1)
 *   5 / 9:  lay 3:2  (risk $3 to win $2)
 *   6 / 8:  lay 6:5  (risk $6 to win $5)
 */
function layAmountToWin(point: number, targetWin: number): number {
  const ratios: Record<number, number> = {
    4: 2.0, 10: 2.0,
    5: 1.5,  9: 1.5,
    6: 1.2,  8: 1.2,
  };
  return Math.ceil(targetWin * ratios[point]);
}

/**
 * Creates a fresh BATS strategy. Each call produces an independent runtime.
 * Register in StrategyRegistry as: `'BATS': BATS()`
 */
export function BATS() {
  return stageMachine('BATS')
    .startingAt('bearishAccumulator')

    // --- Stage 1: Bearish Accumulator ---
    // Don't Pass only. Lay odds sized to win 1 unit ($10).
    // Advance at profit ≥ +$120.
    .stage('bearishAccumulator', {
      board: ({ bets, table, session, advanceTo }: StageContext) => {
        if (!table.point) {
          bets.dontPass(10);
        } else {
          bets.dontPass(10).withOdds(layAmountToWin(table.point, 10));
        }
        if (session.profit >= 120) advanceTo('littleDolly');
      },
      canAdvanceTo: (_target, session) => session.profit >= 120,
    })

    // --- Stage 2: Little Dolly ---
    // Don't Pass + 1 Don't Come, both with 2× lay odds.
    // Retreat: 2 consecutive come-out losses OR profit drops below +$120.
    // Advance at profit ≥ +$225.
    .stage('littleDolly', {
      board: ({ bets, table, session, advanceTo }: StageContext) => {
        if (!table.point) {
          bets.dontPass(10);
        } else {
          const layAmt = layAmountToWin(table.point, 20); // 2× odds: win $20
          bets.dontPass(10).withOdds(layAmt);
          bets.dontCome(10).withOdds(layAmt);
        }
        if (session.profit >= 225) advanceTo('threePtDolly');
      },
      canAdvanceTo: (_target, session) => session.profit >= 225,
      mustRetreatTo: (session) => {
        if (session.consecutiveComeOutLosses >= 2) return 'bearishAccumulator';
        if (session.profit < 120) return 'bearishAccumulator';
        return undefined;
      },
    })

    // --- Stage 3: Three-Point Dolly ---
    // Don't Pass + 2 Don't Come, all with 5× lay odds (win $50 in odds).
    // Retreat: point repeater streak ≥ 2 OR profit drops below +$225.
    // Advance at profit ≥ +$350.
    .stage('threePtDolly', {
      board: ({ bets, table, session, advanceTo }: StageContext) => {
        if (!table.point) {
          bets.dontPass(10);
        } else {
          const layAmt = layAmountToWin(table.point, 50); // 5× odds: win $50
          bets.dontPass(10).withOdds(layAmt);
          bets.dontCome(10).withOdds(layAmt);
          bets.dontCome(10).withOdds(layAmt);
        }
        if (session.profit >= 350) advanceTo('expandedDarkAlpha');
      },
      canAdvanceTo: (_target, session) => session.profit >= 350,
      mustRetreatTo: (session) => {
        if (session.pointRepeaterStreak >= 2) return 'littleDolly';
        if (session.profit < 225) return 'littleDolly';
        return undefined;
      },
    })

    // --- Stage 4: Expanded Dark Alpha ---
    // Full Dolly (DP + 2 DC + 5× lay odds) plus Lay 4 and Lay 10,
    // skipped when a Don't Come bet already covers those numbers (Swap Rule).
    // Retreat: profit drops below +$350.
    // Advance at profit ≥ +$500.
    .stage('expandedDarkAlpha', {
      board: ({ bets, table, session, advanceTo }: StageContext) => {
        if (!table.point) {
          bets.dontPass(10);
        } else {
          const layAmt = layAmountToWin(table.point, 50);
          bets.dontPass(10).withOdds(layAmt);
          bets.dontCome(10).withOdds(layAmt);
          bets.dontCome(10).withOdds(layAmt);
        }
        // Swap Rule: skip Lay if a DC bet has already traveled to that number.
        if (!table.dontCoverage.has(4))  bets.lay(4, 40);  // Lay $40 → win $20 on 4
        if (!table.dontCoverage.has(10)) bets.lay(10, 40); // Lay $40 → win $20 on 10
        if (session.profit >= 500) advanceTo('maxDarkAlpha');
      },
      canAdvanceTo: (_target, session) => session.profit >= 500,
      mustRetreatTo: (session) => {
        if (session.profit < 350) return 'threePtDolly';
        return undefined;
      },
    })

    // --- Stage 5: Max Dark Alpha (terminal) ---
    // Full Dolly + Lay 4, 5, 9, 10 — maximum dark-side coverage.
    // Swap Rule applies to all four lay numbers.
    // Retreat: profit drops below +$500.
    .stage('maxDarkAlpha', {
      board: ({ bets, table }: StageContext) => {
        if (!table.point) {
          bets.dontPass(10);
        } else {
          const layAmt = layAmountToWin(table.point, 50);
          bets.dontPass(10).withOdds(layAmt);
          bets.dontCome(10).withOdds(layAmt);
          bets.dontCome(10).withOdds(layAmt);
        }
        if (!table.dontCoverage.has(4))  bets.lay(4,  40); // win $20
        if (!table.dontCoverage.has(5))  bets.lay(5,  30); // lay $30 → win $20
        if (!table.dontCoverage.has(9))  bets.lay(9,  30); // lay $30 → win $20
        if (!table.dontCoverage.has(10)) bets.lay(10, 40); // win $20
      },
      mustRetreatTo: (session) => {
        if (session.profit < 500) return 'expandedDarkAlpha';
        return undefined;
      },
    })

    .build();
}

function hasPointInSet(coverage: ReadonlySet<number>, points: number[]): boolean {
  return points.some(p => coverage.has(p));
}
