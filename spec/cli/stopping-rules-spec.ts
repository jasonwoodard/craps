/**
 * Stopping-rule evaluator — dual-path validation (v4 §3).
 *
 * The streaming evaluator (incremental per-roll state) and the post-hoc
 * truncation evaluator (whole-trajectory scans) are independent
 * implementations; their reports must match EXACTLY on the same sessions.
 * The full mandated config (500 seeds) runs in scripts/dual-path-check.ts;
 * this in-suite gate runs a smaller deterministic slice of the same check.
 */
import {
  StreamingStoppingEvaluator,
  evaluateStoppingPostHoc,
  TrajectoryView,
  StoppingConfig,
} from '../../src/cli/stopping-rules';
import {
  runAnalysis,
  buildStoppingContext,
  runSessionsWithFactory,
  streamSession,
  SessionView,
} from '../../src/cli/analyze-stages';
import { createStrategy } from '../../src/cli/strategy-registry';

function toTrajectories(sessions: SessionView[], stateLevel: Map<string, number> | null): TrajectoryView[] {
  return sessions.map(s => ({
    equity: s.rolls.map(r => r.equityAfter),
    ...(stateLevel ? { stageLevel: s.rolls.map(r => stateLevel.get(r.stageName) ?? -1) } : {}),
    endedAtRuin: s.endedAtRuin,
  }));
}

describe('stopping-rule evaluator', () => {

  describe('dual-path gate: streaming === post-hoc truncation', () => {
    it('matches exactly for CATS (60 seeds, 200 rolls, $300)', () => {
      const args = { strategy: 'CATS', rolls: 200, bankroll: 300, seeds: 60, stopAtRuin: true };
      const { config, stateLevel } = buildStoppingContext(args);

      const evaluator = new StreamingStoppingEvaluator(config);
      const sessions = runSessionsWithFactory(
        () => createStrategy('CATS'), args,
        s => streamSession(evaluator, s, stateLevel),
      );

      const streaming = evaluator.report();
      const postHoc = evaluateStoppingPostHoc(toTrajectories(sessions, stateLevel), config);
      expect(streaming).toEqual(postHoc);
    });

    it('matches exactly for a funded entry with a custom trail drop', () => {
      const args = {
        strategy: 'CATS@entry=threePtMollyTight', rolls: 150, bankroll: 200,
        seeds: 40, stopAtRuin: true, trailDrop: 50,
      };
      const { config, stateLevel } = buildStoppingContext(args);
      expect(config.trailDrop).toBe(50);

      const evaluator = new StreamingStoppingEvaluator(config);
      const sessions = runSessionsWithFactory(
        () => createStrategy(args.strategy), args,
        s => streamSession(evaluator, s, stateLevel),
      );

      const streaming = evaluator.report();
      const postHoc = evaluateStoppingPostHoc(toTrajectories(sessions, stateLevel), config);
      expect(streaming).toEqual(postHoc);
    });
  });

  describe("rule 'none' reproduces the session P&L metrics to the dollar", () => {
    it('banked P&L quantiles and % positive equal the session report', () => {
      const report = runAnalysis({
        strategy: 'CATS', rolls: 200, bankroll: 300, seeds: 50,
        stopAtRuin: true, output: 'json',
      });
      const none = report.stopping!.rules.find(r => r.rule === 'none')!;
      expect(none.triggerRate).toBe(0);
      expect(none.banked.p10).toBe(report.pnl.p10);
      expect(none.banked.p50).toBe(report.pnl.p50);
      expect(none.banked.p90).toBe(report.pnl.p90);
      expect(none.pctPositive).toBe(report.pctSessionsPositive);
      expect(100 * none.ruinRate).toBeCloseTo(report.pctSessionsRuined, 10);
    });
  });

  describe('rule semantics on hand-built trajectories', () => {
    const config: StoppingConfig = { bankroll: 100, trailDrop: 30, belowStageLevel: 2, belowStageSlug: 'stageC' };

    function evalOne(t: TrajectoryView) {
      const streaming = new StreamingStoppingEvaluator(config);
      streaming.beginSession();
      t.equity.forEach((e, i) => streaming.onRoll(e, t.stageLevel?.[i]));
      streaming.endSession(t.equity[t.equity.length - 1], t.endedAtRuin);
      const s = streaming.report();
      const p = evaluateStoppingPostHoc([t], config);
      expect(s).toEqual(p); // every hand case double-checks the dual path
      return s;
    }

    it('hard target banks the equity of the crossing roll', () => {
      const r = evalOne({
        equity: [150, 120, 210, 260, 80],
        stageLevel: [2, 2, 2, 2, 2],
        endedAtRuin: false,
      });
      const t2 = r.rules.find(x => x.rule === 'target-2x')!;
      expect(t2.triggerRate).toBe(1);
      expect(t2.banked.p50).toBe(110); // 210 − 100 at the ≥200 crossing
    });

    it('trailing floor banks peak − observed drop at the breach', () => {
      const r = evalOne({
        equity: [150, 180, 149, 140],
        stageLevel: [2, 2, 2, 2],
        endedAtRuin: false,
      });
      const trail = r.rules.find(x => x.rule === 'trail')!;
      // Peak 180; fires at 149 (≤ 180 − 30) → banked 49.
      expect(trail.triggerRate).toBe(1);
      expect(trail.banked.p50).toBe(49);
    });

    it('below-stage arms at/above the level and fires on the fall', () => {
      const r = evalOne({
        equity: [110, 120, 115, 90],
        stageLevel: [1, 2, 3, 1], // arms at level 2, falls to 1 on roll 4
        endedAtRuin: false,
      });
      const below = r.rules.find(x => x.rule === 'below-stage')!;
      expect(below.triggerRate).toBe(1);
      expect(below.banked.p50).toBe(-10); // equity 90 at the fall
    });

    it('below-stage never fires when the session never reaches the level', () => {
      const r = evalOne({
        equity: [90, 80, 70],
        stageLevel: [1, 1, 0],
        endedAtRuin: false,
      });
      const below = r.rules.find(x => x.rule === 'below-stage')!;
      expect(below.triggerRate).toBe(0);
      expect(below.censoredRate).toBe(1);
    });

    it('roll caps bank the equity at the cap; ruin before the cap is ruin', () => {
      const shortRuin: TrajectoryView = {
        equity: [60, 20, 0],
        stageLevel: [1, 1, 1],
        endedAtRuin: true,
      };
      const r = evalOne(shortRuin);
      const cap100 = r.rules.find(x => x.rule === 'cap-100')!;
      expect(cap100.triggerRate).toBe(0);
      expect(cap100.ruinRate).toBe(1);
      expect(cap100.banked.p50).toBe(-100);
    });

    it('peak-equity distribution is reported from the running peak', () => {
      const r = evalOne({
        equity: [150, 300, 100],
        stageLevel: [2, 2, 2],
        endedAtRuin: false,
      });
      expect(r.peakPnl.p50).toBe(200); // peak 300 − B 100
      const hit2 = r.hitting.find(h => h.k === 2)!;
      expect(hit2.pHitBeforeRuin).toBe(1); // 300 ≥ 2·100 before any ruin
    });
  });
});
