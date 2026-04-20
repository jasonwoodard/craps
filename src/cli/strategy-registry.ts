import { StrategyDefinition } from '../dsl/strategy';
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
import { BATS, CATS, CATSAccumulatorOnly } from '../dsl/strategies-staged';

// Keep in alphabetical order
export const BUILT_IN_STRATEGIES: Record<string, StrategyDefinition> = {
  'BATS':                    BATS(),
  'CATS':                    CATS(),
  'CATSAccumulatorOnly':     CATSAccumulatorOnly(),
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
