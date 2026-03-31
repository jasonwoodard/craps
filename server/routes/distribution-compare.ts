import { Request, Response } from 'express';
import { SharedTable } from '../../src/engine/shared-table';
import { BUILT_IN_STRATEGIES } from '../../src/cli/strategy-registry';
import { summarize, computeAggregates, SessionSummary } from '../lib/distribution';

export function distributionCompareStreamRoute(req: Request, res: Response): void {
  const { strategy, test, seeds, rolls, bankroll } = req.query as Record<string, string>;

  if (!strategy || !BUILT_IN_STRATEGIES[strategy]) {
    res.status(400).json({ error: `Unknown baseline strategy: "${strategy}". Available: ${Object.keys(BUILT_IN_STRATEGIES).join(', ')}` });
    return;
  }

  if (!test || !BUILT_IN_STRATEGIES[test]) {
    res.status(400).json({ error: `Unknown test strategy: "${test}". Available: ${Object.keys(BUILT_IN_STRATEGIES).join(', ')}` });
    return;
  }

  const N = parseInt(seeds, 10);
  if (!Number.isFinite(N) || N <= 0) {
    res.status(400).json({ error: 'seeds must be a positive integer' });
    return;
  }

  const rollsNum = parseInt(rolls, 10);
  if (!Number.isFinite(rollsNum) || rollsNum <= 0) {
    res.status(400).json({ error: 'rolls must be a positive integer' });
    return;
  }

  const bankrollNum = parseInt(bankroll, 10);
  if (!Number.isFinite(bankrollNum) || bankrollNum <= 0) {
    res.status(400).json({ error: 'bankroll must be a positive integer' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const baselineFn = BUILT_IN_STRATEGIES[strategy];
  const testFn = BUILT_IN_STRATEGIES[test];
  const batchSize = Math.max(1, Math.floor(N / 10));
  const baselineResults: SessionSummary[] = [];
  const testResults: SessionSummary[] = [];

  for (let i = 0; i < N; i++) {
    if (res.destroyed) break;

    // Use SharedTable so both strategies see identical dice for each seed.
    const table = new SharedTable({ seed: i, rolls: rollsNum });
    table.addStrategy(strategy, baselineFn, { bankroll: bankrollNum });
    table.addStrategy(test, testFn, { bankroll: bankrollNum });
    const sharedResult = table.run();

    const baselineEntry = sharedResult[strategy];
    const testEntry = sharedResult[test];

    if (baselineEntry) {
      baselineResults.push(summarize(
        { finalBankroll: baselineEntry.finalBankroll, initialBankroll: bankrollNum, rollsPlayed: baselineEntry.log.length, rolls: baselineEntry.log },
        i,
      ));
    }

    if (testEntry) {
      testResults.push(summarize(
        { finalBankroll: testEntry.finalBankroll, initialBankroll: bankrollNum, rollsPlayed: testEntry.log.length, rolls: testEntry.log },
        i,
      ));
    }

    if ((i + 1) % batchSize === 0 || i === N - 1) {
      const payload = JSON.stringify({
        progress: (i + 1) / N,
        completed: i + 1,
        baseline: computeAggregates(baselineResults),
        test: computeAggregates(testResults),
        done: i === N - 1,
      });
      res.write(`data: ${payload}\n\n`);
    }
  }

  res.end();
}
