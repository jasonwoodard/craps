import { parseArgs, aggregate, runAnalysis, runComparison } from '../../src/cli/analyze-stages';

describe('analyze-stages CLI', () => {

  describe('parseArgs', () => {
    it('parses strategy mode with defaults', () => {
      const args = parseArgs(['--strategy', 'CATS']);
      expect(args.strategy).toBe('CATS');
      expect(args.rolls).toBe(1000);
      expect(args.bankroll).toBe(300);
      expect(args.seeds).toBe(2000);
      expect(args.stopAtRuin).toBe(false);
      expect(args.output).toBe('text');
    });

    it('parses explicit values and flags', () => {
      const args = parseArgs([
        '--strategy', 'CATS', '--rolls', '500', '--bankroll', '200',
        '--seeds', '50', '--stop-at-ruin', '--output', 'json',
      ]);
      expect(args.rolls).toBe(500);
      expect(args.bankroll).toBe(200);
      expect(args.seeds).toBe(50);
      expect(args.stopAtRuin).toBe(true);
      expect(args.output).toBe('json');
    });

    it('requires --strategy or --jsonl-dir', () => {
      expect(() => parseArgs([])).toThrow();
    });

    it('rejects invalid output values', () => {
      expect(() => parseArgs(['--strategy', 'CATS', '--output', 'csv'])).toThrow();
    });
  });

  describe('aggregate', () => {
    // Two synthetic 4-roll sessions with a $100 bankroll.
    const sessions = [
      {
        initialBankroll: 100,
        endedAtRuin: false,
        rolls: [
          { stageName: 'a', equityAfter: 95 },
          { stageName: 'a', equityAfter: 90 },
          { stageName: 'b', equityAfter: 110 },
          { stageName: 'b', equityAfter: 105 },
        ],
      },
      {
        initialBankroll: 100,
        endedAtRuin: true,
        rolls: [
          { stageName: 'a', equityAfter: 60 },
          { stageName: 'a', equityAfter: 0 },
        ],
      },
    ];

    it('computes reach probability and first-entry quantiles', () => {
      const report = aggregate(sessions as any, { rollsPerSession: 4, bankroll: 100 });
      const a = report.stages.find(s => s.stage === 'a')!;
      const b = report.stages.find(s => s.stage === 'b')!;
      expect(a.reachProbability).toBe(1);
      expect(b.reachProbability).toBe(0.5);
      expect(a.medianRollsToFirstEntry).toBe(1);
      expect(b.medianRollsToFirstEntry).toBe(3);
    });

    it('computes time-in-stage and per-stage loss from equity deltas', () => {
      const report = aggregate(sessions as any, { rollsPerSession: 4, bankroll: 100 });
      const a = report.stages.find(s => s.stage === 'a')!;
      const b = report.stages.find(s => s.stage === 'b')!;
      // Stage a: 4 of 6 rolls; losses 5 + 5 (session 1) + 40 + 60 (session 2) = 110
      expect(a.timeInStagePct).toBeCloseTo(100 * 4 / 6, 6);
      expect(a.lossPer100Rolls).toBeCloseTo(100 * 110 / 4, 6);
      // Stage b: gains 20 then loses 5 → net -15 loss over 2 rolls
      expect(b.lossPer100Rolls).toBeCloseTo(100 * -15 / 2, 6);
    });

    it('computes session-level P&L and ruin stats', () => {
      const report = aggregate(sessions as any, { rollsPerSession: 4, bankroll: 100 });
      // P&Ls: +5 and -100
      expect(report.pctSessionsPositive).toBe(50);
      expect(report.pctSessionsRuined).toBe(50);
      expect(report.pnl.p50).toBeCloseTo(-47.5, 6);
    });
  });

  describe('multi-spec comparison mode', () => {
    it('parses repeated --strategy flags in order', () => {
      const args = parseArgs([
        '--strategy', 'CATS@entry=accumulator',
        '--strategy', 'CATS@entry=threePtMollyLoose',
        '--seeds', '5', '--rolls', '50',
      ]);
      expect(args.strategies).toEqual(['CATS@entry=accumulator', 'CATS@entry=threePtMollyLoose']);
      expect(args.strategy).toBe('CATS@entry=accumulator');
    });

    it('runs all specs on shared seeds and labels columns with canonical specs', () => {
      const args = parseArgs([
        '--strategy', 'CATS', '--strategy', 'CATS@entry=threePtMollyLoose',
        '--seeds', '8', '--rolls', '60', '--bankroll', '300', '--stop-at-ruin',
      ]);
      const entries = runComparison(args);
      expect(entries.map(e => e.spec)).toEqual(['CATS', 'CATS@entry=threePtMollyLoose']);
      expect(entries[0].report.sessions).toBe(8);
      expect(entries[1].report.sessions).toBe(8);
      // Shared seeds: the first spec's report equals a standalone run of it.
      const standalone = runAnalysis({
        strategy: 'CATS', rolls: 60, bankroll: 300, seeds: 8,
        stopAtRuin: true, output: 'json',
      });
      // generatedAt is a wall-clock stamp — it is excluded from run identity
      // (manifestHash) and from determinism comparisons.
      const stripStamp = (r: any) => ({ ...r, manifest: { ...r.manifest, generatedAt: 'X' } });
      expect(stripStamp(entries[0].report)).toEqual(stripStamp(standalone));
      // Stopping menu present per spec.
      expect(entries[0].report.stopping).toBeDefined();
      expect(entries[1].report.stopping).toBeDefined();
    });
  });

  describe('runAnalysis (engine integration, small run)', () => {
    it('produces a coherent report for CATS with deterministic seeds', () => {
      const report = runAnalysis({
        strategy: 'CATS',
        rolls: 200,
        bankroll: 300,
        seeds: 10,
        stopAtRuin: true,
        output: 'json',
      });
      expect(report.sessions).toBe(10);
      const acc = report.stages.find(s => s.stage === 'accumulatorFull');
      expect(acc).toBeDefined();
      expect(acc!.reachProbability).toBe(1);
      // Time percentages sum to ~100.
      const totalTime = report.stages.reduce((sum, s) => sum + s.timeInStagePct, 0);
      expect(totalTime).toBeCloseTo(100, 6);
      // Deterministic: same seeds → same report (generatedAt is wall-clock
      // and excluded from run identity).
      const again = runAnalysis({
        strategy: 'CATS', rolls: 200, bankroll: 300, seeds: 10, stopAtRuin: true, output: 'json',
      });
      const stripStamp = (r: any) => ({ ...r, manifest: { ...r.manifest, generatedAt: 'X' } });
      expect(stripStamp(again)).toEqual(stripStamp(report));
    });
  });
});
