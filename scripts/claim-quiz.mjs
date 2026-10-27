// Lists quiz sessions, or links one to an account without the browser's edit
// cookie (e.g. a quiz taken in another browser or before signing up).
//
// Usage: npm run quiz:claim                                list sessions
//        npm run quiz:claim -- <slug> <email> [private]    link a quiz to an account
//        ENV_FILE=.env.cloud npm run quiz:claim -- <slug> <email>

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import { Client } from "pg";

const [slug, email, visibility = "public"] = process.argv.slice(2);
if (slug && (!email || !["public", "private"].includes(visibility))) {
  console.error("usage: npm run quiz:claim -- <slug> <email> [public|private]");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  if (!slug) {
    const { rows } = await client.query(
      `select q.slug, q.status, q.target_mode as mode, jsonb_array_length(q.answers) as answers,
              coalesce(u.email, '') as owner, q.visibility,
              to_char(q.created_at, 'YYYY-MM-DD HH24:MI') as created,
              to_char(q.completed_at, 'YYYY-MM-DD HH24:MI') as completed
         from quiz_sessions q
         left join auth.users u on u.id = q.owner_id
        order by (q.status = 'complete') desc, q.created_at desc`,
    );
    console.table(rows);
  } else {
    const { rows } = await client.query(
      `update quiz_sessions q
          set owner_id = u.id, visibility = $3, claimed_at = now(), updated_at = now()
         from auth.users u
        where q.slug = $1 and lower(u.email) = lower($2)
        returning q.slug`,
      [slug, email.trim(), visibility],
    );
    if (rows.length) console.log(`Quiz ${slug} now belongs to ${email} (${visibility}).`);
    else {
      console.error(`No quiz ${slug} or no account for ${email}.`);
      process.exitCode = 1;
    }
  }
} finally {
  await client.end();
}
