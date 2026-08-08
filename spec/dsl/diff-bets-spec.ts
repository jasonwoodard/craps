import { SimpleBetReconciler, diffBets, DesiredBet } from '../../src/dsl/bet-reconciler';

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

  it('resizes a place bet by remove + re-place when the desired amount changes', () => {
    const current: DesiredBet[] = [{ type: 'place', amount: 18, point: 8 }];
    const reconciler = new SimpleBetReconciler();
    reconciler.place(8, 12);
    const cmds = diffBets(current, reconciler.desired);
    expect(cmds).toEqual([
      { type: 'remove', betType: 'place', point: 8 },
      { type: 'place', betType: 'place', amount: 12, point: 8 },
    ]);
  });

  describe('come/dontCome contract pool', () => {
    it('does not remove a traveled come bet matched by an un-pointed declaration', () => {
      const current: DesiredBet[] = [{ type: 'come', amount: 10, point: 5 }];
      const reconciler = new SimpleBetReconciler();
      reconciler.come(10);
      const cmds = diffBets(current, reconciler.desired);
      expect(cmds).toEqual([]);
    });

    it('applies declared odds to a traveled come bet, targeted by its point', () => {
      const current: DesiredBet[] = [{ type: 'come', amount: 10, point: 5 }];
      const reconciler = new SimpleBetReconciler();
      reconciler.come(10).withOdds(20);
      const cmds = diffBets(current, reconciler.desired);
      expect(cmds).toEqual([
        { type: 'updateOdds', betType: 'come', amount: 20, point: 5 },
      ]);
    });

    it('places a new transit come without odds when declarations exceed current bets', () => {
      const current: DesiredBet[] = [{ type: 'come', amount: 10, point: 5, odds: 20 }];
      const reconciler = new SimpleBetReconciler();
      reconciler.come(10).withOdds(20);
      reconciler.come(10).withOdds(20);
      const cmds = diffBets(current, reconciler.desired);
      // Traveled bet already has its odds; second declaration spawns a new
      // transit come — with NO odds command (odds go on after it travels).
      expect(cmds).toEqual([
        { type: 'place', betType: 'come', amount: 10 },
      ]);
    });

    it('is idempotent when traveled + transit bets match the declarations', () => {
      const current: DesiredBet[] = [
        { type: 'come', amount: 10, point: 5, odds: 20 },
        { type: 'come', amount: 10 },
      ];
      const reconciler = new SimpleBetReconciler();
      reconciler.come(10).withOdds(20);
      reconciler.come(10).withOdds(20);
      const cmds = diffBets(current, reconciler.desired);
      expect(cmds).toEqual([]);
    });

    it('keeps a traveled come riding but strips its odds when declarations disappear', () => {
      const current: DesiredBet[] = [
        { type: 'come', amount: 10, point: 5, odds: 20 },
        { type: 'come', amount: 10 },
      ];
      const cmds = diffBets(current, []);
      // Traveled flat is a contract (rides); odds come down; transit bet removed.
      expect(cmds).toEqual([
        { type: 'updateOdds', betType: 'come', amount: 0, point: 5 },
        { type: 'remove', betType: 'come' },
      ]);
    });

    it('handles dontCome with the same pool semantics', () => {
      const current: DesiredBet[] = [{ type: 'dontCome', amount: 10, point: 4 }];
      const reconciler = new SimpleBetReconciler();
      reconciler.dontCome(10).withOdds(40);
      const cmds = diffBets(current, reconciler.desired);
      expect(cmds).toEqual([
        { type: 'updateOdds', betType: 'dontCome', amount: 40, point: 4 },
      ]);
    });
  });
});
