/**
 * Unit system — every CATS/BATS sizing quantity derived from the table
 * minimum. One "unit" (u) is the table minimum. The v1.2 strategy doc's
 * dollar figures are the $10-table instantiation of these rules:
 *
 *   Gates above origin:      7u / 15u / 25u / 40u  → $70/150/250/400 @ $10
 *   Pass/Come flat:          1u; odds 2× (Little), 5× (Loose), 3-2-1× (Tight)
 *   Buy 4/10 and 5/9:        2u each ($20 @ $10; $30 @ $15)
 *   Accumulator start:       min proper place bet + $6 (the 6/8 place step)
 *   Accumulator regressed:   min proper place bet ($12 @ $10; $18 @ $15)
 *   Classic declared risk B: 30u
 */

/**
 * Minimum proper place bet on a number at a given table minimum.
 * 6/8 pay 7:6 — proper bets are multiples of $6; 4/5/9/10 pay x:5 —
 * multiples of $5. The minimum proper bet is the smallest such multiple
 * at or above the table minimum.
 */
export function minPlaceBet(num: number, tableMin: number): number {
  const step = (num === 6 || num === 8) ? 6 : 5;
  return Math.ceil(tableMin / step) * step;
}

/** The place-bet increment for a number ($6 on 6/8, $5 elsewhere). */
export function placeStep(num: number): number {
  return (num === 6 || num === 8) ? 6 : 5;
}

export interface CatsUnits {
  tableMin: number;
  /** One unit = the table minimum. */
  unit: number;
  /** Pass/Come flat bet: 1u. */
  flat: number;
  /** Little Molly odds: 2× flat. */
  oddsLittle: number;
  /** Loose Molly odds: 5× flat. */
  oddsLoose: number;
  /** Tight Molly tiered odds (3-2-1× flat by coverage state). */
  tier: {
    sweet: { passLine: number; come1: number; come2: number };
    middle: { passLine: number; come1: number; come2: number };
    rough: { passLine: number; come1: number; come2: number };
  };
  /** Buy 4/10/5/9 amount: 2u. */
  buyAmount: number;
  /** Accumulator opening place bet on each of 6/8: min proper bet + $6. */
  accumulatorStart: number;
  /** Regressed place bet on each of 6/8: min proper bet. */
  accumulatorRegressed: number;
  /** Profit gates above origin (7u / 15u / 25u / 40u). */
  gates: {
    littleMolly: number;
    threePtMolly: number;
    expandedAlpha: number;
    maxAlpha: number;
  };
  /** Tight ⇄ Loose mode-shift cushion: 20u. */
  modeShiftCushion: number;
  /** §3.4 hard-reset floor: 2u. */
  hardReset: number;
  /** Classic declared session risk B: 30u. */
  classicRisk: number;
  /** Reference funded configs (v4 §4): declared risk for funded entries. */
  referenceFunded: {
    /** B for a Tight-Molly funded entry: 20u. */
    tight: number;
    /** B for a Little-Molly funded entry: 15u. */
    littleMolly: number;
  };
}

export function catsUnits(tableMin: number = 10): CatsUnits {
  const u = tableMin;
  return {
    tableMin,
    unit: u,
    flat: u,
    oddsLittle: 2 * u,
    oddsLoose: 5 * u,
    tier: {
      sweet:  { passLine: 3 * u, come1: 2 * u, come2: 1 * u },
      middle: { passLine: 2 * u, come1: 1 * u, come2: 1 * u },
      rough:  { passLine: 1 * u, come1: 1 * u, come2: 1 * u },
    },
    buyAmount: 2 * u,
    accumulatorStart: minPlaceBet(6, tableMin) + placeStep(6),
    accumulatorRegressed: minPlaceBet(6, tableMin),
    gates: {
      littleMolly: 7 * u,
      threePtMolly: 15 * u,
      expandedAlpha: 25 * u,
      maxAlpha: 40 * u,
    },
    modeShiftCushion: 20 * u,
    hardReset: 2 * u,
    classicRisk: 30 * u,
    referenceFunded: {
      tight: 20 * u,
      littleMolly: 15 * u,
    },
  };
}

export interface BatsUnits {
  tableMin: number;
  unit: number;
  /** Don't Pass / Don't Come flat: 1u. */
  flat: number;
  /** Lay-odds target win in the bearish Accumulator: 1u. */
  layWinAccumulator: number;
  /** Lay-odds target win in Little Dolly (and regressed-accumulator full mode): 2u. */
  layWinDolly: number;
  /** Lay-odds target win in 3-Point Dolly and above: 5u. */
  layWinThreePt: number;
  /** Standalone Lay 4/10/5/9 target win (Dark Alpha stages): 2u. */
  layWinStandalone: number;
  /** Profit gates (v1.x BATS ladder: $120/225/350/500 @ $10, scaled). */
  gates: {
    littleDolly: number;
    threePtDolly: number;
    expandedDarkAlpha: number;
    maxDarkAlpha: number;
  };
}

export function batsUnits(tableMin: number = 10): BatsUnits {
  const u = tableMin;
  return {
    tableMin,
    unit: u,
    flat: u,
    layWinAccumulator: u,
    layWinDolly: 2 * u,
    layWinThreePt: 5 * u,
    layWinStandalone: 2 * u,
    gates: {
      littleDolly: Math.round(12 * u),
      threePtDolly: Math.round(22.5 * u),
      expandedDarkAlpha: Math.round(35 * u),
      maxDarkAlpha: Math.round(50 * u),
    },
  };
}
