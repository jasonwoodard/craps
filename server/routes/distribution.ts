import { Request, Response } from 'express';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { BUILT_IN_STRATEGIES } from '../../src/cli/strategy-registry';
import { summarize, computeAggregates, SessionSummary } from '../lib/distribution';

export function distributionStreamRoute(req: Request, res: Response): void {
  const { strategy, seeds, rolls, bankroll } = req.query as Record<string, string>;

  if (!strategy || !BUILT_IN_STRATEGIES[strategy]) {
    res.status(400).json({ error: `Unknown strategy: "${strategy}". Available: ${Object.keys(BUILT_IN_STRATEGIES).join(', ')}` });
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

  const strategyFn = BUILT_IN_STRATEGIES[strategy];
  const batchSize = Math.max(1, Math.floor(N / 10));
  const allResults: SessionSummary[] = [];

  for (let i = 0; i < N; i++) {
    if (res.destroyed) break;

    const engine = new CrapsEngine({
      strategy: strategyFn,
      bankroll: bankrollNum,
      rolls: rollsNum,
      seed: i,
    });

    allResults.push(summarize(engine.run(), i));

    if ((i + 1) % batchSize === 0 || i === N - 1) {
      const payload = JSON.stringify({
        progress: (i + 1) / N,
        completed: i + 1,
        aggregates: computeAggregates(allResults),
        done: i === N - 1,
      });
      res.write(`data: ${payload}\n\n`);
    }
  }

  res.end();
}
