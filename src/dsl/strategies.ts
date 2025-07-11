import { StrategyDefinition } from './strategy';

export const PassLineAnd2Comes: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(50);
  bets.come(10).withOdds(50);
  bets.come(10).withOdds(50);
};

export const PassLineAndPlace68: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(50);
  bets.place(6, 12);
  bets.place(8, 12);
};

export const SixIn8Progressive: StrategyDefinition = ({ bets, track }) => {
  const wins = track<number>('wins', 0);
  bets.place(6, 12);
  if (wins === 1) {
    bets.remove('place', 6);
    bets.place(6, 24);
  } else if (wins > 1) {
    bets.remove('place', 6);
    bets.place(6, 12);
  }
};
