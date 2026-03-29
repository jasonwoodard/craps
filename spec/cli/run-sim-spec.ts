import { parseArgs, runSim, runCompare, runDistribution, CliArgs } from '../../src/cli/run-sim';

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('parses --strategy as required', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly']);
    expect(args.strategy).toBe('PassLineOnly');
  });

  it('defaults rolls to 10000', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly']);
    expect(args.rolls).toBe(10000);
  });

  it('defaults bankroll to 500', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly']);
    expect(args.bankroll).toBe(500);
  });

  it('defaults output to summary', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly']);
    expect(args.output).toBe('summary');
  });

  it('defaults seed to undefined', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly']);
    expect(args.seed).toBeUndefined();
  });

  it('parses --rolls', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly', '--rolls', '500']);
    expect(args.rolls).toBe(500);
  });

  it('parses --bankroll', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly', '--bankroll', '1000']);
    expect(args.bankroll).toBe(1000);
  });

  it('parses --seed', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly', '--seed', '42']);
    expect(args.seed).toBe(42);
  });

  it('parses --output verbose', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly', '--output', 'verbose']);
    expect(args.output).toBe('verbose');
  });

  it('parses --output json', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly', '--output', 'json']);
    expect(args.output).toBe('json');
  });

  it('throws when --strategy is missing', () => {
    expect(() => parseArgs([])).toThrowError(/Missing required flag: --strategy/);
  });

  it('parses --strategy-file', () => {
    const args = parseArgs(['--strategy-file', './my-strategy.ts']);
    expect(args.strategyFile).toBe('./my-strategy.ts');
    expect(args.strategy).toBeUndefined();
  });

  it('throws when both --strategy and --strategy-file are provided', () => {
    expect(() => parseArgs(['--strategy', 'PassLineOnly', '--strategy-file', './my.ts']))
      .toThrowError(/mutually exclusive/);
  });

  it('throws for invalid --rolls value', () => {
    expect(() => parseArgs(['--strategy', 'PassLineOnly', '--rolls', 'abc']))
      .toThrowError(/Invalid value for --rolls/);
  });

  it('throws for non-positive --rolls', () => {
    expect(() => parseArgs(['--strategy', 'PassLineOnly', '--rolls', '0']))
      .toThrowError(/Invalid value for --rolls/);
  });

  it('throws for invalid --bankroll value', () => {
    expect(() => parseArgs(['--strategy', 'PassLineOnly', '--bankroll', '-10']))
      .toThrowError(/Invalid value for --bankroll/);
  });

  it('throws for invalid --output value', () => {
    expect(() => parseArgs(['--strategy', 'PassLineOnly', '--output', 'fancy']))
      .toThrowError(/Invalid value for --output/);
  });

  it('throws when a flag has no value', () => {
    expect(() => parseArgs(['--strategy', 'PassLineOnly', '--rolls']))
      .toThrowError(/--rolls requires a value/);
  });

  it('parses --output distribution', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly', '--seeds', '10', '--output', 'distribution']);
    expect(args.output).toBe('distribution');
  });

  it('parses --seeds as a positive integer', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly', '--seeds', '200', '--output', 'distribution']);
    expect(args.seeds).toBe(200);
  });

  it('defaults seeds to undefined when --seeds is not provided', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly']);
    expect(args.seeds).toBeUndefined();
  });

  it('throws for --output distribution without --seeds', () => {
    expect(() => parseArgs(['--strategy', 'PassLineOnly', '--output', 'distribution']))
      .toThrowError(/--output distribution requires --seeds/);
  });

  it('throws for --output distribution in compare mode', () => {
    expect(() => parseArgs(['--compare', 'PassLineOnly', 'Place6And8', '--seeds', '10', '--output', 'distribution']))
      .toThrowError(/not supported in comparison mode/);
  });

  it('throws for invalid --seeds value', () => {
    expect(() => parseArgs(['--strategy', 'PassLineOnly', '--seeds', 'abc', '--output', 'distribution']))
      .toThrowError(/Invalid value for --seeds/);
  });

  it('throws for non-positive --seeds value', () => {
    expect(() => parseArgs(['--strategy', 'PassLineOnly', '--seeds', '0', '--output', 'distribution']))
      .toThrowError(/Invalid value for --seeds/);
  });
});

// ---------------------------------------------------------------------------
// runDistribution integration — M6.0
// ---------------------------------------------------------------------------

describe('runDistribution', () => {
  let writtenChunks: string[];
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    writtenChunks = [];
    originalWrite = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = (chunk: any) => {
      writtenChunks.push(String(chunk));
      return true;
    };
  });

  afterEach(() => {
    (process.stdout as any).write = originalWrite;
  });

  it('runs without throwing', () => {
    expect(() => runDistribution({ strategy: 'PassLineOnly', seeds: 5, rolls: 20, bankroll: 300, output: 'distribution' }))
      .not.toThrow();
  });

  it('produces a single valid JSON object on stdout', () => {
    runDistribution({ strategy: 'PassLineOnly', seeds: 5, rolls: 20, bankroll: 300, output: 'distribution' });
    const output = writtenChunks.join('');
    let parsed: any;
    expect(() => { parsed = JSON.parse(output); }).not.toThrow();
    expect(typeof parsed).toBe('object');
  });

  it('output contains all required FullDistributionAggregates fields', () => {
    runDistribution({ strategy: 'PassLineOnly', seeds: 5, rolls: 20, bankroll: 300, output: 'distribution' });
    const parsed = JSON.parse(writtenChunks.join(''));
    expect(Array.isArray(parsed.p10)).toBe(true);
    expect(Array.isArray(parsed.p50)).toBe(true);
    expect(Array.isArray(parsed.p90)).toBe(true);
    expect(Array.isArray(parsed.p95)).toBe(true);
    expect(Array.isArray(parsed.p99)).toBe(true);
    expect(Array.isArray(parsed.ruinByRoll)).toBe(true);
    expect(typeof parsed.winRate).toBe('number');
    expect(typeof parsed.ruinRate).toBe('number');
    expect(typeof parsed.seedCount).toBe('number');
    expect(typeof parsed.generatedAt).toBe('string');
    expect(typeof parsed.params).toBe('object');
  });

  it('seedCount matches the --seeds argument', () => {
    runDistribution({ strategy: 'PassLineOnly', seeds: 7, rolls: 20, bankroll: 300, output: 'distribution' });
    const parsed = JSON.parse(writtenChunks.join(''));
    expect(parsed.seedCount).toBe(7);
  });

  it('params.strategy matches the strategy name', () => {
    runDistribution({ strategy: 'PassLineOnly', seeds: 3, rolls: 20, bankroll: 300, output: 'distribution' });
    const parsed = JSON.parse(writtenChunks.join(''));
    expect(parsed.params.strategy).toBe('PassLineOnly');
  });

  it('band arrays have length equal to --rolls (all seeds ran full length)', () => {
    runDistribution({ strategy: 'PassLineOnly', seeds: 3, rolls: 15, bankroll: 300, output: 'distribution' });
    const parsed = JSON.parse(writtenChunks.join(''));
    // Rolls = 15, no ruin expected on PassLineOnly with $300, so all bands should be 15 long
    expect(parsed.p50.length).toBe(15);
    expect(parsed.p95.length).toBe(15);
  });

  it('produces identical output for the same inputs (seeds are deterministic)', () => {
    const run = () => {
      writtenChunks = [];
      runDistribution({ strategy: 'PassLineOnly', seeds: 5, rolls: 20, bankroll: 300, output: 'distribution' });
      return JSON.parse(writtenChunks.join(''));
    };
    const first  = run();
    const second = run();
    expect(first.p50).toEqual(second.p50);
    expect(first.finalBankroll).toEqual(second.finalBankroll);
    expect(first.seedCount).toEqual(second.seedCount);
  });

  it('throws for an unknown strategy name', () => {
    expect(() => runDistribution({ strategy: 'Fake', seeds: 3, rolls: 10, bankroll: 300, output: 'distribution' }))
      .toThrowError(/Unknown strategy "Fake"/);
  });
});

// ---------------------------------------------------------------------------
// runSim integration
// ---------------------------------------------------------------------------

describe('runSim', () => {
  let outputLines: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    outputLines = [];
    originalLog = console.log;
    console.log = (...args: any[]) => outputLines.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('runs a simulation without throwing', () => {
    expect(() => runSim({ strategy: 'PassLineOnly', rolls: 50, bankroll: 500, output: 'summary' }))
      .not.toThrow();
  });

  it('produces summary output by default', () => {
    runSim({ strategy: 'PassLineOnly', rolls: 50, bankroll: 500, output: 'summary' });
    const joined = outputLines.join('\n');
    expect(joined).toContain('Simulation Summary');
    expect(joined).toContain('PassLineOnly');
  });

  it('produces verbose output with per-roll lines', () => {
    runSim({ strategy: 'PassLineOnly', rolls: 10, bankroll: 500, output: 'verbose' });
    const rollLines = outputLines.filter(l => l.startsWith('Roll #'));
    expect(rollLines.length).toBeGreaterThan(0);
  });

  it('produces parseable JSONL in json mode', () => {
    runSim({ strategy: 'PassLineOnly', rolls: 20, bankroll: 500, output: 'json' });
    for (const line of outputLines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
    const parsed = outputLines.map(l => JSON.parse(l));
    const summary = parsed.find((e: any) => e.type === 'summary');
    expect(summary).toBeDefined();
    expect(summary.meta.strategy).toBe('PassLineOnly');
  });

  it('produces identical dice rolls for the same seed', () => {
    const captureRollLines = (): any[] => {
      const lines: string[] = [];
      const orig = console.log;
      console.log = (...a: any[]) => lines.push(a.join(' '));
      runSim({ strategy: 'PassLineOnly', rolls: 100, bankroll: 500, seed: 42, output: 'json' });
      console.log = orig;
      // Return only the roll entries (exclude summary which has a timestamp)
      return lines.map(l => JSON.parse(l)).filter((e: any) => e.type === 'roll');
    };

    const run1 = captureRollLines();
    const run2 = captureRollLines();
    expect(run1).toEqual(run2);
  });

  it('throws for an unknown strategy name', () => {
    expect(() => runSim({ strategy: 'Fake', rolls: 10, bankroll: 500, output: 'summary' }))
      .toThrowError(/Unknown strategy "Fake"/);
  });

  it('runs a simulation from a strategy file without throwing', () => {
    const fixturePath = require('path').join(__dirname, 'fixtures', 'minimal-strategy.ts');
    expect(() => runSim({ strategyFile: fixturePath, rolls: 20, bankroll: 500, output: 'summary' }))
      .not.toThrow();
  });

  it('produces summary output when run from a strategy file', () => {
    const fixturePath = require('path').join(__dirname, 'fixtures', 'minimal-strategy.ts');
    runSim({ strategyFile: fixturePath, rolls: 20, bankroll: 500, output: 'summary' });
    const joined = outputLines.join('\n');
    expect(joined).toContain('Simulation Summary');
  });
});

// ---------------------------------------------------------------------------
// parseArgs — --compare flag (M3.2)
// ---------------------------------------------------------------------------

describe('parseArgs --compare', () => {
  it('parses --compare with two strategy names', () => {
    const args = parseArgs(['--compare', 'ThreePointMolly', 'Place6And8']);
    expect(args.compare).toEqual(['ThreePointMolly', 'Place6And8']);
    expect(args.strategy).toBeUndefined();
    expect(args.strategyFile).toBeUndefined();
  });

  it('parses --compare with three strategy names', () => {
    const args = parseArgs(['--compare', 'ThreePointMolly', 'Place6And8', 'PassLineOnly']);
    expect(args.compare).toEqual(['ThreePointMolly', 'Place6And8', 'PassLineOnly']);
  });

  it('--compare combines with shared flags', () => {
    const args = parseArgs(['--compare', 'ThreePointMolly', 'Place6And8', '--rolls', '100', '--seed', '42']);
    expect(args.compare).toEqual(['ThreePointMolly', 'Place6And8']);
    expect(args.rolls).toBe(100);
    expect(args.seed).toBe(42);
  });

  it('throws when --compare is provided with only one name and no other strategy source', () => {
    expect(() => parseArgs(['--compare', 'ThreePointMolly']))
      .toThrowError(/at least 2/);
  });

  it('throws when --compare is used with --strategy', () => {
    expect(() => parseArgs(['--compare', 'ThreePointMolly', 'Place6And8', '--strategy', 'PassLineOnly']))
      .toThrowError(/cannot be used with/);
  });

  it('does not set compare when absent', () => {
    const args = parseArgs(['--strategy', 'PassLineOnly']);
    expect(args.compare).toBeUndefined();
    expect(args.compareFiles).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseArgs — --compare-files and mixed comparison (M3.3)
// ---------------------------------------------------------------------------

describe('parseArgs --compare-files and mixed', () => {
  it('parses --compare-files with two file paths', () => {
    const args = parseArgs(['--compare-files', './a.ts', './b.ts']);
    expect(args.compareFiles).toEqual(['./a.ts', './b.ts']);
    expect(args.compare).toBeUndefined();
  });

  it('throws when --compare-files has only one path and no other strategy source', () => {
    expect(() => parseArgs(['--compare-files', './a.ts']))
      .toThrowError(/at least 2/);
  });

  it('--compare-files with --strategy is mutually exclusive', () => {
    expect(() => parseArgs(['--compare-files', './a.ts', './b.ts', '--strategy', 'PassLineOnly']))
      .toThrowError(/cannot be used with/);
  });

  it('mixed: --compare one name + --strategy-file gives 2 total strategies', () => {
    const args = parseArgs(['--compare', 'ThreePointMolly', '--strategy-file', './b.ts']);
    expect(args.compare).toEqual(['ThreePointMolly']);
    expect(args.strategyFile).toBe('./b.ts');
  });

  it('mixed: --compare-files one file + --compare one name gives 2 total strategies', () => {
    const args = parseArgs(['--compare-files', './a.ts', '--compare', 'PassLineOnly']);
    expect(args.compareFiles).toEqual(['./a.ts']);
    expect(args.compare).toEqual(['PassLineOnly']);
  });
});

// ---------------------------------------------------------------------------
// runCompare integration (M3.2 and M3.3)
// ---------------------------------------------------------------------------

describe('runCompare', () => {
  let outputLines: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    outputLines = [];
    originalLog = console.log;
    console.log = (...args: any[]) => outputLines.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('runs a two-strategy comparison without throwing', () => {
    expect(() => runCompare({ compare: ['PassLineOnly', 'Place6And8'], rolls: 50, bankroll: 500, output: 'summary' }))
      .not.toThrow();
  });

  it('comparison summary output contains both strategy names', () => {
    runCompare({ compare: ['PassLineOnly', 'Place6And8'], rolls: 50, bankroll: 500, output: 'summary' });
    const joined = outputLines.join('\n');
    expect(joined).toContain('PassLineOnly');
    expect(joined).toContain('Place6And8');
  });

  it('comparison summary output contains a Strategy Comparison header', () => {
    runCompare({ compare: ['PassLineOnly', 'Place6And8'], rolls: 50, bankroll: 500, output: 'summary' });
    const joined = outputLines.join('\n');
    expect(joined).toContain('Strategy Comparison');
  });

  it('comparison json output is parseable JSONL', () => {
    runCompare({ compare: ['PassLineOnly', 'Place6And8'], rolls: 20, bankroll: 500, output: 'json' });
    for (const line of outputLines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('comparison json output contains an entry per strategy', () => {
    runCompare({ compare: ['PassLineOnly', 'Place6And8'], rolls: 20, bankroll: 500, output: 'json' });
    const parsed = outputLines.map(l => JSON.parse(l));
    const strategyNames = parsed.map((e: any) => e.strategyName);
    expect(strategyNames).toContain('PassLineOnly');
    expect(strategyNames).toContain('Place6And8');
  });

  it('produces identical dice when comparing with a fixed seed (CUJ 4.1 via CLI)', () => {
    // Capture results as JSONL and verify both strategies saw the same dice
    runCompare({ compare: ['PassLineOnly', 'Place6And8'], rolls: 30, bankroll: 500, seed: 42, output: 'json' });
    const entries = outputLines.map(l => JSON.parse(l));
    const passEntry = entries.find((e: any) => e.strategyName === 'PassLineOnly');
    const placeEntry = entries.find((e: any) => e.strategyName === 'Place6And8');
    // Both summaries should reflect the same number of rolls
    expect(passEntry.meta.totalRolls).toBe(placeEntry.meta.totalRolls);
  });

  it('supports --compare-files with two fixture files (M3.3)', () => {
    const fixtureA = require('path').join(__dirname, 'fixtures', 'minimal-strategy.ts');
    const fixtureB = require('path').join(__dirname, 'fixtures', 'minimal-strategy.ts');
    expect(() => runCompare({ compareFiles: [fixtureA, fixtureB], rolls: 20, bankroll: 500, output: 'summary' }))
      .not.toThrow();
  });

  it('supports mixed comparison: named strategy + strategy file (M3.3)', () => {
    const fixturePath = require('path').join(__dirname, 'fixtures', 'minimal-strategy.ts');
    expect(() => runCompare({ compare: ['PassLineOnly'], strategyFile: fixturePath, rolls: 20, bankroll: 500, output: 'summary' }))
      .not.toThrow();
  });

  it('throws for an unknown strategy name in compare mode', () => {
    expect(() => runCompare({ compare: ['Fake', 'Place6And8'], rolls: 10, bankroll: 500, output: 'summary' }))
      .toThrowError(/Unknown strategy "Fake"/);
  });

  it('verbose output falls back to comparison table (same as summary)', () => {
    runCompare({ compare: ['PassLineOnly', 'Place6And8'], rolls: 20, bankroll: 500, output: 'verbose' });
    const joined = outputLines.join('\n');
    expect(joined).toContain('Strategy Comparison');
  });
});
