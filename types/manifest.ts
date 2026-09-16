// Wire mirror of src/cli/manifest.ts's RunManifest — session-lifecycle.md v4 §5.
// Standalone (like types/simulation.ts) because the engine's manifest module
// reaches child_process and crypto and cannot be imported into a browser
// bundle. The server asserts conformance at compile time; spec/server pins it.

export interface RunManifest {
  schemaVersion: number;
  /** Canonical strategy spec (NAME[@key=value,...]), or a source tag for JSONL re-analysis. */
  strategySpec: string;
  tableMin: number;
  bankroll: number;
  rolls: number;
  /** Seed range { count } (seeds 0..count-1) or a single { seed }. */
  seeds: { count: number } | { seed: number | null };
  /** Engine git sha (short), or "unknown". */
  engineVersion: string;
  /** Wall-clock stamp — excluded from the identity hash. */
  generatedAt: string;
}

/** True when the manifest describes a seed range rather than one session. */
export function isSeedRange(seeds: RunManifest['seeds']): seeds is { count: number } {
  return 'count' in seeds;
}
