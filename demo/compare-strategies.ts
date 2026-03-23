#!/usr/bin/env npx ts-node
/**
 * Milestone 3 Demo — Multi-Strategy Comparison (CUJs 1.1, 3.0, 3.1)
 * ==================================================================
 *
 * This demo shows how to use SharedTable — the M3 comparison engine —
 * to run multiple strategies on identical dice. Three primary M3 user
 * journeys are exercised here.
 *
 * WHO THIS IS FOR:
 *   Casual users, strategy authors, and researchers who want to compare
 *   strategies programmatically or understand what the --compare CLI flag
 *   does under the hood.
 *
 * WHAT YOU'LL LEARN:
 *   1. CUJ 1.1 — Compare two built-in strategies on identical dice
 *   2. CUJ 3.1 — Compare five strategies in a single programmatic run
 *   3. CUJ 3.0 — Loop over many seeds and collect aggregate statistics
 *
 * RUN IT:
 *   npx ts-node demo/compare-strategies.ts
 */

import { SharedTable } from '../src/engine/shared-table';
import { lookupStrategy } from '../src/cli/strategy-registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function avg(arr: number[]): number {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

// Count seven-outs from a roll log: a seven-out is a roll of 7 during the
// point phase (pointBefore is set). This is derived from raw RollRecord data
// — no special logging needed.
function countSevenOuts(log: ReturnType<SharedTable['run']>[string]['log']): number {
  return log.filter(r => r.rollValue === 7 && r.pointBefore != null).length;
}

console.log('=== Milestone 3 Demo — Multi-Strategy Comparison ===\n');

// ---------------------------------------------------------------------------
// CUJ 1.1 — Two strategies, head-to-head on the same dice
// ---------------------------------------------------------------------------
// SharedTable accepts multiple strategies and rolls the dice exactly once per
// turn. Every strategy sees the same sequence of numbers, so any difference
// in final bankroll is purely a function of strategy logic — not luck.
//
// CLI equivalent:
//   npx ts-node run-sim.ts \
//     --compare ThreePointMolly3X Place6And8 \
//     --rolls 10000 --bankroll 500 --seed 42

console.log('--- CUJ 1.1: Two-strategy head-to-head comparison ---\n');

const SEED = 42;
const ROLLS = 10000;
const BANKROLL = 500;

// Step 1: Create a SharedTable with a fixed seed.
//   seed  — initialises the Mersenne Twister; same seed → same dice every run
//   rolls — maximum number of dice rolls before the run ends
const table1 = new SharedTable({ seed: SEED, rolls: ROLLS });

// Step 2: Register each strategy with its starting bankroll.
//   Both strategies share the same table, so they get exactly the same rolls.
table1.addStrategy('ThreePointMolly3X', lookupStrategy('ThreePointMolly3X'), { bankroll: BANKROLL });
table1.addStrategy('Place6And8',        lookupStrategy('Place6And8'),        { bankroll: BANKROLL });

// Step 3: Run. Results come back as a keyed object — one entry per strategy.
const results1 = table1.run();

// Step 4: Read the results.
const mollyResult = results1['ThreePointMolly3X'];
const placeResult = results1['Place6And8'];

// Print side-by-side summary
console.log('  Strategy           Final $   Net         Seven-outs');
console.log('  ────────────────────────────────────────────────────');
for (const [name, r] of Object.entries(results1)) {
  const net = r.netChange >= 0 ? `+$${r.netChange}` : `-$${Math.abs(r.netChange)}`;
  const sevenOuts = countSevenOuts(r.log);
  console.log(
    `  ${name.padEnd(18)} $${String(r.finalBankroll).padStart(5)}  ${net.padStart(8)}   ${sevenOuts}`
  );
}
console.log('');

// Verify that both strategies saw the exact same dice sequence.
// We compare every roll in the log — this is stronger than just checking
// that both runs used the same seed, because it catches any accidental
// RNG-state divergence inside SharedTable.
assert(mollyResult.log.length === placeResult.log.length,
  'Both strategies ran the same number of rolls');

for (let i = 0; i < mollyResult.log.length; i++) {
  assert(
    mollyResult.log[i].rollValue === placeResult.log[i].rollValue,
    `Roll ${i + 1}: same value across both strategies`
  );
}

assert(mollyResult.log[0].rollValue >= 2 && mollyResult.log[0].rollValue <= 12,
  'Roll values are valid dice totals (2–12)');

console.log(`  PASS: Both strategies saw the exact same ${mollyResult.log.length}-roll dice sequence.`);
console.log(`  PASS: ThreePointMolly3X ended at $${mollyResult.finalBankroll}.`);
console.log(`  PASS: Place6And8 ended at $${placeResult.finalBankroll}.`);
console.log('');

// ---------------------------------------------------------------------------
// CUJ 3.1 — Five strategies in a single comparison run
// ---------------------------------------------------------------------------
// addStrategy() can be called as many times as needed. All registered
// strategies share one dice sequence. Results are structured data — you can
// sort, filter, and aggregate them however you like.
//
// CLI equivalent:
//   npx ts-node run-sim.ts \
//     --compare ThreePointMolly3X ThreePointMolly5X Place6And8 PlaceInside PassLineOnly \
//     --rolls 10000 --bankroll 500 --seed 42

console.log('--- CUJ 3.1: Five-strategy comparison ---\n');

const STRATEGY_NAMES = [
  'ThreePointMolly3X',
  'ThreePointMolly5X',
  'Place6And8',
  'PlaceInside',
  'PassLineOnly',
];

const table2 = new SharedTable({ seed: SEED, rolls: ROLLS });
for (const name of STRATEGY_NAMES) {
  table2.addStrategy(name, lookupStrategy(name), { bankroll: BANKROLL });
}
const results2 = table2.run();

// Sort by final bankroll descending so the best performer is listed first
const ranked = Object.entries(results2).sort((a, b) => b[1].finalBankroll - a[1].finalBankroll);

console.log('  Rank  Strategy           Final $   Net');
console.log('  ────────────────────────────────────────────');
ranked.forEach(([name, r], i) => {
  const net = r.netChange >= 0 ? `+$${r.netChange}` : `-$${Math.abs(r.netChange)}`;
  console.log(`  ${String(i + 1).padEnd(6)}${name.padEnd(18)} $${String(r.finalBankroll).padStart(5)}  ${net.padStart(8)}`);
});
console.log('');

// All strategies must have seen identical dice
const firstLog = results2[STRATEGY_NAMES[0]].log;
for (const name of STRATEGY_NAMES.slice(1)) {
  const otherLog = results2[name].log;
  assert(firstLog.length === otherLog.length,
    `"${name}" ran the same number of rolls as "${STRATEGY_NAMES[0]}"`);
  for (let i = 0; i < firstLog.length; i++) {
    assert(
      firstLog[i].rollValue === otherLog[i].rollValue,
      `Roll ${i + 1}: "${name}" saw the same value as "${STRATEGY_NAMES[0]}"`
    );
  }
}

// Results are structured data objects — not just printed text
assert(typeof ranked[0][1].finalBankroll === 'number', 'finalBankroll is a number');
assert(Array.isArray(ranked[0][1].log), 'log is an array of RollRecord objects');
assert(ranked[0][1].summary != null, 'summary object is present');
assert(ranked[0][1].summary.bankroll.netChange === ranked[0][1].netChange,
  'summary.bankroll.netChange matches result.netChange');

console.log(`  PASS: All ${STRATEGY_NAMES.length} strategies saw identical dice.`);
console.log(`  PASS: Best performer: ${ranked[0][0]} ($${ranked[0][1].finalBankroll}).`);
console.log(`  PASS: Worst performer: ${ranked[ranked.length - 1][0]} ($${ranked[ranked.length - 1][1].finalBankroll}).`);
console.log('  PASS: Results returned as structured data objects.');
console.log('');

// ---------------------------------------------------------------------------
// CUJ 3.0 — Use SharedTable as a library: sweep across many seeds
// ---------------------------------------------------------------------------
// Because SharedTable is a plain TypeScript class you can import it directly,
// it composes naturally with any TypeScript control flow. Here we loop over
// 20 seeds, run a two-strategy comparison on each, and tally which strategy
// finished ahead more often.
//
// This kind of multi-seed analysis would be impossible without a programmatic
// API. With SharedTable it is just a for loop.

console.log('--- CUJ 3.0: Sweep 20 seeds — ThreePointMolly3X vs Place6And8 ---\n');

const NUM_SEEDS = 20;
const SWEEP_ROLLS = 5000;

const wins: Record<string, number> = { ThreePointMolly3X: 0, Place6And8: 0, tie: 0 };
const finals: Record<string, number[]> = { ThreePointMolly3X: [], Place6And8: [] };

for (let seed = 0; seed < NUM_SEEDS; seed++) {
  const t = new SharedTable({ seed, rolls: SWEEP_ROLLS });
  t.addStrategy('ThreePointMolly3X', lookupStrategy('ThreePointMolly3X'), { bankroll: BANKROLL });
  t.addStrategy('Place6And8',        lookupStrategy('Place6And8'),        { bankroll: BANKROLL });
  const r = t.run();

  finals['ThreePointMolly3X'].push(r['ThreePointMolly3X'].finalBankroll);
  finals['Place6And8'].push(r['Place6And8'].finalBankroll);

  const mollyFinal = r['ThreePointMolly3X'].finalBankroll;
  const placeFinal = r['Place6And8'].finalBankroll;

  if (mollyFinal > placeFinal)      wins['ThreePointMolly3X']++;
  else if (placeFinal > mollyFinal) wins['Place6And8']++;
  else                              wins['tie']++;
}

console.log(`  Seeds: ${NUM_SEEDS}   Rolls per seed: ${SWEEP_ROLLS}   Starting bankroll: $${BANKROLL}`);
console.log('');
console.log('  Strategy           Wins   Avg final $   Min $   Max $');
console.log('  ──────────────────────────────────────────────────────');
for (const name of ['ThreePointMolly3X', 'Place6And8']) {
  const arr = finals[name];
  const minVal = Math.min(...arr);
  const maxVal = Math.max(...arr);
  console.log(
    `  ${name.padEnd(18)} ${String(wins[name]).padStart(4)}   $${String(avg(arr)).padStart(5)}        $${minVal}   $${maxVal}`
  );
}
if (wins['tie'] > 0) {
  console.log(`  Ties: ${wins['tie']}`);
}
console.log('');

assert(
  wins['ThreePointMolly3X'] + wins['Place6And8'] + wins['tie'] === NUM_SEEDS,
  'Win counts sum to total seeds'
);
assert(finals['ThreePointMolly3X'].length === NUM_SEEDS,
  `Collected ${NUM_SEEDS} bankroll readings for ThreePointMolly3X`);
assert(finals['Place6And8'].length === NUM_SEEDS,
  `Collected ${NUM_SEEDS} bankroll readings for Place6And8`);
assert(finals['ThreePointMolly3X'].every(n => typeof n === 'number' && n >= 0),
  'All ThreePointMolly3X final bankrolls are non-negative numbers');
assert(finals['Place6And8'].every(n => typeof n === 'number' && n >= 0),
  'All Place6And8 final bankrolls are non-negative numbers');

// Different seeds must produce meaningfully different outcomes
const uniqueMollyFinals = new Set(finals['ThreePointMolly3X']);
assert(uniqueMollyFinals.size > 1, 'Different seeds produced different final bankrolls');

console.log(`  PASS: Win counts sum to ${NUM_SEEDS}.`);
console.log('  PASS: Different seeds produced different outcomes.');
console.log('  PASS: All final bankrolls are valid non-negative numbers.');
console.log('');

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log('=== All assertions passed! ===\n');
console.log('The Milestone 3 SharedTable API is working correctly.');
console.log('');
console.log('Try the CLI equivalents:');
console.log('  npx ts-node run-sim.ts --compare ThreePointMolly3X Place6And8 --rolls 10000 --seed 42');
console.log('  npx ts-node run-sim.ts --compare ThreePointMolly3X ThreePointMolly5X Place6And8 PlaceInside PassLineOnly --rolls 10000 --seed 42');
