import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Called opportunistically by anonymous write paths. The database guard means
// only one request per day performs cleanup, regardless of instance count.
export async function maybeRunAbuseRetention(force = false): Promise<boolean> {
  if (!force && Math.random() >= 0.02) return false;
  const claimed = await db.execute(sql`
    update security_maintenance
    set last_run = now()
    where task = 'abuse-retention'
      and (last_run < now() - interval '1 day' or ${force})
    returning task
  `);
  if (!claimed.rows.length) return false;

  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from request_rate_limits where expires_at < now()`);
    await tx.execute(sql`delete from quiz_opener_events where created_at < now() - interval '90 days'`);
    await tx.execute(sql`
      delete from quiz_sessions
      where owner_id is null
        and status = 'in_progress'
        and updated_at < now() - interval '30 days'
    `);
  });
  console.info("[abuse:retention] expired counters, opener events, and abandoned quizzes removed");
  return true;
}
