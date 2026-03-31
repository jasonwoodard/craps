import { computeHeatScores } from '../../web/src/lib/stats';
import type { RollRecord } from '@shared/simulation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoll(overrides: Partial<RollRecord> & { rollValue: number; pointBefore?: number }): RollRecord {
  const { rollValue, pointBefore, ...rest } = overrides;
  return {
    rollNumber: 1,
    die1: 1,
    die2: rollValue - 1,
    rollValue,
    pointBefore,
    pointAfter: undefined,
    outcomes: [],
    bankrollBefore: 300,
    bankrollAfter: 300,
    activeBets: [],
    tableLoadBefore: 0,
    tableLoadAfter: 0,
    ...rest,
  };
}

// Come-out phase: pointBefore === undefined
function comeOut(rollValue: number): RollRecord {
  return makeRoll({ rollValue, pointBefore: undefined });
}

// Point phase: pointBefore is the established point
function pointPhase(rollValue: number, point: number): RollRecord {
  return makeRoll({ rollValue, pointBefore: point });
}

// ---------------------------------------------------------------------------
// computeHeatScores — single-roll window tests (halfWindow = 0)
// ---------------------------------------------------------------------------

describe('computeHeatScores — single-roll rubric (halfWindow=0)', () => {
  it('come-out natural 7 scores +1', () => {
    const scores = computeHeatScores([comeOut(7)], 0);
    expect(scores[0]).toBe(1);
  });

  it('come-out natural 11 scores +1', () => {
    const scores = computeHeatScores([comeOut(11)], 0);
    expect(scores[0]).toBe(1);
  });

  it('come-out craps 2 scores -1', () => {
    const scores = computeHeatScores([comeOut(2)], 0);
    expect(scores[0]).toBe(-1);
  });

  it('come-out craps 3 scores -1', () => {
    const scores = computeHeatScores([comeOut(3)], 0);
    expect(scores[0]).toBe(-1);
  });

  it('come-out craps 12 scores -1', () => {
    const scores = computeHeatScores([comeOut(12)], 0);
    expect(scores[0]).toBe(-1);
  });

  it('come-out point established (e.g. 6) scores 0', () => {
    const scores = computeHeatScores([comeOut(6)], 0);
    expect(scores[0]).toBe(0);
  });

  it('point phase — point made scores +1', () => {
    const scores = computeHeatScores([pointPhase(6, 6)], 0);
    expect(scores[0]).toBe(1);
  });

  it('point phase — seven-out scores -1', () => {
    const scores = computeHeatScores([pointPhase(7, 6)], 0);
    expect(scores[0]).toBe(-1);
  });

  it('point phase — off number scores 0', () => {
    const scores = computeHeatScores([pointPhase(5, 6)], 0);
    expect(scores[0]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeHeatScores — window and clamping
// ---------------------------------------------------------------------------

describe('computeHeatScores — window scoring', () => {
  it('returns an array the same length as the input rolls', () => {
    const rolls = [comeOut(7), pointPhase(7, 6), comeOut(11)];
    expect(computeHeatScores(rolls).length).toBe(3);
  });

  it('scores a mixed window correctly', () => {
    // Window at center roll (index 2) with halfWindow=2:
    // Rolls 0–4: natural(+1), 7-out(-1), point-made(+1), come-out(0), craps(-1) → sum = 0
    const rolls = [
      comeOut(7),        // +1
      pointPhase(7, 6),  // -1
      pointPhase(6, 6),  // +1
      comeOut(5),        // 0
      comeOut(12),       // -1
    ];
    const scores = computeHeatScores(rolls, 2);
    // Center roll index 2, window [0..4]: +1 -1 +1 0 -1 = 0
    expect(scores[2]).toBe(0);
  });

  it('clamps scores above +2 to +2', () => {
    // 5 naturals in a row, halfWindow=4 → window has 5 rolls at center → sum=5 → clamped to 2
    const rolls = Array.from({ length: 5 }, () => comeOut(7));
    const scores = computeHeatScores(rolls, 4);
    expect(scores[2]).toBe(2);
  });

  it('clamps scores below -2 to -2', () => {
    // 5 seven-outs in a row → sum=-5 → clamped to -2
    const rolls = Array.from({ length: 5 }, () => pointPhase(7, 6));
    const scores = computeHeatScores(rolls, 4);
    expect(scores[2]).toBe(-2);
  });
});

// ---------------------------------------------------------------------------
// computeHeatScores — edge rolls
// ---------------------------------------------------------------------------

describe('computeHeatScores — edge roll behavior', () => {
  it('roll 0 uses a shrunk window [0, halfWindow] without out-of-bounds error', () => {
    const rolls = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? comeOut(7) : comeOut(2)  // alternating +1/-1
    );
    // Should not throw; just check it returns a value in [-2, 2]
    const scores = computeHeatScores(rolls, 4);
    expect(scores[0]).toBeGreaterThanOrEqual(-2);
    expect(scores[0]).toBeLessThanOrEqual(2);
  });

  it('roll N-1 uses a shrunk window [N-1-halfWindow, N-1] without out-of-bounds error', () => {
    const rolls = Array.from({ length: 20 }, () => comeOut(7));
    const scores = computeHeatScores(rolls, 4);
    const last = scores[scores.length - 1];
    expect(last).toBeGreaterThanOrEqual(-2);
    expect(last).toBeLessThanOrEqual(2);
  });

  it('single roll uses window of size 1 (the roll itself)', () => {
    // halfWindow=4, only 1 roll → window is [0,0]
    expect(computeHeatScores([comeOut(7)], 4)[0]).toBe(1);
    expect(computeHeatScores([comeOut(2)], 4)[0]).toBe(-1);
    expect(computeHeatScores([comeOut(5)], 4)[0]).toBe(0);
  });

  it('returns empty array for empty input', () => {
    expect(computeHeatScores([], 4)).toEqual([]);
  });
});
