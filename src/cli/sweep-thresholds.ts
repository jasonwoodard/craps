#!/usr/bin/env npx ts-node
/**
 * sweep-thresholds.ts — Stage 1→2 gate sensitivity sweep for CATS.
 *
 *   npx ts-node src/cli/sweep-thresholds.ts \
 *       [--gates 40,55,70,85,100] [--rolls 1000] [--bankroll 300] \
 *       [--seeds 2000] [--output text|json]
 *
 * For each gate value, all higher ladder gates scale proportionally
 * (CATS({ stage2Gate })). The former §3.4 hard reset is RETIRED (v4 decision
 * #3) and is not part of this sweep; descent runs through the chained
 * step-down floors, which scale with the gates. Reports,
 * per gate: Stage-2 (Little Molly) reach probability, median rolls to
 * Stage 2, session P&L p10/p50/p90, and ruin rate. Sessions end at ruin.
 *
 * This is sensitivity ANALYSIS input only — the strategy's official
 * thresholds are unchanged.
 */

import { CATS } from '../dsl/strategies-staged';
import { analyzeWithFactory, AnalyzeReport } from './analyze-stages';

interface SweepArgs {
  gates: number[];
  rolls: number;
  bankroll: number;
  seeds: number;
  output: 'text' | 'json';
}

export interface GateResult {
  gate: number;
  stage2ReachPct: number;
  medianRollsToStage2: number;
  pnl: { p10: number; p50: number; p90: number };
  pctSessionsPositive: number;
  ruinRatePct: number;
}

export function parseArgs(argv: string[]): SweepArgs {
  const single: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`Flag --${key} requires a value.`);
    }
    single[key] = next;
    i++;
  }

  const gates = (single['gates'] ?? '40,55,70,85,100').split(',').map(g => {
    const n = Number(g.trim());
    if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid gate value: "${g}"`);
    return n;
  });

  const output = single['output'] ?? 'text';
  if (output !== 'text' && output !== 'json') {
    throw new Error(`Invalid value for --output: "${output}". Must be text or json.`);
  }

  return {
    gates,
    rolls: parsePositiveInt(single['rolls'], 'rolls', 1000),
    bankroll: parsePositiveInt(single['bankroll'], 'bankroll', 300),
    seeds: parsePositiveInt(single['seeds'], 'seeds', 2000),
    output,
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

export function sweepGate(gate: number, args: Pick<SweepArgs, 'rolls' | 'bankroll' | 'seeds'>): GateResult {
  const report: AnalyzeReport = analyzeWithFactory(
    () => CATS({ stage2Gate: gate }),
    { ...args, stopAtRuin: true },
  );
  const stage2 = report.stages.find(s => s.stage === 'littleMolly');
  return {
    gate,
    stage2ReachPct: 100 * (stage2?.reachProbability ?? 0),
    medianRollsToStage2: stage2?.medianRollsToFirstEntry ?? NaN,
    pnl: report.pnl,
    pctSessionsPositive: report.pctSessionsPositive,
    ruinRatePct: report.pctSessionsRuined,
  };
}

function printText(results: GateResult[], args: SweepArgs): void {
  console.log(`\n=== Stage 1→2 gate sensitivity (${args.seeds} sessions/gate, up to ${args.rolls} rolls, $${args.bankroll} bankroll, higher gates proportional) ===\n`);
  const header =
    'Gate'.padStart(5) +
    ' | ' + 'S2 reach %'.padStart(10) +
    ' | ' + 'Med rolls→S2'.padStart(12) +
    ' | ' + 'P&L p10'.padStart(8) +
    ' | ' + 'P&L p50'.padStart(8) +
    ' | ' + 'P&L p90'.padStart(8) +
    ' | ' + 'Positive %'.padStart(10) +
    ' | ' + 'Ruin %'.padStart(7);
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const r of results) {
    console.log(
      `$${r.gate}`.padStart(5) +
      ' | ' + r.stage2ReachPct.toFixed(1).padStart(10) +
      ' | ' + String(Math.round(r.medianRollsToStage2)).padStart(12) +
      ' | ' + money(r.pnl.p10).padStart(8) +
      ' | ' + money(r.pnl.p50).padStart(8) +
      ' | ' + money(r.pnl.p90).padStart(8) +
      ' | ' + r.pctSessionsPositive.toFixed(1).padStart(10) +
      ' | ' + r.ruinRatePct.toFixed(1).padStart(7)
    );
  }
  console.log('');
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '+';
  return `${sign}$${Math.abs(Math.round(n))}`;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const results = args.gates.map(gate => sweepGate(gate, args));
    if (args.output === 'json') {
      process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    } else {
      printText(results, args);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    console.error('Usage: npx ts-node src/cli/sweep-thresholds.ts [--gates 40,55,70,85,100] [--rolls 1000] [--bankroll 300] [--seeds 2000] [--output text|json]');
    process.exit(1);
  }
}
