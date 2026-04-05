import { StrategyDefinition } from '../dsl/strategy';
import {
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
} from '../dsl/strategies';
import { CATS } from '../dsl/strategies-staged';

export const BUILT_IN_STRATEGIES: Record<string, StrategyDefinition> = {
  'ThreePointMolly1X': ThreePointMolly1X,
  'ThreePointMolly2X': ThreePointMolly2X,
  'ThreePointMolly3X': ThreePointMolly3X,
  'ThreePointMolly4X': ThreePointMolly4X,
  'ThreePointMolly5X': ThreePointMolly5X,
  'Place6And8':        Place6And8,
  'PlaceInside':       PlaceInside,
  'PlaceAll':          PlaceAll,
  'PassLineOnly':      PassLineOnly,
  'Place6And8Progressive': Place6And8Progressive,
  'CATS':              CATS(),
  'JustField':         JustField,
  'IronCross':         IronCross,
  'MartingaleField':   MartingaleField,
};

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
