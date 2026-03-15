/**
 * conservative-place-strategy.ts — Example custom strategy file
 * ==============================================================
 *
 * This is an example of a user-supplied strategy file that can be loaded
 * via the CLI with: --strategy-file demo/conservative-place-strategy.ts
 *
 * It demonstrates:
 *   - Defining a StrategyDefinition function as a named export
 *   - Using the bets DSL to place flat bets
 *   - Keeping the strategy minimal so its behavior is easy to verify
 *
 * Strategy: Place 6 and 8 for $6 each — the lowest table-minimum size
 * at most casinos. No pass line, no come bets. Pure place action.
 */

import { StrategyDefinition } from '../src/dsl/strategy';

export const ConservativePlace: StrategyDefinition = ({ bets }) => {
  bets.place(6, 6);
  bets.place(8, 6);
};
