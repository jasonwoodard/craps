/**
 * Milestone 4 Demo — CATS vs ThreePointMolly3X
 *
 * CUJ: "I want to see how CATS performs against ThreePointMolly3X on the same dice."
 *
 * Demonstrates:
 * - Running CATS as a built-in named strategy via CrapsEngine
 * - Inspecting stage transitions via the StageMachineRuntime
 * - Comparing CATS vs ThreePointMolly3X with identical dice (same seed)
 * - Reading per-strategy summary statistics
 *
 * Run: npx ts-node demo/cats-vs-molly.ts
 */

import { CrapsEngine } from '../src/engine/craps-engine';
import { lookupStrategy } from '../src/cli/strategy-registry';
import { CATS } from '../src/dsl/strategies-staged';
import { STAGE_MACHINE_RUNTIME, StrategyDefinition } from '../src/dsl/strategy';
import { StageMachineRuntime } from '../src/dsl/stage-machine-state';

// --- Config ---
const SEED = 42;
const ROLLS = 10000;
const BANKROLL = 500;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

// === Part 1: Run CATS as a named strategy ===
console.log('=== Part 1: Run CATS via lookupStrategy ===\n');

const catsFromRegistry = lookupStrategy('CATS');
assert(typeof catsFromRegistry === 'function', 'CATS resolves from registry');
console.log('  CATS resolves from StrategyRegistry.');

// === Part 2: Run CATS with a fixed seed and inspect stage transitions ===
console.log('\n=== Part 2: CATS run with seed=%d, rolls=%d, bankroll=%d ===\n', SEED, ROLLS, BANKROLL);

const catsStrategy = CATS();
const catsEngine = new CrapsEngine({
  strategy: catsStrategy,
  bankroll: BANKROLL,
  rolls: ROLLS,
  seed: SEED,
});
const catsResult = catsEngine.run();

const runtime = (catsStrategy as any)[STAGE_MACHINE_RUNTIME] as StageMachineRuntime;
const session = runtime.getSessionState();

console.log('  Rolls played:         %d', catsResult.rollsPlayed);
console.log('  Final bankroll:       $%d', catsResult.finalBankroll);
console.log('  Net change:           %s$%d',
  catsResult.finalBankroll >= BANKROLL ? '+' : '-',
  Math.abs(catsResult.finalBankroll - BANKROLL));
console.log('  Final stage:          %s', session.stage);
console.log('  Hands played:         %d', session.handsPlayed);
console.log('  Consecutive 7-outs:   %d', session.consecutiveSevenOuts);
console.log('  Session profit:       $%d', session.profit);

assert(catsResult.rollsPlayed > 0, 'CATS completed rolls without throwing');

// === Part 3: Run ThreePointMolly3X with the SAME seed ===
console.log('\n=== Part 3: ThreePointMolly3X with same seed ===\n');

const molly3x = lookupStrategy('ThreePointMolly3X');
const mollyEngine = new CrapsEngine({
  strategy: molly3x,
  bankroll: BANKROLL,
  rolls: ROLLS,
  seed: SEED,
});
const mollyResult = mollyEngine.run();

console.log('  Rolls played:         %d', mollyResult.rollsPlayed);
console.log('  Final bankroll:       $%d', mollyResult.finalBankroll);
console.log('  Net change:           %s$%d',
  mollyResult.finalBankroll >= BANKROLL ? '+' : '-',
  Math.abs(mollyResult.finalBankroll - BANKROLL));

// === Part 4: Compare — verify identical dice ===
console.log('\n=== Part 4: Comparison — Identical Dice Verification ===\n');

// Both runs used seed=42, so dice sequences should be identical
const minRolls = Math.min(catsResult.rollsPlayed, mollyResult.rollsPlayed);
let diceMatch = true;
for (let i = 0; i < minRolls; i++) {
  if (catsResult.rolls[i].rollValue !== mollyResult.rolls[i].rollValue) {
    diceMatch = false;
    break;
  }
}
// Note: individual engine runs with the same seed produce identical dice
// because each CrapsEngine creates its own LiveDice with the same seed.
// This is NOT the same as SharedTable (which shares a single dice instance).
// The dice match as long as both engines consume RNG calls at the same rate.
// Since strategy bet decisions don't consume RNG calls, this holds.
console.log('  Dice match across %d shared rolls: %s', minRolls, diceMatch ? 'YES' : 'NO');

// === Part 5: Side-by-side summary ===
console.log('\n=== Part 5: Side-by-Side Summary ===\n');

function row(label: string, cats: string, molly: string): string {
  return `  ${label.padEnd(25)} ${cats.padStart(12)} ${molly.padStart(12)}`;
}
function money(val: number): string { return `$${val}`; }
function delta(final: number, initial: number): string {
  return final >= initial ? `+$${final - initial}` : `-$${initial - final}`;
}

console.log(row('Metric', 'CATS', 'Molly3X'));
console.log(row('-'.repeat(25), '-'.repeat(12), '-'.repeat(12)));
console.log(row('Rolls played', String(catsResult.rollsPlayed), String(mollyResult.rollsPlayed)));
console.log(row('Final bankroll', money(catsResult.finalBankroll), money(mollyResult.finalBankroll)));
console.log(row('Net change', delta(catsResult.finalBankroll, BANKROLL), delta(mollyResult.finalBankroll, BANKROLL)));

// Peak and trough
let catsPeak = BANKROLL, catsTrough = BANKROLL;
for (const roll of catsResult.rolls) {
  if (roll.bankrollAfter > catsPeak) catsPeak = roll.bankrollAfter;
  if (roll.bankrollAfter < catsTrough) catsTrough = roll.bankrollAfter;
}
let mollyPeak = BANKROLL, mollyTrough = BANKROLL;
for (const roll of mollyResult.rolls) {
  if (roll.bankrollAfter > mollyPeak) mollyPeak = roll.bankrollAfter;
  if (roll.bankrollAfter < mollyTrough) mollyTrough = roll.bankrollAfter;
}
console.log(row('Peak bankroll', money(catsPeak), money(mollyPeak)));
console.log(row('Trough bankroll', money(catsTrough), money(mollyTrough)));
console.log(row('Max drawdown', money(catsPeak - catsTrough), money(mollyPeak - mollyTrough)));

// === Self-verification ===
assert(catsResult.rollsPlayed > 0, 'CATS completed without error');
assert(mollyResult.rollsPlayed > 0, 'ThreePointMolly3X completed without error');

console.log('\n  All assertions passed. Demo complete.\n');
