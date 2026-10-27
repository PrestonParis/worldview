import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present — fine in CI, where DATABASE_URL is injected directly.
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local before running drizzle-kit.",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
