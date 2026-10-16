// Deletes political-quiz sessions nobody claimed within 7 days
// (docs/quiz-plan.md). Claimed quizzes are never touched. The app already
// hides expired unclaimed quizzes, so this only reclaims the rows. Each answer
// log is first copied to quiz_responses without its slug, edit token, or id,
// so the quiz stats keep it while the link stops working.
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
  await client.query("begin");
  const expired = `owner_id is null and created_at < now() - make_interval(days => $1)`;
  const { rowCount: archived } = await client.query(
    `insert into quiz_responses (bank_version, engine_version, target_mode, highest_completed_mode, status,
       entry_variant, entry_topic, answers, refine, deferred, checkpoint_history, is_test, created_at, updated_at, completed_at)
     select bank_version, engine_version, target_mode, highest_completed_mode, status,
       entry_variant, entry_topic, answers, refine, deferred, checkpoint_history, is_test, created_at, updated_at, completed_at
     from quiz_sessions where ${expired}`,
    [TTL_DAYS],
  );
  const { rowCount } = await client.query(`delete from quiz_sessions where ${expired}`, [TTL_DAYS]);
  await client.query("commit");
  console.log(`Purged ${rowCount} unclaimed quiz${rowCount === 1 ? "" : "zes"} older than ${TTL_DAYS} days (${archived} answer logs archived)`);
} catch (err) {
  await client.query("rollback");
  throw err;
} finally {
  await client.end();
}
