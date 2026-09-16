import { Request, Response } from 'express';
import { listStrategyNames, getStrategyMetadata, getStageLadder } from '../../src/cli/strategy-registry';
import { canonicalizeSpec } from '../../src/cli/strategy-spec';
import type { StrategyCatalog, StrategyMeta } from '../../types/strategy-meta';

/** Table minimums below this are not a real table; the unit system needs u > 0. */
const MIN_TABLE_MIN = 5;
const DEFAULT_TABLE_MIN = 10;

/**
 * GET /api/meta/strategies[?tableMin=N]
 *
 * The Web UI's single source of truth for stage slugs, display names, entry
 * gates, and ladder order (webui-plan.md W1). Gates are dollars, so they are
 * computed at the requested table minimum — the engine's unit system does the
 * scaling, never the client.
 *
 * The web build cannot import the stage machines directly (they reach the
 * whole engine, including a non-erasable enum), so this endpoint is the
 * documented fallback seam. `src/dsl/units.ts` is dependency-free and IS
 * imported directly by web/.
 */
export function strategyMetaRoute(req: Request, res: Response): void {
  const raw = req.query.tableMin;
  let tableMin = DEFAULT_TABLE_MIN;
  if (raw !== undefined) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < MIN_TABLE_MIN) {
      res.status(400).json({ error: `tableMin must be an integer of at least ${MIN_TABLE_MIN}` });
      return;
    }
    tableMin = n;
  }

  const strategies: StrategyMeta[] = listStrategyNames().map(name => {
    const meta = getStrategyMetadata(name, { tableMin });
    // Ladder order (including internal, non-entry states) comes from the same
    // instance shape the runtime exposes; ask for it at the same table min so
    // one instantiation policy governs both halves of the payload.
    const spec = meta.parameterized ? canonicalizeSpec(name, { tableMin }) : name;
    const ladder = getStageLadder(spec);
    return {
      name,
      parameterized: meta.parameterized,
      stages: meta.stages.map(s => ({
        slug: s.slug,
        state: s.state,
        displayName: s.displayName,
        gate: s.gate,
      })),
      stateOrder: ladder?.stateOrder ?? [],
    };
  });

  const catalog: StrategyCatalog = { tableMin, strategies };
  res.json(catalog);
}
