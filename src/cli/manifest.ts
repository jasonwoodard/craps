/**
 * Run manifest — session-lifecycle.md v4 §5.
 *
 * Determinism makes the manifest the archive: a run is fully reproducible
 * from { strategySpec, tableMin, bankroll, rolls, seeds, engineVersion }.
 * The manifest is embedded in every output mode; aggregate results are
 * memoized keyed by a stable hash of the manifest minus generatedAt.
 */
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { parseStrategySpec } from './strategy-loader';

export const MANIFEST_SCHEMA_VERSION = 1;

export interface RunManifest {
  schemaVersion: number;
  /** Canonical strategy spec (NAME[@key=value,...]), or a source tag for JSONL re-analysis. */
  strategySpec: string;
  tableMin: number;
  bankroll: number;
  rolls: number;
  /** Seed range { count } (seeds 0..count-1) or a single { seed }. */
  seeds: { count: number } | { seed: number | null };
  /** Engine git sha (short). Falls back to ENGINE_VERSION env, then "unknown". */
  engineVersion: string;
  /** Wall-clock stamp — excluded from the identity hash. */
  generatedAt: string;
}

let cachedEngineVersion: string | null = null;

export function engineVersion(): string {
  if (cachedEngineVersion === null) {
    try {
      cachedEngineVersion = execSync('git rev-parse --short HEAD', {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString().trim();
    } catch {
      cachedEngineVersion = process.env.ENGINE_VERSION ?? 'unknown';
    }
  }
  return cachedEngineVersion;
}

export interface ManifestInputs {
  /** Strategy spec string; canonicalized here. Pass a `jsonl:` tag for re-analysis runs. */
  strategySpec: string;
  bankroll: number;
  rolls: number;
  seeds: { count: number } | { seed: number | null };
  /** Override table minimum; defaults to the spec's tableMin option or $10. */
  tableMin?: number;
}

export function buildManifest(inputs: ManifestInputs): RunManifest {
  let tableMin = inputs.tableMin;
  let spec = inputs.strategySpec;
  if (!spec.startsWith('jsonl:')) {
    try {
      const parsed = parseStrategySpec(spec);
      spec = parsed.canonical;
      tableMin = tableMin ?? parsed.options.tableMin;
    } catch {
      // Strategy-file paths and other non-registry sources pass through as-is.
    }
  }
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    strategySpec: spec,
    tableMin: tableMin ?? 10,
    bankroll: inputs.bankroll,
    rolls: inputs.rolls,
    seeds: inputs.seeds,
    engineVersion: engineVersion(),
    generatedAt: new Date().toISOString(),
  };
}

/** Recursively key-sorted JSON — a stable serialization for hashing. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as object).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(',')}}`;
}

/** Stable identity hash of a manifest, excluding generatedAt. */
export function manifestHash(manifest: RunManifest): string {
  const { generatedAt: _ignored, ...identity } = manifest;
  return createHash('sha256').update(stableStringify(identity)).digest('hex');
}
