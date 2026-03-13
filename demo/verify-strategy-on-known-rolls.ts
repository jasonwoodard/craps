#!/usr/bin/env npx ts-node
/**
 * Demo: Verify a Strategy on a Known Roll Sequence (CUJ 4.0)
 * ============================================================
 *
 * This demo shows how to use the craps simulator's core engine to
 * verify that a strategy behaves correctly on a predetermined dice
 * sequence. This is the primary user journey unlocked by Milestone 1.
 *
 * WHO THIS IS FOR:
 *   Debuggers, testers, and strategy authors who want deterministic,
 *   reproducible verification of strategy behavior — no randomness involved.
 *
 * WHAT YOU'LL LEARN:
 *   1. How to define a strategy using the DSL
 *   2. How to inject a rigged dice sequence via RiggedDice
 *   3. How to run CrapsEngine and inspect roll-by-roll results
 *   4. How to assert on outcomes, bankroll changes, and point transitions
 *
 * RUN IT:
 *   npx ts-node demo/verify-strategy-on-known-rolls.ts
 */

import { CrapsEngine, RollRecord } from '../src/engine/craps-engine';
import { StrategyDefinition } from '../src/dsl/strategy';
import { RiggedDice } from '../spec/dice/rigged-dice';
import { BetTypes } from '../src/bets/base-bet';

// ---------------------------------------------------------------------------
// STEP 1: Define a strategy
// ---------------------------------------------------------------------------
// Strategies are plain functions that declare desired bets. The engine's
// reconciler diffs your desired state against the table and issues commands
// to place, remove, or update bets automatically.
//
// This strategy: always have a $10 Pass Line bet with $20 odds,
// plus Place bets on 6 and 8 for $12 each.

const PassLineWithPlace68: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(20);
  bets.place(6, 12);
  bets.place(8, 12);
};

// ---------------------------------------------------------------------------
// STEP 2: Script a known dice sequence
// ---------------------------------------------------------------------------
// RiggedDice lets you control exactly what the dice produce on each roll.
// This removes all randomness so you can verify strategy logic step by step.
//
// Our sequence tells a clear story:
//   Roll 1: 7  → Come-out win (natural). Pass Line pays even money.
//   Roll 2: 6  → Establishes 6 as the point. Place bets are now active.
//   Roll 3: 8  → Place 8 wins (pays 7:6). Point is still 6.
//   Roll 4: 6  → Point made! Pass Line + odds win. Place 6 also wins.
//   Roll 5: 9  → New come-out, establishes 9 as the point.
//   Roll 6: 7  → Seven-out. Pass Line loses. Place bets lose.

const diceSequence = [7, 6, 8, 6, 9, 7];

// ---------------------------------------------------------------------------
// STEP 3: Create and run the engine
// ---------------------------------------------------------------------------
// CrapsEngine ties everything together: strategy, bankroll, roll count,
// and dice source. Inject RiggedDice for deterministic testing.

const engine = new CrapsEngine({
  strategy: PassLineWithPlace68,
  bankroll: 500,
  rolls: diceSequence.length,
  dice: new RiggedDice(diceSequence),
});

const result = engine.run();

// ---------------------------------------------------------------------------
// STEP 4: Inspect results roll by roll
// ---------------------------------------------------------------------------
// Each RollRecord captures the full state at that point:
//   - rollValue:      what the dice showed
//   - pointBefore/After: the table point before and after the roll
//   - outcomes[]:     win/loss results for each resolved bet
//   - bankrollBefore/After: your money before and after settlement

console.log('=== Verify Strategy on Known Roll Sequence (CUJ 4.0) ===\n');
console.log(`Starting bankroll: $${result.initialBankroll}`);
console.log(`Rolls played:      ${result.rollsPlayed}\n`);

for (const roll of result.rolls) {
  printRoll(roll);
}

console.log('--- Final Summary ---');
console.log(`Final bankroll: $${result.finalBankroll}`);
console.log(`Net result:     ${result.finalBankroll >= result.initialBankroll ? '+' : ''}$${result.finalBankroll - result.initialBankroll}`);

// ---------------------------------------------------------------------------
// STEP 5: Programmatic assertions
// ---------------------------------------------------------------------------
// In a real test you'd use Jasmine/Jest. Here we use simple checks to show
// the kind of verification you can do.

console.log('\n=== Assertions ===\n');

// Roll 1: come-out 7 → Pass Line wins $10 (even money)
assertRoll(result.rolls[0], {
  rollValue: 7,
  pointBefore: undefined,   // no point established yet
  pointAfter: undefined,     // natural — point stays off
  expectWin: true,
  description: 'Come-out 7: Pass Line wins even money',
});

// Roll 2: 6 → establishes point
assertRoll(result.rolls[1], {
  rollValue: 6,
  pointBefore: undefined,
  pointAfter: 6,
  expectWin: false,
  description: 'Roll 6: point established at 6',
});

// Roll 3: 8 → Place 8 wins (7:6 payout on $12 = $14)
assertRoll(result.rolls[2], {
  rollValue: 8,
  pointBefore: 6,
  pointAfter: 6,           // point unchanged
  expectWin: true,
  description: 'Roll 8: Place 8 wins while point is 6',
});

// Roll 4: 6 → Point made! Pass Line + odds + Place 6 all win
assertRoll(result.rolls[3], {
  rollValue: 6,
  pointBefore: 6,
  pointAfter: undefined,   // point clears after being made
  expectWin: true,
  description: 'Roll 6: Point made — Pass Line, odds, and Place 6 win',
});

// Roll 6: 7 → Seven-out
assertRoll(result.rolls[5], {
  rollValue: 7,
  pointBefore: 9,
  pointAfter: undefined,   // point clears on seven-out
  expectWin: false,
  description: 'Seven-out: all bets lose',
});

console.log('\nAll assertions passed!');

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function printRoll(roll: RollRecord): void {
  const pointStr = (p: number | undefined) => p != null ? String(p) : 'OFF';
  const phase = roll.pointBefore == null ? 'come-out' : 'point';

  console.log(`Roll #${roll.rollNumber}: dice=${roll.rollValue}  point: ${pointStr(roll.pointBefore)} → ${pointStr(roll.pointAfter)}  [${phase}]`);

  if (roll.outcomes.length > 0) {
    for (const o of roll.outcomes) {
      const betName = BetTypes[o.betType];
      const pointInfo = o.point != null ? ` (${o.point})` : '';
      console.log(`  ${o.result.toUpperCase()}: ${betName}${pointInfo}  wager=$${o.amount}  payout=$${o.payout}`);
    }
  } else {
    console.log('  (no bets resolved)');
  }
  console.log(`  Bankroll: $${roll.bankrollBefore} → $${roll.bankrollAfter}\n`);
}

interface AssertionOpts {
  rollValue: number;
  pointBefore: number | undefined;
  pointAfter: number | undefined;
  expectWin: boolean;
  description: string;
}

function assertRoll(roll: RollRecord, opts: AssertionOpts): void {
  let passed = true;
  const errors: string[] = [];

  if (roll.rollValue !== opts.rollValue) {
    errors.push(`  expected rollValue=${opts.rollValue}, got ${roll.rollValue}`);
    passed = false;
  }
  if (roll.pointBefore !== opts.pointBefore) {
    errors.push(`  expected pointBefore=${opts.pointBefore}, got ${roll.pointBefore}`);
    passed = false;
  }
  if (roll.pointAfter !== opts.pointAfter) {
    errors.push(`  expected pointAfter=${opts.pointAfter}, got ${roll.pointAfter}`);
    passed = false;
  }

  const hasWin = roll.outcomes.some(o => o.result === 'win');
  if (opts.expectWin && !hasWin) {
    errors.push('  expected at least one winning outcome, but found none');
    passed = false;
  }
  if (!opts.expectWin && hasWin) {
    errors.push('  expected no winning outcomes, but found one');
    passed = false;
  }

  if (passed) {
    console.log(`PASS: ${opts.description}`);
  } else {
    console.log(`FAIL: ${opts.description}`);
    for (const e of errors) console.log(e);
    process.exit(1);
  }
}
