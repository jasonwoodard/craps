import { stageMachine } from '../../src/dsl/stage-machine';
import { StageConfig, StageContext } from '../../src/dsl/stage-machine-types';

describe('stageMachine() builder', () => {
  const simpleBoard: StageConfig = {
    board: (_ctx: StageContext) => {},
  };

  it('throws if build() is called before startingAt()', () => {
    expect(() => {
      stageMachine('test')
        .stage('a', simpleBoard)
        .build();
    }).toThrowError(/startingAt\(\) must be called/);
  });

  it('throws if startingAt() references a stage that was not added', () => {
    expect(() => {
      stageMachine('test')
        .startingAt('missing')
        .stage('a', simpleBoard)
        .build();
    }).toThrowError(/startingAt\("missing"\) references an undeclared stage/);
  });

  it('returns a callable StrategyDefinition from build()', () => {
    const strategy = stageMachine('test')
      .startingAt('a')
      .stage('a', simpleBoard)
      .build();

    expect(typeof strategy).toBe('function');
  });

  it('allows adding multiple stages before build()', () => {
    const strategy = stageMachine('test')
      .startingAt('a')
      .stage('a', {
        board: () => {},
        canAdvanceTo: () => true,
      })
      .stage('b', {
        board: () => {},
      })
      .build();

    expect(typeof strategy).toBe('function');
  });

  it('allows the same stage to have both canAdvanceTo and mustRetreatTo', () => {
    const strategy = stageMachine('test')
      .startingAt('a')
      .stage('a', { board: () => {} })
      .stage('b', {
        board: () => {},
        canAdvanceTo: (_target, _ctx) => true,
        mustRetreatTo: (_ctx) => undefined,
      })
      .build();

    expect(typeof strategy).toBe('function');
  });

  describe('structural validation', () => {
    it('rejects a machine with zero stages', () => {
      expect(() => {
        stageMachine('empty')
          .startingAt('a')
          .build();
      }).toThrowError(/has no stages/);
    });

    it('rejects a machine where startingAt stage has no board function', () => {
      expect(() => {
        stageMachine('test')
          .startingAt('a')
          .stage('a', { board: null as any })
          .build();
      }).toThrowError(/must have a board function/);
    });
  });

  describe('strategy execution', () => {
    it('calls the starting stage board function on first invocation', () => {
      let boardCalled = false;
      const strategy = stageMachine('test')
        .startingAt('a')
        .stage('a', {
          board: () => { boardCalled = true; },
        })
        .build();

      // Invoke the strategy with a minimal context
      const mockCtx = {
        bets: {
          passLine: () => ({ withOdds: () => {}, withMaxOdds: () => {} }),
          come: () => ({ withOdds: () => {}, withMaxOdds: () => {} }),
          dontPass: () => ({ withOdds: () => {}, withMaxOdds: () => {} }),
          dontCome: () => ({ withOdds: () => {}, withMaxOdds: () => {} }),
          place: () => {},
          field: () => {},
          hardways: () => {},
          ce: () => {},
          remove: () => {},
        },
        track: <T>(_k: string, i?: T) => i as T,
      };

      strategy(mockCtx);
      expect(boardCalled).toBe(true);
    });
  });
});
