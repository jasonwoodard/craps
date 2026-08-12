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
import { StrategyDefinition } from '../dsl/strategy';
import { createStrategy, getStageLadder, getStrategyMetadata } from './strategy-registry';
import { parseStrategySpec } from './strategy-loader';
import {
  StreamingStoppingEvaluator,
  StoppingConfig,
  StoppingReport,
} from './stopping-rules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyzeArgs {
  strategy?: string;
  /** Comparison mode: all specs, in flag order, when --strategy is repeated. */
  strategies?: string[];
  jsonlDir?: string;
  rolls: number;
  bankroll: number;
  seeds: number;
  stopAtRuin: boolean;
  output: 'text' | 'json';
  /** Trailing-floor drop d in dollars (default bankroll / 3). */
  trailDrop?: number;
  /** Fall-below-stage rule slug (default: first gated stage of the ladder). */
  belowStage?: string;
}

/** Minimal per-roll view the aggregator needs, from either source. */
export interface RollView {
  stageName: string;
  equityAfter: number; // bankroll + table load, after settlement
}

export interface SessionView {
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
  /** Stopping-rule menu results (v4 §3); present when sessions were scored. */
  stopping?: StoppingReport;
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
  const strategies: string[] = [];

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
      if (key === 'strategy') {
        strategies.push(next); // repeatable: comparison mode when > 1
      } else {
        single[key] = next;
      }
      i++;
    }
  }

  if (strategies.length === 0 && !single['jsonl-dir']) {
    throw new Error('Provide --strategy <spec> (repeatable, to run sessions) or --jsonl-dir <path> (to analyze existing JSONL).');
  }

  const output = single['output'] ?? 'text';
  if (output !== 'text' && output !== 'json') {
    throw new Error(`Invalid value for --output: "${output}". Must be text or json.`);
  }

  return {
    strategy: strategies[0],
    strategies: strategies.length > 0 ? strategies : undefined,
    jsonlDir: single['jsonl-dir'],
    rolls: parsePositiveInt(single['rolls'], 'rolls', 1000),
    bankroll: parsePositiveInt(single['bankroll'], 'bankroll', 300),
    seeds: parsePositiveInt(single['seeds'], 'seeds', 2000),
    stopAtRuin: flags.has('stop-at-ruin'),
    output,
    trailDrop: single['trail-drop'] !== undefined ? parsePositiveInt(single['trail-drop'], 'trail-drop', 0) : undefined,
    belowStage: single['exit-below-stage'],
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

function runSessions(args: AnalyzeArgs, onSession?: (s: SessionView) => void): SessionView[] {
  createStrategy(args.strategy!); // validate the spec up front
  return runSessionsWithFactory(() => createStrategy(args.strategy!), args, onSession);
}

/** Run seeded sessions for any strategy factory and return session views. */
export function runSessionsWithFactory(
  factory: () => StrategyDefinition,
  args: Pick<AnalyzeArgs, 'rolls' | 'bankroll' | 'seeds' | 'stopAtRuin'>,
  onSession?: (s: SessionView) => void,
): SessionView[] {
  const sessions: SessionView[] = [];
  for (let seed = 0; seed < args.seeds; seed++) {
    // Fresh strategy per session — stage machines carry runtime state.
    const engine = new CrapsEngine({
      strategy: factory(),
      bankroll: args.bankroll,
      rolls: args.rolls,
      seed,
      stopAtRuin: args.stopAtRuin,
    });
    const result = engine.run();
    const view: SessionView = {
      initialBankroll: result.initialBankroll,
      endedAtRuin: result.endedAtRuin ?? false,
      rolls: result.rolls.map(r => ({
        stageName: r.stagePlayed ?? r.stageName ?? '(stageless)',
        equityAfter: r.bankrollAfter + r.tableLoadAfter,
      })),
    };
    if (onSession) onSession(view); // streaming consumers score per session
    sessions.push(view);
  }
  return sessions;
}

/** Full analysis for an arbitrary strategy factory (used by sweep tools). */
export function analyzeWithFactory(
  factory: () => StrategyDefinition,
  args: Pick<AnalyzeArgs, 'rolls' | 'bankroll' | 'seeds' | 'stopAtRuin'>,
): AnalyzeReport {
  const sessions = runSessionsWithFactory(factory, args);
  return aggregate(sessions, { rollsPerSession: args.rolls, bankroll: args.bankroll });
}

/** Parse run-sim --output json JSONL files (one session per file). */
function loadJsonlSessions(dir: string, onSession?: (s: SessionView) => void): SessionView[] {
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
    const view: SessionView = {
      rolls,
      initialBankroll: initialBankroll ?? 0,
      // JSONL carries no explicit ruin marker: treat a session whose final
      // equity cannot fund a $10 flat bet as ruined.
      endedAtRuin: sawBets && finalEquity < 10,
    };
    if (onSession) onSession(view);
    sessions.push(view);
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

  if (report.stopping) printStopping(report.stopping);
}

function printStopping(stopping: StoppingReport): void {
  console.log('=== Stopping-rule menu (banked P&L per rule; sessions play fully out) ===\n');
  const header =
    'Rule'.padEnd(14) +
    ' | ' + 'Trigger %'.padStart(9) +
    ' | ' + 'Ruin %'.padStart(7) +
    ' | ' + 'Cens. %'.padStart(7) +
    ' | ' + 'p10'.padStart(7) +
    ' | ' + 'p50'.padStart(7) +
    ' | ' + 'p90'.padStart(7) +
    ' | ' + 'Pos %'.padStart(6) +
    ' | ' + 'PeakCap'.padStart(7);
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const r of stopping.rules) {
    console.log(
      r.rule.padEnd(14) +
      ' | ' + fmt(100 * r.triggerRate).padStart(9) +
      ' | ' + fmt(100 * r.ruinRate).padStart(7) +
      ' | ' + fmt(100 * r.censoredRate).padStart(7) +
      ' | ' + money(r.banked.p10).padStart(7) +
      ' | ' + money(r.banked.p50).padStart(7) +
      ' | ' + money(r.banked.p90).padStart(7) +
      ' | ' + fmt(r.pctPositive).padStart(6) +
      ' | ' + (r.peakCapture === null ? '—' : r.peakCapture.toFixed(2)).padStart(7)
    );
  }
  const peaks = stopping.peakPnl;
  console.log(`\nPeak P&L: p10 ${money(peaks.p10)}  p25 ${money(peaks.p25)}  p50 ${money(peaks.p50)}  p75 ${money(peaks.p75)}  p90 ${money(peaks.p90)}  p99 ${money(peaks.p99)}`);
  const hits = stopping.hitting
    .map(h => `k=${h.k}: ${fmt(100 * h.pHitBeforeRuin)}% (censored ${fmt(100 * h.censoredFraction)}%)`)
    .join('   ');
  console.log(`P(hit k·B before ruin): ${hits}\n`);
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '+';
  return `${sign}$${Math.abs(Math.round(n))}`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Build the stopping config for a spec: trailing-floor drop, and the
 * fall-below-stage ladder level (default: the ladder's first gated stage).
 * Returns the config plus the state → ladder-level map used to score rolls.
 */
export function buildStoppingContext(
  args: Pick<AnalyzeArgs, 'strategy' | 'bankroll' | 'trailDrop' | 'belowStage'>,
): { config: StoppingConfig; stateLevel: Map<string, number> | null } {
  const config: StoppingConfig = {
    bankroll: args.bankroll,
    ...(args.trailDrop !== undefined ? { trailDrop: args.trailDrop } : {}),
  };
  let stateLevel: Map<string, number> | null = null;

  if (args.strategy) {
    const ladder = getStageLadder(args.strategy);
    if (ladder) {
      stateLevel = new Map(ladder.stateOrder.map((state, i) => [state, i]));
      let slug = args.belowStage;
      if (slug === undefined) {
        const meta = getStrategyMetadata(parseStrategySpec(args.strategy).name);
        slug = meta.stages.find(m => m.gate > 0)?.slug;
      }
      if (slug !== undefined) {
        const state = ladder.slugToState.get(slug);
        if (state === undefined) {
          const valid = [...ladder.slugToState.keys()].join(', ');
          throw new Error(`Unknown --exit-below-stage slug "${slug}". Valid slugs: ${valid}`);
        }
        config.belowStageLevel = stateLevel.get(state);
        config.belowStageSlug = slug;
      }
    }
  }
  return { config, stateLevel };
}

/** Feed one materialized session through the streaming evaluator. */
export function streamSession(
  evaluator: StreamingStoppingEvaluator,
  session: SessionView,
  stateLevel: Map<string, number> | null,
): void {
  evaluator.beginSession();
  let finalEquity = session.initialBankroll;
  for (const roll of session.rolls) {
    const level = stateLevel ? stateLevel.get(roll.stageName) : undefined;
    evaluator.onRoll(roll.equityAfter, level);
    finalEquity = roll.equityAfter;
  }
  evaluator.endSession(finalEquity, session.endedAtRuin);
}

export function runAnalysis(args: AnalyzeArgs): AnalyzeReport {
  const { config, stateLevel } = buildStoppingContext(args);
  const evaluator = new StreamingStoppingEvaluator(config);

  // The streaming path: each session is scored roll-by-roll as it is
  // produced (one pass; sessions still play fully out).
  const onSession = (session: SessionView) => streamSession(evaluator, session, stateLevel);

  const sessions = args.jsonlDir
    ? loadJsonlSessions(args.jsonlDir, onSession)
    : runSessions(args, onSession);

  const report = aggregate(sessions, { rollsPerSession: args.rolls, bankroll: args.bankroll });
  report.stopping = evaluator.report();
  return report;
}

// ---------------------------------------------------------------------------
// Multi-spec comparison (v4 §2: shared seeds, side-by-side)
// ---------------------------------------------------------------------------

export interface CompareEntry {
  /** Canonical spec string. */
  spec: string;
  report: AnalyzeReport;
}

/**
 * Run every spec over the SAME seed range (0..seeds-1) — identical dice per
 * seed — and return reports in flag order. The canonical normalized spec
 * string labels each column.
 */
export function runComparison(args: AnalyzeArgs): CompareEntry[] {
  const entries: CompareEntry[] = [];
  for (const spec of args.strategies!) {
    const canonical = parseStrategySpec(spec).canonical;
    const report = runAnalysis({ ...args, strategy: spec, strategies: undefined });
    entries.push({ spec: canonical, report });
  }
  return entries;
}

function printComparison(entries: CompareEntry[], args: AnalyzeArgs): void {
  const width = Math.max(24, ...entries.map(e => e.spec.length + 2));
  const label = (s: string) => s.padStart(width);
  console.log(`\n=== Spec comparison (${args.seeds} shared seeds, up to ${args.rolls} rolls, $${args.bankroll} bankroll) ===\n`);
  console.log('Metric'.padEnd(30) + entries.map(e => label(e.spec)).join(''));
  console.log('-'.repeat(30 + width * entries.length));

  const row = (name: string, value: (e: CompareEntry) => string) =>
    console.log(name.padEnd(30) + entries.map(e => label(value(e))).join(''));

  row('P&L p10', e => money(e.report.pnl.p10));
  row('P&L p50', e => money(e.report.pnl.p50));
  row('P&L p90', e => money(e.report.pnl.p90));
  row('Sessions positive %', e => fmt(e.report.pctSessionsPositive));
  row('Sessions ruined %', e => fmt(e.report.pctSessionsRuined));

  if (entries.every(e => e.report.stopping)) {
    row('Peak P&L p50', e => money(e.report.stopping!.peakPnl.p50));
    row('Peak P&L p90', e => money(e.report.stopping!.peakPnl.p90));
    for (const h of entries[0].report.stopping!.hitting) {
      row(`P(hit ${h.k}·B before ruin) %`, e => {
        const hit = e.report.stopping!.hitting.find(x => x.k === h.k)!;
        return fmt(100 * hit.pHitBeforeRuin);
      });
    }
  }

  // Stage-reach rows over the union of stages, first-seen order.
  const stageOrder: string[] = [];
  for (const e of entries) {
    for (const s of e.report.stages) {
      if (!stageOrder.includes(s.stage)) stageOrder.push(s.stage);
    }
  }
  for (const stage of stageOrder) {
    row(`reach % ${stage}`, e => {
      const s = e.report.stages.find(x => x.stage === stage);
      return s ? fmt(100 * s.reachProbability) : '—';
    });
  }

  // Stopping-menu summary per spec: banked p50 and trigger rate per rule.
  if (entries.every(e => e.report.stopping)) {
    for (const rule of entries[0].report.stopping!.rules) {
      row(`stop ${rule.rule} banked p50`, e => {
        const r = e.report.stopping!.rules.find(x => x.rule === rule.rule);
        return r ? money(r.banked.p50) : '—';
      });
      row(`stop ${rule.rule} trigger %`, e => {
        const r = e.report.stopping!.rules.find(x => x.rule === rule.rule);
        return r ? fmt(100 * r.triggerRate) : '—';
      });
    }
  }
  console.log('');
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.strategies && args.strategies.length > 1) {
      const entries = runComparison(args);
      if (args.output === 'json') {
        process.stdout.write(JSON.stringify(entries, null, 2) + '\n');
      } else {
        printComparison(entries, args);
      }
    } else {
      const report = runAnalysis(args);
      if (args.output === 'json') {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        printText(report);
      }
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    console.error('Usage:');
    console.error('  npx ts-node src/cli/analyze-stages.ts --strategy CATS[@entry=slug,tableMin=n] --rolls 1000 --bankroll 300 --seeds 2000 [--stop-at-ruin] [--trail-drop n] [--exit-below-stage slug] [--output text|json]');
    console.error('  npx ts-node src/cli/analyze-stages.ts --jsonl-dir ./sessions [--output json]');
    process.exit(1);
  }
}
