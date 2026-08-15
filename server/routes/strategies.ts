import { Request, Response } from 'express';
import { listStrategyNames, getStrategyMetadata } from '../../src/cli/strategy-registry';

/**
 * Strategy catalog. Returns names (back-compat: an array of strings unless
 * ?metadata=1), or the full per-strategy stage metadata — ordered slugs,
 * display names, entry gates — so the UI can render a funded-entry dropdown
 * generically for any staged strategy (v4 §2).
 */
export function strategiesRoute(req: Request, res: Response): void {
  if (req.query.metadata === '1') {
    res.json(listStrategyNames().map(name => getStrategyMetadata(name)));
    return;
  }
  res.json(listStrategyNames());
}
