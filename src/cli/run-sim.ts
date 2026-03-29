#!/usr/bin/env npx ts-node
/**
 * run-sim.ts — CLI runner for single-strategy and multi-strategy comparison.
 *
 * Single-strategy usage:
 *   npx ts-node src/cli/run-sim.ts --strategy <name> [options]
 *   npx ts-node src/cli/run-sim.ts --strategy-file <path> [options]
 *
 * Comparison usage (M3.2 / M3.3):
 *   npx ts-node src/cli/run-sim.ts --compare <name1> <name2> [options]
 *   npx ts-node src/cli/run-sim.ts --compare-files <file1> <file2> [options]
 *   npx ts-node src/cli/run-sim.ts --compare <name> --strategy-file <file> [options]
 *
 * Shared flags:
 *   --rolls <n>                    Number of rolls (default: 10000).
 *   --bankroll <n>                 Starting bankroll (default: 500).
 *   --seed <n>                     RNG seed for reproducible runs (optional).
 *   --output summary|verbose|json  Output format (default: summary).
 */

import { CrapsEngine } from '../engine/craps-engine';
import { SharedTable, SharedTableResult } from '../engine/shared-table';
import { RunLogger } from '../logger/run-logger';
import { StrategyDefinition } from '../dsl/strategy';
import { lookupStrategy } from './strategy-registry';
import { loadStrategyFile } from './strategy-loader';
import { summarize, computeFullAggregates } from '../../server/lib/distribution';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CliArgs {
  // Single-strategy mode (mutually exclusive with compare/compareFiles)
  strategy?: string;
  strategyFile?: string;

  // Comparison mode (M3.2 / M3.3)
  compare?: string[];       // built-in strategy names to compare
  compareFiles?: string[];  // file paths to compare

  // Shared options
  rolls: number;
  bankroll: number;
  seed?: number;
  seeds?: number;
  output: 'summary' | 'verbose' | 'json' | 'distribution';
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv: string[]): CliArgs {
  const single: Record<string, string> = {};
  const multi: Record<string, string[]> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const key = arg.slice(2);

    if (key === 'compare' || key === 'compare-files') {
      // Greedily consume all subsequent non-flag tokens as values.
      const values: string[] = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        values.push(argv[++i]);
      }
      if (values.length === 0) {
        throw new Error(`Flag --${key} requires at least one value.`);
      }
      multi[key] = values;
    } else {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Flag --${key} requires a value.`);
      }
      single[key] = value;
      i++;
    }
  }

  const compare     = multi['compare'];
  const compareFiles = multi['compare-files'];
  const isCompareMode = compare != null || compareFiles != null;

  if (isCompareMode) {
    if (single['strategy']) {
      throw new Error(
        '--strategy cannot be used with --compare or --compare-files. ' +
        'Use --strategy-file to include a custom file in a comparison run.',
      );
    }
    const totalStrategies =
      (compare?.length ?? 0) +
      (compareFiles?.length ?? 0) +
      (single['strategy-file'] ? 1 : 0);
    if (totalStrategies < 2) {
      throw new Error(
        'Comparison mode requires at least 2 strategies. ' +
        'Examples: --compare A B, --compare-files ./a.ts ./b.ts, or --compare A --strategy-file ./b.ts',
      );
    }
  } else {
    if (!single['strategy'] && !single['strategy-file']) {
      throw new Error('Missing required flag: --strategy <name> or --strategy-file <path>');
    }
    if (single['strategy'] && single['strategy-file']) {
      throw new Error('--strategy and --strategy-file are mutually exclusive. Provide only one.');
    }
  }

  const rolls    = parsePositiveInt(single['rolls'],    'rolls',    10000);
  const bankroll = parsePositiveInt(single['bankroll'], 'bankroll', 500);

  let seed: number | undefined;
  if (single['seed'] !== undefined) {
    const parsed = Number(single['seed']);
    if (!Number.isInteger(parsed)) {
      throw new Error(`Invalid value for --seed: "${single['seed']}". Must be an integer.`);
    }
    seed = parsed;
  }

  const outputRaw = single['output'] ?? 'summary';
  if (outputRaw !== 'summary' && outputRaw !== 'verbose' && outputRaw !== 'json' && outputRaw !== 'distribution') {
    throw new Error(`Invalid value for --output: "${outputRaw}". Must be summary, verbose, json, or distribution.`);
  }

  let seeds: number | undefined;
  if (single['seeds'] !== undefined) {
    seeds = parsePositiveInt(single['seeds'], 'seeds', 500);
  }

  if (outputRaw === 'distribution') {
    if (seeds === undefined) {
      throw new Error('--output distribution requires --seeds <n>.');
    }
    if (isCompareMode) {
      throw new Error('--output distribution is not supported in comparison mode.');
    }
  }

  return {
    strategy:     single['strategy'],
    strategyFile: single['strategy-file'],
    compare,
    compareFiles,
    rolls,
    bankroll,
    seed,
    seeds,
    output: outputRaw,
  };
}

function parsePositiveInt(raw: string | undefined, name: string, defaultValue: number): number {
  if (raw === undefined) return defaultValue;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid value for --${name}: "${raw}". Must be a positive integer.`);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Single-strategy runner
// ---------------------------------------------------------------------------

export function runSim(args: CliArgs): void {
  let strategyName: string;
  let strategy: StrategyDefinition;

  if (args.strategyFile) {
    strategy = loadStrategyFile(args.strategyFile);
    strategyName = args.strategyFile;
  } else {
    strategyName = args.strategy!;
    strategy = lookupStrategy(strategyName);
  }

  const logger = new RunLogger({
    strategyName,
    playerId: 'player1',
    initialBankroll: args.bankroll,
    seed: args.seed,
  });

  const engine = new CrapsEngine({
    strategy,
    bankroll: args.bankroll,
    rolls: args.rolls,
    seed: args.seed,
    logger,
  });

  engine.run();
  logger.flush(args.output);
}

// ---------------------------------------------------------------------------
// Distribution runner — M6.0
// ---------------------------------------------------------------------------

export function runDistribution(args: CliArgs): void {
  let strategyName: string;
  let strategy: StrategyDefinition;

  if (args.strategyFile) {
    strategy = loadStrategyFile(args.strategyFile);
    strategyName = args.strategyFile;
  } else {
    strategyName = args.strategy!;
    strategy = lookupStrategy(strategyName);
  }

  const N = args.seeds!;
  const sessionResults = [];

  for (let i = 0; i < N; i++) {
    // Seeds are sequential integers starting at 0 — same convention as SSE stream.
    const engine = new CrapsEngine({
      strategy,
      bankroll: args.bankroll,
      rolls: args.rolls,
      seed: i,
    });
    sessionResults.push(summarize(engine.run(), i));
  }

  const aggregates = computeFullAggregates(sessionResults, {
    strategy: strategyName,
    rolls: args.rolls,
    bankroll: args.bankroll,
  });

  process.stdout.write(JSON.stringify(aggregates, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Multi-strategy comparison runner (M3.2 / M3.3)
// ---------------------------------------------------------------------------

export function runCompare(args: CliArgs): void {
  const strategies: Array<{ name: string; strategy: StrategyDefinition }> = [];

  for (const name of args.compare ?? []) {
    strategies.push({ name, strategy: lookupStrategy(name) });
  }

  for (const filePath of args.compareFiles ?? []) {
    strategies.push({ name: filePath, strategy: loadStrategyFile(filePath) });
  }

  if (args.strategyFile) {
    strategies.push({ name: args.strategyFile, strategy: loadStrategyFile(args.strategyFile) });
  }

  const table = new SharedTable({ seed: args.seed, rolls: args.rolls });
  for (const { name, strategy } of strategies) {
    table.addStrategy(name, strategy, { bankroll: args.bankroll });
  }

  const results = table.run();

  if (args.output === 'json') {
    printComparisonJson(results);
  } else {
    // Both 'summary' and 'verbose' show the comparison table.
    // Per-roll verbose output is not meaningful across multiple strategies in a
    // shared-table run without a unified log; deferred to a future enhancement.
    printComparisonTable(results, args);
  }
}

// ---------------------------------------------------------------------------
// Comparison output helpers
// ---------------------------------------------------------------------------

function printComparisonJson(results: SharedTableResult): void {
  for (const [strategyName, result] of Object.entries(results)) {
    console.log(JSON.stringify({ ...result.summary, strategyName }));
  }
}

function printComparisonTable(results: SharedTableResult, args: CliArgs): void {
  const names = Object.keys(results);
  const seedStr = args.seed != null ? `, seed: ${args.seed}` : '';

  console.log(`\n=== Strategy Comparison (${args.rolls} rolls, bankroll $${args.bankroll}${seedStr}) ===\n`);

  const nameColWidth = Math.max(20, ...names.map(n => n.length));

  const header =
    pad('Strategy', nameColWidth) +
    ' | ' + rpad('Final',       9) +
    ' | ' + rpad('Net',         9) +
    ' | ' + rpad('Peak',        9) +
    ' | ' + rpad('Max Drawdown', 12);

  const separator = '-'.repeat(header.length);

  console.log(header);
  console.log(separator);

  for (const name of names) {
    const b = results[name].summary.bankroll;
    const netStr = (b.netChange >= 0 ? '+' : '') + `$${b.netChange}`;

    const row =
      pad(name, nameColWidth) +
      ' | ' + rpad(`$${b.final}`,     9) +
      ' | ' + rpad(netStr,            9) +
      ' | ' + rpad(`$${b.peak}`,      9) +
      ' | ' + rpad(`$${b.maxDrawdown}`, 12);

    console.log(row);
  }

  console.log('');
}

function pad(s: string, width: number): string  { return s.padEnd(width); }
function rpad(s: string, width: number): string { return s.padStart(width); }

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const argv = process.argv.slice(2);
  try {
    const args = parseArgs(argv);
    if (args.compare || args.compareFiles) {
      runCompare(args);
    } else if (args.output === 'distribution') {
      runDistribution(args);
    } else {
      runSim(args);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    console.error('Usage:');
    console.error('  npx ts-node src/cli/run-sim.ts --strategy <name> [options]');
    console.error('  npx ts-node src/cli/run-sim.ts --strategy-file <path> [options]');
    console.error('  npx ts-node src/cli/run-sim.ts --compare <name1> <name2> [options]');
    console.error('  npx ts-node src/cli/run-sim.ts --compare-files <file1> <file2> [options]');
    console.error('  npx ts-node src/cli/run-sim.ts --compare <name> --strategy-file <file> [options]');
    console.error('Options: --rolls <n>  --bankroll <n>  --seed <n>  --seeds <n>  --output summary|verbose|json|distribution');
    process.exit(1);
  }
}
