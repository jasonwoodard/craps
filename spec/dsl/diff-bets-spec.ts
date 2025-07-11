import { SimpleBetReconciler, diffBets } from '../../src/dsl/bet-reconciler';

describe('diffBets', () => {
  it('creates place and odds commands for desired bets', () => {
    const reconciler = new SimpleBetReconciler();
    reconciler.passLine(10).withOdds(5);
    reconciler.place(6, 12);
    const cmds = diffBets([], reconciler.desired);
    expect(cmds).toEqual([
      { type: 'place', betType: 'passLine', amount: 10, point: undefined },
      { type: 'updateOdds', betType: 'passLine', amount: 5, point: undefined },
      { type: 'place', betType: 'place', amount: 12, point: 6 }
    ]);
  });
});
