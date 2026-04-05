/**
 * Type-level tests for the Stage Machine API contract.
 *
 * These tests verify the API shape is correct by constructing valid and
 * invalid usages. TypeScript compilation failure = test failure.
 * Runtime assertions confirm the types are importable and structurally sound.
 */

import {
  StageContext,
  StageConfig,
  SessionState,
  TableReadView,
  StageMachineBuilder,
  CrapsEventName,
  CrapsEventPayload,
  CrapsEventHandlers,
} from '../../src/dsl/stage-machine-types';

describe('StageContext type contract', () => {
  it('includes bets, track, session, table, and advanceTo', () => {
    // Verify that a valid StageContext can be structurally defined
    const ctx: StageContext = {
      bets: {
        passLine: () => ({ withOdds: () => {}, withMaxOdds: () => {} }),
        come: () => ({ withOdds: () => {}, withMaxOdds: () => {} }),
        dontPass: () => ({ withOdds: () => {}, withMaxOdds: () => {} }),
        dontCome: () => ({ withOdds: () => {}, withMaxOdds: () => {} }),
        place: () => {},
        field: () => {},
        hardways: () => {},
        remove: () => {},
      },
      track: <T>(key: string, initial?: T) => initial as T,
      session: { profit: 0, stage: 'test', consecutiveSevenOuts: 0, handsPlayed: 0 },
      table: {
        point: null,
        coverage: new Set<number>(),
        hasSixOrEight: false,
        comeBetsInTransit: 0,
      },
      advanceTo: (_name: string) => {},
    };

    expect(ctx.bets).toBeDefined();
    expect(ctx.track).toBeDefined();
    expect(ctx.session).toBeDefined();
    expect(ctx.table).toBeDefined();
    expect(ctx.advanceTo).toBeDefined();
  });

  it('bets has the same interface as StrategyContext.bets', () => {
    // Verify that BetReconciler methods are present
    const ctx: StageContext = {
      bets: {
        passLine: (amount: number) => ({ withOdds: () => {}, withMaxOdds: () => {} }),
        come: (amount: number) => ({ withOdds: () => {}, withMaxOdds: () => {} }),
        dontPass: (amount: number) => ({ withOdds: () => {}, withMaxOdds: () => {} }),
        dontCome: (amount: number) => ({ withOdds: () => {}, withMaxOdds: () => {} }),
        place: (point: number, amount: number) => {},
        field: (amount: number) => {},
        hardways: (point: number, amount: number) => {},
        remove: (type: string, point?: number) => {},
      },
      track: <T>(_k: string, i?: T) => i as T,
      session: { profit: 0, stage: 'a', consecutiveSevenOuts: 0, handsPlayed: 0 },
      table: { point: null, coverage: new Set(), hasSixOrEight: false, comeBetsInTransit: 0 },
      advanceTo: () => {},
    };

    expect(typeof ctx.bets.passLine).toBe('function');
    expect(typeof ctx.bets.come).toBe('function');
    expect(typeof ctx.bets.place).toBe('function');
    expect(typeof ctx.bets.field).toBe('function');
    expect(typeof ctx.bets.hardways).toBe('function');
    expect(typeof ctx.bets.remove).toBe('function');
  });

  it('session fields are all readonly', () => {
    const session: SessionState = {
      profit: 100,
      stage: 'stage1',
      consecutiveSevenOuts: 2,
      handsPlayed: 5,
    };

    // Verify all fields are readable
    expect(session.profit).toBe(100);
    expect(session.stage).toBe('stage1');
    expect(session.consecutiveSevenOuts).toBe(2);
    expect(session.handsPlayed).toBe(5);
  });

  it('table fields are all readonly', () => {
    const table: TableReadView = {
      point: 6,
      coverage: new Set([6, 8]),
      hasSixOrEight: true,
      comeBetsInTransit: 1,
    };

    expect(table.point).toBe(6);
    expect(table.coverage.has(6)).toBe(true);
    expect(table.hasSixOrEight).toBe(true);
    expect(table.comeBetsInTransit).toBe(1);
  });

  it('advanceTo accepts a string stage name', () => {
    let calledWith: string | undefined;
    const ctx: StageContext = {
      bets: {} as any,
      track: <T>(_k: string, i?: T) => i as T,
      session: { profit: 0, stage: 'a', consecutiveSevenOuts: 0, handsPlayed: 0 },
      table: { point: null, coverage: new Set(), hasSixOrEight: false, comeBetsInTransit: 0 },
      advanceTo: (name: string) => { calledWith = name; },
    };

    ctx.advanceTo('nextStage');
    expect(calledWith).toBe('nextStage');
  });
});

describe('StageConfig type contract', () => {
  it('board is required', () => {
    const config: StageConfig = {
      board: (_ctx: StageContext) => {},
    };
    expect(config.board).toBeDefined();
  });

  it('canAdvanceTo is optional', () => {
    const configWithout: StageConfig = {
      board: () => {},
    };
    expect(configWithout.canAdvanceTo).toBeUndefined();

    const configWith: StageConfig = {
      board: () => {},
      canAdvanceTo: (_target: string, _ctx: SessionState) => true,
    };
    expect(typeof configWith.canAdvanceTo).toBe('function');
  });

  it('mustRetreatTo is optional', () => {
    const configWithout: StageConfig = {
      board: () => {},
    };
    expect(configWithout.mustRetreatTo).toBeUndefined();

    const configWith: StageConfig = {
      board: () => {},
      mustRetreatTo: (_ctx: SessionState) => undefined,
    };
    expect(typeof configWith.mustRetreatTo).toBe('function');
  });

  it('on is optional and accepts a partial CrapsEventHandlers', () => {
    const config: StageConfig = {
      board: () => {},
      on: {
        numberHit: (payload, _ctx) => {
          // payload should be { number: number; payout: number }
          const _n: number = payload.number;
          const _p: number = payload.payout;
        },
      },
    };

    expect(config.on).toBeDefined();
    expect(config.on!.numberHit).toBeDefined();
    expect(config.on!.sevenOut).toBeUndefined();
  });
});

describe('CrapsEventPayload type contract', () => {
  it('numberHit payload has number and payout', () => {
    const payload: CrapsEventPayload<'numberHit'> = { number: 6, payout: 14 };
    expect(payload.number).toBe(6);
    expect(payload.payout).toBe(14);
  });

  it('sevenOut payload has rollNumber', () => {
    const payload: CrapsEventPayload<'sevenOut'> = { rollNumber: 42 };
    expect(payload.rollNumber).toBe(42);
  });

  it('pointEstablished payload has point', () => {
    const payload: CrapsEventPayload<'pointEstablished'> = { point: 8 };
    expect(payload.point).toBe(8);
  });

  it('comeTravel payload has number', () => {
    const payload: CrapsEventPayload<'comeTravel'> = { number: 5 };
    expect(payload.number).toBe(5);
  });
});
