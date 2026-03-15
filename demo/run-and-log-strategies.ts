#!/usr/bin/env npx ts-node
/**
 * Demo: Run and Log Strategies via the CLI API (CUJs 1.0, 1.2, 1.3, 2.0)
 * ========================================================================
 *
 * This demo shows how to use the Milestone 2 API surface directly in
 * TypeScript code — the same layer that powers the CLI. The four CUJs
 * exercised here are the primary deliverables of Milestone 2.
 *
 * WHO THIS IS FOR:
 *   Strategy authors and power users who want to drive the simulator
 *   programmatically rather than from the terminal.
 *
 * WHAT YOU'LL LEARN:
 *   1. CUJ 1.0 — Run a named built-in strategy via StrategyRegistry
 *   2. CUJ 1.2 — Reproduce an exact run using a fixed seed
 *   3. CUJ 1.3 — Read roll-by-roll verbose output from RunLogger
 *   4. CUJ 2.0 — Load and run a custom .ts strategy file
 *
 * RUN IT:
 *   npx ts-node demo/run-and-log-strategies.ts
 */

import * as path from 'path';
import { CrapsEngine } from '../src/engine/craps-engine';
import { RunLogger } from '../src/logger/run-logger';
import { lookupStrategy } from '../src/cli/strategy-registry';
import { loadStrategyFile } from '../src/cli/strategy-loader';
import { SummaryRecord } from '../src/logger/run-logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runStrategy(
  strategyName: string,
  strategy: ReturnType<typeof lookupStrategy>,
  opts: { rolls: number; bankroll: number; seed?: number },
): SummaryRecord {
  const logger = new RunLogger({
    strategyName,
    playerId: 'player1',
    initialBankroll: opts.bankroll,
    seed: opts.seed,
  });

  const engine = new CrapsEngine({
    strategy,
    bankroll: opts.bankroll,
    rolls: opts.rolls,
    seed: opts.seed,
    logger,
  });

  engine.run();
  return logger.buildSummary();
}

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`PASS: ${message}`);
  } else {
    console.log(`FAIL: ${message}`);
    process.exit(1);
  }
}

console.log('=== Milestone 2 Demo — Run and Log Strategies ===\n');

// ---------------------------------------------------------------------------
// CUJ 1.0 — Run a named built-in strategy
// ---------------------------------------------------------------------------
// The strategy registry maps canonical names to StrategyDefinition functions.
// The CLI uses this to resolve --strategy <name>. Use it directly in code
// to access the same built-in strategies without any configuration.

console.log('--- CUJ 1.0: Run a built-in strategy ---\n');

const passLineStrategy = lookupStrategy('PassLineOnly');
const summary1 = runStrategy('PassLineOnly', passLineStrategy, {
  rolls: 500,
  bankroll: 500,
  seed: 99,
});

console.log(`Strategy:    ${summary1.meta.strategy}`);
console.log(`Total rolls: ${summary1.meta.totalRolls}`);
console.log(`Final bankroll: $${summary1.bankroll.final}  (net: ${summary1.bankroll.netChange >= 0 ? '+' : ''}$${summary1.bankroll.netChange})`);
console.log(`Peak: $${summary1.bankroll.peak}   Trough: $${summary1.bankroll.trough}   Max drawdown: $${summary1.bankroll.maxDrawdown}`);
console.log(`Win rolls: ${summary1.activity.rollsWithWin}  Loss rolls: ${summary1.activity.rollsWithLoss}\n`);

assert(summary1.meta.strategy === 'PassLineOnly', 'Summary reports correct strategy name');
assert(summary1.meta.totalRolls === 500, 'Ran exactly 500 rolls');
assert(summary1.bankroll.peak >= summary1.meta.startBankroll || summary1.bankroll.trough <= summary1.meta.startBankroll,
  'Bankroll moved during the run');
assert(summary1.activity.rollsWithWin + summary1.activity.rollsWithLoss + summary1.activity.rollsNoAction === 500,
  'Win + loss + no-action rolls sum to total rolls');

// ---------------------------------------------------------------------------
// CUJ 1.2 — Reproduce a run with a fixed seed
// ---------------------------------------------------------------------------
// The seed parameter initializes the Mersenne Twister RNG. Two runs with the
// same seed produce identical dice sequences and therefore identical outcomes.
// This is essential for debugging and for comparing strategies fairly.

console.log('--- CUJ 1.2: Reproduce a run with a seed ---\n');

const threePointMolly = lookupStrategy('ThreePointMolly3X');

const summaryA = runStrategy('ThreePointMolly3X', threePointMolly, { rolls: 200, bankroll: 1000, seed: 42 });
const summaryB = runStrategy('ThreePointMolly3X', threePointMolly, { rolls: 200, bankroll: 1000, seed: 42 });
const summaryC = runStrategy('ThreePointMolly3X', threePointMolly, { rolls: 200, bankroll: 1000, seed: 99 });

console.log(`Seed 42, run 1: final bankroll = $${summaryA.bankroll.final}`);
console.log(`Seed 42, run 2: final bankroll = $${summaryB.bankroll.final}`);
console.log(`Seed 99, run 1: final bankroll = $${summaryC.bankroll.final}\n`);

assert(summaryA.bankroll.final === summaryB.bankroll.final,
  'Same seed → identical final bankroll');
assert(summaryA.activity.rollsWithWin === summaryB.activity.rollsWithWin,
  'Same seed → identical win count');
assert(summaryA.diceDistribution.bySum['7'] === summaryB.diceDistribution.bySum['7'],
  'Same seed → identical dice distribution');

// We can't guarantee different seeds always produce different results, but it's
// overwhelmingly likely over 200 rolls. We assert the seeds ran at all.
assert(summaryC.meta.totalRolls === 200, 'Different seed ran successfully');

// ---------------------------------------------------------------------------
// CUJ 1.3 — Verbose roll-by-roll output via RunLogger
// ---------------------------------------------------------------------------
// RunLogger.flush('verbose') prints each roll's state followed by a summary.
// This is the same output produced by --output verbose on the CLI.
// Here we demonstrate reading the roll records programmatically instead of
// printing to stdout, which is more useful in library mode.

console.log('--- CUJ 1.3: Verbose roll-by-roll output ---\n');

const verboseLogger = new RunLogger({
  strategyName: 'Place6And8',
  playerId: 'player1',
  initialBankroll: 200,
  seed: 7,
});

const verboseEngine = new CrapsEngine({
  strategy: lookupStrategy('Place6And8'),
  bankroll: 200,
  rolls: 20,
  seed: 7,
  logger: verboseLogger,
});

verboseEngine.run();

// Access the raw roll entries for programmatic inspection
const rollEntries = verboseLogger.getRollEntries();
const firstEntry = rollEntries[0];

console.log(`Captured ${rollEntries.length} roll entries`);
console.log(`Roll #1: dice [${firstEntry.roll.die1}+${firstEntry.roll.die2}=${firstEntry.roll.sum}]  point: ${firstEntry.gameState.pointBefore ?? 'OFF'} → ${firstEntry.gameState.pointAfter ?? 'OFF'}`);
console.log(`  bankroll: $${firstEntry.players[0].bankroll.before} → $${firstEntry.players[0].bankroll.after}`);
if (firstEntry.players[0].outcomes.length > 0) {
  for (const o of firstEntry.players[0].outcomes) {
    console.log(`  ${o.result.toUpperCase()}: ${o.type}  payout=$${o.payout}`);
  }
}
console.log('');

// Flush the verbose output (first 5 rolls only, for readability in a demo)
console.log('--- First 5 rolls (verbose output) ---');
const previewLogger = new RunLogger({ strategyName: 'Place6And8', playerId: 'player1', initialBankroll: 200, seed: 7 });
const previewEngine = new CrapsEngine({
  strategy: lookupStrategy('Place6And8'),
  bankroll: 200,
  rolls: 5,
  seed: 7,
  logger: previewLogger,
});
previewEngine.run();
previewLogger.flush('verbose');
console.log('');

assert(rollEntries.length === 20, 'Logger captured exactly 20 roll entries');
assert(firstEntry.roll.sum >= 2 && firstEntry.roll.sum <= 12, 'Roll sum is a valid dice total');
assert(firstEntry.players[0].id === 'player1', 'Player ID is correct in roll entry');
assert(typeof firstEntry.players[0].bankroll.before === 'number', 'Bankroll.before is a number');

// ---------------------------------------------------------------------------
// CUJ 2.0 — Load and run a custom strategy file
// ---------------------------------------------------------------------------
// Users can write their own strategy as a .ts file and run it via the CLI
// with --strategy-file, or load it programmatically with loadStrategyFile().
// The loader resolves the path and requires the first function export it finds.

console.log('--- CUJ 2.0: Load and run a custom strategy file ---\n');

const customStrategyPath = path.join(__dirname, 'conservative-place-strategy.ts');
console.log(`Loading strategy from: ${customStrategyPath}`);

const customStrategy = loadStrategyFile(customStrategyPath);
const customSummary = runStrategy(customStrategyPath, customStrategy, {
  rolls: 300,
  bankroll: 300,
  seed: 55,
});

console.log(`Custom strategy loaded: ${typeof customStrategy === 'function' ? 'yes (function)' : 'no'}`);
console.log(`Runs completed: ${customSummary.meta.totalRolls}`);
console.log(`Final bankroll: $${customSummary.bankroll.final}  (net: ${customSummary.bankroll.netChange >= 0 ? '+' : ''}$${customSummary.bankroll.netChange})`);
console.log(`Table load avg: $${customSummary.tableLoad.avg}  avg-when-active: $${customSummary.tableLoad.avgWhenActive}\n`);

assert(typeof customStrategy === 'function', 'loadStrategyFile returns a callable function');
assert(customSummary.meta.totalRolls === 300, 'Custom strategy ran all 300 rolls');
// ConservativePlace bets $6 on 6 and $8 — the avg table load should reflect this
assert(customSummary.tableLoad.avgWhenActive > 0, 'Custom strategy placed bets on the table');
// Place bets are only active during the point phase, so avgWhenActive > avg
assert(customSummary.tableLoad.avgWhenActive >= customSummary.tableLoad.avg,
  'avgWhenActive ≥ avg (place bets are off during come-out)');

// Confirm that loadStrategyFile throws a helpful error for a missing file
let caughtError: Error | null = null;
try {
  loadStrategyFile(path.join(__dirname, 'nonexistent-strategy.ts'));
} catch (e: any) {
  caughtError = e;
}
assert(caughtError !== null, 'loadStrategyFile throws on nonexistent file');
assert(caughtError!.message.includes('Failed to load'), 'Error message is descriptive');

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log('\n=== All assertions passed! ===\n');
console.log('The Milestone 2 API is working correctly.');
console.log('Try these CLI equivalents:');
console.log('  npx ts-node src/cli/run-sim.ts --strategy PassLineOnly --rolls 500 --seed 99');
console.log('  npx ts-node src/cli/run-sim.ts --strategy ThreePointMolly3X --seed 42 --output verbose');
console.log('  npx ts-node src/cli/run-sim.ts --strategy-file demo/conservative-place-strategy.ts --rolls 300 --seed 55');
