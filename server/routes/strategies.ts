import { Request, Response } from 'express';
import { BUILT_IN_STRATEGIES } from '../../src/cli/strategy-registry';

export function strategiesRoute(_req: Request, res: Response): void {
  res.json(Object.keys(BUILT_IN_STRATEGIES));
}
