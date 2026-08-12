#!/usr/bin/env npx ts-node
/**
 * Dual-path gate (session-lifecycle.md v4 §3 / Phase 3 item 6):
 * for one config (500 seeds), compute the stopping-rule menu two ways —
 * the streaming evaluator scoring sessions as they are produced, and an
 * independent post-hoc truncation of archived JSONL trajectories — and
 * assert the reports match EXACTLY.
 *
 *   npx ts-node scripts/dual-path-check.ts [seeds] [rolls] [bankroll] [spec]
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildStoppingContext,
  runSessionsWithFactory,
  streamSession,
  SessionView,
} from '../src/cli/analyze-stages';
import { StreamingStoppingEvaluator, evaluateStoppingPostHoc, TrajectoryView } from '../src/cli/stopping-rules';
import { createStrategy } from '../src/cli/strategy-registry';
import { runSim } from '../src/cli/run-sim';

const SEEDS = Number(process.argv[2] ?? 500);
const ROLLS = Number(process.argv[3] ?? 300);
const BANKROLL = Number(process.argv[4] ?? 300);
const SPEC = process.argv[5] ?? 'CATS';

const args = { strategy: SPEC, rolls: ROLLS, bankroll: BANKROLL, seeds: SEEDS, stopAtRuin: true };
const { config, stateLevel } = buildStoppingContext(args);

// --- Path 1: streaming, scored during simulation -------------------------
console.error(`[1/3] Streaming path: ${SEEDS} sessions of ${SPEC} (${ROLLS} rolls, $${BANKROLL})...`);
const evaluator = new StreamingStoppingEvaluator(config);
runSessionsWithFactory(
  () => createStrategy(SPEC), args,
  (s: SessionView) => streamSession(evaluator, s, stateLevel),
);
const streaming = evaluator.report();

// --- Path 2: archive JSONL trajectories, then post-hoc truncation --------
// Archive via run-sim (the real JSONL producer), then re-load and truncate.
console.error(`[2/3] Archiving ${SEEDS} JSONL trajectories via run-sim and truncating post hoc...`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-path-'));
const trajectories: TrajectoryView[] = [];

/** Run the real JSONL producer (run-sim + RunLogger) in-process, capturing stdout. */
function archiveRun(seed: number): string {
  const lines: string[] = [];
  const original = console.log;
  console.log = (msg?: unknown) => { lines.push(String(msg)); };
  try {
    runSim({
      strategy: SPEC, rolls: ROLLS, bankroll: BANKROLL, seed,
      output: 'json',
    } as any);
  } finally {
    console.log = original;
  }
  return lines.join('\n') + '\n';
}

for (let seed = 0; seed < SEEDS; seed++) {
  const out = archiveRun(seed);
  fs.writeFileSync(path.join(dir, `seed-${seed}.jsonl`), out);

  const equity: number[] = [];
  const stageLevels: number[] = [];
  let sawBets = false;
  for (const line of out.split('\n')) {
    if (!line) continue;
    const record = JSON.parse(line);
    if (record.type !== 'roll') continue;
    const p = record.players[0];
    equity.push(p.bankroll.after + (p.tableLoad?.after ?? 0));
    if ((p.activeBets?.length ?? 0) > 0) sawBets = true;
    if (stateLevel) stageLevels.push(stateLevel.get(p.stagePlayed ?? p.stageName) ?? -1);
  }
  // run-sim has no stop-at-ruin flag; truncate the archived trajectory at
  // ruin the same way the engine ends it: the first roll that begins with
  // nothing on the felt ends the session (that roll is still recorded).
  let end = equity.length;
  for (const line of out.split('\n')) {
    if (!line) continue;
    const record = JSON.parse(line);
    if (record.type !== 'roll') continue;
    const p = record.players[0];
    if ((p.activeBets?.length ?? 0) === 0 && (p.tableLoad?.before ?? 0) === 0) {
      end = record.roll.number;
      break;
    }
  }
  const truncated = equity.slice(0, end);
  trajectories.push({
    equity: truncated,
    ...(stateLevel ? { stageLevel: stageLevels.slice(0, end) } : {}),
    endedAtRuin: sawBets && end < ROLLS,
  });
}
const postHoc = evaluateStoppingPostHoc(trajectories, config);

// --- Compare ---------------------------------------------------------------
console.error('[3/3] Comparing reports...');
const a = JSON.stringify(streaming, null, 2);
const b = JSON.stringify(postHoc, null, 2);
if (a === b) {
  console.log(`DUAL-PATH GATE PASSED: streaming === post-hoc truncation for ${SEEDS} seeds (${SPEC}, ${ROLLS} rolls, $${BANKROLL})`);
  fs.rmSync(dir, { recursive: true, force: true });
} else {
  console.log('DUAL-PATH GATE FAILED — first difference:');
  const al = a.split('\n');
  const bl = b.split('\n');
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] !== bl[i]) {
      console.log(`  streaming: ${al[i]}`);
      console.log(`  post-hoc:  ${bl[i]}`);
      break;
    }
  }
  console.log(`JSONL kept at ${dir}`);
  process.exit(1);
}
