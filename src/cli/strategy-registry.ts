import { StrategyDefinition, STAGE_MACHINE_RUNTIME } from '../dsl/strategy';
import { StageMachineRuntime } from '../dsl/stage-machine-state';
import { StageMetadata } from '../dsl/stage-machine-types';
import { parseStrategySpec, StrategySpecOptions } from './strategy-loader';
import {
  PassLineWithOdds1X,
  PassLineWithOdds2X,
  PassLineWithOdds3X,
  PassLineWithOdds4X,
  PassLineWithOdds5X,
  ThreePointMolly1X,
  ThreePointMolly2X,
  ThreePointMolly3X,
  ThreePointMolly4X,
  ThreePointMolly5X,
  Place6And8,
  PlaceInside,
  PlaceAll,
  PassLineOnly,
  Place6And8Progressive,
  JustField,
  IronCross,
  MartingaleField,
  DontPassLineOnly,
  DontPassLineWithOdds1X,
  DontPassLineWithOdds2X,
  DontPassLineWithOdds3X,
  DontPassLineWithOdds4X,
  DontPassLineWithOdds5X,
  ThreePointDolly1X,
  ThreePointDolly2X,
  ThreePointDolly3X,
  ThreePointDolly4X,
  ThreePointDolly5X,
  HardwaysHedge,
  PassAndHards,
  IronCrossWithCE,
  PassWithCEInsurance,
} from '../dsl/strategies';
import {
  BATS, BATSAccumulatorOnly, CATS, CATSAccumulatorOnly,
  DoDont1X, DoDont2X, DoDont3X,
  DoDontWithCome1X, DoDontWithCome2X, DoDontWithCome3X,
} from '../dsl/strategies-staged';

// Keep in alphabetical order
export const BUILT_IN_STRATEGIES: Record<string, StrategyDefinition> = {
  'BATS':                    BATS(),
  'BATSAccumulatorOnly':     BATSAccumulatorOnly(),
  'CATS':                    CATS(),
  'CATSAccumulatorOnly':     CATSAccumulatorOnly(),
  'DoDont1X':                DoDont1X(),
  'DoDont2X':                DoDont2X(),
  'DoDont3X':                DoDont3X(),
  'DoDontWithCome1X':        DoDontWithCome1X(),
  'DoDontWithCome2X':        DoDontWithCome2X(),
  'DoDontWithCome3X':        DoDontWithCome3X(),
  'DontPassLineOnly':        DontPassLineOnly,
  'DontPassLineWithOdds1X':  DontPassLineWithOdds1X,
  'DontPassLineWithOdds2X':  DontPassLineWithOdds2X,
  'DontPassLineWithOdds3X':  DontPassLineWithOdds3X,
  'DontPassLineWithOdds4X':  DontPassLineWithOdds4X,
  'DontPassLineWithOdds5X':  DontPassLineWithOdds5X,
  'HardwaysHedge':           HardwaysHedge,
  'IronCross':               IronCross,
  'IronCrossWithCE':         IronCrossWithCE,
  'JustField':               JustField,
  'MartingaleField':         MartingaleField,
  'PassAndHards':            PassAndHards,
  'PassLineOnly':            PassLineOnly,
  'PassLineWithOdds1X':      PassLineWithOdds1X,
  'PassLineWithOdds2X':      PassLineWithOdds2X,
  'PassLineWithOdds3X':      PassLineWithOdds3X,
  'PassLineWithOdds4X':      PassLineWithOdds4X,
  'PassLineWithOdds5X':      PassLineWithOdds5X,
  'Place6And8':              Place6And8,
  'Place6And8Progressive':   Place6And8Progressive,
  'PlaceAll':                PlaceAll,
  'PassWithCEInsurance':     PassWithCEInsurance,
  'PlaceInside':             PlaceInside,
  'ThreePointDolly1X':       ThreePointDolly1X,
  'ThreePointDolly2X':       ThreePointDolly2X,
  'ThreePointDolly3X':       ThreePointDolly3X,
  'ThreePointDolly4X':       ThreePointDolly4X,
  'ThreePointDolly5X':       ThreePointDolly5X,
  'ThreePointMolly1X':       ThreePointMolly1X,
  'ThreePointMolly2X':       ThreePointMolly2X,
  'ThreePointMolly3X':       ThreePointMolly3X,
  'ThreePointMolly4X':       ThreePointMolly4X,
  'ThreePointMolly5X':       ThreePointMolly5X,
};

/**
 * Factories for strategies that carry per-session runtime state (stage
 * machines). Multi-session runs MUST create a fresh instance per session —
 * the singletons in BUILT_IN_STRATEGIES carry stage, profit baseline, and
 * counters from one session into the next. These factories accept the
 * canonical spec options ({ entry?, tableMin? }).
 */
const STRATEGY_FACTORIES: Record<string, (options?: StrategySpecOptions) => StrategyDefinition> = {
  'BATS':                BATS,
  'BATSAccumulatorOnly': BATSAccumulatorOnly,
  'CATS':                CATS,
  'CATSAccumulatorOnly': CATSAccumulatorOnly,
  'DoDont1X':            DoDont1X,
  'DoDont2X':            DoDont2X,
  'DoDont3X':            DoDont3X,
  'DoDontWithCome1X':    DoDontWithCome1X,
  'DoDontWithCome2X':    DoDontWithCome2X,
  'DoDontWithCome3X':    DoDontWithCome3X,
};

/**
 * Strategies whose factories understand canonical spec options. Specs with
 * options on any other name fail loudly rather than silently ignoring them.
 */
const PARAMETERIZED = new Set(['BATS', 'BATSAccumulatorOnly', 'CATS', 'CATSAccumulatorOnly']);

/**
 * Look up a built-in strategy by name. Throws a descriptive error if the name
 * is not recognised so the CLI can surface a helpful message.
 */
export function lookupStrategy(name: string): StrategyDefinition {
  const strategy = BUILT_IN_STRATEGIES[name];
  if (!strategy) {
    const available = Object.keys(BUILT_IN_STRATEGIES).join(', ');
    throw new Error(`Unknown strategy "${name}". Available strategies: ${available}`);
  }
  return strategy;
}

/**
 * Create a strategy instance for one session from a canonical spec string
 * (`NAME` or `NAME@key=value[,key=value]`, e.g. `CATS@entry=threePtMollyLoose`).
 * Stage-machine strategies get a fresh runtime; stateless strategies return
 * the shared function (their only state lives in the per-engine
 * ReconcileEngine trackers). Unknown entry slugs fail loudly with the valid
 * list (thrown by the stage machine, which owns the metadata).
 */
export function createStrategy(spec: string): StrategyDefinition {
  const parsed = parseStrategySpec(spec);
  const factory = STRATEGY_FACTORIES[parsed.name];

  const hasOptions = Object.keys(parsed.options).length > 0;
  if (hasOptions && !PARAMETERIZED.has(parsed.name)) {
    throw new Error(
      `Strategy "${parsed.name}" does not accept spec options. ` +
      `Parameterizable strategies: ${[...PARAMETERIZED].sort().join(', ')}.`
    );
  }

  if (factory) return factory(parsed.options);
  return lookupStrategy(parsed.name);
}

/** Per-strategy stage metadata for UIs: ordered slugs, display names, gates. */
export interface StrategyMetadata {
  name: string;
  /** Ordered funded-entry stages; empty for non-staged strategies. */
  stages: StageMetadata[];
  /** Whether the strategy accepts canonical spec options. */
  parameterized: boolean;
}

/**
 * Export a strategy's stage metadata so any UI can render an entry-stage
 * dropdown generically. Instantiates the factory (cheap, no table context)
 * and reads the stage machine's declared metadata.
 */
export function getStrategyMetadata(name: string): StrategyMetadata {
  const factory = STRATEGY_FACTORIES[name];
  const instance = factory ? factory() : lookupStrategy(name);
  const runtime = (instance as any)[STAGE_MACHINE_RUNTIME] as StageMachineRuntime | undefined;
  return {
    name,
    stages: runtime ? runtime.getStageMetadata() : [],
    parameterized: PARAMETERIZED.has(name),
  };
}

/** All registry names, for UIs and error messages. */
export function listStrategyNames(): string[] {
  return Object.keys(BUILT_IN_STRATEGIES);
}

/**
 * Ladder info for stopping rules: machine states in ladder order plus the
 * slug → state mapping. Returns null for non-staged strategies.
 */
export function getStageLadder(spec: string): { stateOrder: string[]; slugToState: Map<string, string> } | null {
  const instance = createStrategy(spec);
  const runtime = (instance as any)[STAGE_MACHINE_RUNTIME] as StageMachineRuntime | undefined;
  if (!runtime) return null;
  const slugToState = new Map<string, string>();
  for (const row of runtime.getStageMetadata()) {
    slugToState.set(row.slug, row.state);
  }
  return { stateOrder: runtime.getStateOrder(), slugToState };
}
