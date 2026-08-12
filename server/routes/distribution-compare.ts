import { Request, Response } from 'express';
import { SharedTable } from '../../src/engine/shared-table';
import { createStrategy } from '../../src/cli/strategy-registry';
import { buildManifest, manifestHash, RunManifest } from '../../src/cli/manifest';
import { summarize, computeAggregates, SessionSummary } from '../lib/distribution';
import { LruCache } from '../lib/memo';

/** Memoized final aggregates keyed by the pair of manifest hashes (v4 §5). */
const cache = new LruCache<{
  baseline: ReturnType<typeof computeAggregates>;
  test: ReturnType<typeof computeAggregates>;
  manifests: RunManifest[];
}>();

export function distributionCompareStreamRoute(req: Request, res: Response): void {
  const { strategy, test, seeds, rolls, bankroll } = req.query as Record<string, string>;

  try {
    createStrategy(strategy ?? '');
  } catch (err: any) {
    res.status(400).json({ error: `Baseline: ${err.message}` });
    return;
  }
  try {
    createStrategy(test ?? '');
  } catch (err: any) {
    res.status(400).json({ error: `Test: ${err.message}` });
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

  const manifests = [strategy, test].map(spec => buildManifest({
    strategySpec: spec,
    bankroll: bankrollNum,
    rolls: rollsNum,
    seeds: { count: N },
  }));
  const key = manifests.map(manifestHash).join('+');

  const cached = cache.get(key);
  if (cached) {
    const payload = JSON.stringify({
      progress: 1,
      completed: N,
      baseline: cached.baseline,
      test: cached.test,
      manifests,
      cached: true,
      done: true,
    });
    res.write(`data: ${payload}\n\n`);
    res.end();
    return;
  }

  const batchSize = Math.max(1, Math.floor(N / 10));
  const baselineResults: SessionSummary[] = [];
  const testResults: SessionSummary[] = [];

  for (let i = 0; i < N; i++) {
    if (res.destroyed) break;

    // Use SharedTable so both strategies see identical dice for each seed.
    // Fresh instances per seed — stage machines carry runtime state.
    const table = new SharedTable({ seed: i, rolls: rollsNum });
    table.addStrategy(strategy, createStrategy(strategy), { bankroll: bankrollNum });
    table.addStrategy(test, createStrategy(test), { bankroll: bankrollNum });
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
      const baselineAgg = computeAggregates(baselineResults);
      const testAgg = computeAggregates(testResults);
      const done = i === N - 1;
      if (done && !res.destroyed) {
        cache.set(key, { baseline: baselineAgg, test: testAgg, manifests });
      }
      const payload = JSON.stringify({
        progress: (i + 1) / N,
        completed: i + 1,
        baseline: baselineAgg,
        test: testAgg,
        manifests,
        done,
      });
      res.write(`data: ${payload}\n\n`);
    }
  }

  res.end();
}
