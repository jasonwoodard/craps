import { Request, Response } from 'express';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { createStrategy } from '../../src/cli/strategy-registry';
import { buildManifest, manifestHash } from '../../src/cli/manifest';
import { summarize, computeAggregates, SessionSummary } from '../lib/distribution';
import { LruCache } from '../lib/memo';

/** Memoized final aggregates keyed by manifest hash (v4 §5). */
const cache = new LruCache<{ aggregates: ReturnType<typeof computeAggregates>; manifest: object }>();

export function distributionStreamRoute(req: Request, res: Response): void {
  const { strategy, seeds, rolls, bankroll } = req.query as Record<string, string>;

  // Spec-aware validation: NAME[@key=value,...]. createStrategy throws a
  // descriptive error for unknown names, options, and entry slugs.
  try {
    createStrategy(strategy ?? '');
  } catch (err: any) {
    res.status(400).json({ error: err.message });
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

  const manifest = buildManifest({
    strategySpec: strategy,
    bankroll: bankrollNum,
    rolls: rollsNum,
    seeds: { count: N },
  });
  const key = manifestHash(manifest);

  const cached = cache.get(key);
  if (cached) {
    const payload = JSON.stringify({
      progress: 1,
      completed: N,
      aggregates: cached.aggregates,
      manifest,
      cached: true,
      done: true,
    });
    res.write(`data: ${payload}\n\n`);
    res.end();
    return;
  }

  const batchSize = Math.max(1, Math.floor(N / 10));
  const allResults: SessionSummary[] = [];

  for (let i = 0; i < N; i++) {
    if (res.destroyed) break;

    const engine = new CrapsEngine({
      // Fresh instance per session — stage machines carry runtime state.
      strategy: createStrategy(strategy),
      bankroll: bankrollNum,
      rolls: rollsNum,
      seed: i,
    });

    allResults.push(summarize(engine.run(), i));

    if ((i + 1) % batchSize === 0 || i === N - 1) {
      const aggregates = computeAggregates(allResults);
      const done = i === N - 1;
      if (done && !res.destroyed) {
        cache.set(key, { aggregates, manifest });
      }
      const payload = JSON.stringify({
        progress: (i + 1) / N,
        completed: i + 1,
        aggregates,
        manifest,
        done,
      });
      res.write(`data: ${payload}\n\n`);
    }
  }

  res.end();
}
