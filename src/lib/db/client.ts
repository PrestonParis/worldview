import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in " +
      "(run `npm run infra:up` first if you're using the local stack).",
  );
}

export const db = drizzle(connectionString, { schema });
