/**
 * CATS — Calculated Advantage Timing Strategy
 *
 * A five-stage strategy implemented using the Stage Machine API.
 * Each call to CATS() returns a fresh StrategyDefinition with its own runtime.
 *
 * Stages:
 *   accumulatorFull    → Place 6/8 at $18 each. Transitions on first 6/8 hit.
 *   accumulatorRegressed → Place 6/8 at $12 each. Advances at profit ≥ +$70.
 *   littleMolly        → Pass $10 + 1 Come $10 + 2× odds. Advances at +$150.
 *   threePtMollyTight  → Pass + 2 Come + tiered odds. Shifts to Loose at +$200 w/ 6/8.
 *   threePtMollyLoose  → Pass + 2 Come + 5× odds. Terminal stage (no further advance).
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

function hasPointInSet(coverage: ReadonlySet<number>, points: number[]): boolean {
  return points.some(p => coverage.has(p));
}
