import { useEffect, useState } from 'react';
import type { StrategyCatalog, StrategyMeta } from '@shared/strategy-meta';
import { parseStrategySpec } from '@engine/cli/strategy-spec';

/**
 * Client for GET /api/meta/strategies — the only origin of stage slugs,
 * display names, entry gates, and ladder order in web/ (webui-plan.md W1).
 *
 * Nothing here may fall back to a hardcoded stage list: when the catalog is
 * unavailable, callers render nothing rather than a stale copy of the ladder.
 */

const inflight = new Map<number, Promise<StrategyCatalog>>();

export function fetchStrategyCatalog(tableMin: number): Promise<StrategyCatalog> {
  const cached = inflight.get(tableMin);
  if (cached) return cached;

  const request = fetch(`/api/meta/strategies?tableMin=${tableMin}`)
    .then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Server error: ${res.status}`);
      }
      return res.json() as Promise<StrategyCatalog>;
    })
    .catch(err => {
      inflight.delete(tableMin);
      throw err;
    });

  inflight.set(tableMin, request);
  return request;
}

/** Test seam: drop the memoized catalogs between cases. */
export function resetStrategyCatalogCache(): void {
  inflight.clear();
}

export interface CatalogState {
  catalog: StrategyCatalog | null;
  loading: boolean;
  error: string | null;
}

export function useStrategyCatalog(tableMin: number): CatalogState {
  const [state, setState] = useState<CatalogState>({ catalog: null, loading: true, error: null });

  useEffect(() => {
    let live = true;
    setState({ catalog: null, loading: true, error: null });
    fetchStrategyCatalog(tableMin)
      .then(catalog => { if (live) setState({ catalog, loading: false, error: null }); })
      .catch((err: unknown) => {
        if (!live) return;
        setState({ catalog: null, loading: false, error: err instanceof Error ? err.message : 'Unknown error' });
      });
    return () => { live = false; };
  }, [tableMin]);

  return state;
}

export function findStrategy(catalog: StrategyCatalog | null, name: string): StrategyMeta | undefined {
  return catalog?.strategies.find(s => s.name === name);
}

/** The strategy entry a spec string refers to, e.g. `CATS@entry=maxAlpha` → CATS. */
export function findStrategyForSpec(catalog: StrategyCatalog | null, spec: string): StrategyMeta | undefined {
  try {
    return findStrategy(catalog, parseStrategySpec(spec).name);
  } catch {
    return undefined;
  }
}

/**
 * Presentation fallback for machine states that declare no entry metadata
 * (CATS's `accumulatorRegressed`, for instance): split camelCase into words.
 * This derives a label from the state name — it does not invent one.
 */
export function humanizeState(state: string): string {
  return state
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());
}

/** Ladder-position tints, coolest at the bottom of the ladder. */
const STAGE_PALETTE = [
  '#fef3c7', // amber-100
  '#fffbeb', // amber-50
  '#dcfce7', // green-100
  '#dbeafe', // blue-100
  '#e0e7ff', // indigo-100
  '#ede9fe', // violet-100
  '#fce7f3', // pink-100
];
const STAGE_FALLBACK_COLOR = '#f5f5f5';

export interface StageNaming {
  /** Display name for a machine state, from entry metadata where declared. */
  label: (state: string) => string;
  /** Stable tint for a machine state, assigned by ladder position. */
  color: (state: string) => string;
  /** True once the catalog has arrived. */
  ready: boolean;
}

/**
 * Stage naming for whatever strategy produced a set of RollRecords. Pass the
 * spec when it is known so labels come from that strategy's ladder; without
 * one, every staged strategy in the catalog is searched.
 */
export function useStageNaming(spec?: string, tableMin = 10): StageNaming {
  const { catalog } = useStrategyCatalog(tableMin);

  const scoped = spec ? findStrategyForSpec(catalog, spec) : undefined;
  const pool: StrategyMeta[] = scoped ? [scoped] : (catalog?.strategies ?? []);

  const labels = new Map<string, string>();
  const colors = new Map<string, string>();
  for (const strategy of pool) {
    strategy.stateOrder.forEach((state, i) => {
      if (!colors.has(state)) colors.set(state, STAGE_PALETTE[i % STAGE_PALETTE.length]);
    });
    for (const stage of strategy.stages) {
      if (!labels.has(stage.state)) labels.set(stage.state, stage.displayName);
    }
  }

  return {
    label: (state: string) => labels.get(state) ?? humanizeState(state),
    color: (state: string) => colors.get(state) ?? STAGE_FALLBACK_COLOR,
    ready: catalog != null,
  };
}

/**
 * Entry gate declared by a spec's funded-entry stage, in dollars at the
 * catalog's table minimum. Zero for classic entry and for specs with no
 * `entry=` option — which is exactly the classic origin.
 */
export function specEntryGate(catalog: StrategyCatalog | null, spec: string): number {
  const strategy = findStrategyForSpec(catalog, spec);
  if (!strategy) return 0;
  let entry: string | undefined;
  try {
    entry = parseStrategySpec(spec).options.entry;
  } catch {
    return 0;
  }
  if (entry === undefined) return 0;
  return strategy.stages.find(s => s.slug === entry)?.gate ?? 0;
}

/**
 * Profit's zero point for a run (session-lifecycle.md v4 §2):
 * origin = B − gate(entry). Classic entry has gate 0, so origin = B.
 */
export function useOrigin(spec: string, bankroll: number, tableMin = 10): number {
  const { catalog } = useStrategyCatalog(tableMin);
  return bankroll - specEntryGate(catalog, spec);
}
