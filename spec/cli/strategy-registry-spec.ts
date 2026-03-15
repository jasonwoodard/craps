import { BUILT_IN_STRATEGIES, lookupStrategy } from '../../src/cli/strategy-registry';

describe('BUILT_IN_STRATEGIES', () => {
  const expectedNames = [
    'ThreePointMolly1X',
    'ThreePointMolly2X',
    'ThreePointMolly3X',
    'ThreePointMolly4X',
    'ThreePointMolly5X',
    'Place6And8',
    'PlaceInside',
    'PlaceAll',
    'PassLineOnly',
    'SixIn8Progressive',
  ];

  for (const name of expectedNames) {
    it(`contains "${name}" as a callable function`, () => {
      expect(typeof BUILT_IN_STRATEGIES[name]).toBe('function');
    });
  }

  it('registers five distinct ThreePointMolly variants', () => {
    const variants = [1, 2, 3, 4, 5].map(n => BUILT_IN_STRATEGIES[`ThreePointMolly${n}X`]);
    // All are functions
    variants.forEach(v => expect(typeof v).toBe('function'));
    // All are distinct strategy instances
    const unique = new Set(variants);
    expect(unique.size).toBe(5);
  });
});

describe('lookupStrategy', () => {
  it('returns the strategy for a known name', () => {
    const strategy = lookupStrategy('PassLineOnly');
    expect(typeof strategy).toBe('function');
  });

  it('returns different strategies for different ThreePointMolly variants', () => {
    const a = lookupStrategy('ThreePointMolly1X');
    const b = lookupStrategy('ThreePointMolly5X');
    expect(a).not.toBe(b);
  });

  it('throws a descriptive error for an unknown name', () => {
    expect(() => lookupStrategy('NotAStrategy')).toThrowError(/Unknown strategy "NotAStrategy"/);
  });

  it('error message lists available strategies', () => {
    expect(() => lookupStrategy('Nope')).toThrowError(/ThreePointMolly1X/);
  });
});
