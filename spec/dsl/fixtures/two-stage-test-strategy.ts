/**
 * Two-stage test strategy for deterministic RiggedDice-based unit tests.
 *
 * Stage A: Place 6/8 at $12 each (identical to Place6And8)
 * Stage B: Pass line $10 with $20 odds + 1 come bet $10 with $20 odds
 *
 * Advance: A → B when profit >= +$30
 * Retreat: B → A when profit < +$30 or consecutiveSevenOuts >= 2
 *
 * This strategy is designed for controlled tests using RiggedDice
 * where specific roll sequences can trigger transitions.
 */

import { stageMachine } from '../../../src/dsl/stage-machine';

export function createTwoStageStrategy() {
  return stageMachine('TwoStage')
    .startingAt('stageA')
    .stage('stageA', {
      board: ({ bets, session, advanceTo }) => {
        bets.place(6, 12);
        bets.place(8, 12);
        if (session.profit >= 30) {
          advanceTo('stageB');
        }
      },
      canAdvanceTo: (_target, session) => session.profit >= 30,
    })
    .stage('stageB', {
      board: ({ bets }) => {
        bets.passLine(10).withOdds(20);
        bets.come(10).withOdds(20);
      },
      mustRetreatTo: (session) =>
        session.profit < 30 || session.consecutiveSevenOuts >= 2
          ? 'stageA'
          : undefined,
    })
    .build();
}
