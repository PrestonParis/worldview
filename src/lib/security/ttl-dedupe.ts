// Small per-instance promise cache for burst coalescing. It is intentionally
// volatile: exact addresses must not be retained in a shared persistent cache.
export class TtlDedupe<Value> {
  private readonly entries = new Map<string, { expires: number; value: Promise<Value> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string, load: () => Promise<Value>): Promise<Value> {
    const now = Date.now();
    const existing = this.entries.get(key);
    if (existing && existing.expires > now) return existing.value;
    if (existing) this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    const value = load().catch((error) => {
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, { expires: now + this.ttlMs, value });
    return value;
  }
}

export const normalizePrivateCacheKey = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();
