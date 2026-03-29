import { summarize, computeAggregates, computeFullAggregates } from '../../../server/lib/distribution';
import { EngineResult } from '../../../types/simulation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal EngineResult with the given bankroll-by-roll sequence. */
function makeResult(bankrolls: number[], initial = 300): EngineResult {
  return {
    initialBankroll: initial,
    finalBankroll: bankrolls[bankrolls.length - 1],
    rollsPlayed: bankrolls.length,
    rolls: bankrolls.map((br, i) => ({
      rollNumber: i + 1,
      die1: 3,
      die2: 4,
      rollValue: 7,
      pointBefore: undefined,
      pointAfter: undefined,
      outcomes: [],
      bankrollBefore: i === 0 ? initial : bankrolls[i - 1],
      bankrollAfter: br,
      activeBets: [],
      tableLoadBefore: 0,
      tableLoadAfter: 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// summarize
// ---------------------------------------------------------------------------

describe('summarize', () => {
  it('returns the correct seed', () => {
    const result = makeResult([300, 290, 310]);
    expect(summarize(result, 42).seed).toBe(42);
  });

  it('extracts bankrollByRoll from bankrollAfter values', () => {
    const result = makeResult([300, 290, 310]);
    expect(summarize(result, 0).bankrollByRoll).toEqual([300, 290, 310]);
  });

  it('reports final bankroll from the last roll', () => {
    const result = makeResult([300, 290, 310]);
    expect(summarize(result, 0).finalBankroll).toBe(310);
  });

  it('tracks peak bankroll and roll index', () => {
    // Peak at roll 4 (index 3, value 350)
    const result = makeResult([300, 320, 315, 350, 330]);
    const s = summarize(result, 0);
    expect(s.peakBankroll).toBe(350);
    expect(s.rollsToPeak).toBe(4);
  });

  it('uses initial bankroll as baseline for peak (no improvement → rollsToPeak = 0)', () => {
    const result = makeResult([290, 280, 270], 300);
    const s = summarize(result, 0);
    expect(s.peakBankroll).toBe(300);   // initial, never exceeded
    expect(s.rollsToPeak).toBe(0);
  });

  it('detects ruin at the first roll where bankroll hits 0', () => {
    const result = makeResult([200, 100, 0, 0]);
    expect(summarize(result, 0).ruinedAtRoll).toBe(3);
  });

  it('returns ruinedAtRoll null when bankroll never hits 0', () => {
    const result = makeResult([300, 310, 295]);
    expect(summarize(result, 0).ruinedAtRoll).toBeNull();
  });

  it('echoes initialBankroll from the engine result', () => {
    const result = makeResult([300], 300);
    expect(summarize(result, 0).initialBankroll).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// computeAggregates
// ---------------------------------------------------------------------------

describe('computeAggregates', () => {
  it('returns zero-state aggregates for empty input', () => {
    const agg = computeAggregates([]);
    expect(agg.seedCount).toBe(0);
    expect(agg.p10).toEqual([]);
    expect(agg.p50).toEqual([]);
    expect(agg.p90).toEqual([]);
    expect(agg.winRate).toBe(0);
    expect(agg.ruinRate).toBe(0);
  });

  it('reports seedCount equal to input length', () => {
    const sessions = [
      summarize(makeResult([300, 310]), 0),
      summarize(makeResult([300, 290]), 1),
      summarize(makeResult([300, 305]), 2),
    ];
    expect(computeAggregates(sessions).seedCount).toBe(3);
  });

  it('produces per-roll band arrays with length equal to maxRolls', () => {
    const sessions = [
      summarize(makeResult([300, 310, 320]), 0),
      summarize(makeResult([300, 290, 280]), 1),
    ];
    const agg = computeAggregates(sessions);
    expect(agg.p10.length).toBe(3);
    expect(agg.p50.length).toBe(3);
    expect(agg.p90.length).toBe(3);
    expect(agg.ruinByRoll.length).toBe(3);
  });

  it('p10 ≤ p50 ≤ p90 at every roll index (ordering invariant)', () => {
    // Use a diverse enough spread so ordering is exercised
    const sessions = Array.from({ length: 20 }, (_, i) =>
      summarize(makeResult([300 + i * 10, 300 + i * 5, 300 - i * 2]), i)
    );
    const agg = computeAggregates(sessions);
    for (let i = 0; i < agg.p10.length; i++) {
      expect(agg.p10[i]).not.toBeGreaterThan(agg.p50[i]);
      expect(agg.p50[i]).not.toBeGreaterThan(agg.p90[i]);
    }
  });

  it('counts winRate as the fraction of sessions ending above initial bankroll', () => {
    const sessions = [
      summarize(makeResult([300, 350], 300), 0),  // win
      summarize(makeResult([300, 280], 300), 1),  // loss
      summarize(makeResult([300, 300], 300), 2),  // exactly even — not a win
      summarize(makeResult([300, 400], 300), 3),  // win
    ];
    // 2 out of 4 end above $300
    expect(computeAggregates(sessions).winRate).toBeCloseTo(0.5);
  });

  it('counts ruinRate as the fraction of sessions that reached $0', () => {
    const sessions = [
      summarize(makeResult([300, 0, 0], 300), 0),  // ruined
      summarize(makeResult([300, 150, 0], 300), 1), // ruined
      summarize(makeResult([300, 280, 260], 300), 2), // survived
    ];
    expect(computeAggregates(sessions).ruinRate).toBeCloseTo(2 / 3);
  });

  it('carries forward 0 for sessions that ended early when computing per-roll bands', () => {
    // Session A: 3 rolls. Many copies of session B: ruins at roll 1 (bankroll = 0).
    // Using enough copies of B so P10 is well into the zero-dominated portion.
    const sessionA = summarize(makeResult([300, 310, 320]), 0);
    const ruinedSessions = Array.from({ length: 9 }, (_, i) =>
      summarize(makeResult([0], 300), i + 1)
    );
    const agg = computeAggregates([sessionA, ...ruinedSessions]);
    // 9 out of 10 sessions ruined at roll 1 → 0 carried forward.
    // P10 at rolls 2 and 3 must be 0 (well below the median).
    expect(agg.p10[1]).toBe(0);
    expect(agg.p10[2]).toBe(0);
    // P90 at those rolls reflects the one surviving session
    expect(agg.p90[1]).toBeGreaterThan(0);
  });

  it('ruinByRoll is monotonically non-decreasing', () => {
    const sessions = [
      summarize(makeResult([300, 200, 0, 0]), 0),
      summarize(makeResult([300, 100, 50, 0]), 1),
      summarize(makeResult([300, 310, 320, 330]), 2),
    ];
    const { ruinByRoll } = computeAggregates(sessions);
    for (let i = 1; i < ruinByRoll.length; i++) {
      expect(ruinByRoll[i]).not.toBeLessThan(ruinByRoll[i - 1]);
    }
  });

  it('finalBankroll stats reflect the distribution of terminal values', () => {
    // Three sessions ending at 200, 300, 400 — median should be 300
    const sessions = [
      summarize(makeResult([200], 300), 0),
      summarize(makeResult([300], 300), 1),
      summarize(makeResult([400], 300), 2),
    ];
    const agg = computeAggregates(sessions);
    expect(agg.finalBankroll.p50).toBe(300);
    expect(agg.finalBankroll.p10).toBeLessThan(300);
    expect(agg.finalBankroll.p90).toBeGreaterThan(300);
  });
});

// ---------------------------------------------------------------------------
// computeFullAggregates
// ---------------------------------------------------------------------------

describe('computeFullAggregates', () => {
  const params = { strategy: 'CATS', rolls: 50, bankroll: 300 };

  it('returns zero-state for empty input', () => {
    const agg = computeFullAggregates([], params);
    expect(agg.p95).toEqual([]);
    expect(agg.p99).toEqual([]);
    expect(agg.seedCount).toBe(0);
  });

  it('includes all base DistributionAggregates fields', () => {
    const sessions = [
      summarize(makeResult([300, 310, 320]), 0),
      summarize(makeResult([300, 290, 280]), 1),
    ];
    const agg = computeFullAggregates(sessions, params);
    expect(agg.p10).toBeDefined();
    expect(agg.p50).toBeDefined();
    expect(agg.p90).toBeDefined();
    expect(agg.ruinByRoll).toBeDefined();
    expect(agg.winRate).toBeDefined();
    expect(agg.ruinRate).toBeDefined();
  });

  it('produces p95 and p99 arrays the same length as the band arrays', () => {
    const sessions = [
      summarize(makeResult([300, 310, 320]), 0),
      summarize(makeResult([300, 290, 280]), 1),
    ];
    const agg = computeFullAggregates(sessions, params);
    expect(agg.p95.length).toBe(agg.p10.length);
    expect(agg.p99.length).toBe(agg.p10.length);
  });

  it('p90 ≤ p95 ≤ p99 at every roll index (ordering invariant)', () => {
    const sessions = Array.from({ length: 30 }, (_, i) =>
      summarize(makeResult([300 + i * 8, 300 + i * 4, 300 - i * 3]), i)
    );
    const agg = computeFullAggregates(sessions, params);
    for (let i = 0; i < agg.p90.length; i++) {
      expect(agg.p95[i]).not.toBeLessThan(agg.p90[i]);
      expect(agg.p99[i]).not.toBeLessThan(agg.p95[i]);
    }
  });

  it('finalBankroll includes p95 and p99 fields', () => {
    const sessions = [
      summarize(makeResult([200], 300), 0),
      summarize(makeResult([300], 300), 1),
      summarize(makeResult([400], 300), 2),
    ];
    const agg = computeFullAggregates(sessions, params);
    expect(agg.finalBankroll.p95).toBeDefined();
    expect(agg.finalBankroll.p99).toBeDefined();
  });

  it('finalBankroll.p95 ≥ finalBankroll.p90', () => {
    const sessions = Array.from({ length: 20 }, (_, i) =>
      summarize(makeResult([300 + i * 10], 300), i)
    );
    const agg = computeFullAggregates(sessions, params);
    expect(agg.finalBankroll.p95).not.toBeLessThan(agg.finalBankroll.p90);
    expect(agg.finalBankroll.p99).not.toBeLessThan(agg.finalBankroll.p95);
  });

  it('attaches the provided params verbatim', () => {
    const sessions = [summarize(makeResult([300]), 0)];
    const customParams = { strategy: 'ThreePointMolly3X', rolls: 200, bankroll: 500 };
    const agg = computeFullAggregates(sessions, customParams);
    expect(agg.params).toEqual(customParams);
  });

  it('sets generatedAt to a valid ISO timestamp', () => {
    const before = Date.now();
    const sessions = [summarize(makeResult([300]), 0)];
    const agg = computeFullAggregates(sessions, params);
    const after = Date.now();
    const ts = Date.parse(agg.generatedAt);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('seedCount matches the number of sessions passed in', () => {
    const sessions = Array.from({ length: 7 }, (_, i) =>
      summarize(makeResult([300 + i]), i)
    );
    expect(computeFullAggregates(sessions, params).seedCount).toBe(7);
  });
});
