/**
 * Stopping-rule evaluator — session-lifecycle.md v4 §3.
 *
 * Exit rules are stopping times, so the whole standard menu is scored in one
 * pass while sessions play fully out: each rule tracks its trigger state per
 * roll; when it fires, its banked P&L is recorded and the session continues
 * for the remaining rules and the played-fully-out baseline.
 *
 * Standard menu: none (baseline), hard targets at equity ≥ k·B for
 * k ∈ {2,3,6}, trailing floor (exit when equity ≤ peak − d, default d = B/3),
 * fall-below-stage (configurable slug), and roll caps {100, 200, 300}.
 *
 * Two independent implementations live here on purpose:
 *   - StreamingStoppingEvaluator: incremental per-roll state (the production
 *     path, run during simulation).
 *   - evaluateStoppingPostHoc: whole-trajectory truncation scans (the
 *     validation path, run over archived JSONL trajectories).
 * The dual-path gate asserts their outputs are exactly equal.
 */

export interface StoppingConfig {
  bankroll: number;
  /** Trailing-floor drop d in dollars (default: bankroll / 3, rounded). */
  trailDrop?: number;
  /**
   * Fall-below-stage rule: ladder level (index into the machine's state
   * order) below which the rule fires, once the session has been at or
   * above it. Omit to skip the rule (non-staged strategies / no ladder).
   */
  belowStageLevel?: number;
  /** Slug used only for labeling the fall-below-stage rule. */
  belowStageSlug?: string;
}

/** One session's trajectory as the evaluator consumes it. */
export interface TrajectoryView {
  /** equityAfter per roll (rack + felt, post-settlement). */
  equity: number[];
  /** Ladder level of stagePlayed per roll (parallel to equity); optional. */
  stageLevel?: number[];
  endedAtRuin: boolean;
}

export type StopOutcome = 'triggered' | 'ruin' | 'censored';

export interface RuleSessionResult {
  outcome: StopOutcome;
  /** Banked P&L: equity at exit (or final equity) − bankroll. */
  banked: number;
  /** Roll index (1-based) at which the rule fired; null if it never did. */
  exitRoll: number | null;
}

export interface StoppingRuleReport {
  rule: string;
  params?: Record<string, number | string>;
  triggerRate: number;
  ruinRate: number;
  censoredRate: number;
  banked: { p10: number; p50: number; p90: number };
  pctPositive: number;
  /**
   * Peak-capture ratio over sessions whose peak P&L is positive, computed
   * as ratio of sums: Σ(exit P&L) ÷ Σ(peak P&L). (Ratio-of-sums rather than
   * mean-of-ratios — near-zero peaks make per-session ratios explode.)
   * Null when no session had a positive peak.
   */
  peakCapture: number | null;
}

export interface StoppingReport {
  rules: StoppingRuleReport[];
  /** P(equity reached k·B before ruin), with the censored fraction stated. */
  hitting: { k: number; pHitBeforeRuin: number; censoredFraction: number }[];
  /** Peak session P&L distribution — a first-class output (v4 §3). */
  peakPnl: { p10: number; p25: number; p50: number; p75: number; p90: number; p99: number };
}

export const TARGET_KS = [2, 3, 6];
export const ROLL_CAPS = [100, 200, 300];

interface RuleDef {
  id: string;
  params?: Record<string, number | string>;
}

export function ruleDefs(config: StoppingConfig): RuleDef[] {
  const d = config.trailDrop ?? Math.round(config.bankroll / 3);
  const defs: RuleDef[] = [{ id: 'none' }];
  for (const k of TARGET_KS) defs.push({ id: `target-${k}x`, params: { k } });
  defs.push({ id: 'trail', params: { drop: d } });
  if (config.belowStageLevel !== undefined) {
    defs.push({ id: 'below-stage', params: { slug: config.belowStageSlug ?? String(config.belowStageLevel) } });
  }
  for (const cap of ROLL_CAPS) defs.push({ id: `cap-${cap}`, params: { rolls: cap } });
  return defs;
}

// ---------------------------------------------------------------------------
// Path 1: streaming (incremental per-roll state)
// ---------------------------------------------------------------------------

interface StreamRuleState {
  exitRoll: number | null;
  banked: number | null;
  armed: boolean; // below-stage only
}

export class StreamingStoppingEvaluator {
  private readonly config: StoppingConfig;
  private readonly trailDrop: number;
  private readonly defs: RuleDef[];

  // Per-session working state
  private states: Map<string, StreamRuleState> = new Map();
  private peak = 0;
  private rollIndex = 0;
  private hitK: Map<number, boolean> = new Map();

  // Accumulated per-session results
  private perRule: Map<string, RuleSessionResult[]> = new Map();
  private peaks: number[] = [];
  private hitting: Map<number, { hit: number; ruined: number; censored: number }> = new Map();

  constructor(config: StoppingConfig) {
    this.config = config;
    this.trailDrop = config.trailDrop ?? Math.round(config.bankroll / 3);
    this.defs = ruleDefs(config);
    for (const def of this.defs) this.perRule.set(def.id, []);
    for (const k of TARGET_KS) this.hitting.set(k, { hit: 0, ruined: 0, censored: 0 });
  }

  beginSession(): void {
    this.states = new Map(this.defs.map(d => [d.id, { exitRoll: null, banked: null, armed: false }]));
    this.peak = this.config.bankroll;
    this.rollIndex = 0;
    this.hitK = new Map(TARGET_KS.map(k => [k, false]));
  }

  onRoll(equityAfter: number, stageLevel?: number): void {
    this.rollIndex++;
    const B = this.config.bankroll;
    if (equityAfter > this.peak) this.peak = equityAfter;

    for (const k of TARGET_KS) {
      if (!this.hitK.get(k) && equityAfter >= k * B) this.hitK.set(k, true);
    }

    for (const def of this.defs) {
      const st = this.states.get(def.id)!;
      if (st.exitRoll !== null) continue;

      let fire = false;
      if (def.id.startsWith('target-')) {
        fire = equityAfter >= (def.params!.k as number) * B;
      } else if (def.id === 'trail') {
        fire = equityAfter <= this.peak - this.trailDrop;
      } else if (def.id === 'below-stage') {
        const level = stageLevel;
        if (level !== undefined && this.config.belowStageLevel !== undefined) {
          if (level >= this.config.belowStageLevel) st.armed = true;
          else if (st.armed) fire = true;
        }
      } else if (def.id.startsWith('cap-')) {
        fire = this.rollIndex >= (def.params!.rolls as number);
      }
      // 'none' never fires.

      if (fire) {
        st.exitRoll = this.rollIndex;
        st.banked = equityAfter - B;
      }
    }
  }

  endSession(finalEquity: number, endedAtRuin: boolean): void {
    const B = this.config.bankroll;
    const finalPnl = finalEquity - B;
    for (const def of this.defs) {
      const st = this.states.get(def.id)!;
      const result: RuleSessionResult = st.exitRoll !== null
        ? { outcome: 'triggered', banked: st.banked!, exitRoll: st.exitRoll }
        : { outcome: endedAtRuin ? 'ruin' : 'censored', banked: finalPnl, exitRoll: null };
      this.perRule.get(def.id)!.push(result);
    }
    this.peaks.push(this.peak - B);
    for (const k of TARGET_KS) {
      const bucket = this.hitting.get(k)!;
      if (this.hitK.get(k)) bucket.hit++;
      else if (endedAtRuin) bucket.ruined++;
      else bucket.censored++;
    }
  }

  report(): StoppingReport {
    return buildReport(this.defs, this.perRule, this.peaks, this.hitting);
  }
}

// ---------------------------------------------------------------------------
// Path 2: post-hoc truncation (independent implementation for validation)
// ---------------------------------------------------------------------------

/**
 * Evaluate the same menu by literal truncation of full trajectories:
 * for each rule, scan the whole equity path for the first roll satisfying
 * the rule, truncate there, and bank that equity. Implemented with
 * whole-array scans (not incremental state) so it validates the streaming
 * path rather than mirroring it.
 */
export function evaluateStoppingPostHoc(trajectories: TrajectoryView[], config: StoppingConfig): StoppingReport {
  const B = config.bankroll;
  const trailDrop = config.trailDrop ?? Math.round(B / 3);
  const defs = ruleDefs(config);
  const perRule = new Map<string, RuleSessionResult[]>(defs.map(d => [d.id, []]));
  const peaks: number[] = [];
  const hitting = new Map<number, { hit: number; ruined: number; censored: number }>(
    TARGET_KS.map(k => [k, { hit: 0, ruined: 0, censored: 0 }]),
  );

  for (const t of trajectories) {
    const eq = t.equity;
    const n = eq.length;
    const finalPnl = (n > 0 ? eq[n - 1] : B) - B;

    // Running peak (prefix max including the starting bankroll).
    const prefixPeak: number[] = new Array(n);
    let p = B;
    for (let i = 0; i < n; i++) {
      p = Math.max(p, eq[i]);
      prefixPeak[i] = p;
    }
    peaks.push((n > 0 ? prefixPeak[n - 1] : B) - B);

    for (const k of TARGET_KS) {
      const hitIdx = eq.findIndex(e => e >= k * B);
      const bucket = hitting.get(k)!;
      if (hitIdx !== -1) bucket.hit++;
      else if (t.endedAtRuin) bucket.ruined++;
      else bucket.censored++;
    }

    for (const def of defs) {
      let idx = -1;
      if (def.id.startsWith('target-')) {
        const k = def.params!.k as number;
        idx = eq.findIndex(e => e >= k * B);
      } else if (def.id === 'trail') {
        idx = eq.findIndex((e, i) => e <= prefixPeak[i] - trailDrop);
      } else if (def.id === 'below-stage') {
        const levels = t.stageLevel;
        if (levels && config.belowStageLevel !== undefined) {
          let armedAt = -1;
          for (let i = 0; i < n; i++) {
            if (levels[i] >= config.belowStageLevel) { armedAt = i; break; }
          }
          if (armedAt !== -1) {
            for (let i = armedAt; i < n; i++) {
              if (levels[i] < config.belowStageLevel) { idx = i; break; }
            }
          }
        }
      } else if (def.id.startsWith('cap-')) {
        const cap = def.params!.rolls as number;
        idx = n >= cap ? cap - 1 : -1;
      }

      const results = perRule.get(def.id)!;
      if (idx !== -1) {
        results.push({ outcome: 'triggered', banked: eq[idx] - B, exitRoll: idx + 1 });
      } else {
        results.push({ outcome: t.endedAtRuin ? 'ruin' : 'censored', banked: finalPnl, exitRoll: null });
      }
    }
  }

  return buildReport(defs, perRule, peaks, hitting);
}

// ---------------------------------------------------------------------------
// Shared aggregation
// ---------------------------------------------------------------------------

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function buildReport(
  defs: RuleDef[],
  perRule: Map<string, RuleSessionResult[]>,
  peaks: number[],
  hitting: Map<number, { hit: number; ruined: number; censored: number }>,
): StoppingReport {
  const rules: StoppingRuleReport[] = defs.map(def => {
    const results = perRule.get(def.id)!;
    const n = results.length || 1;
    const banked = results.map(r => r.banked).sort((a, b) => a - b);
    // Peak capture: Σ(exit P&L) ÷ Σ(peak P&L) over peak-positive paths.
    let exitSum = 0;
    let peakSum = 0;
    results.forEach((r, i) => {
      if (peaks[i] > 0) {
        exitSum += r.banked;
        peakSum += peaks[i];
      }
    });
    return {
      rule: def.id,
      ...(def.params ? { params: def.params } : {}),
      triggerRate: results.filter(r => r.outcome === 'triggered').length / n,
      ruinRate: results.filter(r => r.outcome === 'ruin').length / n,
      censoredRate: results.filter(r => r.outcome === 'censored').length / n,
      banked: { p10: quantile(banked, 0.1), p50: quantile(banked, 0.5), p90: quantile(banked, 0.9) },
      pctPositive: (100 * results.filter(r => r.banked > 0).length) / n,
      peakCapture: peakSum > 0 ? exitSum / peakSum : null,
    };
  });

  const sortedPeaks = peaks.slice().sort((a, b) => a - b);
  const sessions = peaks.length || 1;
  return {
    rules,
    hitting: TARGET_KS.map(k => {
      const b = hitting.get(k)!;
      return {
        k,
        pHitBeforeRuin: b.hit / sessions,
        censoredFraction: b.censored / sessions,
      };
    }),
    peakPnl: {
      p10: quantile(sortedPeaks, 0.1),
      p25: quantile(sortedPeaks, 0.25),
      p50: quantile(sortedPeaks, 0.5),
      p75: quantile(sortedPeaks, 0.75),
      p90: quantile(sortedPeaks, 0.9),
      p99: quantile(sortedPeaks, 0.99),
    },
  };
}
