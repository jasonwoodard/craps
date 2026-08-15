/**
 * Funded entry (session-lifecycle.md v4 §2) — origin-based profit.
 *
 * origin = bankroll − gate(entryStage); profit = equity − origin. Default
 * entry (gate 0) reproduces classic behavior exactly (see the bit-identity
 * gate in scripts/bit-identity-check.sh). The seven-out counter starts at
 * zero regardless of entry stage.
 */
import { CrapsEngine } from '../../src/engine/craps-engine';
import { RiggedDice } from '../dice/rigged-dice';
import { STAGE_MACHINE_RUNTIME, StrategyDefinition } from '../../src/dsl/strategy';
import { StageMachineRuntime } from '../../src/dsl/stage-machine-state';
import { CATS } from '../../src/dsl/strategies-staged';
import { createStrategy } from '../../src/cli/strategy-registry';

function getRuntime(strategy: StrategyDefinition): StageMachineRuntime {
  return (strategy as any)[STAGE_MACHINE_RUNTIME];
}

describe('funded entry — BATS generality acceptance (v4 §2, decision #7)', () => {
  // The acceptance test for "general solution, not CATS solution": a funded
  // BATS entry works purely through the stage-machine mechanism. BATS's only
  // contribution is declarative stage metadata — no BATS-specific runtime
  // code exists anywhere in the entry/origin/spec machinery.
  it('BATS@entry=threePtDolly starts in the Dolly with profit at its $225 gate', () => {
    const strategy = createStrategy('BATS@entry=threePtDolly');
    const runtime = getRuntime(strategy);
    expect(runtime.getCurrentStage()).toBe('threePtDolly');

    // 4 (come-out: DP placed, point 4 on) — origin = 300 − 225 = 75,
    // so profit = equity − origin = 225 at the start.
    const dice = new RiggedDice([4]);
    const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: 1, dice });
    const result = engine.run();
    expect(result.rolls[0].stagePlayed).toBe('threePtDolly');
    expect(runtime.getSessionState().profit).toBe(225);
    expect(runtime.getSessionState().consecutiveSevenOuts).toBe(0);
  });

  it('a funded BATS entry retreats down the Dolly chain as profit falls', () => {
    const strategy = createStrategy('BATS@entry=threePtDolly');
    const runtime = getRuntime(strategy);
    // Losing sequence for the don't side: points made repeatedly. Each made
    // point loses the DP flat + lay odds, dropping profit through the $225
    // (→ littleDolly) and $120 (→ bearishAccumulator) floors.
    const rolls: number[] = [];
    for (let i = 0; i < 12; i++) rolls.push(6, 6); // point 6 set, point made
    const dice = new RiggedDice(rolls);
    const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: rolls.length, dice });
    engine.run();
    expect(runtime.getCurrentStage()).toBe('bearishAccumulator');
  });
});

describe('funded entry (v4 §2)', () => {

  it('default entry starts in accumulatorFull with origin = bankroll (profit 0)', () => {
    const strategy = CATS();
    const runtime = getRuntime(strategy);
    expect(runtime.getCurrentStage()).toBe('accumulatorFull');
    const dice = new RiggedDice([4]);
    const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: 1, dice });
    engine.run();
    // One point-set roll: equity unchanged (place bets at face) → profit 0.
    expect(runtime.getSessionState().profit).toBe(0);
  });

  it("entry='accumulator' resolves the slug to accumulatorFull with gate 0", () => {
    const strategy = CATS({ entry: 'accumulator' });
    const runtime = getRuntime(strategy);
    expect(runtime.getCurrentStage()).toBe('accumulatorFull');
    const dice = new RiggedDice([4]);
    const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: 1, dice });
    engine.run();
    expect(runtime.getSessionState().profit).toBe(0);
  });

  it("CATS@entry=threePtMollyLoose at $300 occupies Loose on roll 1 with profit exactly $250 (origin $50)", () => {
    const strategy = CATS({ entry: 'threePtMollyLoose' });
    const runtime = getRuntime(strategy);
    expect(runtime.getCurrentStage()).toBe('threePtMollyLoose');

    // Roll 4 establishes a point: pass line placed at face, equity unchanged.
    const dice = new RiggedDice([4]);
    const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: 1, dice });
    const result = engine.run();

    expect(result.rolls[0].stagePlayed).toBe('threePtMollyLoose');
    // origin = 300 − 250 = 50; equity still 300 → profit 250.
    expect(runtime.getSessionState().profit).toBe(250);
    // Loose's gate is shared with expandedAlpha's (both 25u): profit at
    // exactly the gate qualifies the ≥$250 advance — the stage after the
    // roll is expandedAlpha (v4 decision #1: physics, not validation).
    expect(runtime.getCurrentStage()).toBe('expandedAlpha');
  });

  it('a mid-ladder entry retreats through the chain on sustained losses', () => {
    // Enter Expanded Alpha at $300 (origin $50, profit $250) and feed
    // repeated point-then-seven-out cycles. Profit-threshold retreats walk
    // the ladder down stage by stage until the Accumulator.
    const strategy = CATS({ entry: 'expandedAlpha' });
    const runtime = getRuntime(strategy);
    expect(runtime.getCurrentStage()).toBe('expandedAlpha');

    const rolls: number[] = [];
    for (let i = 0; i < 20; i++) rolls.push(4, 7); // set point, seven out
    const dice = new RiggedDice(rolls);
    const engine = new CrapsEngine({ strategy, bankroll: 300, rolls: rolls.length, dice });
    const result = engine.run();

    // Lands in the Accumulator band...
    expect(runtime.getCurrentStage()).toBe('accumulatorRegressed');
    // ...and got there THROUGH the chain: intermediate boards were played.
    const played = new Set(result.rolls.map(r => r.stagePlayed));
    expect(played.has('expandedAlpha')).toBe(true);
    expect(
      played.has('threePtMollyLoose') || played.has('threePtMollyTight') || played.has('littleMolly')
    ).toBe(true);
  });

  it('B below the entry gate (negative origin) is legal and runs', () => {
    // $100 into Max Alpha: origin = 100 − 400 = −300 → profit starts at
    // 400 with only $100 of runway. Documented experimental config —
    // no validation beyond B > 0.
    const strategy = CATS({ entry: 'maxAlpha' });
    const runtime = getRuntime(strategy);
    const dice = new RiggedDice([4]);
    const engine = new CrapsEngine({ strategy, bankroll: 100, rolls: 1, dice });
    expect(() => engine.run()).not.toThrow();
    expect(runtime.getSessionState().profit).toBe(400);
  });

  it('the seven-out counter starts at zero regardless of entry stage', () => {
    const runtime = getRuntime(CATS({ entry: 'expandedAlpha' }));
    expect(runtime.getSessionState().consecutiveSevenOuts).toBe(0);
    expect(runtime.getSessionState().sevenOutStepDownTriggered).toBe(false);
  });

  it('unknown entry slugs fail loudly with the valid list', () => {
    expect(() => CATS({ entry: 'turboAccumulator' })).toThrowError(
      /unknown entry stage "turboAccumulator".*accumulator, littleMolly, threePtMollyTight, threePtMollyLoose, expandedAlpha, maxAlpha/
    );
    // Internal machine states without entry metadata are not enterable.
    expect(() => CATS({ entry: 'accumulatorRegressed' })).toThrow();
  });
});
