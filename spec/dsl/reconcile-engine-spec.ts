import { ReconcileEngine } from '../../src/dsl/strategy';
import { GameState } from '../../src/dsl/game-state';
import { PassLineAndPlace68, Place6And8Progressive } from '../../src/dsl/strategies';
import { CrapsTable } from '../../src/craps-table';
import { RiggedDice } from '../dice/rigged-dice';
import { PassLineBet } from '../../src/bets/pass-line-bet';
import { PlaceBet } from '../../src/bets/place-bet';
import { Outcome } from '../../src/dsl/outcome';
import { BetTypes } from '../../src/bets/base-bet';

describe('ReconcileEngine', () => {
  const PLAYER = 'test-player';

  function makeEngine(rolls: number[] = [2]): { engine: ReconcileEngine; table: CrapsTable } {
    const table = new CrapsTable();
    table.dice = new RiggedDice(rolls);
    const game = new GameState(new RiggedDice(rolls));
    const engine = new ReconcileEngine(table, PLAYER, game);
    return { engine, table };
  }

  it('produces commands from a strategy when table has no bets', () => {
    const { engine } = makeEngine();
    const cmds = engine.reconcile(PassLineAndPlace68);
    // passLine place + passLine updateOdds + place(6) + place(8) = 4 commands
    expect(cmds.length).toBe(4);
  });

  it('produces no commands when table already has the desired bets (idempotency)', () => {
    const { engine, table } = makeEngine();

    // First reconcile: all bets are new
    const firstCmds = engine.reconcile(PassLineAndPlace68);
    expect(firstCmds.length).toBe(4);

    // Simulate applying those commands to the table
    const passLine = new PassLineBet(10, PLAYER);
    passLine.oddsAmount = 50;
    table.placeBet(passLine);
    table.placeBet(new PlaceBet(12, 6, PLAYER));
    table.placeBet(new PlaceBet(12, 8, PLAYER));

    // Second reconcile: bets already exist, should produce no commands
    const secondCmds = engine.reconcile(PassLineAndPlace68);
    expect(secondCmds.length).toBe(0);
  });

  it('produces only the diff when table has partial bets', () => {
    const { engine, table } = makeEngine();

    // Place only the pass line bet on the table
    const passLine = new PassLineBet(10, PLAYER);
    passLine.oddsAmount = 50;
    table.placeBet(passLine);

    // Reconcile should only produce place commands for the two missing place bets
    const cmds = engine.reconcile(PassLineAndPlace68);
    expect(cmds.length).toBe(2);
    expect(cmds[0]).toEqual({ type: 'place', betType: 'place', amount: 12, point: 6 });
    expect(cmds[1]).toEqual({ type: 'place', betType: 'place', amount: 12, point: 8 });
  });

  it('ignores bets belonging to other players', () => {
    const { engine, table } = makeEngine();

    // Another player has bets on the table
    table.placeBet(new PassLineBet(10, 'other-player'));
    table.placeBet(new PlaceBet(12, 6, 'other-player'));

    // Our player's reconcile should still produce all 4 commands
    const cmds = engine.reconcile(PassLineAndPlace68);
    expect(cmds.length).toBe(4);
  });

  it('produces remove commands when table has bets no longer desired', () => {
    const { engine, table } = makeEngine();

    // Table has a place bet on 5 that the strategy doesn't want
    table.placeBet(new PlaceBet(12, 5, PLAYER));

    // Also add the desired bets
    const passLine = new PassLineBet(10, PLAYER);
    passLine.oddsAmount = 50;
    table.placeBet(passLine);
    table.placeBet(new PlaceBet(12, 6, PLAYER));
    table.placeBet(new PlaceBet(12, 8, PLAYER));

    const cmds = engine.reconcile(PassLineAndPlace68);
    // Should remove the place-5 bet
    expect(cmds.length).toBe(1);
    expect(cmds[0]).toEqual({ type: 'remove', betType: 'place', point: 5 });
  });

  describe('postRoll', () => {
    function winOutcome(point?: number): Outcome {
      return { result: 'win', betType: BetTypes.PLACE, point, amount: 12, payout: 14 };
    }

    function lossOutcome(point?: number): Outcome {
      return { result: 'loss', betType: BetTypes.PLACE, point, amount: 12, payout: 0 };
    }

    it('increments wins tracker after a winning outcome', () => {
      const { engine } = makeEngine();

      // First reconcile to initialize tracker with Place6And8Progressive
      engine.reconcile(Place6And8Progressive);

      // Win 1: bet stays flat at $12 (collect profit, no press yet)
      engine.postRoll([winOutcome(6)]);
      const cmds1 = engine.reconcile(Place6And8Progressive);
      const place1 = cmds1.find(c => c.type === 'place' && 'amount' in c);
      expect(place1).toBeDefined();
      expect((place1 as any).amount).toBe(12);

      // Win 2: press by $6 → $18
      engine.postRoll([winOutcome(6)]);
      const cmds2 = engine.reconcile(Place6And8Progressive);
      const place2 = cmds2.find(c => c.type === 'place' && 'amount' in c);
      expect(place2).toBeDefined();
      expect((place2 as any).amount).toBe(18);
    });

    it('increments losses tracker after a losing outcome', () => {
      const { engine } = makeEngine();

      engine.reconcile(Place6And8Progressive);
      engine.postRoll([lossOutcome(6)]);

      // Verify the loss was tracked by reading it through a custom strategy
      let trackedLosses = -1;
      engine.reconcile(({ track }) => {
        trackedLosses = track<number>('losses', 0);
      });
      expect(trackedLosses).toBe(1);
    });

    it('does not increment trackers when there are no outcomes', () => {
      const { engine } = makeEngine();

      engine.reconcile(Place6And8Progressive);
      engine.postRoll([]);

      let trackedWins = -1;
      let trackedLosses = -1;
      engine.reconcile(({ track }) => {
        trackedWins = track<number>('wins', 0);
        trackedLosses = track<number>('losses', 0);
      });
      expect(trackedWins).toBe(0);
      expect(trackedLosses).toBe(0);
    });

    it('accumulates multiple wins across rolls', () => {
      const { engine } = makeEngine();

      engine.reconcile(Place6And8Progressive);
      engine.postRoll([winOutcome(6)]);
      engine.postRoll([winOutcome(6)]);

      // After 2 wins, Place6And8Progressive should revert to base bet ($12)
      let trackedWins = -1;
      engine.reconcile(({ track }) => {
        trackedWins = track<number>('wins', 0);
      });
      expect(trackedWins).toBe(2);
    });

    it('tracks wins and losses independently', () => {
      const { engine } = makeEngine();

      engine.reconcile(Place6And8Progressive);
      engine.postRoll([winOutcome(6)]);
      engine.postRoll([lossOutcome(6)]);
      engine.postRoll([winOutcome(6)]);

      let trackedWins = -1;
      let trackedLosses = -1;
      engine.reconcile(({ track }) => {
        trackedWins = track<number>('wins', 0);
        trackedLosses = track<number>('losses', 0);
      });
      expect(trackedWins).toBe(2);
      expect(trackedLosses).toBe(1);
    });

    it('handles multiple outcomes in a single roll', () => {
      const { engine } = makeEngine();

      engine.reconcile(Place6And8Progressive);
      // Two bets resolve on the same roll
      engine.postRoll([winOutcome(6), winOutcome(8)]);

      let trackedWins = -1;
      engine.reconcile(({ track }) => {
        trackedWins = track<number>('wins', 0);
      });
      expect(trackedWins).toBe(2);
    });
  });
});
