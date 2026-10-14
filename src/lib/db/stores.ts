// area_stats lives in two databases: Supabase (`db`) holds as much as fits
// under its plan's size cap, and Neon (`neonDb`) holds the overflow. Every
// dataset's rows sit wholly in one of them, recorded in datasets.storage
// (which stays in Supabase); scripts/db-rebalance.mjs moves datasets between
// the two and the importers route writes the same way (scripts/lib/stores.mjs).

import { eq } from "drizzle-orm";
import { db, neonDb, type Db } from "./client";
import { datasets } from "./schema";

// Placements change only when a dataset is moved; the rebalance script
// waits out this TTL before deleting the old copy.
const TTL_MS = 60_000;
let cached: { at: number; neon: Promise<Set<string>> } | null = null;

function neonSources(): Promise<Set<string>> {
  if (!neonDb) return Promise.resolve(new Set());
  if (cached && Date.now() - cached.at < TTL_MS) return cached.neon;
  const neon = db
    .select({ slug: datasets.slug })
    .from(datasets)
    .where(eq(datasets.storage, "neon"))
    .then((rows) => new Set(rows.map((r) => r.slug)))
    .catch((err) => {
      cached = null;
      throw err;
    });
  cached = { at: Date.now(), neon };
  return neon;
}

// The database holding one dataset's area_stats rows.
export async function dbFor(source: string): Promise<Db> {
  return neonDb && (await neonSources()).has(source) ? neonDb : db;
}

// Splits items keyed by dataset into one group per database, for queries
// that span datasets.
export async function bySource<T>(items: T[], source: (item: T) => string): Promise<[Db, T[]][]> {
  if (!neonDb) return items.length ? [[db, items]] : [];
  const neon = await neonSources();
  const groups = new Map<Db, T[]>();
  for (const item of items) {
    const target = neon.has(source(item)) ? neonDb : db;
    groups.set(target, [...(groups.get(target) ?? []), item]);
  }
  return [...groups];
}
