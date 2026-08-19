// Wire contract for GET /api/meta/strategies — the Web UI's single source of
// truth for stage slugs, display names, and entry gates (webui-plan.md W1).
//
// The engine's stage machines own this data; the endpoint is a transport, not
// a second definition. Nothing in web/ may hardcode a stage list, a display
// name, or a gate — the units-parity and metadata-contract tests enforce it.

/** One funded-entry stage, at the table minimum the catalog was built for. */
export interface StageMeta {
  /** Stable slug id — the canonical spec key (`CATS@entry=threePtMollyLoose`). */
  slug: string;
  /** Machine-state name the slug enters at (what RollRecord.stageName reports). */
  state: string;
  /** Human-facing display name. Presentation metadata; may change. */
  displayName: string;
  /** Entry gate above origin, in dollars at this catalog's table minimum. */
  gate: number;
}

export interface StrategyMeta {
  /** Registry name, e.g. "CATS". */
  name: string;
  /** Whether the strategy accepts canonical spec options (@entry, @tableMin). */
  parameterized: boolean;
  /** Ordered funded-entry stages. Empty for non-staged strategies. */
  stages: StageMeta[];
  /**
   * Full machine-state ladder in order, including internal states with no
   * entry metadata (e.g. CATS's `accumulatorRegressed`). Empty for
   * non-staged strategies.
   */
  stateOrder: string[];
}

export interface StrategyCatalog {
  /** Table minimum the gates above were computed at. */
  tableMin: number;
  strategies: StrategyMeta[];
}
