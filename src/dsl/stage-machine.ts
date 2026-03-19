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
} from './stage-machine-types';
import { StrategyDefinition, STAGE_MACHINE_RUNTIME } from './strategy';
import { StageMachineRuntime } from './stage-machine-state';

/**
 * Entry point — creates a new Stage Machine builder.
 * The returned builder uses a fluent API: chain .startingAt(), .stage(), then .build().
 */
export function stageMachine(name: string): StageMachineBuilder {
  return new StageMachineBuilderImpl(name);
}

class StageMachineBuilderImpl implements StageMachineBuilder {
  private _name: string;
  private _startingStage: string | undefined;
  private _stages = new Map<string, StageConfig>();

  constructor(name: string) {
    this._name = name;
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

    // Build the runtime. Each call to the returned StrategyDefinition
    // delegates to the runtime, which tracks stage state across rolls.
    // The runtime is created lazily on first call so that the bankroll
    // can be derived from the engine context.
    const stages = new Map(this._stages);
    const startingStage = this._startingStage;
    const machineName = this._name;

    const runtime = new StageMachineRuntime(startingStage, stages, machineName);

    const strategyFn: StrategyDefinition = (ctx) => {
      runtime.onStrategyCall(ctx);
    };

    // Tag the function so ReconcileEngine can detect and integrate
    (strategyFn as any)[STAGE_MACHINE_RUNTIME] = runtime;

    return strategyFn;
  }
}
