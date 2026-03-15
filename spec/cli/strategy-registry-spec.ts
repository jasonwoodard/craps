import { BUILT_IN_STRATEGIES, lookupStrategy } from '../../src/cli/strategy-registry';

describe('BUILT_IN_STRATEGIES', () => {
  const expectedNames = [
    'ThreePointMolly',
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
});

describe('lookupStrategy', () => {
  it('returns the strategy for a known name', () => {
    const strategy = lookupStrategy('PassLineOnly');
    expect(typeof strategy).toBe('function');
  });

  it('returns different strategies for different names', () => {
    const a = lookupStrategy('Place6And8');
    const b = lookupStrategy('ThreePointMolly');
    expect(a).not.toBe(b);
  });

  it('throws a descriptive error for an unknown name', () => {
    expect(() => lookupStrategy('NotAStrategy')).toThrowError(/Unknown strategy "NotAStrategy"/);
  });

  it('error message lists available strategies', () => {
    expect(() => lookupStrategy('Nope')).toThrowError(/ThreePointMolly/);
  });
});
