#!/usr/bin/env npx ts-node
/**
 * run-sim.ts — Single-strategy CLI runner
 *
 * Usage:
 *   npx ts-node src/cli/run-sim.ts --strategy <name> [options]
 *   npx ts-node src/cli/run-sim.ts --strategy-file <path> [options]
 *
 * Flags:
 *   --strategy <name>              Built-in strategy name (mutually exclusive with --strategy-file).
 *   --strategy-file <path>         Path to a .ts strategy file (mutually exclusive with --strategy).
 *   --rolls <n>                    Number of rolls to simulate (default: 10000).
 *   --bankroll <n>                 Starting bankroll (default: 500).
 *   --seed <n>                     RNG seed for reproducible runs (optional).
 *   --output summary|verbose|json  Output format (default: summary).
 */

import { CrapsEngine } from '../engine/craps-engine';
import { RunLogger } from '../logger/run-logger';
import { lookupStrategy } from './strategy-registry';
import { loadStrategyFile } from './strategy-loader';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export interface CliArgs {
  strategy?: string;
  strategyFile?: string;
  rolls: number;
  bankroll: number;
  seed?: number;
  output: 'summary' | 'verbose' | 'json';
}

export function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Flag --${key} requires a value.`);
      }
      args[key] = value;
      i++;
    }
  }

  if (!args['strategy'] && !args['strategy-file']) {
    throw new Error('Missing required flag: --strategy <name> or --strategy-file <path>');
  }

  if (args['strategy'] && args['strategy-file']) {
    throw new Error('--strategy and --strategy-file are mutually exclusive. Provide only one.');
  }

  const rolls = parsePositiveInt(args['rolls'], 'rolls', 10000);
  const bankroll = parsePositiveInt(args['bankroll'], 'bankroll', 500);

  let seed: number | undefined;
  if (args['seed'] !== undefined) {
    const parsed = Number(args['seed']);
    if (!Number.isInteger(parsed)) {
      throw new Error(`Invalid value for --seed: "${args['seed']}". Must be an integer.`);
    }
    seed = parsed;
  }

  const outputRaw = args['output'] ?? 'summary';
  if (outputRaw !== 'summary' && outputRaw !== 'verbose' && outputRaw !== 'json') {
    throw new Error(`Invalid value for --output: "${outputRaw}". Must be summary, verbose, or json.`);
  }

  return {
    strategy: args['strategy'],
    strategyFile: args['strategy-file'],
    rolls,
    bankroll,
    seed,
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
// Main runner
// ---------------------------------------------------------------------------

export function runSim(args: CliArgs): void {
  let strategyName: string;
  let strategy;

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
// Entry point (only runs when executed directly, not when imported in tests)
// ---------------------------------------------------------------------------

if (require.main === module) {
  const argv = process.argv.slice(2);
  try {
    const args = parseArgs(argv);
    runSim(args);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    console.error('Usage: npx ts-node src/cli/run-sim.ts --strategy <name> [--rolls <n>] [--bankroll <n>] [--seed <n>] [--output summary|verbose|json]');
    process.exit(1);
  }
}
