import { StrategyDefinition } from '../../../src/dsl/strategy';

export const MinimalStrategy: StrategyDefinition = ({ bets }) => {
  bets.passLine(10);
};
