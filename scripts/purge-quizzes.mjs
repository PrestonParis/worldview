// Deletes political-quiz sessions nobody claimed within 7 days
// (docs/quiz-plan.md). Claimed quizzes are never touched. The app already
// hides expired unclaimed quizzes, so this only reclaims the rows.
//
// Usage: node scripts/purge-quizzes.mjs
//        ENV_FILE=.env.cloud node scripts/purge-quizzes.mjs

try {
  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
} catch {
  // CI injects DATABASE_URL via .env.local; locally it may already be set.
}

import { Client } from "pg";

const TTL_DAYS = 7; // keep in sync with UNCLAIMED_TTL_DAYS in src/lib/db/quizSessions.ts

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rowCount } = await client.query(
    `delete from quiz_sessions where owner_id is null and created_at < now() - make_interval(days => $1)`,
    [TTL_DAYS],
  );
  console.log(`Purged ${rowCount} unclaimed quiz${rowCount === 1 ? "" : "zes"} older than ${TTL_DAYS} days`);
} finally {
  await client.end();
}
