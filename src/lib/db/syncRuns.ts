import { eq, desc } from "drizzle-orm";
import { db } from "./client";
import { syncRuns } from "./schema";

export interface SyncRun {
  id: string;
  source: string;
  startedAt: string;
  finishedAt: string | null;
  status: "ok" | "error" | "partial";
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  error: string | null;
  cursor: string | null;
}

function toSyncRun(row: typeof syncRuns.$inferSelect): SyncRun {
  return {
    id: row.id,
    source: row.source,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    status: (row.status as SyncRun["status"]) ?? "ok",
    rowsInserted: row.rowsInserted,
    rowsUpdated: row.rowsUpdated,
    rowsSkipped: row.rowsSkipped,
    error: row.error,
    cursor: row.cursor,
  };
}

// The most recent finished run for a source — its `cursor` is where the
// next incremental run resumes, and its status/finishedAt drive the
// freshness line.
export async function latestSyncRun(source: string): Promise<SyncRun | null> {
  const row = await db.query.syncRuns.findFirst({
    where: eq(syncRuns.source, source),
    orderBy: [desc(syncRuns.startedAt)],
  });
  return row ? toSyncRun(row) : null;
}

export async function latestSyncRuns(sources: string[]): Promise<Map<string, SyncRun>> {
  const out = new Map<string, SyncRun>();
  for (const source of sources) {
    const run = await latestSyncRun(source);
    if (run) out.set(source, run);
  }
  return out;
}
