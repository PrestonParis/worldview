// Parquet downloads published to the lake (scripts/export-lake.mjs), as
// catalogued in lake_files.

import { inArray } from "drizzle-orm";
import { db } from "./client";
import { RECORD_DATASETS } from "./records";
import { lakeFiles } from "./schema";

export interface LakeDownload {
  label: string;
  url: string;
  rows: number;
  bytes: number;
  builtAt: string;
}

export function lakeUrl(objectPath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lake/${objectPath}`;
}

// A dataset's files: its area_stats extract, or for a record dataset, one
// file per table it fills.
export async function datasetDownloads(slug: string): Promise<LakeDownload[]> {
  const record = RECORD_DATASETS[slug];
  const wanted = record
    ? record.tables.map((t) => ({ path: `tables/${t.from.split(/\s/)[0]}.parquet`, label: t.label }))
    : [{ path: `area-stats/${slug}.parquet`, label: "All values" }];
  const files = await db.select().from(lakeFiles).where(inArray(lakeFiles.path, wanted.map((w) => w.path)));
  const byPath = new Map(files.map((f) => [f.path, f]));
  return wanted.flatMap(({ path, label }) => {
    const file = byPath.get(path);
    return file
      ? [{ label, url: lakeUrl(path), rows: file.rows, bytes: file.bytes, builtAt: file.builtAt.toISOString() }]
      : [];
  });
}
