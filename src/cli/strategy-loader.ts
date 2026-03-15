import * as path from 'path';
import { StrategyDefinition } from '../dsl/strategy';

/**
 * Dynamically load a user-supplied `.ts` strategy file.
 *
 * Requires `ts-node` to be registered in the process (which is the case when
 * the CLI is run via `npx ts-node`). Uses `require()` to import the file and
 * returns the first exported value that is a function.
 *
 * Throws a descriptive error if:
 * - The file cannot be loaded (syntax error, missing import, etc.)
 * - The file exports no function value
 */
export function loadStrategyFile(filePath: string): StrategyDefinition {
  const resolved = path.resolve(filePath);

  let mod: Record<string, unknown>;
  try {
    mod = require(resolved);
  } catch (err: any) {
    throw new Error(`Failed to load strategy file "${filePath}": ${err.message}`);
  }

  for (const key of Object.keys(mod)) {
    if (typeof mod[key] === 'function') {
      return mod[key] as StrategyDefinition;
    }
  }

  throw new Error(
    `No function export found in strategy file "${filePath}". ` +
    `Export a StrategyDefinition function as a named or default export.`
  );
}
