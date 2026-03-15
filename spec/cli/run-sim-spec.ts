import { parseArgs, runSim, CliArgs } from '../../src/cli/run-sim';

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
});
