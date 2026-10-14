import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in " +
      "(run `npm run infra:up` first if you're using the local stack).",
  );
}

// Every serverless instance holds its own pool, and the Supabase pooler caps
// clients across all of them, so instances on Vercel keep only a few
// connections each and release idle ones quickly.
const pool = process.env.VERCEL
  ? { max: 3, idleTimeoutMillis: 5_000 }
  : { max: 10 };

export const db = drizzle({ connection: { connectionString, ...pool }, schema });
export type Db = typeof db;

// Neon holds the area_stats rows of datasets that don't fit in Supabase
// (src/lib/db/stores.ts). Unset means one database holds everything, as in
// the local stack.
export const neonDb: Db | null = process.env.NEON_DATABASE_URL
  ? drizzle({ connection: { connectionString: process.env.NEON_DATABASE_URL, ...pool }, schema })
  : null;
