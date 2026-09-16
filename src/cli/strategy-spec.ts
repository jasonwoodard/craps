/**
 * Canonical strategy specs — NAME@key=value[,key=value]
 * (session-lifecycle.md v4 §2: `CATS@entry=threePtMollyLoose`).
 *
 * Deliberately dependency-free: the spec string is the shared currency of the
 * CLI, the server, the manifest, and the Web UI's URLs, so this module must be
 * importable from a browser bundle as well as from Node. `strategy-loader.ts`
 * re-exports it for back-compat; nothing here may import `path`, `fs`, or any
 * engine module.
 */

/** Options a strategy spec can carry. */
export interface StrategySpecOptions {
  /** Funded-entry stage slug (resolved by the strategy's stage metadata). */
  entry?: string;
  /** Table minimum in dollars. */
  tableMin?: number;
}

export interface ParsedStrategySpec {
  /** Registry name (e.g. "CATS"). */
  name: string;
  options: StrategySpecOptions;
  /**
   * Normalized canonical form: bare name when no options; otherwise
   * NAME@key=value[,key=value] with keys in canonical order (entry,
   * tableMin). This string is the manifest's `strategySpec` — parsing it
   * again yields the same canonical string (round-trip stable).
   */
  canonical: string;
}

const SPEC_KEYS = ['entry', 'tableMin'] as const;

/**
 * Parse a canonical strategy spec. Throws with the valid key list on
 * unknown keys and on malformed input; entry-slug validity is checked by
 * the strategy factory itself (which knows its stage metadata).
 */
export function parseStrategySpec(spec: string): ParsedStrategySpec {
  const at = spec.indexOf('@');
  const name = (at === -1 ? spec : spec.slice(0, at)).trim();
  if (!name) {
    throw new Error(`Invalid strategy spec "${spec}": empty strategy name.`);
  }

  const options: StrategySpecOptions = {};
  if (at !== -1) {
    const optString = spec.slice(at + 1);
    if (!optString) {
      throw new Error(`Invalid strategy spec "${spec}": "@" with no options.`);
    }
    for (const pair of optString.split(',')) {
      const eq = pair.indexOf('=');
      if (eq === -1) {
        throw new Error(`Invalid strategy spec "${spec}": option "${pair}" is not key=value.`);
      }
      const key = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!value) {
        throw new Error(`Invalid strategy spec "${spec}": option "${key}" has no value.`);
      }
      switch (key) {
        case 'entry':
          if (options.entry !== undefined) throw new Error(`Invalid strategy spec "${spec}": duplicate key "entry".`);
          options.entry = value;
          break;
        case 'tableMin': {
          if (options.tableMin !== undefined) throw new Error(`Invalid strategy spec "${spec}": duplicate key "tableMin".`);
          const n = Number(value);
          if (!Number.isInteger(n) || n <= 0) {
            throw new Error(`Invalid strategy spec "${spec}": tableMin must be a positive integer, got "${value}".`);
          }
          options.tableMin = n;
          break;
        }
        default:
          throw new Error(
            `Invalid strategy spec "${spec}": unknown option "${key}". Valid options: ${SPEC_KEYS.join(', ')}.`
          );
      }
    }
  }

  return { name, options, canonical: canonicalizeSpec(name, options) };
}

/** Render the canonical string form of a name + options. */
export function canonicalizeSpec(name: string, options: StrategySpecOptions): string {
  const parts: string[] = [];
  if (options.entry !== undefined) parts.push(`entry=${options.entry}`);
  if (options.tableMin !== undefined) parts.push(`tableMin=${options.tableMin}`);
  return parts.length === 0 ? name : `${name}@${parts.join(',')}`;
}
