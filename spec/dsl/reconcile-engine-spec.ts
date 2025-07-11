import { ReconcileEngine } from '../../src/dsl/strategy';
import { PlayerState } from '../../src/dsl/player-state';
import { GameState } from '../../src/dsl/game-state';
import { PassLineAndPlace68 } from '../../src/dsl/strategies';
import { Dice } from '../../src/dice/dice';

class StubDice extends Dice {
  constructor(private values: number[]) {
    super();
  }

  protected doRoll(): number {
    return this.values.shift()!;
  }
}

describe('ReconcileEngine', () => {
  it('produces commands from a strategy', () => {
    const player: PlayerState = { comeBets: [], placeBets: {} } as any;
    const engine = new ReconcileEngine(player, new GameState(new StubDice([2])));
    const cmds = engine.reconcile(PassLineAndPlace68);
    expect(cmds.length).toBe(4);
  });
});
