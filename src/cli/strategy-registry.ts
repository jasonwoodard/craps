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
  SixIn8Progressive,
} from '../dsl/strategies';

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
  'SixIn8Progressive': SixIn8Progressive,
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
