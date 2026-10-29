-- Application abuse protection. Fixed-window counters are shared by every
-- Vercel instance; only irreversible hashes of client identifiers are stored.
-- Expired counters and anonymous analytics are removed by the application's
-- guarded retention pass (src/lib/security/retention.ts).

CREATE TABLE IF NOT EXISTS "request_rate_limits" (
  "scope" text NOT NULL,
  "identity_hash" text NOT NULL,
  "window_start" timestamptz NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  "expires_at" timestamptz NOT NULL,
  PRIMARY KEY ("scope", "identity_hash", "window_start")
);
CREATE INDEX IF NOT EXISTS "request_rate_limits_expires_idx" ON "request_rate_limits" ("expires_at");

CREATE TABLE IF NOT EXISTS "security_maintenance" (
  "task" text PRIMARY KEY,
  "last_run" timestamptz NOT NULL DEFAULT '-infinity'
);
INSERT INTO "security_maintenance" ("task") VALUES ('abuse-retention') ON CONFLICT DO NOTHING;

ALTER TABLE "request_rate_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security_maintenance" ENABLE ROW LEVEL SECURITY;
