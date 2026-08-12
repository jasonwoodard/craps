/**
 * Stage Machine — fluent builder API and `stageMachine()` entry point.
 *
 * Usage:
 *   const strategy = stageMachine('CATS')
 *     .startingAt('stage1')
 *     .stage('stage1', { board: (ctx) => { ... } })
 *     .stage('stage2', { board: (ctx) => { ... } })
 *     .build();
 *
 * build() produces a StrategyDefinition that wraps a StageMachineRuntime.
 */

import {
  StageMachineBuilder,
  StageConfig,
  StageMachineOptions,
  StageMetadata,
} from './stage-machine-types';
import { StrategyDefinition, STAGE_MACHINE_RUNTIME } from './strategy';
import { StageMachineRuntime } from './stage-machine-state';

/**
 * Entry point — creates a new Stage Machine builder.
 * The returned builder uses a fluent API: chain .startingAt(), .stage(), then .build().
 *
 * Funded entry (session-lifecycle.md v4 §2): pass { entryStage: <slug> }
 * to start the session in that stage. The session origin becomes
 * bankroll − gate(entryStage), so profit starts at exactly the stage's
 * entry gate. Default entry = startingAt() with gate 0 (classic behavior).
 */
export function stageMachine(name: string, options: StageMachineOptions = {}): StageMachineBuilder {
  return new StageMachineBuilderImpl(name, options);
}

/** Build the slug → metadata table from a machine's stage configs. */
export function collectStageMetadata(stages: Map<string, StageConfig>): StageMetadata[] {
  const rows: StageMetadata[] = [];
  for (const [state, config] of stages) {
    if (!config.entry) continue;
    rows.push({
      slug: config.entry.slug ?? state,
      state,
      displayName: config.entry.displayName,
      gate: config.entry.gate,
    });
  }
  return rows;
}

class StageMachineBuilderImpl implements StageMachineBuilder {
  private _name: string;
  private _options: StageMachineOptions;
  private _startingStage: string | undefined;
  private _stages = new Map<string, StageConfig>();

  constructor(name: string, options: StageMachineOptions = {}) {
    this._name = name;
    this._options = options;
  }

  startingAt(stageName: string): StageMachineBuilder {
    this._startingStage = stageName;
    return this;
  }

  stage(name: string, config: StageConfig): StageMachineBuilder {
    this._stages.set(name, config);
    return this;
  }

  build(): StrategyDefinition {
    // Validate: must have at least one stage
    if (this._stages.size === 0) {
      throw new Error(`Stage machine "${this._name}" has no stages. Add at least one stage before calling build().`);
    }

    // Validate: startingAt must have been called
    if (!this._startingStage) {
      throw new Error(`Stage machine "${this._name}": startingAt() must be called before build().`);
    }

    // Validate: startingAt stage must exist
    if (!this._stages.has(this._startingStage)) {
      throw new Error(
        `Stage machine "${this._name}": startingAt("${this._startingStage}") references an undeclared stage. ` +
        `Declared stages: ${[...this._stages.keys()].join(', ')}`
      );
    }

    // Validate: starting stage must have a board function
    const startingConfig = this._stages.get(this._startingStage)!;
    if (!startingConfig.board || typeof startingConfig.board !== 'function') {
      throw new Error(
        `Stage machine "${this._name}": starting stage "${this._startingStage}" must have a board function.`
      );
    }

    // Resolve funded entry: entryStage is a slug matched against the
    // declared entry metadata. Unknown slugs fail loudly with the valid
    // list — slugs are the stable public keys.
    const stages = new Map(this._stages);
    const metadata = collectStageMetadata(stages);
    let startingStage = this._startingStage;
    let entryGate = 0;
    if (this._options.entryStage !== undefined) {
      const row = metadata.find(m => m.slug === this._options.entryStage);
      if (!row) {
        const valid = metadata.map(m => m.slug).join(', ');
        throw new Error(
          `Stage machine "${this._name}": unknown entry stage "${this._options.entryStage}". ` +
          `Valid entry slugs: ${valid}`
        );
      }
      startingStage = row.state;
      entryGate = row.gate;
    }

    // Build the runtime. Each call to the returned StrategyDefinition
    // delegates to the runtime, which tracks stage state across rolls.
    const machineName = this._name;

    const runtime = new StageMachineRuntime(startingStage, stages, machineName, entryGate);

    const strategyFn: StrategyDefinition = (ctx) => {
      runtime.onStrategyCall(ctx);
    };

    // Tag the function so ReconcileEngine can detect and integrate
    (strategyFn as any)[STAGE_MACHINE_RUNTIME] = runtime;

    return strategyFn;
  }
}
