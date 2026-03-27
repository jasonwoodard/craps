import type { EngineResult, DistributionAggregates } from '../../types/simulation';

export type { DistributionAggregates };

export interface SessionSummary {
  seed: number;
  bankrollByRoll: number[];  // bankrollAfter at each roll index
  finalBankroll: number;
  initialBankroll: number;
  peakBankroll: number;
  rollsToPeak: number;
  ruinedAtRoll: number | null;  // roll index where bankroll first hit 0, or null
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function summarize(result: EngineResult, seed: number): SessionSummary {
  const rolls = result.rolls;
  const initial = result.initialBankroll;

  // Build bankroll-by-roll array (one entry per roll)
  const bankrollByRoll = rolls.map(r => r.bankrollAfter);

  let peakBankroll = initial;
  let rollsToPeak = 0;
  let ruinedAtRoll: number | null = null;

  for (let i = 0; i < rolls.length; i++) {
    const br = rolls[i].bankrollAfter;
    if (br > peakBankroll) {
      peakBankroll = br;
      rollsToPeak = i + 1;
    }
    if (br <= 0 && ruinedAtRoll === null) {
      ruinedAtRoll = i + 1;
    }
  }

  return {
    seed,
    bankrollByRoll,
    finalBankroll: result.finalBankroll,
    initialBankroll: initial,
    peakBankroll,
    rollsToPeak,
    ruinedAtRoll,
  };
}

export function computeAggregates(results: SessionSummary[]): DistributionAggregates {
  if (results.length === 0) {
    return {
      p10: [], p50: [], p90: [],
      finalBankroll: { p10: 0, p50: 0, p90: 0, mean: 0 },
      peakBankroll:  { p10: 0, p50: 0, p90: 0, mean: 0 },
      rollsToPeak:   { p10: 0, p50: 0, p90: 0, mean: 0 },
      ruinByRoll:    [],
      winRate: 0,
      ruinRate: 0,
      seedCount: 0,
    };
  }

  const maxRolls = Math.max(...results.map(r => r.bankrollByRoll.length));
  const n = results.length;

  // Per-roll percentile bands
  const p10: number[] = [];
  const p50: number[] = [];
  const p90: number[] = [];
  const ruinByRoll: number[] = [];

  for (let i = 0; i < maxRolls; i++) {
    // For sessions that ended early (ruin), carry forward 0
    const values = results.map(r =>
      i < r.bankrollByRoll.length ? r.bankrollByRoll[i] : 0
    );
    values.sort((a, b) => a - b);
    p10.push(Math.round(percentile(values, 10)));
    p50.push(Math.round(percentile(values, 50)));
    p90.push(Math.round(percentile(values, 90)));

    // P(ruin) = fraction that hit 0 at or before roll i+1
    const ruinCount = results.filter(r =>
      r.ruinedAtRoll !== null && r.ruinedAtRoll <= i + 1
    ).length;
    ruinByRoll.push(ruinCount / n);
  }

  // Final bankroll stats
  const finalValues = results.map(r => r.finalBankroll).sort((a, b) => a - b);
  const finalMean = finalValues.reduce((s, v) => s + v, 0) / n;

  // Peak bankroll stats
  const peakValues = results.map(r => r.peakBankroll).sort((a, b) => a - b);
  const peakMean = peakValues.reduce((s, v) => s + v, 0) / n;

  // Rolls to peak stats
  const rollsToPeakValues = results.map(r => r.rollsToPeak).sort((a, b) => a - b);
  const rollsToPeakMean = rollsToPeakValues.reduce((s, v) => s + v, 0) / n;

  const initialBankroll = results[0].initialBankroll;
  const winRate = results.filter(r => r.finalBankroll > initialBankroll).length / n;
  const ruinRate = results.filter(r => r.ruinedAtRoll !== null).length / n;

  return {
    p10,
    p50,
    p90,
    finalBankroll: {
      p10:  Math.round(percentile(finalValues, 10)),
      p50:  Math.round(percentile(finalValues, 50)),
      p90:  Math.round(percentile(finalValues, 90)),
      mean: Math.round(finalMean),
    },
    peakBankroll: {
      p10:  Math.round(percentile(peakValues, 10)),
      p50:  Math.round(percentile(peakValues, 50)),
      p90:  Math.round(percentile(peakValues, 90)),
      mean: Math.round(peakMean),
    },
    rollsToPeak: {
      p10:  Math.round(percentile(rollsToPeakValues, 10)),
      p50:  Math.round(percentile(rollsToPeakValues, 50)),
      p90:  Math.round(percentile(rollsToPeakValues, 90)),
      mean: Math.round(rollsToPeakMean),
    },
    ruinByRoll,
    winRate,
    ruinRate,
    seedCount: n,
  };
}
