// Side-effect import: load .env.local before any module that reads
// process.env at evaluation time (src/lib/db/client.ts throws if
// DATABASE_URL is unset). ES modules evaluate imports in source order, so
// importing this FIRST guarantees the env is populated before the app's
// db / neo4j layers are pulled in.
import { existsSync } from "node:fs";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
