import { Request, Response } from 'express';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { BUILT_IN_STRATEGIES } from '../../src/cli/strategy-registry';

export function simulateRoute(req: Request, res: Response): void {
  const { strategy, rolls, bankroll, seed } = req.body as {
    strategy?: unknown;
    rolls?: unknown;
    bankroll?: unknown;
    seed?: unknown;
  };

  if (typeof strategy !== 'string' || !BUILT_IN_STRATEGIES[strategy]) {
    res.status(400).json({ error: `Unknown strategy: "${strategy}". Available: ${Object.keys(BUILT_IN_STRATEGIES).join(', ')}` });
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
    strategy: BUILT_IN_STRATEGIES[strategy],
    bankroll,
    rolls,
    seed: resolvedSeed,
  });

  const result = engine.run();
  res.json({ ...result, seed: resolvedSeed });
}
