import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// supabase/sql/2026-10-15-rls-lockdown.sql closed the Supabase Data API on
// every table that existed then; each table created after it must turn RLS
// on itself, or the public anon key can reach it.
const DIR = "supabase/sql";
const LOCKDOWN = "2026-10-15-rls-lockdown.sql";

describe("supabase/sql migrations", () => {
  const later = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql") && f > LOCKDOWN)
    .sort();

  it.each(later.length ? later : [null])("%s enables RLS on every table it creates", (file) => {
    if (!file) return;
    const sql = readFileSync(path.join(DIR, file), "utf8");
    for (const [, table] of sql.matchAll(/CREATE TABLE IF NOT EXISTS "(\w+)"/gi)) {
      expect(sql, `${file} creates "${table}" without RLS`).toMatch(
        new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`, "i"),
      );
    }
  });
});
