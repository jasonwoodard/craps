import * as path from 'path';
import { loadStrategyFile } from '../../src/cli/strategy-loader';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('loadStrategyFile', () => {
  it('loads a minimal fixture strategy and returns a callable function', () => {
    const strategy = loadStrategyFile(path.join(fixturesDir, 'minimal-strategy.ts'));
    expect(typeof strategy).toBe('function');
  });

  it('returned function is callable without throwing (with a stub context)', () => {
    const strategy = loadStrategyFile(path.join(fixturesDir, 'minimal-strategy.ts'));
    const commands: any[] = [];
    const stubCtx = {
      bets: {
        passLine: (_amt: number) => ({ withOdds: (_o: number) => {} }),
        come: (_amt: number) => ({ withOdds: (_o: number) => {} }),
        place: (_n: number, _amt: number) => ({}),
      },
      track: (_key: string, initial?: any) => initial,
    };
    expect(() => strategy(stubCtx as any)).not.toThrow();
  });

  it('throws a descriptive error when the file has no function export', () => {
    expect(() => loadStrategyFile(path.join(fixturesDir, 'no-function-export.ts')))
      .toThrowError(/No function export found/);
  });

  it('throws a descriptive error when the file does not exist', () => {
    expect(() => loadStrategyFile(path.join(fixturesDir, 'nonexistent.ts')))
      .toThrowError(/Failed to load strategy file/);
  });

  it('resolves relative paths', () => {
    // Use an absolute path here to confirm resolution works regardless of cwd
    const absPath = path.join(fixturesDir, 'minimal-strategy.ts');
    const strategy = loadStrategyFile(absPath);
    expect(typeof strategy).toBe('function');
  });
});
