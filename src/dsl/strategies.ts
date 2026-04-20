import { StrategyDefinition } from './strategy';

// --- Canonical built-in strategies (used by StrategyRegistry and CLI) ---

export const PassLineOnly: StrategyDefinition = ({ bets }) => {
  bets.passLine(10);
};

export const Place6And8: StrategyDefinition = ({ bets }) => {
  bets.place(6, 12);
  bets.place(8, 12);
};

export const PlaceInside: StrategyDefinition = ({ bets }) => {
  bets.place(5, 10);
  bets.place(6, 12);
  bets.place(8, 12);
  bets.place(9, 10);
};

export const PlaceAll: StrategyDefinition = ({ bets }) => {
  bets.place(4,  10);
  bets.place(5,  10);
  bets.place(6,  12);
  bets.place(8,  12);
  bets.place(9,  10);
  bets.place(10, 10);
};

// Pass Line with Odds: simple pass line + odds only (no come bets).
// The [1-5]X suffix denotes the odds multiplier on a $10 flat bet.
export const PassLineWithOdds1X: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(10);
};

export const PassLineWithOdds2X: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(20);
};

export const PassLineWithOdds3X: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(30);
};

export const PassLineWithOdds4X: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(40);
};

export const PassLineWithOdds5X: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(50);
};

// Three-Point Molly: pass line + 2 come bets, always trying to keep 3 numbers
// working. The [1-5]X suffix denotes the odds multiplier on a $10 flat bet.
export const ThreePointMolly1X: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(10);
  bets.come(10).withOdds(10);
  bets.come(10).withOdds(10);
};

export const ThreePointMolly2X: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(20);
  bets.come(10).withOdds(20);
  bets.come(10).withOdds(20);
};

export const ThreePointMolly3X: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(30);
  bets.come(10).withOdds(30);
  bets.come(10).withOdds(30);
};

export const ThreePointMolly4X: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(40);
  bets.come(10).withOdds(40);
  bets.come(10).withOdds(40);
};

export const ThreePointMolly5X: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(50);
  bets.come(10).withOdds(50);
  bets.come(10).withOdds(50);
};

// --- Don't Pass strategies ---

export const DontPassLineOnly: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10);
};

// Don't Pass with lay odds: $10 flat + lay odds. The [1-5]X suffix denotes the
// odds multiplier on a $10 flat bet (matching the PassLineWithOdds convention).
export const DontPassLineWithOdds1X: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10).withOdds(10);
};

export const DontPassLineWithOdds2X: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10).withOdds(20);
};

export const DontPassLineWithOdds3X: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10).withOdds(30);
};

export const DontPassLineWithOdds4X: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10).withOdds(40);
};

export const DontPassLineWithOdds5X: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10).withOdds(50);
};

// Three-Point Dolly: darkside equivalent of Three-Point Molly.
// Don't Pass + 2 Don't Come bets with lay odds, always trying to keep
// 3 dark-side numbers working. The [1-5]X suffix denotes the odds multiplier.
export const ThreePointDolly1X: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10).withOdds(10);
  bets.dontCome(10).withOdds(10);
  bets.dontCome(10).withOdds(10);
};

export const ThreePointDolly2X: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10).withOdds(20);
  bets.dontCome(10).withOdds(20);
  bets.dontCome(10).withOdds(20);
};

export const ThreePointDolly3X: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10).withOdds(30);
  bets.dontCome(10).withOdds(30);
  bets.dontCome(10).withOdds(30);
};

export const ThreePointDolly4X: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10).withOdds(40);
  bets.dontCome(10).withOdds(40);
  bets.dontCome(10).withOdds(40);
};

export const ThreePointDolly5X: StrategyDefinition = ({ bets }) => {
  bets.dontPass(10).withOdds(50);
  bets.dontCome(10).withOdds(50);
  bets.dontCome(10).withOdds(50);
};

// Place 6 & 8 progressive: flat $12 on win 1, then press $6 per subsequent win.
// Cap at wins=3 ($24) — covers 90% of sessions (P(≥3 wins) = (5/11)^3 ≈ 9.4%).
export const Place6And8Progressive: StrategyDefinition = ({ bets, track }) => {
  const wins = track<number>('wins', 0);
  // wins=0,1 → $12; wins=2 → $18; wins≥3 → $24 (cap)
  const amount = wins <= 1 ? 12 : Math.min(12 + (wins - 1) * 6, 24);
  bets.place(6, amount);
  bets.place(8, amount);
};

// --- Field strategies ---

export const JustField: StrategyDefinition = ({ bets }) => {
  bets.field(10);
};

export const IronCross: StrategyDefinition = ({ bets }) => {
  // Wins on every roll except 7 once point is established.
  // Place 5/6/8 are off during come-out; Field stays active.
  // No pass line — accepts come-out 7 losses as cost of coverage.
  bets.field(10);
  bets.place(5, 10);
  bets.place(6, 12);
  bets.place(8, 12);
};

export const MartingaleField: StrategyDefinition = ({ bets, track }) => {
  // Double on consecutive losses, reset to base on win. Cap at $160 (4 doublings from $10).
  // Use Distribution Compare against JustField to see Martingale failure profile.
  const consecutiveLosses = track<number>('consecutiveLosses', 0);
  const amount = Math.min(10 * Math.pow(2, consecutiveLosses), 160);
  bets.field(amount);
};

// --- M5: Hardways strategies ---

export const HardwaysHedge: StrategyDefinition = ({ bets }) => {
  // Pass line hedged with H6 and H8 — the most likely hardways points.
  bets.passLine(10);
  bets.hardways(6, 5);
  bets.hardways(8, 5);
};

export const PassAndHards: StrategyDefinition = ({ bets }) => {
  // Pass line + all four hardways. Covers every hard number simultaneously.
  bets.passLine(10);
  bets.hardways(4, 5);
  bets.hardways(6, 5);
  bets.hardways(8, 5);
  bets.hardways(10, 5);
};

// --- M6: C&E strategies ---

export const IronCrossWithCE: StrategyDefinition = ({ bets }) => {
  // IronCross (field + place 5/6/8) plus C&E for come-out insurance.
  bets.field(10);
  bets.place(5, 10);
  bets.place(6, 12);
  bets.place(8, 12);
  bets.ce(10);
};

export const PassWithCEInsurance: StrategyDefinition = ({ bets }) => {
  // Pass line backed by C&E every roll — CE pays if craps hits on come-out.
  bets.passLine(10);
  bets.ce(10);
};

// --- Legacy aliases ---

export const PassLineAndPlace68: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(50);
  bets.place(6, 12);
  bets.place(8, 12);
};
