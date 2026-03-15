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

export const SixIn8Progressive: StrategyDefinition = ({ bets, track }) => {
  const wins = track<number>('wins', 0);
  bets.place(6, 12);
  bets.place(8, 12);
  if (wins === 1) {
    bets.remove('place', 6);
    bets.place(6, 24);
    bets.remove('place', 8);
    bets.place(8, 24);
  } else if (wins > 1) {
    bets.remove('place', 6);
    bets.place(6, 12);
    bets.remove('place', 8);
    bets.place(8, 12);
  }
};

// --- Legacy aliases ---

export const PassLineAndPlace68: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(50);
  bets.place(6, 12);
  bets.place(8, 12);
};
