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
  // Double on loss, reset to base on win. Cap at $160 (4 doublings from $10).
  // Use Distribution Compare against JustField to see Martingale failure profile.
  const losses = track<number>('losses', 0);
  const amount = Math.min(10 * Math.pow(2, losses), 160);
  bets.field(amount);
};

// --- Legacy aliases ---

export const PassLineAndPlace68: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(50);
  bets.place(6, 12);
  bets.place(8, 12);
};
