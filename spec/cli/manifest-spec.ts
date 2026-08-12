import { buildManifest, manifestHash, MANIFEST_SCHEMA_VERSION } from '../../src/cli/manifest';
import { LruCache } from '../../server/lib/memo';

describe('run manifest (v4 §5)', () => {
  it('embeds the canonical spec, tableMin, and engine version', () => {
    const m = buildManifest({
      strategySpec: 'CATS@tableMin=15,entry=littleMolly',
      bankroll: 450,
      rolls: 300,
      seeds: { count: 100 },
    });
    expect(m.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(m.strategySpec).toBe('CATS@entry=littleMolly,tableMin=15'); // canonicalized
    expect(m.tableMin).toBe(15); // derived from the spec
    expect(m.bankroll).toBe(450);
    expect(m.rolls).toBe(300);
    expect(m.seeds).toEqual({ count: 100 });
    expect(m.engineVersion.length).toBeGreaterThan(0);
    expect(() => new Date(m.generatedAt)).not.toThrow();
  });

  it('defaults tableMin to 10 when the spec does not carry it', () => {
    const m = buildManifest({ strategySpec: 'CATS', bankroll: 300, rolls: 300, seeds: { seed: 7 } });
    expect(m.tableMin).toBe(10);
    expect(m.strategySpec).toBe('CATS');
  });

  it('hash is stable across generatedAt and key order, and sensitive to identity fields', () => {
    const a = buildManifest({ strategySpec: 'CATS', bankroll: 300, rolls: 300, seeds: { count: 10 } });
    const b = { ...a, generatedAt: '1999-01-01T00:00:00Z' };
    expect(manifestHash(b as any)).toBe(manifestHash(a));

    const c = { ...a, bankroll: 301 };
    expect(manifestHash(c as any)).not.toBe(manifestHash(a));
    const d = { ...a, strategySpec: 'CATS@entry=littleMolly' };
    expect(manifestHash(d as any)).not.toBe(manifestHash(a));
  });
});

describe('LruCache', () => {
  it('evicts the least-recently-used entry at capacity', () => {
    const lru = new LruCache<number>(2);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.get('a');        // refresh a — b is now oldest
    lru.set('c', 3);     // evicts b
    expect(lru.get('a')).toBe(1);
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('c')).toBe(3);
    expect(lru.size).toBe(2);
  });
});
