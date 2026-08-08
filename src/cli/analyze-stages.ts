#!/usr/bin/env npx ts-node
/**
 * analyze-stages.ts — per-stage metrics aggregation for staged strategies.
 *
 * Runs sessions internally:
 *   npx ts-node src/cli/analyze-stages.ts --strategy CATS --rolls 1000 \
 *       --bankroll 300 --seeds 2000 [--stop-at-ruin] [--output text|json]
 *
 * Or consumes a directory of per-session JSONL files (run-sim --output json):
 *   npx ts-node src/cli/analyze-stages.ts --jsonl-dir ./sessions [--output json]
 *
 * Per stage: reach probability (% of sessions that ever enter it), median and
 * p90 rolls-to-first-entry, time-in-stage (% of rolls), and empirical E[loss]
 * per 100 rolls while in the stage. Session-level: P&L p10/p50/p90, % of
 * sessions ending positive, % ending at ruin.
 *
 * Attribution: each roll is attributed to stagePlayed — the stage whose
 * board() built the bets that rode that roll (falling back to stageName for
 * older JSONL without the field). Loss is measured as the per-roll change in
 * EQUITY (rack + felt), so moving money onto the table is not counted as
 * loss.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CrapsEngine } from '../engine/craps-engine';
import { createStrategy, lookupStrategy } from './strategy-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyzeArgs {
  strategy?: string;
  jsonlDir?: string;
  rolls: number;
  bankroll: number;
  seeds: number;
  stopAtRuin: boolean;
  output: 'text' | 'json';
}

/** Minimal per-roll view the aggregator needs, from either source. */
interface RollView {
  stageName: string;
  equityAfter: number; // bankroll + table load, after settlement
}

interface SessionView {
  rolls: RollView[];
  initialBankroll: number;
  endedAtRuin: boolean;
}

export interface StageMetrics {
  stage: string;
  reachProbability: number;        // fraction of sessions that ever enter
  medianRollsToFirstEntry: number; // among sessions that reach it
  p90RollsToFirstEntry: number;
  timeInStagePct: number;          // % of all rolls spent in this stage
  lossPer100Rolls: number;         // empirical E[loss] per 100 rolls in stage
  rollsObserved: number;
}

export interface AnalyzeReport {
  sessions: number;
  rollsPerSession: number;
  bankroll: number;
  totalRolls: number;
  stages: StageMetrics[];
  pnl: { p10: number; p50: number; p90: number };
  pctSessionsPositive: number;
  pctSessionsRuined: number;
}

// Ladder display order; unknown stages append in encounter order.
const STAGE_ORDER = [
  'accumulatorFull', 'accumulatorRegressed', 'littleMolly',
  'threePtMollyTight', 'threePtMollyLoose', 'expandedAlpha', 'maxAlpha',
  'bearishAccumulator', 'bearishAccumulatorFull', 'bearishAccumulatorRegressed',
  'littleDolly', 'threePtDolly', 'expandedDarkAlpha', 'maxDarkAlpha',
];

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv: string[]): AnalyzeArgs {
  const single: Record<string, string> = {};
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (key === 'stop-at-ruin') {
      flags.add(key);
    } else {
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`Flag --${key} requires a value.`);
      }
      single[key] = next;
      i++;
    }
  }

  if (!single['strategy'] && !single['jsonl-dir']) {
    throw new Error('Provide --strategy <name> (to run sessions) or --jsonl-dir <path> (to analyze existing JSONL).');
  }

  const output = single['output'] ?? 'text';
  if (output !== 'text' && output !== 'json') {
    throw new Error(`Invalid value for --output: "${output}". Must be text or json.`);
  }

  return {
    strategy: single['strategy'],
    jsonlDir: single['jsonl-dir'],
    rolls: parsePositiveInt(single['rolls'], 'rolls', 1000),
    bankroll: parsePositiveInt(single['bankroll'], 'bankroll', 300),
    seeds: parsePositiveInt(single['seeds'], 'seeds', 2000),
    stopAtRuin: flags.has('stop-at-ruin'),
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

// ---------------------------------------------------------------------------
// Session sources
// ---------------------------------------------------------------------------

function runSessions(args: AnalyzeArgs): SessionView[] {
  lookupStrategy(args.strategy!); // validate the name up front
  const sessions: SessionView[] = [];
  for (let seed = 0; seed < args.seeds; seed++) {
    // Fresh strategy per session — stage machines carry runtime state.
    const strategy = createStrategy(args.strategy!);
    const engine = new CrapsEngine({
      strategy,
      bankroll: args.bankroll,
      rolls: args.rolls,
      seed,
      stopAtRuin: args.stopAtRuin,
    });
    const result = engine.run();
    sessions.push({
      initialBankroll: result.initialBankroll,
      endedAtRuin: result.endedAtRuin ?? false,
      rolls: result.rolls.map(r => ({
        stageName: r.stagePlayed ?? r.stageName ?? '(stageless)',
        equityAfter: r.bankrollAfter + r.tableLoadAfter,
      })),
    });
  }
  return sessions;
}

/** Parse run-sim --output json JSONL files (one session per file). */
function loadJsonlSessions(dir: string): SessionView[] {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort();
  if (files.length === 0) {
    throw new Error(`No .jsonl files found in ${dir}`);
  }
  const sessions: SessionView[] = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n').filter(Boolean);
    const rolls: RollView[] = [];
    let initialBankroll: number | undefined;
    let sawBets = false;
    let lastLoad = 0;
    for (const line of lines) {
      let record: any;
      try { record = JSON.parse(line); } catch { continue; }
      if (record.type !== 'roll') continue;
      const p = record.players?.[0];
      if (!p) continue;
      if (initialBankroll === undefined) initialBankroll = p.bankroll.before + (p.tableLoad?.before ?? 0);
      lastLoad = p.tableLoad?.after ?? 0;
      if ((p.activeBets?.length ?? 0) > 0) sawBets = true;
      rolls.push({
        stageName: p.stagePlayed ?? p.stageName ?? '(stageless)',
        equityAfter: p.bankroll.after + lastLoad,
      });
    }
    if (rolls.length === 0) continue;
    const finalEquity = rolls[rolls.length - 1].equityAfter;
    sessions.push({
      rolls,
      initialBankroll: initialBankroll ?? 0,
      // JSONL carries no explicit ruin marker: treat a session whose final
      // equity cannot fund a $10 flat bet as ruined.
      endedAtRuin: sawBets && finalEquity < 10,
    });
  }
  return sessions;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function aggregate(sessions: SessionView[], meta: { rollsPerSession: number; bankroll: number }): AnalyzeReport {
  const firstEntry = new Map<string, number[]>();
  const rollsInStage = new Map<string, number>();
  const lossInStage = new Map<string, number>();
  const reached = new Map<string, number>();
  const pnls: number[] = [];
  let totalRolls = 0;
  let positive = 0;
  let ruined = 0;
  const encounterOrder: string[] = [];

  for (const session of sessions) {
    const seen = new Set<string>();
    let prevEquity = session.initialBankroll;
    session.rolls.forEach((roll, i) => {
      const s = roll.stageName;
      if (!encounterOrder.includes(s)) encounterOrder.push(s);
      if (!seen.has(s)) {
        seen.add(s);
        reached.set(s, (reached.get(s) ?? 0) + 1);
        if (!firstEntry.has(s)) firstEntry.set(s, []);
        firstEntry.get(s)!.push(i + 1);
      }
      rollsInStage.set(s, (rollsInStage.get(s) ?? 0) + 1);
      lossInStage.set(s, (lossInStage.get(s) ?? 0) + (prevEquity - roll.equityAfter));
      prevEquity = roll.equityAfter;
    });
    totalRolls += session.rolls.length;
    const pnl = (session.rolls.length > 0 ? session.rolls[session.rolls.length - 1].equityAfter : session.initialBankroll) - session.initialBankroll;
    pnls.push(pnl);
    if (pnl > 0) positive++;
    if (session.endedAtRuin) ruined++;
  }

  const stageNames = [
    ...STAGE_ORDER.filter(s => rollsInStage.has(s)),
    ...encounterOrder.filter(s => !STAGE_ORDER.includes(s)),
  ];

  const stages: StageMetrics[] = stageNames.map(s => {
    const entries = (firstEntry.get(s) ?? []).slice().sort((a, b) => a - b);
    const rolls = rollsInStage.get(s) ?? 0;
    const loss = lossInStage.get(s) ?? 0;
    return {
      stage: s,
      reachProbability: (reached.get(s) ?? 0) / sessions.length,
      medianRollsToFirstEntry: quantile(entries, 0.5),
      p90RollsToFirstEntry: quantile(entries, 0.9),
      timeInStagePct: totalRolls > 0 ? (100 * rolls) / totalRolls : 0,
      lossPer100Rolls: rolls > 0 ? (100 * loss) / rolls : 0,
      rollsObserved: rolls,
    };
  });

  const sortedPnls = pnls.slice().sort((a, b) => a - b);
  return {
    sessions: sessions.length,
    rollsPerSession: meta.rollsPerSession,
    bankroll: meta.bankroll,
    totalRolls,
    stages,
    pnl: {
      p10: quantile(sortedPnls, 0.1),
      p50: quantile(sortedPnls, 0.5),
      p90: quantile(sortedPnls, 0.9),
    },
    pctSessionsPositive: (100 * positive) / sessions.length,
    pctSessionsRuined: (100 * ruined) / sessions.length,
  };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function fmt(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

function printText(report: AnalyzeReport): void {
  console.log(`\n=== Stage metrics (${report.sessions} sessions, up to ${report.rollsPerSession} rolls, $${report.bankroll} bankroll) ===\n`);

  const header =
    'Stage'.padEnd(22) +
    ' | ' + 'Reach %'.padStart(8) +
    ' | ' + 'Med entry'.padStart(9) +
    ' | ' + 'P90 entry'.padStart(9) +
    ' | ' + 'Time %'.padStart(7) +
    ' | ' + 'E[loss]/100'.padStart(11);
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const s of report.stages) {
    console.log(
      s.stage.padEnd(22) +
      ' | ' + fmt(100 * s.reachProbability).padStart(8) +
      ' | ' + fmt(s.medianRollsToFirstEntry, 0).padStart(9) +
      ' | ' + fmt(s.p90RollsToFirstEntry, 0).padStart(9) +
      ' | ' + fmt(s.timeInStagePct).padStart(7) +
      ' | ' + ('$' + fmt(s.lossPer100Rolls, 2)).padStart(11)
    );
  }

  console.log(`\nSession P&L: p10 ${money(report.pnl.p10)}  p50 ${money(report.pnl.p50)}  p90 ${money(report.pnl.p90)}`);
  console.log(`Sessions ending positive: ${fmt(report.pctSessionsPositive)}%`);
  console.log(`Sessions ending at ruin:  ${fmt(report.pctSessionsRuined)}%\n`);
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '+';
  return `${sign}$${Math.abs(Math.round(n))}`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runAnalysis(args: AnalyzeArgs): AnalyzeReport {
  const sessions = args.jsonlDir
    ? loadJsonlSessions(args.jsonlDir)
    : runSessions(args);
  return aggregate(sessions, { rollsPerSession: args.rolls, bankroll: args.bankroll });
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = runAnalysis(args);
    if (args.output === 'json') {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      printText(report);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    console.error('Usage:');
    console.error('  npx ts-node src/cli/analyze-stages.ts --strategy CATS --rolls 1000 --bankroll 300 --seeds 2000 [--stop-at-ruin] [--output text|json]');
    console.error('  npx ts-node src/cli/analyze-stages.ts --jsonl-dir ./sessions [--output json]');
    process.exit(1);
  }
}
