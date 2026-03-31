import { Request, Response } from 'express';
import { SharedTable } from '../../src/engine/shared-table';
import { BUILT_IN_STRATEGIES } from '../../src/cli/strategy-registry';

export function sessionCompareRoute(req: Request, res: Response): void {
  const { strategies, rolls, bankroll, seed } = req.body as {
    strategies?: unknown;
    rolls?: unknown;
    bankroll?: unknown;
    seed?: unknown;
  };

  if (!Array.isArray(strategies) || strategies.length !== 2) {
    res.status(400).json({ error: 'strategies must be an array of exactly 2 strategy names' });
    return;
  }

  for (const s of strategies) {
    if (typeof s !== 'string' || !BUILT_IN_STRATEGIES[s]) {
      res.status(400).json({ error: `Unknown strategy: "${s}". Available: ${Object.keys(BUILT_IN_STRATEGIES).join(', ')}` });
      return;
    }
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

  const table = new SharedTable({ seed: resolvedSeed, rolls });
  for (const name of strategies as string[]) {
    table.addStrategy(name, BUILT_IN_STRATEGIES[name], { bankroll });
  }

  const results = table.run();
  res.json({ results, seed: resolvedSeed });
}
