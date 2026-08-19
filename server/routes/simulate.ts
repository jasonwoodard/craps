import { Request, Response } from 'express';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { BUILT_IN_STRATEGIES, createStrategy } from '../../src/cli/strategy-registry';
import { buildManifest } from '../../src/cli/manifest';
import type { RunManifest } from '../../types/manifest';

export function simulateRoute(req: Request, res: Response): void {
  const { strategy, rolls, bankroll, seed } = req.body as {
    strategy?: unknown;
    rolls?: unknown;
    bankroll?: unknown;
    seed?: unknown;
  };

  if (typeof strategy !== 'string') {
    res.status(400).json({ error: `Unknown strategy: "${strategy}". Available: ${Object.keys(BUILT_IN_STRATEGIES).join(', ')}` });
    return;
  }
  try {
    createStrategy(strategy);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (typeof rolls !== 'number' || !Number.isInteger(rolls) || rolls <= 0) {
    res.status(400).json({ error: 'rolls must be a positive integer' });
    return;
  }

  if (typeof bankroll !== 'number' || !Number.isInteger(bankroll) || bankroll <= 0) {
    res.status(400).json({ error: 'bankroll must be a positive integer' });
    return;
  }

  if (seed !== undefined && (typeof seed !== 'number' || !Number.isInteger(seed))) {
    res.status(400).json({ error: 'seed must be an integer when provided' });
    return;
  }

  const resolvedSeed = seed !== undefined ? (seed as number) : Math.floor(Math.random() * 1_000_000);

  const engine = new CrapsEngine({
    // Fresh instance per request — stage machines carry runtime state.
    strategy: createStrategy(strategy),
    bankroll,
    rolls,
    seed: resolvedSeed,
  });

  const result = engine.run();

  // Run identity travels with the result: the manifest is the archive
  // (session-lifecycle.md v4 §5), and the UI surfaces it on every view.
  // tableMin is read off the canonical spec, so the toolbar's Table Min
  // control reaches the manifest through the spec string it writes.
  const manifest: RunManifest = buildManifest({
    strategySpec: strategy,
    bankroll,
    rolls,
    seeds: { seed: resolvedSeed },
  });

  res.json({ ...result, seed: resolvedSeed, manifest });
}
