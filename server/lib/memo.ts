/**
 * In-memory LRU memoization for aggregate results, keyed by the stable hash
 * of a run manifest minus generatedAt (session-lifecycle.md v4 §5).
 *
 * Determinism makes the manifest the archive: same manifest identity ⇒ same
 * aggregates, so a repeated WebUI request is a cache hit or a fast recompute.
 * The server never persists trajectories — only aggregates are memoized.
 *
 * TODO(v4 §5): an optional Firestore-backed cache behind a flag was
 * considered, but Firestore is not among the server's existing dependencies
 * — adding it would be new infrastructure. Revisit if/when the deploy
 * gains a Firestore client for other reasons.
 */
export class LruCache<V> {
  private map = new Map<string, V>();

  constructor(private readonly maxEntries = 50) {}

  get(key: string): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    // Refresh recency: Map iteration order is insertion order.
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxEntries) {
      this.map.delete(this.map.keys().next().value as string);
    }
  }

  get size(): number {
    return this.map.size;
  }
}
